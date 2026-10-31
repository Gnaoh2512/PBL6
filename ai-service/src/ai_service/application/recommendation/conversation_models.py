"""Validated, caller-carried search state and bounded LLM extraction contract."""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Self

import simplejson
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from ai_service.application.recommendation.models import (
    RecommendationResult,
    SortBy,
    _contract_json_default,
)

Money = Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]
PositiveInt = Annotated[StrictInt, Field(gt=0)]
Amenity = Annotated[str, Field(min_length=1, max_length=100)]


class SearchState(BaseModel):
    """Only user search criteria are carried across turns; never rooms or prices from BE."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    check_in_date: date | None = Field(default=None, alias="checkInDate")
    check_out_date: date | None = Field(default=None, alias="checkOutDate")
    guest_count: PositiveInt | None = Field(default=None, alias="guestCount")
    room_count: PositiveInt | None = Field(default=None, alias="roomCount")
    room_type_id: PositiveInt | None = Field(default=None, alias="roomTypeId")
    room_type_name: str | None = Field(default=None, alias="roomTypeName", max_length=100)
    min_price: Money | None = Field(default=None, alias="minPrice")
    max_price: Money | None = Field(default=None, alias="maxPrice")
    total_budget: Money | None = Field(default=None, alias="totalBudget")
    sort_by: SortBy | None = Field(default=None, alias="sortBy")
    preferred_amenities: list[Amenity] = Field(default_factory=list, alias="preferredAmenities", max_length=20)
    required_amenities: list[Amenity] = Field(default_factory=list, alias="requiredAmenities", max_length=20)

    @field_validator("room_type_name")
    @classmethod
    def nonblank_room_type(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("roomTypeName cannot be blank")
        return value

    @model_validator(mode="after")
    def one_room_type_selector(self) -> Self:
        if self.room_type_id is not None and self.room_type_name is not None:
            raise ValueError("roomTypeId and roomTypeName cannot both be set")
        return self


class SearchField(str, Enum):
    CHECK_IN_DATE = "checkInDate"
    CHECK_OUT_DATE = "checkOutDate"
    GUEST_COUNT = "guestCount"
    ROOM_COUNT = "roomCount"
    ROOM_TYPE_ID = "roomTypeId"
    ROOM_TYPE_NAME = "roomTypeName"
    MIN_PRICE = "minPrice"
    MAX_PRICE = "maxPrice"
    TOTAL_BUDGET = "totalBudget"
    SORT_BY = "sortBy"
    PREFERRED_AMENITIES = "preferredAmenities"
    REQUIRED_AMENITIES = "requiredAmenities"
    BUDGET_BASIS = "budgetBasis"


class FieldChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: SearchField
    action: Literal["SET", "CLEAR"]
    value: str | None

    @model_validator(mode="after")
    def validate_action(self) -> Self:
        if self.field is SearchField.BUDGET_BASIS:
            raise ValueError("budgetBasis is an ambiguity, not a stored criterion")
        if self.action == "SET" and (self.value is None or not self.value.strip()):
            raise ValueError("SET requires a value")
        if self.action == "CLEAR" and self.value is not None:
            raise ValueError("CLEAR requires null value")
        return self


class ExtractedChanges(BaseModel):
    model_config = ConfigDict(extra="forbid")

    changes: list[FieldChange] = Field(max_length=20)
    ambiguities: list[SearchField] = Field(max_length=12)
    unsupported_intent: bool = Field(alias="unsupportedIntent")

    @model_validator(mode="after")
    def unique_changes(self) -> Self:
        fields = [change.field for change in self.changes]
        if len(fields) != len(set(fields)):
            raise ValueError("a field may be changed only once per turn")
        return self


class ConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)
    state: SearchState = Field(default_factory=SearchState)

    @field_validator("message")
    @classmethod
    def nonblank_message(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message cannot be blank")
        return value.strip()


class ConversationStatus(str, Enum):
    NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION"
    RECOMMENDED = "RECOMMENDED"
    NO_MATCH = "NO_MATCH"
    UNSUPPORTED = "UNSUPPORTED"


class ConversationResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    status: ConversationStatus
    reply: str
    state: SearchState
    clarification_fields: list[SearchField] = Field(alias="clarificationFields")
    result: RecommendationResult | None
    request_id: str = Field(alias="requestId")

    def to_contract_json(self) -> str:
        return simplejson.dumps(
            self.model_dump(by_alias=True),
            use_decimal=True,
            default=_contract_json_default,
            ensure_ascii=False,
            separators=(",", ":"),
        )
