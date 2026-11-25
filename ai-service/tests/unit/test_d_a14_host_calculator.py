"""Slice 3 regression tests for deterministic host-side D-A14 hypothetical deposit calculator."""

import json
from datetime import date

import pytest

from app.academic_demo_contract import read_contract
from app.academic_demo_preflight import ReadOnlyPairedIndex
from app.indexing import ChunkingConfig, EmbeddingProfile
from app.ingestion.snapshot import ROOT
from app.orchestration.verification import VerificationGate
from app.orchestration.verification.artifacts import source_view
from app.orchestration.verification.calculator import (
    calculate_deposit_discount_basis,
    evaluate_hypothetical_calculation,
)
from app.orchestration.verification.catalog import VerifiedCatalog, component_hashes, digest
from app.orchestration.verification.gate import ABSTENTION
from app.providers.contracts import TurnBudget
from app.retrieval.hybrid import HybridRetriever
from app.schemas.verification import Source, VerificationContext

POLICY_TODAY = date(2026, 11, 25)
CONTRACT_PATH = ROOT / "academic-demo.contract.json"
D_A14_QUERY = (
    "Giả sử G=1.700.000, giảm phòng A_room=60.000, giảm khác A_other=40.000 VND đều đã được "
    "chấp nhận. Dùng tổng giảm 100.000 để tính cọc không?"
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
    return VerifiedCatalog(
        lambda: raw,
        expected_hash=g.catalog_sha256,
        authorities=frozenset(g.authorities),
        source_reader=lambda: sources,
    )


def _turn_for(catalog: VerifiedCatalog, query: str):
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
    hits = retriever.bm25(query, manifest, POLICY_TODAY)[:3]
    selected = [by_chunk[h.chunk.chunk_id] for h in hits if h.chunk.chunk_id in by_chunk]
    vocab_h, rules_h, rend_h = component_hashes(catalog.data)
    ctx = VerificationContext.model_validate_json(
        json.dumps(
            {
                "requestId": "req-d-a14",
                "conversationId": "00000000-0000-4000-8000-000000000014",
                "turnId": "00000000-0000-4000-8000-000000000015",
                "diagnosticId": "00000000-0000-4000-8000-000000000016",
                "registryTurnId": "00000000-0000-4000-8000-000000000015",
                "asOfDate": POLICY_TODAY.isoformat(),
                "mode": "demo_synthetic",
                "snapshotId": catalog.data.snapshotId,
                "registryHash": digest([e.model_dump(mode="json") for e in selected]),
                "catalogHash": catalog.expected_hash,
                "vocabularyHash": vocab_h,
                "questionRulesHash": rules_h,
                "rendererHash": rend_h,
            }
        )
    )
    return VerificationGate(catalog).prepare(ctx, query, selected, TurnBudget())


def test_deposit_calculator_uses_decimal_round_half_up_and_clamps_to_zero():
    # Exact D-A14 values computed dynamically.
    d14 = calculate_deposit_discount_basis(1_700_000, 60_000, 40_000)
    assert d14["A_bill"] == 100_000
    assert d14["room_net"] == 1_640_000
    assert d14["deposit"] == 492_000

    # Arbitrary non-Gold values.
    other = calculate_deposit_discount_basis(2_000_000, 150_000, 50_000)
    assert other["A_bill"] == 200_000
    assert other["deposit"] == 555_000

    # ROUND_HALF_UP boundary checks (unlike banker's rounding):
    # 30% * 15 = 4.5 -> 5; 30% * 25 = 7.5 -> 8; 30% * 1_000_005 = 300_001.5 -> 300_002.
    assert calculate_deposit_discount_basis(15, 0)["deposit"] == 5
    assert calculate_deposit_discount_basis(25, 0)["deposit"] == 8
    assert calculate_deposit_discount_basis(1_000_005, 0)["deposit"] == 300_002

    # Discount exceeding room total clamps room_net and deposit to 0.
    clamped = calculate_deposit_discount_basis(500_000, 600_000, 50_000)
    assert clamped["room_net"] == 0 and clamped["deposit"] == 0 and clamped["A_bill"] == 650_000


def test_evaluate_hypothetical_calculation_general_vs_missing_invalid_contradictory():
    # General policy question (no hypothetical amounts) -> not_applicable.
    general = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Tính cọc có dùng tổng giảm hóa đơn gồm cả giảm khác ngoài tiền phòng không?",
    )
    assert general.status == "not_applicable"

    # Missing A_room -> abstain.
    missing_a_room = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử G=1.700.000, tổng giảm 100.000 VND. Dùng tổng giảm 100.000 để tính cọc không?",
    )
    assert missing_a_room.status == "abstain"
    assert missing_a_room.reason == "missing_calculation_inputs"

    # Missing G -> abstain.
    missing_g = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử A_room=60.000, A_other=40.000 VND. Dùng tổng giảm 100.000 để tính cọc không?",
    )
    assert missing_g.status == "abstain"
    assert missing_g.reason == "missing_calculation_inputs"

    # Contradictory stated total discount (60k + 40k != 150k) -> abstain.
    conflict = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử G=1.700.000, A_room=60.000, A_other=40.000 VND. Dùng tổng giảm 150.000 để tính cọc không?",
    )
    assert conflict.status == "abstain"
    assert conflict.reason == "conflicting_calculation_inputs"

    # Negative or fractional VND -> abstain.
    negative = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử G=1.700.000, A_room=-60.000, A_other=40.000 VND. Dùng tổng giảm để tính cọc không?",
    )
    assert negative.status == "abstain"
    assert negative.reason == "invalid_calculation_inputs"

    fractional = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử G=1.700.000, A_room=60,5, A_other=40.000 VND. Dùng tổng giảm để tính cọc không?",
    )
    assert fractional.status == "abstain"
    assert fractional.reason == "invalid_calculation_inputs"

    # Unapproved discount -> abstain.
    unapproved = evaluate_hypothetical_calculation(
        "q-pol03-deposit-discount-basis",
        "Giả sử G=1.700.000, A_room=60.000 chưa được chấp nhận, A_other=40.000 VND. Dùng tổng giảm 100.000 để tính cọc không?",
    )
    assert unapproved.status == "abstain"
    assert unapproved.reason == "unapproved_calculation_inputs"


