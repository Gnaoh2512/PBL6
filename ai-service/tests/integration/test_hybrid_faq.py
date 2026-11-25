import asyncio

import pytest
from fastapi.testclient import TestClient
from grounding_support import gate_for, write_artifacts
from hybrid_support import hybrid
from indexing_support import TODAY
from test_faq_runtime import LabeledFakeProvider, payload
from verification_support import fixture as verification_fixture

from app.indexing import IndexingError
from app.main import create_app
from app.orchestration.faq import Faq
from app.orchestration.verification import VerificationGate
from app.providers.contracts import DependencyError
from app.retrieval.hybrid import HybridFaqIndex
from app.schemas.faq import Probe
from app.schemas.turn import TurnRequest
from app.settings import Settings


@pytest.fixture
def retrieval(tmp_path):
    return hybrid(tmp_path, TODAY)


def test_faq_hybrid_uses_existing_prompt_envelope_and_citations(retrieval):
    generation = LabeledFakeProvider()
    index = HybridFaqIndex(retrieval)
    data = payload()
    result = asyncio.run(
        Faq(generation, index, "demo_synthetic", verification_gate=gate_for(index)).run(
            TurnRequest.validate_python(data)
        )
    )
    assert result["final"]["status"] == "answered"
    assert len(generation.calls) == 2 and len(retrieval.embedder.calls) == 1
    shared = retrieval.embedder.calls[0][1]
    assert shared.calls == 2 and shared.input_used == 20 and shared.output_used == 20
    assert result["final"]["citations"][0]["citationId"] == result["evidence"][0]["chunkId"]
    assert set(result["evidence"][0]) == {
        "citationId",
        "documentId",
        "version",
        "chunkId",
        "sectionId",
        "title",
        "sourceRef",
        "excerpt",
        "corpusMode",
    }
    assert not set(result) & {"retrieval_debug", "rrf_score"}


@pytest.mark.parametrize(
    "error,status,code",
    [
        ("QDRANT_UNAVAILABLE", 503, "DEPENDENCY_UNAVAILABLE"),
        ("QDRANT_TIMEOUT", 504, "DEADLINE_EXCEEDED"),
        ("EMBEDDING_PROTOCOL_ERROR", 502, "AI_PROTOCOL_ERROR"),
    ],
)
def test_faq_hybrid_errors_keep_existing_api_mapping_and_no_answer_call(
    retrieval, error, status, code
):
    if error.startswith("EMBEDDING"):
        retrieval.embedder.error = error
    else:
        retrieval.vector.error = error
    generation = LabeledFakeProvider()
    data = payload()
    settings = Settings(_env_file=None, service_token="test-service", corpus_mode="demo_synthetic")
    # ready endpoint also validates Qdrant; turn still demonstrates mapped retrieval failure.
    with TestClient(
        create_app(
            settings,
            faq=Faq(
                generation,
                HybridFaqIndex(retrieval),
                "demo_synthetic",
                verification_gate=gate_for(HybridFaqIndex(retrieval)),
            ),
        )
    ) as client:
        response = client.post(
            "/internal/assistant/turn",
            json=data,
            headers={"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]},
        )
        assert response.status_code == status and response.json()["error"]["code"] == code
        assert len(generation.calls) == 1
        if status == 503:
            assert client.get("/ready").status_code == 503


def test_faq_deadline_cancels_embedding_inside_unchanged_shared_budget(retrieval, monkeypatch):
    closed = []

    async def wait(*_):
        try:
            await asyncio.Event().wait()
        finally:
            closed.append(True)

    monkeypatch.setattr(retrieval.embedder, "query", wait)
    data = payload()
    data["budget"]["remainingMs"] = 50
    generation = LabeledFakeProvider()
    with pytest.raises(TimeoutError):
        asyncio.run(
            Faq(
                generation,
                HybridFaqIndex(retrieval),
                "demo_synthetic",
                verification_gate=gate_for(HybridFaqIndex(retrieval)),
            ).run(TurnRequest.validate_python(data))
        )
    assert closed == [True] and len(generation.calls) == 1


def test_factory_opt_in_loads_hybrid_without_legacy_index_and_closes_resources(
    retrieval, monkeypatch
):
    import app.main as main

    owned = []
    index = HybridFaqIndex(retrieval)

    async def factory(settings):
        owned.append("created")
        return index

    original = index.close

    async def close():
        owned.append("closed")
        await original()

    index.close = close

    class Provider(LabeledFakeProvider):
        def __init__(self, *_):
            super().__init__()

        async def generate(self, system, data, schema, budget):
            if schema is Probe:
                return Probe(ok=True)
            return await super().generate(system, data, schema, budget)

        async def close(self):
            owned.append("generation_closed")

    monkeypatch.setattr(main, "create_hybrid_index", factory)
    monkeypatch.setattr(main, "Gemini", Provider)
    settings = Settings(
        _env_file=None,
        gemini_key="offline-placeholder",
        service_token="test-service",
        retrieval_mode="hybrid",
        corpus_mode="demo_synthetic",
    )
    settings = settings.model_copy(update={"grounding": write_artifacts(index)[1]})
    assert settings.index_path is None
    with TestClient(create_app(settings)) as client:
        assert client.get("/ready").status_code == 200
    assert owned == ["created", "generation_closed", "closed"]


def test_factory_missing_hybrid_snapshot_fails_closed_without_legacy_fallback(monkeypatch):
    import app.main as main

    async def fail(_):
        raise IndexingError("INDEX_NOT_AVAILABLE")

    monkeypatch.setattr(main, "create_hybrid_index", fail)
    monkeypatch.setattr(main, "KnowledgeIndex", lambda *_: pytest.fail("no BM25 fallback"))
    settings = Settings(
        _env_file=None,
        gemini_key="offline-placeholder",
        service_token="test-service",
        retrieval_mode="hybrid",
    )
    with TestClient(create_app(settings)) as client:
        assert client.get("/ready").status_code == 503


def test_existing_semantic_gate_rejects_stale_catalog_instead_of_trusting_hybrid_scores(retrieval):
    generation = LabeledFakeProvider()
    gate = VerificationGate(verification_fixture().load())
    faq = Faq(generation, HybridFaqIndex(retrieval), "demo_synthetic", verification_gate=gate)
    with pytest.raises(DependencyError) as error:
        asyncio.run(faq.run(TurnRequest.validate_python(payload())))
    assert error.value.code == "DEPENDENCY_UNAVAILABLE"
    assert (
        len(generation.calls) == 1
    )  # No answer/schema-v2 generation after stale snapshot binding.


def test_redaction_expansion_of_model_query_keeps_protocol_error_contract(retrieval):
    from app.schemas.faq import Intent

    class QueryProvider(LabeledFakeProvider):
        async def generate(self, system, data, schema, budget):
            self.calls.append(data)
            assert schema is Intent
            return Intent(intent="faq", query="a@b.co " * 285)

    provider = QueryProvider()
    with pytest.raises(DependencyError) as error:
        asyncio.run(
            Faq(
                provider,
                HybridFaqIndex(retrieval),
                "demo_synthetic",
                verification_gate=gate_for(HybridFaqIndex(retrieval)),
            ).run(TurnRequest.validate_python(payload()))
        )
    assert error.value.code == "AI_PROTOCOL_ERROR" and len(provider.calls) == 1
    assert not retrieval.embedder.calls
