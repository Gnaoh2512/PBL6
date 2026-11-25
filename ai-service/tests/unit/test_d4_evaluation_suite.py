"""Unit verification for the 80-case D1-D4 evaluation suite and offline runner."""

import json

from tests.evaluation.run_d4_eval import (
    CORE_GROUPS,
    SUITE_PATH,
    SUPPLEMENTARY_GROUPS,
    evaluate_d4_suite,
    validate_suite_structure,
)


def test_d4_suite_meets_evaluation_md_structure_and_split_invariants():
    suite = json.loads(SUITE_PATH.read_text(encoding="utf-8"))
    info = validate_suite_structure(suite)
    assert info["totalCases"] == 80
    assert info["coreCases"] == 60
    assert info["supplementaryCases"] == 20
    assert info["paraphraseLeakage"] == 0
    for group in CORE_GROUPS:
        assert info["groupCounts"][group] == 10
    for group in SUPPLEMENTARY_GROUPS:
        assert info["groupCounts"][group] >= 6


def test_d4_offline_evaluation_suite_passes_all_80_cases():
    report = evaluate_d4_suite()
    assert report["failedCases"] == []
    assert report["summary"]["passed"] == 80
    assert report["summary"]["total"] == 80
    assert report["summary"]["devPassed"] == report["summary"]["devTotal"]
    assert report["summary"]["heldOutPassed"] == report["summary"]["heldOutTotal"]
