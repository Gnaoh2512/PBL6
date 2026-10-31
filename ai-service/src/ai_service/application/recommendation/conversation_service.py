"""Stateless, validated Vietnamese room-search conversation orchestration."""

import re
import unicodedata
from collections.abc import Callable
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Protocol
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from ai_service.application.recommendation.conversation_models import (
    ConversationRequest,
    ConversationResponse,
    ConversationStatus,
    ExtractedChanges,
    SearchField,
    SearchState,
)
from ai_service.application.recommendation.models import RecommendationRequest, RecommendationStatus
from ai_service.application.recommendation.pipeline import RecommendationPipeline
from ai_service.infrastructure.backend.client import BackendClient
from ai_service.infrastructure.llm import ExtractionInvalidResponse

FIELD_QUESTIONS = {
    SearchField.CHECK_IN_DATE: "Bạn muốn nhận phòng ngày nào? Vui lòng ghi đủ ngày, tháng và năm.",
    SearchField.CHECK_OUT_DATE: "Bạn muốn trả phòng ngày nào? Vui lòng ghi đủ ngày, tháng và năm.",
    SearchField.GUEST_COUNT: "Một phòng sẽ có tổng cộng bao nhiêu khách?",
    SearchField.ROOM_COUNT: "Bạn cần một phòng hay nhiều phòng?",
    SearchField.BUDGET_BASIS: "Ngân sách này tính cho mỗi đêm hay cho toàn kỳ ở?",
    SearchField.ROOM_TYPE_NAME: "Bạn muốn hạng phòng nào trong danh mục khách sạn?",
    SearchField.ROOM_TYPE_ID: "Bạn muốn chọn mã hạng phòng nào?",
    SearchField.MIN_PRICE: "Vui lòng cho biết mức giá tối thiểu mỗi đêm.",
    SearchField.MAX_PRICE: "Vui lòng cho biết mức giá tối đa mỗi đêm.",
    SearchField.TOTAL_BUDGET: "Bạn muốn giới hạn giá mỗi đêm ở mức nào?",
    SearchField.REQUIRED_AMENITIES: "Tiện nghi đó là bắt buộc hay chỉ ưu tiên?",
    SearchField.PREFERRED_AMENITIES: "Bạn muốn ưu tiên tiện nghi nào?",
    SearchField.SORT_BY: "Bạn muốn sắp xếp theo giá tăng hay giảm?",
}
DATE_FIELDS = {SearchField.CHECK_IN_DATE, SearchField.CHECK_OUT_DATE}
INT_FIELDS = {SearchField.GUEST_COUNT, SearchField.ROOM_COUNT, SearchField.ROOM_TYPE_ID}
MONEY_FIELDS = {SearchField.MIN_PRICE, SearchField.MAX_PRICE, SearchField.TOTAL_BUDGET}
LIST_FIELDS = {SearchField.PREFERRED_AMENITIES, SearchField.REQUIRED_AMENITIES}


class NeedsExtractor(Protocol):
    async def extract(
        self, message: str, state: SearchState, *, today: date, request_id: str
    ) -> ExtractedChanges: ...


def _normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_value(field: SearchField, value: str) -> object:
    if field in DATE_FIELDS:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("date must be YYYY-MM-DD")
        return date.fromisoformat(value)
    if field in INT_FIELDS:
        if not re.fullmatch(r"[1-9][0-9]*", value):
            raise ValueError("integer must be positive")
        return int(value)
    if field in MONEY_FIELDS:
        number = Decimal(value)
        if not number.is_finite() or number < 0:
            raise ValueError("money must be finite and non-negative")
        return number
    if field in LIST_FIELDS:
        items = [item.strip() for item in value.split(",")]
        if not items or any(not item for item in items):
            raise ValueError("amenity list must contain nonblank items")
        return items
    return value.strip()


def apply_changes(state: SearchState, extracted: ExtractedChanges) -> SearchState:
    """Apply explicit SET/CLEAR only; an absent field retains its previous value."""

    values = state.model_dump(by_alias=True)
    try:
        ambiguous = set(extracted.ambiguities)
        if SearchField.BUDGET_BASIS in ambiguous:
            ambiguous.update(MONEY_FIELDS)
        for change in extracted.changes:
            if change.field in ambiguous:
                continue
            values[change.field.value] = (
                ([] if change.field in LIST_FIELDS else None)
                if change.action == "CLEAR"
                else _parse_value(change.field, change.value or "")
            )
            if change.field is SearchField.ROOM_TYPE_NAME and change.action == "SET":
                values["roomTypeId"] = None
            if change.field is SearchField.ROOM_TYPE_ID and change.action == "SET":
                values["roomTypeName"] = None
        return SearchState.model_validate(values)
    except (ValueError, InvalidOperation, ValidationError) as exc:
        raise ExtractionInvalidResponse("LLM produced invalid search criteria") from exc


