"""Reproducible offline evaluation with reference extraction patches and synthetic rooms."""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean
from zoneinfo import ZoneInfo

from ai_service.application.recommendation.amenities import (
    AmenityStatus,
    evidence_for,
    requested_codes,
    status_for,
)
from ai_service.application.recommendation.conversation_models import (
    ConversationRequest,
    SearchState,
)
from ai_service.application.recommendation.conversation_service import ConversationService
from ai_service.application.recommendation.pipeline import RecommendationPipeline
from ai_service.application.recommendation.scoring import BaselineAmenityScorer, MultiCriteriaScorer
from ai_service.evaluation.dataset import (
    DATA_DIR,
    EvaluationTurn,
    RankingCase,
    Scenario,
    load_ranking,
    load_rooms,
    load_scenarios,
)
from ai_service.evaluation.metrics import ndcg_at_k
from ai_service.infrastructure.backend.errors import (
    BackendClientError,
    BackendConnectionError,
    BackendTimeoutError,
)
from ai_service.infrastructure.backend.models import AvailableRoomCandidate
from ai_service.infrastructure.llm import ExtractionTimeout

FIXED_NOW = datetime(2026, 10, 31, 3, tzinfo=timezone.utc)


class ReferenceExtractor:
    def __init__(self, turn: EvaluationTurn, *, fail: bool = False) -> None:
        self.turn = turn
        self.fail = fail

    async def extract(self, message, state, *, today, request_id):
        if self.fail:
            raise ExtractionTimeout("synthetic extractor timeout")
        return self.turn.reference_patch


class SyntheticBackend:
    def __init__(self, rooms: list[AvailableRoomCandidate], mode: str = "normal") -> None:
        self.rooms = rooms
        self.mode = mode
        self.calls = 0

    async def find_available_rooms(self, search, *, request_id):
        self.calls += 1
        if self.mode == "timeout":
            raise BackendTimeoutError("synthetic timeout")
        if self.mode == "connection":
            raise BackendConnectionError("synthetic connection failure")
        return [] if self.mode == "empty" else self.rooms

    async def list_room_types(self, *, request_id):
        return [room.room_type for room in self.rooms]


def _hard_violation(room: AvailableRoomCandidate, state: SearchState) -> bool:
    if (
        room.status != "AVAILABLE"
        or room.check_in_date != state.check_in_date
        or room.check_out_date != state.check_out_date
        or room.nights != (state.check_out_date - state.check_in_date).days
        or room.room_type.capacity < state.guest_count
        or (state.room_type_id is not None and room.room_type.room_type_id != state.room_type_id)
        or (state.min_price is not None and room.price_per_night < state.min_price)
        or (state.max_price is not None and room.price_per_night > state.max_price)
        or (state.total_budget is not None and room.total_room_charge > state.total_budget)
    ):
        return True
    required = requested_codes(state.required_amenities, "requiredAmenities")
    evidence = evidence_for(room.room_type.amenities)
    return any(status_for(evidence, code) is not AmenityStatus.PRESENT for code in required)


async def replay_case(
    case: Scenario, rooms: list[AvailableRoomCandidate]
) -> tuple[list[dict], list[tuple[str, SearchState]]]:
    backend = SyntheticBackend(rooms, mode=case.backend)
    by_id = {room.room_id: room for room in rooms}
    state = case.initial_state
    outcomes: list[dict] = []
    contexts: list[tuple[str, SearchState]] = []
    for index, turn in enumerate(case.turns):
        contexts.append((turn.message, state))
        service = ConversationService(
            backend,
            ReferenceExtractor(turn, fail=case.backend == "extractor_timeout"),
            timezone=ZoneInfo("Asia/Ho_Chi_Minh"),
            clock=lambda: FIXED_NOW,
        )
        violation_ids: list[int] = []
        result_status_mismatch = False
        try:
            response = await service.execute(
                ConversationRequest(message=turn.message, state=state),
                request_id=f"eval-{case.id}-{index}",
            )
            status = response.status.value
            state = response.state
            result_status_mismatch = (
                status == "NO_MATCH" and response.result is not None
                and response.result.status.value != "NO_MATCH"
            )
            for recommended in response.result.recommendations if response.result else []:
                if _hard_violation(by_id[recommended.room_id], state):
                    violation_ids.append(recommended.room_id)
        except (BackendClientError, ExtractionTimeout) as exc:
            status = "TECHNICAL_ERROR"
            error = type(exc).__name__
        else:
            error = None
        actual_state = state.model_dump(by_alias=True, mode="json")
        state_mismatches = {
            field: {"expected": expected, "actual": actual_state.get(field)}
            for field, expected in turn.expected_state.items()
            if actual_state.get(field) != expected
        }
        passed = (
            status == turn.expected_status
            and backend.calls == turn.expected_backend_calls
            and not state_mismatches
            and not violation_ids
            and not result_status_mismatch
        )
        outcomes.append({
            "scenarioId": case.id,
            "split": case.split,
            "group": case.group,
            "turn": index + 1,
            "expectedStatus": turn.expected_status,
            "actualStatus": status,
            "expectedBackendCalls": turn.expected_backend_calls,
            "actualBackendCalls": backend.calls,
            "stateMismatches": state_mismatches,
            "hardViolationRoomIds": violation_ids,
            "resultStatusMismatch": result_status_mismatch,
            "technicalError": error,
            "pass": passed,
        })
    return outcomes, contexts


def _git_commit() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=DATA_DIR.parent, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def _mean_ndcg(rows: list[dict]) -> dict[str, float | None]:
    labeled = [row for row in rows if row["hasRelevanceLabels"]]
    return {
        name: round(mean(row[name]["nDCG@5"] for row in labeled), 6) if labeled else None
        for name in ("baseline", "multiCriteria")
    }


