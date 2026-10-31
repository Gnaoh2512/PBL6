"""Validated, caller-carried search state and bounded LLM extraction contract."""

from datetime import date
from decimal import Decimal
from enum import Enum
from typing import Annotated, Literal, Self

import simplejson
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator, model_validator

from ai_service.application.recommendation.models import (
    CapacityPreference,
    PricePreference,
    RecommendationResult,
    SortBy,
    _contract_json_default,
)

Money = Annotated[Decimal, Field(ge=0, allow_inf_nan=False)]
PositiveInt = Annotated[StrictInt, Field(gt=0)]
Amenity = Annotated[str, Field(min_length=1, max_length=100)]


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
    PRICE_PREFERENCE = "pricePreference"
    CAPACITY_PREFERENCE = "capacityPreference"
    PREFERRED_AMENITIES = "preferredAmenities"
    REQUIRED_AMENITIES = "requiredAmenities"
    BUDGET_BASIS = "budgetBasis"
    BUDGET = "budget"


class BudgetBasis(str, Enum):
    PER_NIGHT = "PER_NIGHT"
    TOTAL_STAY = "TOTAL_STAY"


class PendingBudget(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["budget"] = "budget"
    amount: Money | None = None
    basis: BudgetBasis | None = None


class PendingDate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["date"] = "date"
    field: Literal[SearchField.CHECK_IN_DATE, SearchField.CHECK_OUT_DATE]
    month: Annotated[StrictInt, Field(ge=1, le=12)] | None = None
    day: Annotated[StrictInt, Field(ge=1, le=31)] | None = None

    @model_validator(mode="after")
    def valid_partial_date(self) -> Self:
        if (self.month is None) != (self.day is None):
            raise ValueError("pending date needs both month and day")
        if self.month is not None:
            date(2000, self.month, self.day)
        return self


class PendingField(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["field"] = "field"
    field: SearchField
    value: str | None = Field(default=None, max_length=2100)

    @model_validator(mode="after")
    def supported_field(self) -> Self:
        if self.field in (
            SearchField.BUDGET,
            SearchField.BUDGET_BASIS,
            SearchField.CHECK_IN_DATE,
            SearchField.CHECK_OUT_DATE,
        ):
            raise ValueError("field uses a dedicated pending criterion")
        return self


PendingCriterion = Annotated[
    PendingBudget | PendingDate | PendingField, Field(discriminator="kind")
]


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
    price_preference: PricePreference | None = Field(default=None, alias="pricePreference")
    capacity_preference: CapacityPreference | None = Field(default=None, alias="capacityPreference")
    preferred_amenities: list[Amenity] = Field(
        default_factory=list, alias="preferredAmenities", max_length=20
    )
    required_amenities: list[Amenity] = Field(
        default_factory=list, alias="requiredAmenities", max_length=20
    )
    pending: list[PendingCriterion] = Field(default_factory=list, max_length=12)
    pending_question: SearchField | None = Field(default=None, alias="pendingQuestion")

    @field_validator("room_type_name")
    @classmethod
    def nonblank_room_type(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("roomTypeName cannot be blank")
        return value

    @model_validator(mode="after")
    def consistent_criteria_and_pending(self) -> Self:
        if self.room_type_id is not None and self.room_type_name is not None:
            raise ValueError("roomTypeId and roomTypeName cannot both be set")
        keys = [
            item.field if isinstance(item, (PendingDate, PendingField)) else SearchField.BUDGET
            for item in self.pending
        ]
        if len(keys) != len(set(keys)):
            raise ValueError("pending criteria must be unique")
        for item in self.pending:
            if isinstance(item, PendingBudget):
                if self.max_price is not None or self.total_budget is not None:
                    raise ValueError("pending budget cannot coexist with a confirmed budget")
                if item.amount is not None and item.basis is not None:
                    raise ValueError("completed budget must be confirmed")
            if isinstance(item, PendingDate):
                confirmed = (
                    self.check_in_date
                    if item.field is SearchField.CHECK_IN_DATE
                    else self.check_out_date
                )
                if confirmed is not None:
                    raise ValueError("pending date cannot coexist with a confirmed date")
            if isinstance(item, PendingField):
                confirmed = self.model_dump(by_alias=True)[item.field.value]
                if confirmed not in (None, []):
                    raise ValueError("pending field cannot coexist with a confirmed value")
        if self.pending:
            questions = {
                (SearchField.BUDGET if item.amount is None else SearchField.BUDGET_BASIS)
                if isinstance(item, PendingBudget)
                else item.field
                for item in self.pending
            }
            if self.pending_question not in questions:
                raise ValueError("pendingQuestion must identify an unresolved criterion")
        return self


class FieldChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    field: SearchField
    action: Literal["SET", "CLEAR"]
    value: str | None

    @model_validator(mode="after")
    def validate_action(self) -> Self:
        if self.action == "SET" and (self.value is None or not self.value.strip()):
            raise ValueError("SET requires a value")
        if self.action == "CLEAR" and self.value is not None:
            raise ValueError("CLEAR requires null value")
        if self.field is SearchField.BUDGET_BASIS and self.action == "SET":
            BudgetBasis(self.value)
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