class ConversationService:
    def __init__(
        self,
        backend: BackendClient,
        extractor: NeedsExtractor,
        *,
        timezone: ZoneInfo,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._backend = backend
        self._extractor = extractor
        self._timezone = timezone
        self._clock = clock

    async def execute(self, request: ConversationRequest, *, request_id: str) -> ConversationResponse:
        today = self._clock().astimezone(self._timezone).date()
        extracted = await self._extractor.extract(
            request.message, request.state, today=today, request_id=request_id
        )
        date_changes = [
            change.field
            for change in extracted.changes
            if change.field in DATE_FIELDS and change.action == "SET"
        ]
        has_year = re.search(r"(?<!\d)(?:19|20)\d{2}(?!\d)", request.message) is not None
        has_relative_day = any(word in _normalize(request.message) for word in ("hôm nay", "ngày mai"))
        has_prior_date = request.state.check_in_date is not None or request.state.check_out_date is not None
        if date_changes and not (has_year or has_relative_day or has_prior_date):
            extracted = extracted.model_copy(
                update={"ambiguities": list(dict.fromkeys([*date_changes, *extracted.ambiguities]))}
            )
        state = apply_changes(request.state, extracted)

        def respond(
            status: ConversationStatus, reply: str, fields: list[SearchField] | None = None
        ) -> ConversationResponse:
            return ConversationResponse(
                status=status,
                reply=reply,
                state=state,
                clarificationFields=fields or [],
                result=None,
                requestId=request_id,
            )

        if extracted.unsupported_intent:
            return respond(ConversationStatus.UNSUPPORTED, "Tôi chỉ hỗ trợ tìm và gợi ý phòng phù hợp.")
        if state.room_count is not None and state.room_count != 1:
            return respond(
                ConversationStatus.UNSUPPORTED,
                "Hiện chỉ hỗ trợ tìm một phòng cho mỗi lần yêu cầu.",
            )
        if state.total_budget is not None:
            return respond(
                ConversationStatus.UNSUPPORTED,
                "Hiện chưa lọc theo tổng ngân sách toàn kỳ. Bạn có thể cho biết mức tối đa mỗi đêm.",
            )
        if state.required_amenities:
            return respond(
                ConversationStatus.UNSUPPORTED,
                "Hiện chưa bảo đảm tiện nghi bắt buộc. Bạn có thể đổi thành tiện nghi ưu tiên.",
            )
        if extracted.ambiguities:
            field = extracted.ambiguities[0]
            return respond(ConversationStatus.NEEDS_CLARIFICATION, FIELD_QUESTIONS[field], [field])

        required = (
            (SearchField.CHECK_IN_DATE, state.check_in_date),
            (SearchField.CHECK_OUT_DATE, state.check_out_date),
            (SearchField.GUEST_COUNT, state.guest_count),
            (SearchField.ROOM_COUNT, state.room_count),
        )
        missing = [field for field, value in required if value is None]
        if missing:
            return respond(
                ConversationStatus.NEEDS_CLARIFICATION, FIELD_QUESTIONS[missing[0]], missing
            )
        if state.check_in_date < today:
            return respond(
                ConversationStatus.NEEDS_CLARIFICATION,
                "Ngày nhận phòng đã qua. Bạn muốn nhận phòng ngày nào trong tương lai?",
                [SearchField.CHECK_IN_DATE],
            )
        if state.check_out_date <= state.check_in_date:
            return respond(
                ConversationStatus.NEEDS_CLARIFICATION,
                "Ngày trả phòng phải sau ngày nhận phòng. Bạn muốn trả ngày nào?",
                [SearchField.CHECK_OUT_DATE],
            )
        if state.min_price is not None and state.max_price is not None and state.min_price > state.max_price:
            return respond(
                ConversationStatus.NEEDS_CLARIFICATION,
                "Giá tối đa mỗi đêm đang thấp hơn giá tối thiểu. Bạn muốn sửa mức nào?",
                [SearchField.MIN_PRICE, SearchField.MAX_PRICE],
            )

        room_type_id = state.room_type_id
        if state.room_type_name is not None:
            room_types = await self._backend.list_room_types(request_id=request_id)
            matches = [
                room_type
                for room_type in room_types
                if _normalize(room_type.type_name) == _normalize(state.room_type_name)
            ]
            if len(matches) != 1:
                names = ", ".join(room_type.type_name for room_type in room_types[:8])
                return respond(
                    ConversationStatus.NEEDS_CLARIFICATION,
                    f"Không tìm thấy đúng hạng phòng đó. Các hạng hiện có: {names}. Bạn muốn chọn hạng nào?",
                    [SearchField.ROOM_TYPE_NAME],
                )
            room_type_id = matches[0].room_type_id

        criteria = RecommendationRequest.model_validate(
            {
                "checkInDate": state.check_in_date,
                "checkOutDate": state.check_out_date,
                "guestCount": state.guest_count,
                "roomTypeId": room_type_id,
                "minPrice": state.min_price,
                "maxPrice": state.max_price,
                "sortBy": state.sort_by,
                "preferences": {"amenities": state.preferred_amenities},
            }
        )
        result = await RecommendationPipeline(self._backend).execute(criteria, request_id=request_id)
        if result.status is RecommendationStatus.NO_MATCH:
            return ConversationResponse(
                status=ConversationStatus.NO_MATCH,
                reply="Hiện không có phòng thỏa các điều kiện này. Bạn có thể đổi ngày hoặc ngân sách.",
                state=state,
                clarificationFields=[],
                result=result,
                requestId=request_id,
            )

        rooms = []
        for room in result.recommendations:
            reasons = [f"Đủ sức chứa cho {state.guest_count} khách"]
            if state.max_price is not None:
                reasons.append("Giá mỗi đêm nằm trong mức tối đa đã chọn")
            reasons.extend(
                reason.replace("Amenity preference matched: ", "Khớp tiện nghi ưu tiên: ")
                for reason in room.reasons
            )
            rooms.append(room.model_copy(update={"reasons": reasons}))
        result = result.model_copy(update={"recommendations": rooms})
        return ConversationResponse(
            status=ConversationStatus.RECOMMENDED,
            reply=f"Có {len(rooms)} phòng phù hợp. Gợi ý này không giữ chỗ; tình trạng có thể thay đổi.",
            state=state,
            clarificationFields=[],
            result=result,
            requestId=request_id,
        )
