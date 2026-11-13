"""Strict incoming turn schemas. No customer identity or arbitrary tool payloads."""

import re
from datetime import date
from typing import Annotated, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    TypeAdapter,
    field_validator,
    model_validator,
)

Uuid = Annotated[UUID, Field(strict=False)]
Text = Annotated[str, Field(min_length=1, max_length=2000)]
Money = Annotated[str, Field(pattern=r"^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$", max_length=32)]
ToolName = Literal[
    "search_knowledge",
    "search_rooms",
    "list_services",
    "list_my_bookings",
    "get_my_booking",
]
BusinessTool = Literal["search_rooms", "list_services", "list_my_bookings", "get_my_booking"]
RequestId = Annotated[str, Field(pattern=r"^[A-Za-z0-9._-]{1,64}$")]


def parse_wire_date(value):
    if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        raise ValueError("Date must be a YYYY-MM-DD string")
    return date.fromisoformat(value)


WireDate = Annotated[date, BeforeValidator(parse_wire_date)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, hide_input_in_errors=True)


class Budget(StrictModel):
    remainingToolCalls: int = Field(ge=0, le=4)
    remainingBrokerBatches: int = Field(ge=0, le=2)
    remainingMs: int = Field(ge=0, le=20000)
    remainingInputTokens: int = Field(ge=0, le=8000)
    remainingOutputTokens: int = Field(ge=0, le=2000)


class Context(StrictModel):
    locale: Literal["vi-VN"]
    timeZone: Literal["Asia/Ho_Chi_Minh"]
    today: WireDate
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]


class HistoryMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: Text


class ServiceItem(StrictModel):
    serviceId: int = Field(gt=0)
    categoryName: Text
    serviceName: Text
    unitPrice: Money
    unit: Text
    isActive: Literal[True]
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]

    @field_validator("isActive", mode="before")
    @classmethod
    def actual_boolean(cls, value):
        if value is not True:
            raise ValueError("Active service requires the boolean true")
        return value


class RoomItem(StrictModel):
    roomId: int = Field(gt=0)
    roomTypeId: int = Field(gt=0)
    typeName: Text
    capacity: int = Field(gt=0)
    amenities: Text | None
    description: Text | None
    checkInDate: WireDate
    checkOutDate: WireDate
    nights: int = Field(gt=0)
    pricePerNight: Money
    totalRoomCharge: Money
    depositPercentage: int = Field(ge=0, le=100)
    estimatedDeposit: Money
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
    priceScope: Literal["room_charge_estimate"]


class BookingItem(StrictModel):
    bookingCode: Annotated[str, Field(pattern=r"^[A-Za-z0-9-]{1,50}$")]
    bookingStatus: Literal[
        "PENDING_DEPOSIT",
        "CONFIRMED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELED",
        "EXPIRED",
    ]
    roomTypeName: Text | None
    checkInDate: WireDate
    checkOutDate: WireDate
    nights: int = Field(gt=0)
    guestCount: int = Field(gt=0)


class BookingDetail(BookingItem):
    depositRequired: Money | None = None
    depositPaid: Money | None = None
    totalAmount: Money | None = None
    remainingBalance: Money | None = None
    currency: Annotated[str, Field(pattern=r"^[A-Z]{3}$")] | None = None


class RoomList(StrictModel):
    items: list[RoomItem] = Field(max_length=10)
    hasMore: bool


class ServiceList(StrictModel):
    items: list[ServiceItem] = Field(max_length=10)
    hasMore: bool


class BookingList(StrictModel):
    items: list[BookingItem] = Field(max_length=10)
    hasMore: bool


class ToolError(StrictModel):
    code: Literal[
        "AUTH_REQUIRED",
        "FORBIDDEN",
        "NOT_FOUND",
        "VALIDATION_ERROR",
        "CAPABILITY_UNAVAILABLE",
        "DEPENDENCY_UNAVAILABLE",
        "DATA_UNAVAILABLE",
        "TIMEOUT",
    ]
    message: Text


class ToolResult(StrictModel):
    callId: Uuid
    name: BusinessTool
    status: Literal["ok", "error"]
    data: RoomList | ServiceList | BookingList | BookingDetail | None
    error: ToolError | None

    @field_validator("data", mode="before")
    @classmethod
    def parse_named_payload(cls, value, info):
        expected = {
            "search_rooms": RoomList,
            "list_services": ServiceList,
            "list_my_bookings": BookingList,
            "get_my_booking": BookingDetail,
        }.get(info.data.get("name"))
        if value is not None and expected is not None:
            return expected.model_validate(value)
        return value

    @model_validator(mode="after")
    def match_tool_payload(self):
        expected = {
            "search_rooms": RoomList,
            "list_services": ServiceList,
            "list_my_bookings": BookingList,
            "get_my_booking": BookingDetail,
        }
        if self.status == "ok":
            if self.error is not None or not isinstance(self.data, expected[self.name]):
                raise ValueError("Successful tool result must match its tool schema")
        elif self.data is not None or self.error is None:
            raise ValueError("Failed tool result needs error and no data")
        return self


class TurnBase(StrictModel):
    requestId: RequestId
    conversationId: Uuid
    turnId: Uuid
    budget: Budget


class StartTurn(TurnBase):
    phase: Literal["start"]
    message: Text
    history: list[HistoryMessage] = Field(max_length=8)
    allowedTools: list[ToolName] = Field(max_length=5)
    context: Context

    @model_validator(mode="after")
    def valid_start(self):
        self.message = self.message.strip()
        if not self.message or len(self.allowedTools) != len(set(self.allowedTools)):
            raise ValueError("Empty message or duplicate tool")
        return self


class ResumeTurn(TurnBase):
    phase: Literal["resume"]
    continuationId: Uuid
    toolResults: list[ToolResult] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def unique_results(self):
        ids = [item.callId for item in self.toolResults]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate tool call ID")
        return self


TurnPayload = Annotated[StartTurn | ResumeTurn, Field(discriminator="phase")]
TurnRequest = TypeAdapter(TurnPayload)
