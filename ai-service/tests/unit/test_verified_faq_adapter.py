"""FAQ opt-in wiring with labeled fakes; no HTTP, Gemini, filesystem, or snapshots."""

import asyncio
import json
from uuid import uuid4

import pytest
from verification_support import TL, fixture

from app.orchestration.faq import Faq
from app.orchestration.verification import VerificationGate
from app.orchestration.verification.gate import ABSTENTION
from app.providers.contracts import DependencyError, Evidence
from app.schemas.faq import Intent
from app.schemas.turn import TurnRequest
from app.schemas.verification import CandidateDraft


class FakeIndex:
    snapshot_id = "SX"

    def __init__(self, f):
        self.evidence, self.searches = f.evidence, []

    def validate(self, today):
        pass

    def search(self, query, today):
        self.searches.append(query)
        return [Evidence.model_validate_json(json.dumps(e)) for e in self.evidence]


class LabeledTypedProvider:
    def __init__(self, f, mode):
        self.fixture, self.mode, self.calls = f, mode, []

    async def generate(self, instruction, data, schema, budget):
        self.calls.append((data, schema, budget))
        budget.reserve(10)
        budget.record(10, 5)
        if schema is Intent:
            return Intent(
                intent="unavailable" if self.mode == "capability" else "faq", query="model rewrite"
            )
        assert schema is CandidateDraft
        if self.mode == "cancel":
            raise asyncio.CancelledError()
        if self.mode == "legacy":
            return {"supported": True, "answer": "Unchecked model draft", "citationIds": ["CL"]}
        if self.mode == "drift":
            self.fixture.raw += b" "
        p = self.fixture.proposal("F_L")
        if self.mode == "unsupported":
            p["claims"][0]["value"]["data"] = True
        return CandidateDraft.model_validate_json(json.dumps(p))


def payload(message):
    return TurnRequest.validate_python(
        {
            "phase": "start",
            "requestId": "req-d120",
            "conversationId": str(uuid4()),
            "turnId": str(uuid4()),
            "message": message,
            "history": [],
            "allowedTools": ["search_knowledge"],
            "context": {
                "today": "2026-11-13",
                "locale": "vi-VN",
                "timeZone": "Asia/Ho_Chi_Minh",
                "currency": "VND",
            },
            "budget": {
                "remainingMs": 20000,
                "remainingToolCalls": 1,
                "remainingBrokerBatches": 0,
                "remainingInputTokens": 8000,
                "remainingOutputTokens": 2000,
            },
        }
    )


@pytest.mark.parametrize(
    "mode,status", [("supported", "answered"), ("unsupported", "insufficient_evidence")]
)
def test_opt_in_uses_typed_schema_and_shared_budget_without_supported_boolean(mode, status):
    f = fixture()
    index, provider = FakeIndex(f), LabeledTypedProvider(f, mode)
    request = payload(f.data["questionRules"][0]["aliases"][0])
    faq = Faq(provider, index, "demo_synthetic", verification_gate=VerificationGate(f.load()))
    result = asyncio.run(faq.run(request))
    assert result["requestId"] == request.requestId and result["turnId"] == str(request.turnId)
    assert result["final"]["status"] == status
    assert result["final"]["answer"] == (TL if mode == "supported" else ABSTENTION)
    assert len(provider.calls) == 2 and len(index.searches) == 1
    assert provider.calls[0][2] is provider.calls[1][2]
    assert provider.calls[1][2].remaining_ms == 20000 and provider.calls[1][2].calls == 2
    assert result["usage"]["inputTokensUsed"] == 20 and result["usage"]["outputTokensUsed"] == 10
    sent = provider.calls[1][0]
    assert sent["requiredFactKeys"] == ["L"]  # Bound to original message, not model rewrite.
    assert "approval" not in json.dumps(sent) and "authorityRef" not in json.dumps(sent)


def test_unknown_question_does_not_get_authority_from_classifier_or_call_answer():
    f = fixture()
    provider, index = LabeledTypedProvider(f, "supported"), FakeIndex(f)
    faq = Faq(provider, index, "demo_synthetic", verification_gate=VerificationGate(f.load()))
    result = asyncio.run(faq.run(payload("Demo jacuzzi?")))
    assert result["final"]["status"] == "insufficient_evidence"
    assert len(provider.calls) == len(index.searches) == 1


@pytest.mark.parametrize(
    "mode,error", [("legacy", "AI_PROTOCOL_ERROR"), ("drift", "DEPENDENCY_UNAVAILABLE")]
)
def test_opt_in_has_no_legacy_or_dependency_fallback(mode, error):
    f = fixture()
    provider = LabeledTypedProvider(f, mode)
    faq = Faq(
        provider, FakeIndex(f), "demo_synthetic", verification_gate=VerificationGate(f.load())
    )
    with pytest.raises(DependencyError) as caught:
        asyncio.run(faq.run(payload(f.data["questionRules"][0]["aliases"][0])))
    assert caught.value.code == error and len(provider.calls) == 2


def test_capability_template_and_cancellation_remain_existing_flow():
    f = fixture()
    provider = LabeledTypedProvider(f, "capability")
    index = FakeIndex(f)
    faq = Faq(provider, index, "demo_synthetic", verification_gate=VerificationGate(f.load()))
    result = asyncio.run(faq.run(payload("Booking?")))
    assert result["final"]["status"] == "capability_unavailable"
    assert result["final"]["citations"] == [] and not index.searches and len(provider.calls) == 1
    provider.mode = "cancel"
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(faq.run(payload(f.data["questionRules"][0]["aliases"][0])))


@pytest.mark.parametrize("field", ["chunkId", "sectionId"])
def test_valid_citation_id_with_wrong_chunk_metadata_fails_before_answer(field):
    f = fixture()
    f.evidence[0][field] = "different-chunk-or-section"
    provider = LabeledTypedProvider(f, "supported")
    faq = Faq(
        provider, FakeIndex(f), "demo_synthetic", verification_gate=VerificationGate(f.load())
    )
    with pytest.raises(DependencyError) as caught:
        asyncio.run(faq.run(payload(f.data["questionRules"][0]["aliases"][0])))
    assert caught.value.code == "DEPENDENCY_UNAVAILABLE"
    assert len(provider.calls) == 1 and provider.calls[0][1] is Intent
