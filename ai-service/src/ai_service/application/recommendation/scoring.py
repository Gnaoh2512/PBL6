"""Replaceable, deterministic scorers for already eligible rooms."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ai_service.application.recommendation.amenities import AmenityStatus, evidence_for, status_for
from ai_service.application.recommendation.models import (
    CapacityPreference,
    PreferenceEvidence,
    PricePreference,
    RecommendationRequest,
    ScoreComponent,
)
from ai_service.infrastructure.backend.models import AvailableRoomCandidate


class ScoringConfig(BaseModel):
    """Experimental weights; no offline or online optimization is claimed."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["multi-criteria-experimental-v1"] = "multi-criteria-experimental-v1"
    amenity_weight: Decimal = Field(default=Decimal("0.4"), ge=0, allow_inf_nan=False)
    price_weight: Decimal = Field(default=Decimal("0.35"), ge=0, allow_inf_nan=False)
    capacity_weight: Decimal = Field(default=Decimal("0.25"), ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def positive_total(self) -> "ScoringConfig":
        if not any((self.amenity_weight, self.price_weight, self.capacity_weight)):
            raise ValueError("at least one scoring weight must be positive")
        return self


@dataclass(frozen=True)
class ScoreEvaluation:
    score: Decimal
    breakdown: dict[str, ScoreComponent]
    matched: list[PreferenceEvidence]
    unmatched: list[PreferenceEvidence]
    reasons: list[str]


@dataclass(frozen=True)
class ScoringContext:
    lowest_price: Decimal
    highest_price: Decimal
    lowest_capacity: Decimal
    highest_capacity: Decimal

    @classmethod
    def from_candidates(cls, candidates: list[AvailableRoomCandidate]) -> "ScoringContext":
        prices = [room.price_per_night for room in candidates]
        capacities = [Decimal(room.room_type.capacity) for room in candidates]
        return cls(min(prices), max(prices), min(capacities), max(capacities))


class RoomScorer(Protocol):
    version: str

    def score(
        self,
        candidate: AvailableRoomCandidate,
        context: ScoringContext,
        request: RecommendationRequest,
        required: set[str],
        preferred: set[str],
    ) -> ScoreEvaluation: ...


def _amenity_result(
    candidate: AvailableRoomCandidate, preferred: set[str]
) -> tuple[Decimal | None, list[PreferenceEvidence], list[PreferenceEvidence]]:
    if not preferred:
        return None, [], []
    evidence = evidence_for(candidate.room_type.amenities)
    matched: list[PreferenceEvidence] = []
    unmatched: list[PreferenceEvidence] = []
    for code in sorted(preferred):
        item = evidence.get(code)
        entry = PreferenceEvidence(
            criterion="amenities", requested=code,
            evidence=item.raw_token if item is not None else None,
        )
        if status_for(evidence, code) is AmenityStatus.PRESENT:
            matched.append(entry)
        else:
            unmatched.append(entry)
    return Decimal(len(matched)) / Decimal(len(preferred)), matched, unmatched


class BaselineAmenityScorer:
    """The original M/R amenity score, retained for controlled comparison."""

    version = "amenity-baseline-v1"

    def score(
        self,
        candidate: AvailableRoomCandidate,
        context: ScoringContext,
        request: RecommendationRequest,
        required: set[str],
        preferred: set[str],
    ) -> ScoreEvaluation:
        amenity_score, matched, unmatched = _amenity_result(candidate, preferred)
        evidence = evidence_for(candidate.room_type.amenities)
        reasons = [
            f"Required amenity verified: {evidence[code].raw_token}" for code in sorted(required)
        ]
        reasons.extend(f"Amenity preference matched: {item.evidence}" for item in matched)
        return ScoreEvaluation(
            score=amenity_score if amenity_score is not None else Decimal(0),
            breakdown={
                "amenities": ScoreComponent(score=amenity_score, weight=Decimal(1)),
                "price": ScoreComponent(score=None, weight=Decimal(0)),
                "capacity": ScoreComponent(score=None, weight=Decimal(0)),
            },
            matched=matched,
            unmatched=unmatched,
            reasons=reasons,
        )


def _relative_score(value: Decimal, low: Decimal, high: Decimal, *, ascending: bool) -> Decimal:
    if low == high:
        return Decimal(1)
    return (high - value if ascending else value - low) / (high - low)


class MultiCriteriaScorer:
    def __init__(self, config: ScoringConfig | None = None) -> None:
        self.config = config or ScoringConfig()
        self.version = self.config.version

    def score(
        self,
        candidate: AvailableRoomCandidate,
        context: ScoringContext,
        request: RecommendationRequest,
        required: set[str],
        preferred: set[str],
    ) -> ScoreEvaluation:
        amenity_score, matched, unmatched = _amenity_result(candidate, preferred)
        price_score = None
        capacity_score = None
        if request.preferences.price is not None:
            price_score = _relative_score(
                candidate.price_per_night,
                context.lowest_price,
                context.highest_price,
                ascending=request.preferences.price is PricePreference.SAVE,
            )
            entry = PreferenceEvidence(
                criterion="price", requested=request.preferences.price.value,
                evidence=str(candidate.price_per_night),
            )
            (matched if price_score == 1 else unmatched).append(entry)
        if request.preferences.capacity is not None:
            capacity_score = _relative_score(
                Decimal(candidate.room_type.capacity),
                context.lowest_capacity,
                context.highest_capacity,
                ascending=request.preferences.capacity is CapacityPreference.CLOSE_FIT,
            )
            entry = PreferenceEvidence(
                criterion="capacity", requested=request.preferences.capacity.value,
                evidence=str(candidate.room_type.capacity),
            )
            (matched if capacity_score == 1 else unmatched).append(entry)

        breakdown = {
            "amenities": ScoreComponent(score=amenity_score, weight=self.config.amenity_weight),
            "price": ScoreComponent(
                score=price_score, weight=self.config.price_weight,
                evidence=str(candidate.price_per_night) if price_score is not None else None,
            ),
            "capacity": ScoreComponent(
                score=capacity_score, weight=self.config.capacity_weight,
                evidence=str(candidate.room_type.capacity) if capacity_score is not None else None,
            ),
        }
        active = [(part.score, part.weight) for part in breakdown.values() if part.score is not None]
        denominator = sum((weight for _, weight in active), Decimal(0))
        if not denominator:
            score = Decimal(0)
        elif len(active) == 1:
            score = active[0][0]
        else:
            score = sum((value * weight for value, weight in active), Decimal(0)) / denominator

        evidence = evidence_for(candidate.room_type.amenities)
        reasons = [
            f"Đã xác nhận tiện nghi bắt buộc: {evidence[code].raw_token}"
            for code in sorted(required)
        ]
        for item in matched:
            if item.criterion == "amenities":
                reasons.append(f"Khớp tiện nghi ưu tiên: {item.evidence}")
        if price_score is not None:
            preference = "tiết kiệm" if request.preferences.price is PricePreference.SAVE else "giá cao hơn"
            reasons.append(
                f"Giá mỗi đêm {candidate.price_per_night}; điểm ưu tiên {preference}: {price_score}"
            )
        if capacity_score is not None:
            preference = (
                "vừa đủ" if request.preferences.capacity is CapacityPreference.CLOSE_FIT
                else "rộng rãi"
            )
            reasons.append(
                f"Sức chứa {candidate.room_type.capacity}; điểm ưu tiên {preference}: "
                f"{capacity_score}"
            )
        return ScoreEvaluation(score, breakdown, matched, unmatched, reasons)