def test_d_a14_end_to_end_gate_computes_492000_without_hardcoding_template_and_abstains_when_missing():
    catalog = _load_pinned_v3()
    # Confirm 492.000 is NEVER hardcoded anywhere in the static catalog templates.
    raw_templates = json.dumps(
        [t.model_dump(mode="json") for t in catalog.data.templates], ensure_ascii=False
    )
    assert "492.000" not in raw_templates and "492000" not in raw_templates

    # 1. Exact D-A14 query through VerificationGate + FactSelectionProposal -> computes 492.000 VND.
    turn = _turn_for(catalog, D_A14_QUERY)
    assert turn.needs_candidate is True
    out = turn.final_payload(
        {
            "schemaVersion": "d1-fact-selection-1",
            "decision": "propose_answer",
            "factIds": ["pol03-deposit-discount-basis-v1"],
            "abstainReason": None,
        }
    )
    assert out["final"]["status"] == "answered"
    ans = out["final"]["answer"]
    assert "A_bill = 100.000 VND" in ans
    assert "492.000 VND" in ans
    assert "cần nhân viên đối soát" in ans
    assert any(c["sectionId"] == "POL-03-U02" for c in out["final"]["citations"])

    # 2. Different fresh inputs -> dynamically computes 555.000 VND (not hardcoded).
    fresh_query = (
        "Giả sử G=2.000.000, giảm phòng A_room=150.000, giảm khác A_other=50.000 VND đều đã được "
        "chấp nhận. Dùng tổng giảm 200.000 để tính cọc không?"
    )
    turn_fresh = _turn_for(catalog, fresh_query)
    assert turn_fresh.needs_candidate is True
    out_fresh = turn_fresh.final_payload(
        {
            "schemaVersion": "d1-fact-selection-1",
            "decision": "propose_answer",
            "factIds": ["pol03-deposit-discount-basis-v1"],
            "abstainReason": None,
        }
    )
    assert out_fresh["final"]["status"] == "answered"
    assert "555.000 VND" in out_fresh["final"]["answer"]
    assert "A_bill = 200.000 VND" in out_fresh["final"]["answer"]

    # 3. Missing A_room in hypothetical query -> preflight abstains BEFORE calling LLM.
    incomplete_query = "Giả sử G=1.700.000, giảm khác A_other=40.000 VND. Dùng tổng giảm 100.000 để tính cọc không?"
    turn_missing = _turn_for(catalog, incomplete_query)
    assert turn_missing.needs_candidate is False
    assert turn_missing.preflight is not None
    assert turn_missing.preflight.reason == "missing_calculation_inputs"
    out_missing = turn_missing.final_payload(None)
    assert out_missing["final"]["status"] == "insufficient_evidence"
    assert out_missing["final"]["answer"] == ABSTENTION
    assert out_missing["final"]["citations"] == []
