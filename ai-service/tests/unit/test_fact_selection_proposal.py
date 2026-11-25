"""Slice 1 regression tests for slim FactSelectionProposal wire schema & host gate checks."""

import json

import httpx
import pytest
from fastapi.testclient import TestClient
from grounding_support import write_artifacts
from hybrid_support import hybrid
from indexing_support import TODAY
from pydantic import ValidationError
from test_faq_runtime import payload
from verification_support import TL, TW, fixture

import app.main as main
from app.orchestration.verification import VerificationGate
from app.orchestration.verification.catalog import digest
from app.orchestration.verification.gate import ABSTENTION
from app.orchestration.verification.settings import GroundingConfig
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini, _gemini_schema
from app.retrieval.hybrid import HybridFaqIndex
from app.schemas.verification import FactSelectionProposal
from app.settings import Settings


def _sel(decision="propose_answer", fact_ids=("F_L",), abstain_reason=None):
    return {
        "schemaVersion": "d1-fact-selection-1",
        "decision": decision,
        "factIds": list(fact_ids),
        "abstainReason": abstain_reason,
    }


def test_fact_selection_wire_schema_is_compact_and_validates_strictly():
    wire = _gemini_schema(FactSelectionProposal.model_json_schema())
    encoded = json.dumps(wire, ensure_ascii=False)
    assert wire["title"] == "FactSelectionProposal"
    assert len(encoded) < 600
    assert '"const"' not in encoded and '"$defs"' not in encoded

    ok = FactSelectionProposal.model_validate_json(json.dumps(_sel()))
    assert ok.decision == "propose_answer" and ok.factIds == ("F_L",) and ok.abstainReason is None

    ab = FactSelectionProposal.model_validate_json(
        json.dumps(_sel("abstain", (), "insufficient_evidence"))
    )
    assert ab.decision == "abstain" and ab.factIds == ()
    assert ab.abstainReason == "insufficient_evidence"

    # Reject duplicate JSON fields.
    dup_field = (
        '{"schemaVersion":"d1-fact-selection-1","decision":"propose_answer",'
        '"factIds":["F_W"],"factIds":["F_L"],"abstainReason":null}'
    )
    with pytest.raises(ValueError, match="Duplicate JSON field"):
        FactSelectionProposal.model_validate_json(dup_field)

    # Reject duplicate factIds, inconsistent decision, unexpected abstainReason, extra fields.
    for bad in (
        _sel("propose_answer", ("F_L", "F_L")),
        _sel("propose_answer", ()),
        _sel("abstain", ("F_L",), "reason"),
        _sel("propose_answer", ("F_L",), "should-be-null"),
        {**_sel(), "extra": "nope"},
    ):
        with pytest.raises(ValidationError):
            FactSelectionProposal.model_validate_json(json.dumps(bad))


def test_gate_accepts_valid_selection_and_constructs_verified_claims_internally():
    f = fixture()
    gate = VerificationGate(f.load())
    turn = gate.prepare(
        f.context(), f.data["questionRules"][0]["aliases"][0], f.evidence, TurnBudget()
    )
    assert turn.needs_candidate is True

    result = gate.prepare(
        f.context(), f.data["questionRules"][0]["aliases"][0], f.evidence, TurnBudget()
    ).verify(_sel("propose_answer", ("F_L",)))
    assert result.outcome == "verified"
    assert result.reason == "all_supported"
    assert result.verifiedFactSet is not None
    assert result.verifiedFactSet.factIds == ("F_L",)

    out = turn.final_payload(_sel("propose_answer", ("F_L",)))
    assert out["final"]["status"] == "answered"
    assert out["final"]["answer"] == TL
    assert len(out["final"]["citations"]) == 1


def test_gate_rejects_unknown_unoffered_duplicate_and_out_of_binding_fact_ids():
    f = fixture()
    gate = VerificationGate(f.load())
    question = f.data["questionRules"][0]["aliases"][0]

    # Unknown fact ID -> invalid -> protocol error in final_payload.
    turn = gate.prepare(f.context(), question, f.evidence, TurnBudget())
    res = turn.verify(_sel("propose_answer", ("F_INVENTED",)))
    assert res.outcome == "invalid" and res.reason == "schema_invalid"
    with pytest.raises(DependencyError) as exc:
        turn.final_payload(_sel("propose_answer", ("F_INVENTED",)))
    assert exc.value.code == "AI_PROTOCOL_ERROR"

    # Existing catalog fact whose evidence chunk was NOT retrieved (not in offeredFacts).
    only_late = [f.evidence[0]]
    turn_partial = gate.prepare(
        f.context(registryHash=digest(only_late)), question, only_late, TurnBudget()
    )
    assert "F_L" in turn_partial.offered_fact_ids
    assert "F_W" not in turn_partial.offered_fact_ids
    res_unoffered = turn_partial.verify(_sel("propose_answer", ("F_W",)))
    assert res_unoffered.outcome == "invalid" and res_unoffered.reason == "schema_invalid"

    # Fact in offeredFacts but outside permittedFactKeys of the bound question -> abstain.
    turn_all = gate.prepare(f.context(), question, f.evidence, TurnBudget())
    assert "F_W" in turn_all.offered_fact_ids
    res_outside = turn_all.verify(_sel("propose_answer", ("F_W",)))
    assert res_outside.outcome == "abstain" and res_outside.reason == "outside_question_binding"

    # Duplicate factIds in raw JSON -> invalid.
    raw_dup = json.dumps(_sel("propose_answer", ("F_L", "F_L")))
    assert turn_all.verify(raw_dup).outcome == "invalid"


