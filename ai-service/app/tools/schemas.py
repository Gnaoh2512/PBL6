"""Strict D2/D3 turn-planning schemas and host-side business tool argument validators."""

import re
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field

from app.schemas.turn import StrictModel

_ISO_DATE_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
_MONEY_RE = re.compile(r"^(0|[1-9][0-9]*)(\.[0-9]{1,2})?$")
_BOOKING_CODE_RE = re.compile(r"^[A-Za-z0-9-]{1,50}$")
_DEFAULT_LIMIT = 5
_MAX_LIMIT = 10

BookingStatusLiteral = Literal[
    "PENDING_DEPOSIT",
    "CONFIRMED",
    "CHECKED_IN",
    "CHECKED_OUT",
    "CANCELED",
    "EXPIRED",
]
_VALID_BOOKING_STATUSES = frozenset(
    {"PENDING_DEPOSIT", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELED", "EXPIRED"}
)


class TurnPlan(StrictModel):
    """Flat structured plan returned by the LLM when business/booking tools are active."""

    intent: Literal[
        "faq",
        "search_rooms",
        "list_services",
        "list_my_bookings",
        "get_my_booking",
        "unavailable",
    ]
    query: str = Field(min_length=1, max_length=2000)
    checkInDate: str | None = None
    checkOutDate: str | None = None
    guestCount: int | None = None
    roomTypeId: int | None = None
    minPrice: str | None = None
    maxPrice: str | None = None
    sortBy: Literal["PRICE_ASC", "PRICE_DESC"] | None = None
    categoryId: int | None = None
    bookingCode: str | None = None
    bookingStatus: BookingStatusLiteral | None = None
    includeFinancials: bool | None = None
    limit: int | None = None


def _parse_iso_date(raw: str | None) -> date | None:
    if not isinstance(raw, str):
        return None
    cleaned = raw.strip()
    if not _ISO_DATE_RE.fullmatch(cleaned):
        return None
    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        return None


def _parse_money(raw: str | None) -> tuple[str | None, Decimal | None, bool]:
    """Return (normalized_str, decimal_value, is_valid)."""
    if raw is None:
        return None, None, True
    cleaned = raw.strip()
    if not cleaned:
        return None, None, True
    if len(cleaned) > 32 or not _MONEY_RE.fullmatch(cleaned):
        return None, None, False
    value = Decimal(cleaned)
    if value < 0:
        return None, None, False
    return cleaned, value, True


def validate_room_search_plan(
    plan: TurnPlan, today: date
) -> tuple[dict | None, list[str], str | None]:
    """Validate room search args on host before emitting a broker tool call.

    Returns (arguments, missing_fields, clarification_message).
    """
    missing: list[str] = []
    if not plan.checkInDate or not plan.checkInDate.strip():
        missing.append("checkInDate")
    if not plan.checkOutDate or not plan.checkOutDate.strip():
        missing.append("checkOutDate")
    if plan.guestCount is None:
        missing.append("guestCount")

    if missing:
        labels = {
            "checkInDate": "ngày nhận phòng",
            "checkOutDate": "ngày trả phòng",
            "guestCount": "số lượng khách",
        }
        asked = ", ".join(labels[field] for field in missing)
        return (
            None,
            missing,
            f"Để kiểm tra phòng trống và giá dự kiến, bạn vui lòng cho biết thêm {asked} nhé.",
        )

    check_in = _parse_iso_date(plan.checkInDate)
    check_out = _parse_iso_date(plan.checkOutDate)
    if check_in is None or check_out is None:
        bad = [
            f
            for f, parsed in (("checkInDate", check_in), ("checkOutDate", check_out))
            if parsed is None
        ]
        return (
            None,
            bad,
            "Ngày nhận phòng hoặc ngày trả phòng chưa đúng định dạng (YYYY-MM-DD). "
            "Bạn vui lòng cung cấp lại ngày cụ thể nhé.",
        )
    if check_in < today:
        return (
            None,
            ["checkInDate"],
            f"Ngày nhận phòng ({check_in.isoformat()}) phải từ ngày hôm nay "
            f"({today.isoformat()}) trở đi. Bạn vui lòng chọn lại ngày nhận phòng nhé.",
        )
    if check_out <= check_in:
        return (
            None,
            ["checkOutDate"],
            "Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm. "
            "Bạn vui lòng xác nhận lại ngày trả phòng nhé.",
        )
    if plan.guestCount is None or isinstance(plan.guestCount, bool) or plan.guestCount <= 0:
        return (
            None,
            ["guestCount"],
            "Số lượng khách cần lớn hơn 0. Bạn vui lòng cho biết số khách dự kiến nhé.",
        )

    min_str, min_val, min_ok = _parse_money(plan.minPrice)
    max_str, max_val, max_ok = _parse_money(plan.maxPrice)
    if not min_ok or not max_ok:
        return (
            None,
            [],
            "Khoảng giá mỗi đêm chưa hợp lệ. Bạn vui lòng nhập lại mức giá bằng VND nhé.",
        )
    if min_val is not None and max_val is not None and min_val > max_val:
        return (
            None,
            [],
            "Giá tối thiểu đang lớn hơn giá tối đa. Bạn vui lòng điều chỉnh lại khoảng giá nhé.",
        )

    arguments: dict = {
        "checkInDate": check_in.isoformat(),
        "checkOutDate": check_out.isoformat(),
        "guestCount": int(plan.guestCount),
    }
    if (
        plan.roomTypeId is not None
        and not isinstance(plan.roomTypeId, bool)
        and plan.roomTypeId > 0
    ):
        arguments["roomTypeId"] = int(plan.roomTypeId)
    if min_str is not None:
        arguments["minPrice"] = min_str
    if max_str is not None:
        arguments["maxPrice"] = max_str
    if plan.sortBy in ("PRICE_ASC", "PRICE_DESC"):
        arguments["sortBy"] = plan.sortBy
    if (
        plan.limit is not None
        and not isinstance(plan.limit, bool)
        and 1 <= plan.limit <= _MAX_LIMIT
    ):
        arguments["limit"] = int(plan.limit)
    else:
        arguments["limit"] = _DEFAULT_LIMIT
    return arguments, [], None


def validate_service_list_plan(plan: TurnPlan) -> dict:
    """Build strictly validated arguments for list_services."""
    arguments: dict = {}
    if (
        plan.categoryId is not None
        and not isinstance(plan.categoryId, bool)
        and plan.categoryId > 0
    ):
        arguments["categoryId"] = int(plan.categoryId)
    if (
        plan.limit is not None
        and not isinstance(plan.limit, bool)
        and 1 <= plan.limit <= _MAX_LIMIT
    ):
        arguments["limit"] = int(plan.limit)
    else:
        arguments["limit"] = _DEFAULT_LIMIT
    return arguments


def validate_list_bookings_plan(plan: TurnPlan) -> dict:
    """Build strictly validated arguments for list_my_bookings (never includes identity)."""
    arguments: dict = {}
    if plan.bookingStatus in _VALID_BOOKING_STATUSES:
        arguments["status"] = plan.bookingStatus
    if (
        plan.limit is not None
        and not isinstance(plan.limit, bool)
        and 1 <= plan.limit <= _MAX_LIMIT
    ):
        arguments["limit"] = int(plan.limit)
    else:
        arguments["limit"] = _DEFAULT_LIMIT
    return arguments


def validate_get_booking_plan(plan: TurnPlan) -> tuple[dict | None, list[str], str | None]:
    """Validate bookingCode strictly without mutating invalid characters."""
    if not plan.bookingCode or not plan.bookingCode.strip():
        return (
            None,
            ["bookingCode"],
            "Bạn vui lòng cung cấp mã đơn đặt phòng (ví dụ: BK-...) để kiểm tra chi tiết nhé.",
        )
    code = plan.bookingCode.strip()
    if not _BOOKING_CODE_RE.fullmatch(code):
        return (
            None,
            ["bookingCode"],
            "Mã đơn đặt phòng chưa đúng định dạng (chỉ gồm chữ cái, số và dấu gạch ngang). "
            "Bạn vui lòng kiểm tra lại mã đơn nhé.",
        )
    arguments: dict = {"bookingCode": code}
    if plan.includeFinancials is True:
        arguments["includeFinancials"] = True
    return arguments, [], None
