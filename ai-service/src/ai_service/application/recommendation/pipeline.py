"""Deterministic hard-filtering and soft-scoring recommendation pipeline."""

import unicodedata
from collections.abc import Callable
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from ai_service.application.recommendation.models import (
    RecommendationRequest,
    RecommendationResult,
    RecommendationRoomType,
    RecommendationStatus,
    RecommendedRoom,
)
from ai_service.application.request_id import validate_request_id
from ai_service.infrastructure.backend.errors import BackendInvalidResponseError
from ai_service.infrastructure.backend.models import AvailableRoomCandidate

if TYPE_CHECKING:
    from ai_service.infrastructure.backend.client import BackendClient


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_amenity(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    return " ".join(normalized.casefold().split())


def _requested_amenities(values: list[str]) -> set[str]:
    return {normalized for value in values if (normalized := _normalize_amenity(value))}


def _candidate_amenities(value: str | None) -> dict[str, str]:
    if not value:
        return {}

    tokens: dict[str, str] = {}
    for raw_token in value.split(","):
        display_token = " ".join(raw_token.split())
        normalized = _normalize_amenity(display_token)
        if normalized:
            tokens.setdefault(normalized, display_token)
    return tokens


class RecommendationPipeline:
    """Query live availability once, enforce hard constraints, then rank candidates."""

    def __init__(
        self,
        backend_client: "BackendClient",
        *,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._backend_client = backend_client
        self._clock = clock

    async def execute(
        self,
        request: RecommendationRequest,
        *,
        request_id: str,
    ) -> RecommendationResult:
        request_id = validate_request_id(request_id)
        candidates = await self._backend_client.find_available_rooms(
            request.availability_search(),
            request_id=request_id,
        )

        unique_candidates = self._deduplicate(candidates)
        eligible = [
            candidate
            for candidate in unique_candidates
            if self._meets_hard_constraints(candidate, request)
        ]
        recommendations = self._rank(eligible, request)
        status = RecommendationStatus.OK if recommendations else RecommendationStatus.NO_MATCH
        return RecommendationResult(
            status=status,
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
    def _meets_hard_constraints(
        candidate: AvailableRoomCandidate,
        request: RecommendationRequest,
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
        return not (request.max_price is not None and candidate.price_per_night > request.max_price)

    @staticmethod
    def _rank(
        candidates: list[AvailableRoomCandidate],
        request: RecommendationRequest,
    ) -> list[RecommendedRoom]:
        requested = _requested_amenities(request.preferences.amenities)
        ranked = [
            RecommendationPipeline._to_recommendation(candidate, requested)
            for candidate in candidates
        ]
        ranked.sort(key=lambda room: (-room.score, room.price_per_night, room.room_id))
        return ranked[: request.top_k]

    @staticmethod
    def _to_recommendation(
        candidate: AvailableRoomCandidate,
        requested: set[str],
    ) -> RecommendedRoom:
        available = _candidate_amenities(candidate.room_type.amenities)
        matched = sorted(requested.intersection(available))
        score = Decimal(len(matched)) / Decimal(len(requested)) if requested else Decimal("0")
        reasons = [f"Exact amenity token matched: {available[item]}" for item in matched]

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
            score=score,
            reasons=reasons,
        )
