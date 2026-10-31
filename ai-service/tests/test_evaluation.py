import asyncio
import json
import sys

import pytest
from pydantic import ValidationError

import ai_service.evaluation.gemini_live as live
from ai_service.application.recommendation.conversation_models import ExtractedChanges
from ai_service.evaluation.dataset import RankingCase, load_ranking, load_rooms, load_scenarios
from ai_service.evaluation.gemini_live import _compare
from ai_service.evaluation.gemini_live import main as live_main
from ai_service.evaluation.metrics import ndcg_at_k
from ai_service.evaluation.offline import evaluate
from ai_service.infrastructure.llm import ExtractionRateLimited, ExtractionTimeout


def test_synthetic_dataset_loads_with_disjoint_scenario_ids_and_provisional_labels() -> None:
    scenarios = load_scenarios()
    assert len(scenarios) >= 60
    assert len({case.id for case in scenarios}) == len(scenarios)
    assert {case.split for case in scenarios} == {"dev", "heldout"}
    assert all(case.source == "synthetic" and case.label_status == "provisional"
               for case in scenarios)
    assert len(load_rooms().rooms) >= 8
    assert all(case.label_status == "provisional" for case in load_ranking().cases)


def test_loader_rejects_unknown_state_label(tmp_path) -> None:
    source = json.loads((load_scenarios()[0]).model_dump_json(by_alias=True))
    source["turns"][0]["expectedState"] = {"inventedPrice": 1}
    path = tmp_path / "bad.jsonl"
    path.write_text(json.dumps(source), encoding="utf-8")
    with pytest.raises(ValueError, match="line 1"):
        load_scenarios(path)


def test_ranking_schema_requires_complete_independent_labels() -> None:
    source = load_ranking().cases[0].model_dump(by_alias=True, mode="json")
    source["relevance"].pop("101")
    with pytest.raises(ValidationError, match="every eligible room"):
        RankingCase.model_validate(source)


def test_ndcg_at_k_perfect_reversed_and_zero_relevance() -> None:
    labels = {1: 3, 2: 1, 3: 0}
    assert ndcg_at_k([1, 2, 3], labels, 3) == pytest.approx(1.0)
    assert ndcg_at_k([3, 2, 1], labels, 3) < 1.0
    assert ndcg_at_k([1, 2], {1: 0, 2: 0}, 2) == 0.0
    with pytest.raises(ValueError, match="lacks a relevance label"):
        ndcg_at_k([3], {1: 2}, 1)


def test_offline_runner_checks_state_errors_hard_filters_and_same_candidates() -> None:
    report = asyncio.run(evaluate())
    assert report["dataset"]["scenarioCount"] >= 60
    assert report["conversation"]["passedTurns"] == report["dataset"]["turnCount"]
    assert report["conversation"]["hardViolationCount"] == 0
    assert report["conversation"]["noMatchTechnicalConfusions"] == 0
    assert report["ranking"]["allSameEligibleCandidates"]
    assert report["ranking"]["allEligibleSetsMatchLabels"]
    assert any(not case["hasRelevanceLabels"] for case in report["ranking"]["cases"])
    assert all(case["baseline"]["nDCG@5"] is None
               for case in report["ranking"]["cases"] if not case["hasRelevanceLabels"])


def test_live_script_requires_explicit_opt_in_before_network(monkeypatch) -> None:
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setattr(sys, "argv", ["gemini_live", "--split", "dev", "--max-requests", "1"])
    with pytest.raises(SystemExit) as exc:
        live_main()
    assert exc.value.code == 2


def test_live_metrics_compare_actions_values_ambiguity_and_unsupported_separately() -> None:
    reference = load_scenarios()[0].turns[0].reference_patch
    same = _compare(reference, reference)
    assert all(same.values())
    changed = reference.model_copy(update={"unsupported_intent": True})
    scores = _compare(reference, changed)
    assert scores["setClearExact"] and scores["fieldValuesExact"]
    assert scores["ambiguitiesExact"] and not scores["unsupportedExact"]


def test_live_rate_limit_stops_with_bounded_attempts_and_no_key_in_report(monkeypatch) -> None:
    class FakeRateLimitedExtractor:
        def __init__(self, *, api_key, **_kwargs):
            assert api_key == "test-secret"

        async def extract_with_metadata(self, *_args, **_kwargs):
            raise ExtractionRateLimited("synthetic rate limit")

        async def aclose(self):
            pass

    monkeypatch.setattr(live, "GeminiExtractor", FakeRateLimitedExtractor)
    report = asyncio.run(live.evaluate_live(
        split="dev", max_requests=3, timeout_seconds=2,
        min_interval_seconds=0, api_key="test-secret", model="fake-model",
    ))
    assert report["attempted"] == 1
    assert report["completed"] == 0
    assert report["stoppedForRateLimit"]
    assert "test-secret" not in json.dumps(report)


def test_live_timeout_is_recorded_and_request_cap_includes_failures(monkeypatch) -> None:
    class FakeTimeoutExtractor:
        calls = 0

        def __init__(self, **_kwargs):
            pass

        async def extract_with_metadata(self, *_args, **_kwargs):
            self.calls += 1
            if self.calls == 1:
                raise ExtractionTimeout("synthetic timeout")
            return ExtractedChanges.model_validate({
                "changes": [], "ambiguities": [], "unsupportedIntent": False,
            }), None

        async def aclose(self):
            pass

    monkeypatch.setattr(live, "GeminiExtractor", FakeTimeoutExtractor)
    report = asyncio.run(live.evaluate_live(
        split="dev", max_requests=2, timeout_seconds=2,
        min_interval_seconds=0, api_key="fake", model="fake-model",
    ))
    assert report["attempted"] == 2
    assert report["completed"] == 1
    assert report["cases"][0]["error"] == "ExtractionTimeout"
    assert not report["stoppedForRateLimit"]
