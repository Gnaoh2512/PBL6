"""Slice 2 regression tests for D-A13 15-minute deadline & mandatory conditions in catalog v3."""

import json
from datetime import date

import pytest

from app.academic_demo_contract import read_contract
from app.academic_demo_preflight import ReadOnlyPairedIndex
from app.indexing import ChunkingConfig, EmbeddingProfile
from app.ingestion.snapshot import ROOT
from app.orchestration.verification import VerificationGate
from app.orchestration.verification.artifacts import source_view
from app.orchestration.verification.catalog import VerifiedCatalog, component_hashes, digest
from app.orchestration.verification.gate import ABSTENTION
from app.orchestration.verification.questions import bind_question
from app.providers.contracts import TurnBudget
from app.retrieval.hybrid import HybridRetriever
from app.schemas.verification import Source, VerificationContext

POLICY_TODAY = date(2026, 11, 25)
CONTRACT_PATH = ROOT / "academic-demo.contract.json"
D_A13_QUERY = (
    "Theo ví dụ báo giá được duyệt R=2.550.000 VND, cọc khả dụng 510.000: "
    "cần nộp lại cả 765.000 không?"
)


def _load_pinned_v3():
    contract = read_contract(CONTRACT_PATH)
    g = contract.environment.AI_GROUNDING
    cat_path = ROOT / g.catalog_path
    if not cat_path.exists():
        pytest.skip("Pinned local v3 catalog not present in workspace")
    raw = cat_path.read_bytes()
    data = json.loads(raw)
    sources = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in data["sources"]
    )
    catalog = VerifiedCatalog(
        lambda: raw,
        expected_hash=g.catalog_sha256,
        authorities=frozenset(g.authorities),
        source_reader=lambda: sources,
    )
    return contract, catalog


def test_d_a13_requires_both_topup_rule_and_15_minute_deadline_conditions_in_v3():
    contract, catalog = _load_pinned_v3()
    assert contract.environment.AI_GROUNDING.proposal_mode == "fact_selection"
    assert catalog.data.catalogVersion == "academic-policies-2026-11-25-v3"
    assert len(catalog.data.facts) == 42

    binding = bind_question(catalog, D_A13_QUERY)
    assert binding.status == "bound"
    assert binding.key == "q-pol03-modify-increase-deposit"
    req_keys = [r.factKey for r in binding.requirements]
    assert req_keys == [
        "pol03.modify_increase_topup_rule",
        "pol03.modify_increase_deadline_conditions",
    ]
    assert binding.requirements[1].unit == "minute"

    index = ReadOnlyPairedIndex(
        "demo_synthetic",
        None,
        None,
        root=ROOT,
        profile=EmbeddingProfile(),
        chunking=ChunkingConfig(),
        source_pack="academic_policies",
    )
    manifest = index.local_active(POLICY_TODAY)
    retriever = HybridRetriever(index, None, None)
    _, _, _, _, all_evidence = source_view(index, POLICY_TODAY)
    by_chunk = {e.chunkId: e for e in all_evidence}
    bm25_hits = retriever.bm25(D_A13_QUERY, manifest, POLICY_TODAY)[:3]
    selected_evidence = [
        by_chunk[h.chunk.chunk_id] for h in bm25_hits if h.chunk.chunk_id in by_chunk
    ]
    assert any(e.sectionId == "POL-03-U04" for e in selected_evidence)

    vocab_h, rules_h, rend_h = component_hashes(catalog.data)
    ctx = VerificationContext.model_validate_json(
        json.dumps(
            {
                "requestId": "req-d-a13-v3",
                "conversationId": "00000000-0000-4000-8000-000000000013",
                "turnId": "00000000-0000-4000-8000-000000000014",
                "diagnosticId": "00000000-0000-4000-8000-000000000015",
                "registryTurnId": "00000000-0000-4000-8000-000000000014",
                "asOfDate": POLICY_TODAY.isoformat(),
                "mode": "demo_synthetic",
                "snapshotId": catalog.data.snapshotId,
                "registryHash": digest([e.model_dump(mode="json") for e in selected_evidence]),
                "catalogHash": catalog.expected_hash,
                "vocabularyHash": vocab_h,
                "questionRulesHash": rules_h,
                "rendererHash": rend_h,
            }
        )
    )
    gate = VerificationGate(catalog)
    turn = gate.prepare(ctx, D_A13_QUERY, selected_evidence, TurnBudget())
    assert turn.needs_candidate is True
    assert {
        "pol03-modify-increase-topup-v1",
        "pol03-modify-increase-deadline-conditions-v1",
    }.issubset(set(turn.offered_fact_ids))

    # Model omits the 15-minute deadline fact -> host MUST abstain (never auto-fill).
    missing_deadline = turn.final_payload(
        {
            "schemaVersion": "d1-fact-selection-1",
            "decision": "propose_answer",
            "factIds": ["pol03-modify-increase-topup-v1"],
            "abstainReason": None,
        }
    )
    assert missing_deadline["final"]["status"] == "insufficient_evidence"
    assert missing_deadline["final"]["answer"] == ABSTENTION
    assert missing_deadline["final"]["citations"] == []

    # Model selects BOTH facts -> verified canonical rendering includes 15-minute UTC+07:00 & no 0-tx rule.
    complete = turn.final_payload(
        {
            "schemaVersion": "d1-fact-selection-1",
            "decision": "propose_answer",
            "factIds": [
                "pol03-modify-increase-topup-v1",
                "pol03-modify-increase-deadline-conditions-v1",
            ],
            "abstainReason": None,
        }
    )
    assert complete["final"]["status"] == "answered"
    answer = complete["final"]["answer"]
    assert "15 phút" in answer
    assert "UTC+07:00" in answer
    assert "không tạo giao dịch 0" in answer
    assert "không thu lại toàn bộ cọc mới" in answer
    assert any(c["sectionId"] == "POL-03-U04" for c in complete["final"]["citations"])