async def _ranking_row(case: RankingCase, rooms: list[AvailableRoomCandidate]) -> dict:
    versions = {}
    for name, scorer in (
        ("baseline", BaselineAmenityScorer()),
        ("multiCriteria", MultiCriteriaScorer()),
    ):
        backend = SyntheticBackend(rooms)
        result = await RecommendationPipeline(
            backend, scorer=scorer, clock=lambda: FIXED_NOW
        ).execute(case.request, request_id=f"eval-{case.id}-{name}")
        ids = [room.room_id for room in result.recommendations]
        versions[name] = {
            "scoringVersion": result.scoring_version,
            "order": ids,
            "eligibleSetMatchesLabel": set(ids) == set(case.eligible_room_ids),
            "backendCalls": backend.calls,
            "nDCG@5": round(ndcg_at_k(ids, case.relevance, 5), 6)
            if case.relevance is not None else None,
        }
    return {
        "id": case.id,
        "split": case.split,
        "labelStatus": case.label_status,
        "hasRelevanceLabels": case.relevance is not None,
        "sameEligibleCandidates": (
            set(versions["baseline"]["order"]) == set(versions["multiCriteria"]["order"])
        ),
        **versions,
    }


async def evaluate(split: str = "all") -> dict:
    scenarios = [case for case in load_scenarios() if split == "all" or case.split == split]
    rooms_fixture = load_rooms()
    ranking_data = load_ranking()
    ranking_cases = [case for case in ranking_data.cases if split == "all" or case.split == split]
    outcomes = []
    for case in scenarios:
        case_outcomes, _ = await replay_case(case, rooms_fixture.rooms)
        outcomes.extend(case_outcomes)
    grouped = defaultdict(lambda: {"turns": 0, "passed": 0})
    for row in outcomes:
        bucket = grouped[f"{row['split']}/{row['group']}"]
        bucket["turns"] += 1
        bucket["passed"] += int(row["pass"])

    ranking_rows = [await _ranking_row(case, rooms_fixture.rooms) for case in ranking_cases]
    ranking_by_split = {}
    for split_name in ("dev", "heldout"):
        rows = [row for row in ranking_rows if row["split"] == split_name]
        ranking_by_split[split_name] = {
            "cases": len(rows),
            "labeledCases": sum(row["hasRelevanceLabels"] for row in rows),
            "orderDifferences": sum(
                row["baseline"]["order"] != row["multiCriteria"]["order"] for row in rows
            ),
            "provisionalMeanNDCG@5": _mean_ndcg(rows),
        }
    scorer = MultiCriteriaScorer()
    return {
        "evaluation": "synthetic-offline-reference-patches",
        "commit": _git_commit(),
        "dataset": {
            "scenarioVersion": "scenarios-provisional-v1",
            "roomVersion": rooms_fixture.version,
            "rankingVersion": ranking_data.version,
            "labelStatus": "provisional",
            "scenarioCount": len(scenarios),
            "turnCount": len(outcomes),
            "rankingCaseCount": len(ranking_rows),
            "split": split,
        },
        "config": {
            "scoringVersion": scorer.version,
            "amenityWeight": str(scorer.config.amenity_weight),
            "priceWeight": str(scorer.config.price_weight),
            "capacityWeight": str(scorer.config.capacity_weight),
            "nDCGAtK": 5,
            "fixedClock": FIXED_NOW.isoformat(),
        },
        "conversation": {
            "byGroup": dict(sorted(grouped.items())),
            "passedTurns": sum(row["pass"] for row in outcomes),
            "hardViolationCount": sum(len(row["hardViolationRoomIds"]) for row in outcomes),
            "noMatchTechnicalConfusions": sum(
                (row["expectedStatus"], row["actualStatus"])
                in {("NO_MATCH", "TECHNICAL_ERROR"), ("TECHNICAL_ERROR", "NO_MATCH")}
                for row in outcomes
            ),
            "failures": [row for row in outcomes if not row["pass"]],
        },
        "ranking": {
            "cases": ranking_rows,
            "bySplit": ranking_by_split,
            "labeledCount": sum(row["hasRelevanceLabels"] for row in ranking_rows),
            "orderDifferences": sum(
                row["baseline"]["order"] != row["multiCriteria"]["order"]
                for row in ranking_rows
            ),
            "provisionalMeanNDCG@5": _mean_ndcg(ranking_rows),
            "allSameEligibleCandidates": all(row["sameEligibleCandidates"] for row in ranking_rows),
            "allEligibleSetsMatchLabels": all(
                row[name]["eligibleSetMatchesLabel"]
                for row in ranking_rows for name in ("baseline", "multiCriteria")
            ),
        },
        "notRun": ["live Gemini extraction", "Spring/MySQL integration"],
        "limitations": [
            "Reference extraction patches are synthetic; these are not Gemini accuracy results.",
            "Relevance labels are author-proposed and provisional, not user-reviewed.",
            "No scorer superiority or production outcome claim follows from provisional labels.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--split", choices=("all", "dev", "heldout"), default="all")
    parser.add_argument("--output", type=Path, help="write JSON report (otherwise print to stdout)")
    args = parser.parse_args()
    report = asyncio.run(evaluate(args.split))
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
        print(f"Wrote {args.output}: {report['dataset']['turnCount']} turns")
    else:
        print(rendered)
    if (
        report["conversation"]["failures"]
        or not report["ranking"]["allSameEligibleCandidates"]
        or not report["ranking"]["allEligibleSetsMatchLabels"]
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
