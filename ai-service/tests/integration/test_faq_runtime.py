import asyncio
import json
import re
import shutil
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient
from grounding_support import gate_for, proposal
from http_timing_support import PublicCoreTransport, ScriptedBackend, frames, synthetic_pool
from test_faq_http_deadline import faq_frames

from app.ingestion.snapshot import ROOT, build
from app.main import create_app
from app.orchestration.faq import Faq
from app.providers.contracts import DependencyError
from app.providers.gemini import Gemini
from app.providers.http_timing import get_emitter
from app.retrieval.index import KnowledgeIndex
from app.schemas.faq import Intent
from app.schemas.turn import TurnRequest
from app.schemas.verification import CandidateDraft
from app.settings import Settings


class LabeledFakeProvider:
    """Test-only provider. Never selected by settings or runtime fallback."""

    def __init__(self, kind="answer"):
        self.kind, self.calls = kind, []

    async def generate(self, system, data, schema, budget):
        self.calls.append(data)
        budget.reserve(10)
        budget.record(10, 10)
        if self.kind == "timeout":
            raise DependencyError("DEADLINE_EXCEEDED")
        if self.kind == "dependency":
            raise DependencyError()
        if schema is Intent:
            return Intent(
                intent="unavailable" if self.kind == "booking" else "faq",
                query="rocket astronaut" if self.kind == "missing" else "wifi",
            )
        return CandidateDraft.model_validate_json(
            json.dumps(
                proposal(
                    "invented" if self.kind == "citation" else data["evidence"][0]["citationId"],
                    supported=self.kind != "unsupported",
                )
            )
        )


