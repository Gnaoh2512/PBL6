"""Models mirroring the current Spring availability response DTOs."""

from datetime import date, datetime
from decimal import Decimal
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt

T = TypeVar("T")


class BackendModel(BaseModel):
    """Reject schema drift instead of silently ignoring backend fields."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class BackendApiResponse(BackendModel, Generic[T]):
    """Mirror of com.example.pbl6.common.ApiResponse."""

    success: StrictBool
    message: str
    data: T | None
    timestamp: datetime


class BackendRoomType(BackendModel):
    """Mirror of RoomTypeResponse nested in an available room."""

    room_type_id: StrictInt = Field(alias="roomTypeId")
    type_name: str = Field(alias="typeName")
    capacity: StrictInt
    base_price: Decimal = Field(alias="basePrice")
    amenities: str | None
    description: str | None


class AvailableRoomCandidate(BackendModel):
    """One concrete room returned by the authoritative availability query."""

    room_id: StrictInt = Field(alias="roomId")
    room_number: str = Field(alias="roomNumber")
    floor: StrictInt | None
    status: str
    note: str | None
    room_type: BackendRoomType = Field(alias="roomType")
    check_in_date: date = Field(alias="checkInDate")
    check_out_date: date = Field(alias="checkOutDate")
    nights: StrictInt
    price_per_night: Decimal = Field(alias="pricePerNight")
    total_room_charge: Decimal = Field(alias="totalRoomCharge")
    deposit_percentage: StrictInt = Field(alias="depositPercentage")
    estimated_deposit: Decimal = Field(alias="estimatedDeposit")
