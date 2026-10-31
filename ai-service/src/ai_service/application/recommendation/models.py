"""Recommendation inputs validated independently of HTTP presentation."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Self

import simplejson
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictInt, model_validator

from ai_service.application.recommendation.amenities import resolve_criteria

NonNegativeMoney = Annotated[Decimal, Field(ge=Decimal("0"))]
PositiveInteger = Annotated[StrictInt, Field(gt=0)]
TopK = Annotated[StrictInt, Field(ge=1, le=20)]


def _contract_json_default(value: object) -> str:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


class SortBy(str, Enum):
    """Sort values currently recognized by the Spring availability service."""

    PRICE_ASC = "PRICE_ASC"
    PRICE_DESC = "PRICE_DESC"


class PricePreference(str, Enum):
    SAVE = "SAVE"
    PREMIUM = "PREMIUM"


class CapacityPreference(str, Enum):
    CLOSE_FIT = "CLOSE_FIT"
    SPACIOUS = "SPACIOUS"


class AvailabilitySearchRequest(BaseModel):
    """Hard constraints accepted by the backend availability endpoint."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    check_in_date: date = Field(alias="checkInDate")
    check_out_date: date = Field(alias="checkOutDate")
    guest_count: PositiveInteger = Field(alias="guestCount")
    room_type_id: PositiveInteger | None = Field(default=None, alias="roomTypeId")
    min_price: NonNegativeMoney | None = Field(default=None, alias="minPrice")
    max_price: NonNegativeMoney | None = Field(default=None, alias="maxPrice")
    sort_by: SortBy | None = Field(default=None, alias="sortBy")

    @model_validator(mode="after")
    def validate_ranges(self) -> Self:
        if self.check_out_date <= self.check_in_date:
            raise ValueError("checkOutDate must be later than checkInDate")
        if (
            self.min_price is not None
            and self.max_price is not None
            and self.min_price > self.max_price
        ):
            raise ValueError("minPrice must be less than or equal to maxPrice")
        return self


class RecommendationPreferences(BaseModel):
    """Soft inputs present in the REC-01 draft; they never affect eligibility."""

    model_config = ConfigDict(extra="forbid")

    amenities: list[Annotated[str, Field(max_length=100)]] = Field(
        default_factory=list, max_length=20
    )
    price: PricePreference | None = None
    capacity: CapacityPreference | None = None


class ScoreComponent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    score: Decimal | None = Field(default=None, ge=Decimal("0"), le=Decimal("1"))
    weight: Decimal = Field(ge=Decimal("0"))
    evidence: str | None = None


class PreferenceEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterion: Literal["amenities", "price", "capacity"]
    requested: str
    evidence: str | None = None


class RecommendationRequest(AvailabilitySearchRequest):
    """V1 recommendation request with only documented JSON field names."""

    model_config = ConfigDict(populate_by_name=False, validate_by_name=False, extra="forbid")

    preferences: RecommendationPreferences = Field(default_factory=RecommendationPreferences)
    required_amenities: list[Annotated[str, Field(min_length=1, max_length=100)]] = Field(
        default_factory=list, alias="requiredAmenities", max_length=20
    )
    total_budget: NonNegativeMoney | None = Field(default=None, alias="totalBudget")
    top_k: TopK = Field(default=5, alias="topK")

    @model_validator(mode="after")
    def validate_amenities(self) -> Self:
        resolve_criteria(self.required_amenities, self.preferences.amenities)
        return self

    def availability_search(self) -> AvailabilitySearchRequest:
        """Return only fields accepted by the authoritative backend search DTO."""

        return AvailabilitySearchRequest.model_validate(
            self.model_dump(
                exclude={"preferences", "required_amenities", "total_budget", "top_k"}
            )
        )


class RecommendationStatus(str, Enum):
    """Successful internal pipeline outcomes from the draft contract."""

    OK = "OK"
    NO_MATCH = "NO_MATCH"


class RecommendationRoomType(BaseModel):
    """Room-type fields exposed by one recommendation result."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    room_type_id: StrictInt = Field(alias="roomTypeId")
    type_name: str = Field(alias="typeName")
    capacity: StrictInt
    amenities: str | None
    description: str | None


class RecommendedRoom(BaseModel):
    """One ranked concrete room using only fields returned by availability."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    room_id: StrictInt = Field(alias="roomId")
    room_number: str = Field(alias="roomNumber")
    floor: StrictInt | None
    room_type: RecommendationRoomType = Field(alias="roomType")
    check_in_date: date = Field(alias="checkInDate")
    check_out_date: date = Field(alias="checkOutDate")
    nights: StrictInt
    price_per_night: Decimal = Field(alias="pricePerNight")
    total_room_charge: Decimal = Field(alias="totalRoomCharge")
    deposit_percentage: StrictInt = Field(alias="depositPercentage")
    estimated_deposit: Decimal = Field(alias="estimatedDeposit")
    score: Decimal = Field(ge=Decimal("0"), le=Decimal("1"))
    score_breakdown: dict[str, ScoreComponent] = Field(alias="scoreBreakdown")
    matched_preferences: list[PreferenceEvidence] = Field(alias="matchedPreferences")
    unmatched_preferences: list[PreferenceEvidence] = Field(alias="unmatchedPreferences")
    reasons: list[str]


class RecommendationResult(BaseModel):
    """Internal result model and HTTP success contract."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    status: RecommendationStatus
    scoring_version: str = Field(alias="scoringVersion")
    recommendations: list[RecommendedRoom]
    availability_checked_at: AwareDatetime = Field(alias="availabilityCheckedAt")
    request_id: str = Field(alias="requestId")

    @model_validator(mode="after")
    def validate_status_matches_results(self) -> Self:
        if self.status is RecommendationStatus.OK and not self.recommendations:
            raise ValueError("OK requires at least one recommendation")
        if self.status is RecommendationStatus.NO_MATCH and self.recommendations:
            raise ValueError("NO_MATCH requires an empty recommendation list")
        return self

    def to_contract_json(self) -> str:
        """Serialize aliases/dates while keeping Decimal values as JSON numbers."""

        return simplejson.dumps(
            self.model_dump(by_alias=True),
            use_decimal=True,
            default=_contract_json_default,
            separators=(",", ":"),
        )
