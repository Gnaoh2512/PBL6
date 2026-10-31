"""Explicitly opted-in, bounded live Gemini extraction evaluation."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import time
from collections import defaultdict
from pathlib import Path
from zoneinfo import ZoneInfo

from ai_service.evaluation.dataset import DATA_DIR, load_rooms, load_scenarios
from ai_service.evaluation.offline import FIXED_NOW, _git_commit, replay_case
from ai_service.infrastructure.llm import (
    ExtractionError,
    ExtractionRateLimited,
    GeminiExtractor,
)


def _compare(reference, actual) -> dict[str, bool]:
    expected = {change.field.value: (change.action, change.value) for change in reference.changes}
    observed = {change.field.value: (change.action, change.value) for change in actual.changes}
    return {
        "setExact": {key for key, (action, _) in expected.items() if action == "SET"}
        == {key for key, (action, _) in observed.items() if action == "SET"},
        "clearExact": {key for key, (action, _) in expected.items() if action == "CLEAR"}
        == {key for key, (action, _) in observed.items() if action == "CLEAR"},
        "setClearExact": {key: action for key, (action, _) in expected.items()}
        == {key: action for key, (action, _) in observed.items()},
        "fieldValuesExact": {
            key: value for key, (action, value) in expected.items() if action == "SET"
        } == {
            key: value for key, (action, value) in observed.items() if action == "SET"
        },
        "ambiguitiesExact": set(reference.ambiguities) == set(actual.ambiguities),
        "unsupportedExact": reference.unsupported_intent == actual.unsupported_intent,
    }


async def evaluate_live(
    *, split: str, max_requests: int, timeout_seconds: float, min_interval_seconds: float,
    api_key: str, model: str,
) -> dict:
    scenarios = [case for case in load_scenarios() if case.split == split]
    rooms = load_rooms().rooms
    extractor = GeminiExtractor(
        api_key=api_key,
        model=model,
        timezone_name="Asia/Ho_Chi_Minh",
        timeout_seconds=timeout_seconds,
    )
    rows = []
    attempted = 0
    stopped_for_rate_limit = False
    try:
        for case in scenarios:
            _, contexts = await replay_case(case, rooms)
            for index, turn in enumerate(case.turns):
                if attempted >= max_requests or stopped_for_rate_limit:
                    break
                if attempted:
                    await asyncio.sleep(min_interval_seconds)
                message, state = contexts[index]
                attempted += 1
                started = time.perf_counter()
                try:
                    result, usage = await extractor.extract_with_metadata(
                        message, state,
                        today=FIXED_NOW.astimezone(ZoneInfo("Asia/Ho_Chi_Minh")).date(),
                        request_id=f"live-eval-{case.id}-{index}",
                    )
                    scores = _compare(turn.reference_patch, result)
                    error = None
                except ExtractionError as exc:
                    usage = None
                    scores = None
                    error = type(exc).__name__
                    if isinstance(exc, ExtractionRateLimited):
                        stopped_for_rate_limit = True
                rows.append({
                    "scenarioId": case.id,
                    "split": case.split,
                    "group": case.group,
                    "turn": index + 1,
                    "latencyMs": round((time.perf_counter() - started) * 1000, 2),
                    "usage": usage,
                    "error": error,
                    "scores": scores,
                })
            if attempted >= max_requests or stopped_for_rate_limit:
                break
    finally:
        await extractor.aclose()

    metric_names = (
        "setExact", "clearExact", "setClearExact", "fieldValuesExact",
        "ambiguitiesExact", "unsupportedExact",
    )
    grouped = defaultdict(lambda: {
        "attempted": 0, "completed": 0, "errors": 0,
        "metrics": {name: {"correct": 0, "total": 0} for name in metric_names},
    })
    for row in rows:
        bucket = grouped[row["group"]]
        bucket["attempted"] += 1
        bucket["completed"] += int(row["scores"] is not None)
        bucket["errors"] += int(row["error"] is not None)
        if row["scores"] is not None:
            for name in metric_names:
                bucket["metrics"][name]["total"] += 1
                bucket["metrics"][name]["correct"] += int(row["scores"][name])
    completed = [row["scores"] for row in rows if row["scores"] is not None]
    usage_totals = defaultdict(int)
    for row in rows:
        for key, value in (row["usage"] or {}).items():
            usage_totals[key] += value
    return {
        "evaluation": "live-gemini-extraction-only",
        "commit": _git_commit(),
        "datasetVersion": "scenarios-provisional-v1",
        "labelStatus": "provisional",
        "split": split,
        "model": model,
        "config": {
            "maxRequests": max_requests,
            "timeoutSeconds": timeout_seconds,
            "minIntervalSeconds": min_interval_seconds,
            "fixedReferenceDate": FIXED_NOW.isoformat(),
        },
        "attempted": attempted,
        "completed": len(completed),
        "stoppedForRateLimit": stopped_for_rate_limit,
        "metrics": {
            name: {
                "correct": sum(score[name] for score in completed),
                "total": len(completed),
            }
            for name in metric_names
        },
        "usageTotalsWhenProvided": dict(usage_totals),
        "byGroup": dict(sorted(grouped.items())),
        "cases": rows,
        "limitations": [
            "Provisional reference labels need user review.",
            "Prior-turn state is replayed from reference patches, not earlier Gemini predictions.",
            "This evaluates extraction only; it does not test Spring/MySQL or ranking quality.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-live-gemini", action="store_true", required=True)
    parser.add_argument("--split", choices=("dev", "heldout"), required=True)
    parser.add_argument("--max-requests", type=int, required=True)
    parser.add_argument("--timeout-seconds", type=float, default=10.0)
    parser.add_argument("--min-interval-seconds", type=float, default=1.0)
    parser.add_argument("--output", type=Path, default=DATA_DIR / "reports" / "gemini-live.json")
    args = parser.parse_args()
    if not 1 <= args.max_requests <= 100:
        parser.error("--max-requests must be between 1 and 100")
    if not 0 < args.timeout_seconds <= 30:
        parser.error("--timeout-seconds must be in (0, 30]")
    if not 0 <= args.min_interval_seconds <= 30:
        parser.error("--min-interval-seconds must be in [0, 30]")
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        parser.error("GEMINI_API_KEY must be set in the environment")
    report = asyncio.run(evaluate_live(
        split=args.split,
        max_requests=args.max_requests,
        timeout_seconds=args.timeout_seconds,
        min_interval_seconds=args.min_interval_seconds,
        api_key=api_key,
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    ))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}: {report['attempted']} attempted, {report['completed']} completed")


if __name__ == "__main__":
    main()