@pytest.fixture
def ready_runtime(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", date(2026, 11, 13), tmp_path)
    index = KnowledgeIndex(path, "demo_synthetic", date(2026, 11, 13), tmp_path)
    return index


def payload():
    examples = re.findall(
        r"```json\n(.*?)\n```", (ROOT / "docs/API.md").read_text(encoding="utf8"), re.S
    )
    data = next(json.loads(x) for x in examples if json.loads(x).get("phase") == "start")
    data["message"] = "Wi-Fi o dau?"
    data["allowedTools"] = ["search_knowledge"]
    return data


@pytest.mark.parametrize(
    "kind,status,code",
    [
        ("answer", 200, "answered"),
        ("missing", 200, "insufficient_evidence"),
        ("unsupported", 200, "insufficient_evidence"),
        ("booking", 200, "capability_unavailable"),
        ("citation", 502, "AI_PROTOCOL_ERROR"),
        ("timeout", 504, "DEADLINE_EXCEEDED"),
        ("dependency", 503, "DEPENDENCY_UNAVAILABLE"),
    ],
)
def test_full_faq_boundary_with_labeled_fake(ready_runtime, kind, status, code):
    provider = LabeledFakeProvider(kind)
    settings = Settings(_env_file=None, service_token="test-service", corpus_mode="demo_synthetic")
    data = payload()
    with TestClient(
        create_app(
            settings,
            faq=Faq(
                provider, ready_runtime, "demo_synthetic", verification_gate=gate_for(ready_runtime)
            ),
        )
    ) as client:
        assert client.get("/ready").status_code == 200
        response = client.post(
            "/internal/assistant/turn",
            json=data,
            headers={"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]},
        )
        if kind == "dependency":
            assert client.get("/ready").status_code == 503
    assert response.status_code == status
    body = response.json()
    if status != 200:
        assert body["error"]["code"] == code
    else:
        assert body["final"]["status"] == code
        assert body["final"]["corpusMode"] == "demo_synthetic"
        assert body["final"]["cards"] == body["toolCalls"] == []
        if code == "answered":
            assert body["final"]["citations"][0]["chunkId"] == body["evidence"][0]["chunkId"]
    assert len(provider.calls) <= 2
    if kind in {"missing", "booking"}:
        assert len(provider.calls) == 1


def test_prompt_credential_redaction_and_budget(ready_runtime):
    from app.schemas.turn import TurnRequest

    provider = LabeledFakeProvider()
    data = payload()
    data["message"] = "Bearer private-jwt customer@example.invalid +84901234567"
    faq = Faq(provider, ready_runtime, "demo_synthetic", verification_gate=gate_for(ready_runtime))
    asyncio.run(faq.run(TurnRequest.validate_python(data)))
    wire = json.dumps(provider.calls)
    assert "private-jwt" not in wire and "example.invalid" not in wire and "84901234567" not in wire
    data["budget"]["remainingToolCalls"] = 0
    with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
        asyncio.run(faq.run(TurnRequest.validate_python(data)))


def test_http_503_latches_readiness_even_after_direct_provider_recovery(
    ready_runtime, diagnostic_records, timing_records
):
    async def run():
        data = payload()
        citation_id = ready_runtime.search("wifi", date(2026, 11, 13))[0].citationId
        backend = ScriptedBackend(
            frames(b'{"totalTokens":10}')
            # The error body is discarded when the adapter closes this response.
            + frames(b"synthetic unavailable", status=503, combined=True)
            + faq_frames(citation_id) * 2
        )
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        provider = Gemini("synthetic-test-key", "gemini-3.1-flash-lite", transport)
        faq = Faq(
            provider, ready_runtime, "demo_synthetic", verification_gate=gate_for(ready_runtime)
        )
        settings = Settings(
            _env_file=None, service_token="test-service", corpus_mode="demo_synthetic"
        )
        app = create_app(settings, faq=faq)
        auth = {"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]}
        try:
            async with app.router.lifespan_context(app):
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(app), base_url="http://offline.test"
                ) as client:
                    assert (await client.get("/ready")).status_code == 200
                    assert len(transport.extensions) == 0  # No startup/readiness probe.
                    failed = await client.post("/internal/assistant/turn", json=data, headers=auth)
                    assert failed.status_code == 503
                    assert failed.json()["error"]["code"] == "DEPENDENCY_UNAVAILABLE"
                    assert len(transport.extensions) == 2  # Count + generation; no retry.
                    ready = await client.get("/ready")
                    assert ready.status_code == 503
                    assert ready.json()["checks"] == {
                        "configuration": True,
                        "llm": False,
                        "retrieval": True,
                    }
                    assert (await client.get("/health")).status_code == 200
                    blocked = await client.post("/internal/assistant/turn", json=data, headers=auth)
                    assert blocked.status_code == 503
                    assert len(transport.extensions) == 2

                    # The collector's direct FAQ path can recover on this same adapter.
                    direct = await faq.run(TurnRequest.validate_python(data))
                    assert direct["final"]["status"] == "answered"
                    assert len(transport.extensions) == 6
                    assert (await client.get("/ready")).status_code == 503
                    blocked = await client.post("/internal/assistant/turn", json=data, headers=auth)
                    assert blocked.status_code == 503
                    assert len(transport.extensions) == 6

            # A new application has its own latch; no production restart is performed.
            fresh = create_app(settings, faq=faq)
            async with fresh.router.lifespan_context(fresh):
                async with httpx.AsyncClient(
                    transport=httpx.ASGITransport(fresh), base_url="http://offline.test"
                ) as client:
                    assert (await client.get("/ready")).status_code == 200
                    recovered = await client.post(
                        "/internal/assistant/turn", json=data, headers=auth
                    )
                    assert recovered.status_code == 200
                    assert recovered.json()["final"]["status"] == "answered"
                    assert len(transport.extensions) == 10
        finally:
            await provider.close()
        assert transport.closed == 1 and all(s.closed == 1 for s in backend.streams)

    asyncio.run(run())
    assert get_emitter().drain()
    failed = [r for r in timing_records if r["http_status"] == 503]
    assert len(failed) == 1
    event = failed[0]
    assert event["operation"] == "classify" and event["provider_method"] == "generateContent"
    assert event["error_category"] == "http_status" and event["remaining_budget_ms"] > 0
    assert any(
        s["phase"] == "wait_headers" and s["outcome"] == "complete" for s in event["samples"]
    )
    turns = [json.loads(r.getMessage()) for r in diagnostic_records]
    turns = [r for r in turns if r["operation"] == "turn"]
    assert [r["outcome"] for r in turns] == ["error", "success", "success"]
    assert turns[0]["diagnostic_id"] == event["diagnostic_id"]
    assert turns[0]["error_category"] == "http_status"


def test_deadline_does_not_latch_and_next_api_turn_can_succeed(ready_runtime):
    provider = LabeledFakeProvider("timeout")
    settings = Settings(_env_file=None, service_token="test-service", corpus_mode="demo_synthetic")
    data = payload()
    auth = {"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]}
    with TestClient(
        create_app(
            settings,
            faq=Faq(
                provider, ready_runtime, "demo_synthetic", verification_gate=gate_for(ready_runtime)
            ),
        )
    ) as client:
        failed = client.post("/internal/assistant/turn", json=data, headers=auth)
        assert failed.status_code == 504
        assert failed.json()["error"]["code"] == "DEADLINE_EXCEEDED"
        assert client.get("/ready").status_code == 200
        assert len(provider.calls) == 1
        provider.kind = "answer"
        recovered = client.post("/internal/assistant/turn", json=data, headers=auth)
        assert recovered.status_code == 200 and recovered.json()["final"]["status"] == "answered"
        assert len(provider.calls) == 3


@pytest.mark.parametrize(
    "query,supported,status,calls,evidence_count",
    [
        ("jacuzzi", False, "insufficient_evidence", 1, 0),
        ("khách sạn jacuzzi", False, "insufficient_evidence", 1, 3),
        ("khách sạn jacuzzi", True, "insufficient_evidence", 1, 3),
        ("wifi", True, "answered", 2, 1),
    ],
    ids=["empty", "unrelated-abstention", "unrelated-false-positive", "supported-control"],
)
def test_abstention_uses_gate_even_when_provider_would_claim_support(
    ready_runtime, query, supported, status, calls, evidence_count
):
    """Unknown questions cannot reach an answer provider, regardless of its support vote."""
    draft = (
        "Wi-Fi giả lập tại sảnh." if query == "wifi" else "UNSUPPORTED_DRAFT: Jacuzzi available."
    )

    class LabeledSupportProvider:
        def __init__(self):
            self.calls = []

        async def generate(self, system, data, schema, budget):
            self.calls.append((schema, data, budget))
            budget.reserve(10)
            budget.record(10, 10)
            if schema is Intent:
                return Intent(intent="faq", query=query)
            assert schema is CandidateDraft and data["evidence"]
            return CandidateDraft.model_validate_json(
                json.dumps(proposal(data["evidence"][0]["citationId"], supported=supported))
            )

    provider = LabeledSupportProvider()
    data = payload()
    data["message"] = "Wi-Fi ở đâu?" if query == "wifi" else "Demo có jacuzzi không?"
    response = asyncio.run(
        Faq(
            provider, ready_runtime, "demo_synthetic", verification_gate=gate_for(ready_runtime)
        ).run(TurnRequest.validate_python(data))
    )
    final = response["final"]
    assert final["status"] == status
    assert len(provider.calls) == calls
    assert len(response["evidence"]) == evidence_count
    assert len({id(call[2]) for call in provider.calls}) == 1
    assert (
        response["usage"]["inputTokensUsed"] == response["usage"]["outputTokensUsed"] == 10 * calls
    )
    assert response["toolCalls"] == final["cards"] == final["actions"] == []
    if calls == 2:
        assert provider.calls[-1][1]["evidence"] == response["evidence"]
        assert provider.calls[-1][1]["query"] == query
    if status == "insufficient_evidence":
        assert final["answer"] == "Chưa có đủ nguồn để trả lời câu hỏi này."
        assert final["citations"] == [] and draft not in json.dumps(final, ensure_ascii=False)
    else:
        assert final["answer"] == "Trong demo, Wi-Fi có tại sảnh."
        assert final["citations"][0]["citationId"] == response["evidence"][0]["citationId"]
        # The false-positive branch passes identity checks, NOT semantic grounding.
        if query != "wifi":
            assert all("jacuzzi" not in e["excerpt"].lower() for e in response["evidence"])
