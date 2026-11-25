"""Real factory, catalog loader, hybrid orchestration and Gemini REST parser; offline I/O."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient
from grounding_support import write_artifacts
from hybrid_support import hybrid
from indexing_support import TODAY
from test_faq_runtime import payload

import app.main as main
from app.orchestration.faq import Faq
from app.providers.gemini import Gemini
from app.retrieval.hybrid import HybridFaqIndex
from app.settings import Settings


@pytest.fixture
def factory(tmp_path, monkeypatch):
    index = HybridFaqIndex(hybrid(tmp_path, TODAY))
    _, grounding = write_artifacts(index)
    requests, answers = [], []
    controls = {"mode": "ok", "query": "wifi", "count": 10}

    async def handle(request):
        body = json.loads(request.content)
        requests.append((request.url.path, body))
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": controls["count"]})
        title = body["generationConfig"]["responseJsonSchema"]["title"]
        if title == "Probe":
            value = {"ok": True}
        elif title == "Intent":
            value = {"intent": "faq", "query": controls["query"]}
        else:
            from grounding_support import proposal

            data = json.loads(body["contents"][0]["parts"][0]["text"])
            answers.append(data)
            # Find the actual Wi-Fi passage, rather than trusting retrieval rank as proof.
            cid = next(e["citationId"] for e in data["evidence"] if "WIFI" in e["sectionId"])
            value = proposal(cid)
            mode = controls["mode"]
            if mode == "legacy":
                value = {"supported": True, "answer": "Jacuzzi available", "citationIds": [cid]}
            elif mode == "reference":
                value["claims"][0]["supportRefs"][0]["citationId"] = "invented"
            elif mode == "missing":
                value["claims"][0]["supportRefs"] = []
            elif mode == "extra":
                value["claims"].append({"claimId": "secret", "text": "Jacuzzi available"})
            elif mode == "qualifier":
                value["claims"][0]["qualifierIds"] = []
            elif mode == "abstain":
                value = proposal(cid, supported=False)
            elif mode == "drift":
                grounding.catalog_path.write_bytes(grounding.catalog_path.read_bytes() + b" ")
        text = json.dumps(value)
        if title == "CandidateDraft" and controls["mode"] == "duplicate_claims":
            # The first claim must not disappear when the last duplicate key wins.
            text = (
                '{"schemaVersion":"d1-claim-proposal-2","decision":"propose_answer",'
                '"claims":[{"claimId":"extra","text":"Jacuzzi available"}],"claims":'
                + json.dumps(value["claims"])
                + "}"
            )
        return httpx.Response(
            200,
            json={
                "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": text}]}}],
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
            },
        )

    async def create_index(_):
        return index

    real_gemini = Gemini
    monkeypatch.setattr(main, "create_hybrid_index", create_index)
    monkeypatch.setattr(
        main, "Gemini", lambda key, model: real_gemini(key, model, httpx.MockTransport(handle))
    )
    settings = Settings(
        _env_file=None,
        service_token="test-service",
        gemini_key="offline-key",
        corpus_mode="demo_synthetic",
        grounding=grounding,
    )
    return settings, index, controls, requests, answers


def post(client):
    data = payload()
    return client.post(
        "/internal/assistant/turn",
        json=data,
        headers={
            "Authorization": "Bearer test-service",
            "X-Request-ID": data["requestId"],
        },
    )


@pytest.mark.parametrize(
    "mode,status,decision",
    [
        ("ok", 200, "answered"),
        ("qualifier", 200, "insufficient_evidence"),
        ("abstain", 200, "insufficient_evidence"),
        ("legacy", 502, "AI_PROTOCOL_ERROR"),
        ("reference", 502, "AI_PROTOCOL_ERROR"),
        ("missing", 502, "AI_PROTOCOL_ERROR"),
        ("extra", 502, "AI_PROTOCOL_ERROR"),
        ("duplicate_claims", 502, "AI_PROTOCOL_ERROR"),
        ("drift", 503, "DEPENDENCY_UNAVAILABLE"),
    ],
)
def test_default_factory_releases_only_verified_facts(factory, mode, status, decision):
    settings, index, controls, requests, answers = factory
    controls["mode"] = mode
    assert settings.retrieval_mode == "hybrid"
    with TestClient(main.create_app(settings)) as client:
        assert client.get("/ready").status_code == 200
        result = post(client)
        assert result.status_code == status
        body = result.json()
        if status == 200:
            assert body["final"]["status"] == decision
            if decision == "answered":
                assert body["final"]["answer"] == "Trong demo, Wi-Fi có tại sảnh."
                assert body["evidence"] == answers[0]["evidence"]
                assert all(
                    c["citationId"] in {e["citationId"] for e in body["evidence"]}
                    for c in body["final"]["citations"]
                )
            else:
                assert body["final"]["citations"] == []
        else:
            assert body["error"]["code"] == decision and "final" not in body
        assert client.get("/ready").status_code == (503 if mode == "drift" else 200)
    assert len(answers) == 1 and len(requests) == 6  # probe/classify/answer: count + generate
    assert "Jacuzzi" not in result.text
    assert len(index.retriever.embedder.calls) == 1


def test_missing_catalog_cannot_reach_generation_or_legacy_path(factory, monkeypatch):
    settings, _, _, requests, _ = factory
    settings = settings.model_copy(
        update={"grounding": settings.grounding.model_copy(update={"catalog_path": None})}
    )
    monkeypatch.setattr(
        main, "KnowledgeIndex", lambda *_: pytest.fail("No implicit legacy fallback")
    )
    with TestClient(main.create_app(settings)) as client:
        assert client.get("/ready").status_code == 503
        assert post(client).status_code == 503
    assert requests == []


def test_context_budget_checks_actual_count_before_answer_dispatch(factory):
    settings, _, _, requests, answers = factory
    settings = settings.model_copy(
        update={"grounding": settings.grounding.model_copy(update={"context_input_tokens": 9})}
    )
    with TestClient(main.create_app(settings)) as client:
        result = post(client)
        assert result.status_code == 503 and result.json()["error"]["code"] == "BUDGET_EXCEEDED"
        assert client.get("/ready").status_code == 200  # Budget is not dependency corruption.
    assert answers == [] and len(requests) == 5
    assert requests[-1][0].endswith(":countTokens")


@pytest.mark.parametrize("observed_count,status", [(10, 200), (9, 503)])
def test_context_cap_inclusive_boundary_and_actual_usage_recheck(factory, observed_count, status):
    settings, _, controls, requests, answers = factory
    controls["count"] = observed_count
    settings = settings.model_copy(
        update={
            "grounding": settings.grounding.model_copy(
                update={"context_input_tokens": observed_count}
            )
        }
    )
    with TestClient(main.create_app(settings)) as client:
        result = post(client)
        assert result.status_code == status
        if status == 503:
            assert (
                result.json()["error"]["code"] == "BUDGET_EXCEEDED" and "final" not in result.json()
            )
        else:
            assert result.json()["final"]["status"] == "answered"
    assert len(requests) == 6 and len(answers) == 1


@pytest.mark.parametrize("empty_query", [False, True])
def test_empty_hybrid_evidence_never_dispatches_answer(factory, monkeypatch, empty_query):
    settings, index, controls, requests, answers = factory
    if empty_query:
        controls["query"] = "   "
    else:
        monkeypatch.setattr(index.retriever, "bm25", lambda *_args, **_kw: ())

        async def empty(*_args, **_kw):
            return []

        monkeypatch.setattr(index.retriever.vector, "search", empty)
    with TestClient(main.create_app(settings)) as client:
        result = post(client)
        assert result.status_code == 200
        assert result.json()["final"]["status"] == "insufficient_evidence"
        assert result.json()["evidence"] == result.json()["final"]["citations"] == []
    assert len(requests) == 4 and not answers


def test_faq_without_gate_fails_before_any_provider_call(factory):
    import asyncio

    from app.providers.contracts import DependencyError
    from app.schemas.turn import TurnRequest

    _, index, _, _, _ = factory

    class Never:
        async def generate(self, *_):
            pytest.fail("Ungated path reached provider")

    with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
        asyncio.run(
            Faq(Never(), index, "demo_synthetic").run(TurnRequest.validate_python(payload()))
        )


def test_unexpected_renderer_failure_is_500_without_answer_or_abstention(factory, monkeypatch):
    from app.orchestration.verification import renderer

    settings, _, _, _, _ = factory

    def broken(*_):
        raise RuntimeError("synthetic private implementation detail")

    monkeypatch.setattr(renderer, "render", broken)
    with TestClient(main.create_app(settings), raise_server_exceptions=False) as client:
        result = post(client)
        assert result.status_code == 500
        assert result.json()["error"]["code"] == "INTERNAL_ERROR"
        assert "final" not in result.json() and "private" not in result.text
