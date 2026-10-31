"""Deterministic hard-filtering and soft-scoring recommendation pipeline."""

from collections.abc import Callable
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from ai_service.application.recommendation.amenities import (
    AmenityStatus,
    evidence_for,
    resolve_criteria,
    status_for,
)
from ai_service.application.recommendation.models import (
    RecommendationRequest,
    RecommendationResult,
    RecommendationRoomType,
    RecommendationStatus,
    RecommendedRoom,
    SortBy,
)
from ai_service.application.recommendation.scoring import (
    MultiCriteriaScorer,
    RoomScorer,
    ScoreEvaluation,
    ScoringContext,
)
from ai_service.application.request_id import validate_request_id
from ai_service.infrastructure.backend.errors import BackendInvalidResponseError
from ai_service.infrastructure.backend.models import AvailableRoomCandidate

if TYPE_CHECKING:
    from ai_service.infrastructure.backend.client import BackendClient


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class RecommendationPipeline:
    """Query live availability once, enforce hard constraints, then rank candidates."""

    def __init__(
        self,
        backend_client: "BackendClient",
        *,
        clock: Callable[[], datetime] = _utc_now,
        scorer: RoomScorer | None = None,
    ) -> None:
        self._backend_client = backend_client
        self._clock = clock
        self._scorer = scorer or MultiCriteriaScorer()

    async def execute(
        self,
        request: RecommendationRequest,
        *,
        request_id: str,
    ) -> RecommendationResult:
        request_id = validate_request_id(request_id)
        required, preferred = resolve_criteria(
            request.required_amenities, request.preferences.amenities
        )
        candidates = await self._backend_client.find_available_rooms(
            request.availability_search(),
            request_id=request_id,
        )

        unique_candidates = self._deduplicate(candidates)
        for candidate in unique_candidates:
            self._validate_candidate(candidate, request)
        eligible = [
            candidate
            for candidate in unique_candidates
            if self._meets_hard_constraints(candidate, request, required)
        ]
        recommendations = self._rank(eligible, request, required, preferred)
        status = RecommendationStatus.OK if recommendations else RecommendationStatus.NO_MATCH
        return RecommendationResult(
            status=status,
            scoringVersion=self._scorer.version,
            recommendations=recommendations,
            availabilityCheckedAt=self._clock(),
            requestId=request_id,
        )

    @staticmethod
    def _deduplicate(
        candidates: list[AvailableRoomCandidate],
    ) -> list[AvailableRoomCandidate]:
        by_room_id: dict[int, AvailableRoomCandidate] = {}
        for candidate in candidates:
            existing = by_room_id.get(candidate.room_id)
            if existing is None:
                by_room_id[candidate.room_id] = candidate
            elif existing != candidate:
                raise BackendInvalidResponseError(
                    f"backend returned conflicting records for roomId={candidate.room_id}"
                )
        return list(by_room_id.values())

    @staticmethod
    def _validate_candidate(
        candidate: AvailableRoomCandidate,
        request: RecommendationRequest,
    ) -> None:
        if (
            candidate.status != "AVAILABLE"
            or candidate.check_in_date != request.check_in_date
            or candidate.check_out_date != request.check_out_date
            or candidate.nights != (request.check_out_date - request.check_in_date).days
            or candidate.price_per_night < 0
            or candidate.total_room_charge < 0
            or candidate.estimated_deposit < 0
        ):
            raise BackendInvalidResponseError(
                "backend returned a room inconsistent with the availability search"
            )

    @staticmethod
    def _meets_hard_constraints(
        candidate: AvailableRoomCandidate,
        request: RecommendationRequest,
        required: set[str],
    ) -> bool:
        if candidate.room_type.capacity < request.guest_count:
            return False
        if (
            request.room_type_id is not None
            and candidate.room_type.room_type_id != request.room_type_id
        ):
            return False
        if request.min_price is not None and candidate.price_per_night < request.min_price:
            return False
        if request.max_price is not None and candidate.price_per_night > request.max_price:
            return False
        if request.total_budget is not None and candidate.total_room_charge > request.total_budget:
            return False
        if not required:
            return True
        evidence = evidence_for(candidate.room_type.amenities)
        return all(status_for(evidence, code) is AmenityStatus.PRESENT for code in required)

    def _rank(
        self,
        candidates: list[AvailableRoomCandidate],
        request: RecommendationRequest,
        required: set[str],
        preferred: set[str],
    ) -> list[RecommendedRoom]:
        if not candidates:
            return []
        context = ScoringContext.from_candidates(candidates)
        ranked = [
            self._to_recommendation(
                candidate,
                self._scorer.score(candidate, context, request, required, preferred),
            )
            for candidate in candidates
        ]
        price_direction = -1 if request.sort_by is SortBy.PRICE_DESC else 1
        ranked.sort(
            key=lambda room: (
                -room.score,
                price_direction * room.price_per_night,
                room.room_id,
            )
        )
        return ranked[: request.top_k]

    @staticmethod
    def _to_recommendation(
        candidate: AvailableRoomCandidate,
        evaluation: ScoreEvaluation,
    ) -> RecommendedRoom:
        return RecommendedRoom(
            roomId=candidate.room_id,
            roomNumber=candidate.room_number,
            floor=candidate.floor,
            roomType=RecommendationRoomType(
                roomTypeId=candidate.room_type.room_type_id,
                typeName=candidate.room_type.type_name,
                capacity=candidate.room_type.capacity,
                amenities=candidate.room_type.amenities,
                description=candidate.room_type.description,
            ),
            checkInDate=candidate.check_in_date,
            checkOutDate=candidate.check_out_date,
            nights=candidate.nights,
            pricePerNight=candidate.price_per_night,
            totalRoomCharge=candidate.total_room_charge,
            depositPercentage=candidate.deposit_percentage,
            estimatedDeposit=candidate.estimated_deposit,
            score=evaluation.score,
            scoreBreakdown=evaluation.breakdown,
            matchedPreferences=evaluation.matched,
            unmatchedPreferences=evaluation.unmatched,
            reasons=evaluation.reasons,
        )