def test_gate_never_autofills_missing_requirements_on_multi_fact_rule():
    f = fixture()
    # Make rule 0 require BOTH L and W facts.
    f.data["questionRules"][0]["requirements"].append(f.data["questionRules"][1]["requirements"][0])
    f.data["questionRules"][0]["permittedFactKeys"] = ["L", "W"]
    f.publish()

    gate = VerificationGate(f.load())
    question = f.data["questionRules"][0]["aliases"][0]
    turn = gate.prepare(f.context(), question, f.evidence, TurnBudget())
    assert turn.needs_candidate is True
    assert set(turn.offered_fact_ids) >= {"F_L", "F_W"}

    # Model selects only F_L and omits F_W -> host MUST abstain (never auto-fill F_W).
    missing = turn.verify(_sel("propose_answer", ("F_L",)))
    assert missing.outcome == "abstain" and missing.reason == "missing_claim_coverage"
    out_missing = turn.final_payload(_sel("propose_answer", ("F_L",)))
    assert out_missing["final"]["status"] == "insufficient_evidence"
    assert out_missing["final"]["answer"] == ABSTENTION
    assert out_missing["final"]["citations"] == []

    # Model explicitly abstains -> host abstains.
    ab = turn.verify(_sel("abstain", (), "insufficient_evidence"))
    assert ab.outcome == "abstain" and ab.reason == "model_abstained"

    # Model selects BOTH F_L and F_W -> verified and rendered with both facts.
    ok = turn.final_payload(_sel("propose_answer", ("F_W", "F_L")))
    assert ok["final"]["status"] == "answered"
    assert TL in ok["final"]["answer"] and TW in ok["final"]["answer"]
    assert len(ok["final"]["citations"]) == 2


def test_create_app_factory_with_fact_selection_proposal_mode_end_to_end(tmp_path, monkeypatch):
    index = HybridFaqIndex(hybrid(tmp_path, TODAY))
    _, base_grounding = write_artifacts(index)
    grounding = GroundingConfig(
        **{**base_grounding.model_dump(), "proposal_mode": "fact_selection"}
    )
    controls = {"mode": "ok"}
    seen_schemas = []

    async def handle(request):
        body = json.loads(request.content)
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 10})
        schema = body["generationConfig"]["responseJsonSchema"]
        title = schema["title"]
        seen_schemas.append((title, len(json.dumps(schema))))
        if title == "Probe":
            text = json.dumps({"ok": True})
        elif title == "Intent":
            text = json.dumps({"intent": "faq", "query": "wifi"})
        else:
            assert title == "FactSelectionProposal"
            data = json.loads(body["contents"][0]["parts"][0]["text"])
            assert "supportRefs" not in data["offeredFacts"][0]
            if controls["mode"] == "ok":
                text = json.dumps(_sel("propose_answer", ("F_W",)))
            elif controls["mode"] == "abstain":
                text = json.dumps(_sel("abstain", (), "insufficient_evidence"))
            elif controls["mode"] == "invented":
                text = json.dumps(_sel("propose_answer", ("F_UNKNOWN",)))
            elif controls["mode"] == "duplicate_json_key":
                text = (
                    '{"schemaVersion":"d1-fact-selection-1","decision":"propose_answer",'
                    '"factIds":["F_BAD"],"factIds":["F_W"],"abstainReason":null}'
                )
            else:
                raise AssertionError(controls["mode"])
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

    def _post(client):
        data = payload()
        return client.post(
            "/internal/assistant/turn",
            json=data,
            headers={"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]},
        )

    with TestClient(main.create_app(settings)) as client:
        ok = _post(client)
        assert ok.status_code == 200
        assert ok.json()["final"]["status"] == "answered"
        assert len(ok.json()["final"]["citations"]) == 1
        assert any(t == "FactSelectionProposal" and sz < 600 for t, sz in seen_schemas)

        controls["mode"] = "abstain"
        ab = _post(client)
        assert ab.status_code == 200
        assert ab.json()["final"]["status"] == "insufficient_evidence"
        assert ab.json()["final"]["citations"] == []

        controls["mode"] = "invented"
        inv = _post(client)
        assert inv.status_code == 502 and inv.json()["error"]["code"] == "AI_PROTOCOL_ERROR"

        controls["mode"] = "duplicate_json_key"
        dup = _post(client)
        assert dup.status_code == 502 and dup.json()["error"]["code"] == "AI_PROTOCOL_ERROR"
