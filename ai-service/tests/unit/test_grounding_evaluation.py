import asyncio

from tests.evaluation.evaluate_grounding import evaluate


def test_synthetic_gold_contract_and_independent_review_counterexample():
    report = asyncio.run(evaluate())
    assert report["cases"] == report["contract_pass"] == 27
    assert report["answer_correctness"] == {"correct": 4, "total": 5}
    assert report["groundedness"] == {"supported_claims": 5, "total_claims": 6}
    assert report["citation_identity"] == {"correct": 5, "total": 5}
    assert report["semantic_acceptance"] is False
    failures = [r["id"] for r in report["results"] if r["semantic_correct"] is False]
    assert failures == ["g20-review-mistake"]
