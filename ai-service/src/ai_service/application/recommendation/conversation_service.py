"""Stateless, validated Vietnamese room-search conversation orchestration."""

import re
import unicodedata
from collections.abc import Callable
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Protocol
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from ai_service.application.recommendation.amenities import (
    AmenityCriteriaError,
    normalize,
    resolve_criteria,
)
from ai_service.application.recommendation.conversation_models import (
    BudgetBasis,
    BudgetScope,
    ConversationRequest,
    ConversationResponse,
    ConversationStatus,
    ExtractedChanges,
    FieldChange,
    PendingBudget,
    PendingDate,
    PendingField,
    RelaxationDecision,
    RelaxationProposal,
    SearchField,
    SearchState,
)
from ai_service.application.recommendation.models import (
    CapacityPreference,
    PricePreference,
    RecommendationRequest,
    RecommendationStatus,
)
from ai_service.application.recommendation.pipeline import RecommendationPipeline
from ai_service.application.recommendation.scoring import MultiCriteriaScorer, ScoringConfig
from ai_service.infrastructure.backend.client import BackendClient
from ai_service.infrastructure.llm import ExtractionInvalidResponse

FIELD_QUESTIONS = {
    SearchField.CHECK_IN_DATE: "Bạn muốn nhận phòng ngày nào? Vui lòng ghi đủ ngày, tháng và năm.",
    SearchField.CHECK_OUT_DATE: "Bạn muốn trả phòng ngày nào? Vui lòng ghi đủ ngày, tháng và năm.",
    SearchField.GUEST_COUNT: "Một phòng sẽ có tổng cộng bao nhiêu khách?",
    SearchField.ROOM_COUNT: "Bạn cần một phòng hay nhiều phòng?",
    SearchField.BUDGET_BASIS: "Ngân sách này tính cho mỗi đêm hay cho toàn kỳ ở?",
    SearchField.BUDGET: "Bạn muốn giới hạn ngân sách ở mức bao nhiêu?",
    SearchField.ROOM_TYPE_NAME: "Bạn muốn hạng phòng nào trong danh mục khách sạn?",
    SearchField.ROOM_TYPE_ID: "Bạn muốn chọn mã hạng phòng nào?",
    SearchField.MIN_PRICE: "Vui lòng cho biết mức giá tối thiểu mỗi đêm.",
    SearchField.MAX_PRICE: "Vui lòng cho biết mức giá tối đa mỗi đêm.",
    SearchField.TOTAL_BUDGET: "Bạn muốn giới hạn giá mỗi đêm ở mức nào?",
    SearchField.REQUIRED_AMENITIES: "Tiện nghi đó là bắt buộc hay chỉ ưu tiên?",
    SearchField.PREFERRED_AMENITIES: "Bạn muốn ưu tiên tiện nghi nào?",
    SearchField.SORT_BY: "Bạn muốn sắp xếp theo giá tăng hay giảm?",
    SearchField.PRICE_PREFERENCE: "Bạn ưu tiên tiết kiệm hay phòng giá cao hơn?",
    SearchField.CAPACITY_PREFERENCE: (
        "Bạn muốn ưu tiên phòng có sức chứa nhiều khách hơn, hay đang cần thông tin "
        "diện tích/độ rộng? Hiện hệ thống chưa có dữ liệu diện tích để so sánh."
    ),
    SearchField.BUDGET_SCOPE: (
        "Hiện chỉ lọc được tổng tiền phòng cơ bản do hệ thống trả về, chưa gồm thuế, "
        "dịch vụ, voucher hoặc chi phí khác. Bạn có đồng ý dùng phạm vi này không?"
    ),
}
DATE_FIELDS = {SearchField.CHECK_IN_DATE, SearchField.CHECK_OUT_DATE}
INT_FIELDS = {SearchField.GUEST_COUNT, SearchField.ROOM_COUNT, SearchField.ROOM_TYPE_ID}
MONEY_FIELDS = {
    SearchField.MIN_PRICE,
    SearchField.MAX_PRICE,
    SearchField.TOTAL_BUDGET,
    SearchField.BUDGET,
}
LIST_FIELDS = {SearchField.PREFERRED_AMENITIES, SearchField.REQUIRED_AMENITIES}
FULL_NUMERIC_DATE = re.compile(r"(?<!\d)(\d{1,2})[/-](\d{1,2})[/-]((?:19|20)\d{2})(?!\d)")
SHARED_YEAR_RANGE = re.compile(
    r"(?<!\d)(\d{1,2})\s*(?:-|đến)\s*(\d{1,2})[/-](\d{1,2})[/-]((?:19|20)\d{2})(?!\d)",
    re.IGNORECASE,
)
YEAR = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")


class NeedsExtractor(Protocol):
    async def extract(
        self, message: str, state: SearchState, *, today: date, request_id: str
    ) -> ExtractedChanges: ...


def _normalize(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).casefold().split())


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_value(field: SearchField, value: str) -> object:
    if field is SearchField.BUDGET_SCOPE:
        return BudgetScope(value)
    if field is SearchField.PRICE_PREFERENCE:
        return PricePreference(value)
    if field is SearchField.CAPACITY_PREFERENCE:
        return CapacityPreference(value)
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


def _date_parts(value: str) -> tuple[int, int]:
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        parsed = date.fromisoformat(value)
        return parsed.month, parsed.day
    if re.fullmatch(r"\d{2}-\d{2}", value):
        month, day = map(int, value.split("-"))
    elif re.fullmatch(r"\d{1,2}/\d{1,2}", value):
        day, month = map(int, value.split("/"))
    else:
        raise ValueError("pending date must contain day and month")
    date(2000, month, day)
    return month, day


def _pending_key(item: PendingBudget | PendingDate | PendingField) -> SearchField:
    return SearchField.BUDGET if isinstance(item, PendingBudget) else item.field


def _next_pending_question(pending: dict[SearchField, object]) -> SearchField | None:
    for field in (SearchField.BUDGET, SearchField.CHECK_IN_DATE, SearchField.CHECK_OUT_DATE):
        item = pending.get(field)
        if isinstance(item, PendingBudget):
            return SearchField.BUDGET if item.amount is None else SearchField.BUDGET_BASIS
        if item is not None:
            return field
    return next(iter(pending), None)


def _suggest_relaxation(state: SearchState) -> RelaxationProposal:
    if state.total_budget is not None:
        return RelaxationProposal(criterion=SearchField.TOTAL_BUDGET)
    if state.max_price is not None:
        return RelaxationProposal(criterion=SearchField.MAX_PRICE)
    if state.required_amenities:
        return RelaxationProposal(
            criterion=SearchField.REQUIRED_AMENITIES, value=state.required_amenities[0]
        )
    return RelaxationProposal(criterion=SearchField.CHECK_IN_DATE)


def _relaxation_question(proposal: RelaxationProposal) -> str:
    if proposal.criterion is SearchField.TOTAL_BUDGET:
        return "Bạn có muốn tăng giới hạn tổng tiền phòng cơ bản toàn kỳ? Nếu có, hãy cho biết mức mới."
    if proposal.criterion is SearchField.MAX_PRICE:
        return "Bạn có muốn tăng giới hạn giá mỗi đêm? Nếu có, hãy cho biết mức mới."
    if proposal.criterion is SearchField.REQUIRED_AMENITIES:
        return f"Bạn có muốn bỏ yêu cầu bắt buộc về tiện nghi {proposal.value} không?"
    return "Bạn có muốn thử ngày khác? Nếu có, hãy cho biết ngày nhận và trả phòng mới."


def _explicit_relaxation_decision(message: str) -> RelaxationDecision | None:
    answer = re.sub(r"[.!?]+$", "", normalize(message)).strip()
    if answer in {"dong y", "co", "duoc", "vang", "ok", "yes"}:
        return RelaxationDecision.ACCEPT
    if answer in {"khong", "khong muon", "giu nguyen", "no"}:
        return RelaxationDecision.REJECT
    return None


def _mentions_unavailable_costs(message: str) -> bool:
    normalized = normalize(message)
    if re.search(r"(?<!\w)thuế(?!\w)", _normalize(message)):
        return True
    return any(
        phrase in normalized
        for phrase in (
            "tax", "dich vu", "service", "voucher", "phi khac", "tong chi phi",
            "thanh toan cuoi", "tat ca chi phi", "moi chi phi", "phu thu", "bua sang",
            "bao gom thue", "gom thue", "tinh thue", "ca thue",
        )
    )


def _ambiguous_room_size(message: str) -> bool:
    """Room size is not guest capacity; require an explicit capacity request."""
    normalized = normalize(message)
    size_words = re.search(r"\b(?:rong|dien tich|met vuong|m2)\b", normalized)
    capacity_words = re.search(r"\b(?:suc chua|chua du|chua nhieu)\b", normalized)
    return bool(size_words and not capacity_words)


def _area_answer_to_capacity_question(message: str, state: SearchState) -> bool:
    normalized = normalize(message)
    return (
        state.pending_question is SearchField.CAPACITY_PREFERENCE
        and any(
            isinstance(item, PendingField) and item.field is SearchField.CAPACITY_PREFERENCE
            for item in state.pending
        )
        and bool(re.search(r"\b(?:dien tich|met vuong|m2)\b", normalized))
        and not re.search(r"\b(?:suc chua|chua du|chua nhieu)\b", normalized)
        and not re.search(
            r"\bkhong (?:can|muon|quan tam) (?:thong tin )?(?:dien tich|met vuong|m2)\b",
            normalized,
        )
    )


def _date_is_explicit(message: str, value: str, today: date | None) -> bool:
    if not message:
        return True
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return False
    parsed = date.fromisoformat(value)
    normalized = _normalize(message)
    if today is not None and (
        ("hôm nay" in normalized and parsed == today)
        or ("ngày mai" in normalized and parsed == today + timedelta(days=1))
    ):
        return True
    years = YEAR.findall(message)
    if not years:
        return False
    if str(parsed.year) not in years:
        return False
    shared = SHARED_YEAR_RANGE.search(message)
    if shared and (parsed.day, parsed.month, parsed.year) in {
        (int(shared.group(1)), int(shared.group(3)), int(shared.group(4))),
        (int(shared.group(2)), int(shared.group(3)), int(shared.group(4))),
    }:
        return True
    full_dates = {
        (int(year), int(month), int(day)) for day, month, year in FULL_NUMERIC_DATE.findall(message)
    }
    return not full_dates or (parsed.year, parsed.month, parsed.day) in full_dates


def _resolve_budget_basis(
    state: SearchState, values: dict, pending: dict[SearchField, object],
    changes: dict[SearchField, FieldChange], ambiguous: set[SearchField],
    budget_was_cleared: bool,
) -> None:
    basis_change = changes.get(SearchField.BUDGET_BASIS)
    if (
        basis_change is not None
        and not budget_was_cleared
        and SearchField.BUDGET_BASIS not in ambiguous
    ):
        budget = pending.get(SearchField.BUDGET)
        if (
            not isinstance(budget, PendingBudget)
            and state.max_price is not None
            and state.total_budget is not None
            and basis_change.action == "SET"
        ):
            budget = PendingBudget()
        if not isinstance(budget, PendingBudget) and (
            (state.max_price is None) != (state.total_budget is None)
        ):
            amount = state.max_price if state.max_price is not None else state.total_budget
            budget = PendingBudget(amount=amount)
            old_field = "maxPrice" if state.max_price is not None else "totalBudget"
            values[old_field] = None
        if isinstance(budget, PendingBudget):
            basis = BudgetBasis(basis_change.value) if basis_change.action == "SET" else None
            pending[SearchField.BUDGET] = budget.model_copy(update={"basis": basis})

    budget = pending.get(SearchField.BUDGET)
    if (
        isinstance(budget, PendingBudget)
        and budget.amount is not None
        and budget.basis is not None
    ):
        target = "maxPrice" if budget.basis is BudgetBasis.PER_NIGHT else "totalBudget"
        values[target] = budget.amount
        pending.pop(SearchField.BUDGET)


def _resolve_pending_year(
    state: SearchState, values: dict, pending: dict[SearchField, object],
    changes: dict[SearchField, FieldChange], message: str,
) -> None:
    year_only = re.fullmatch(
        r"\s*(?:năm\s*)?((?:19|20)\d{2})\s*[.!]?\s*", message, re.IGNORECASE
    )
    if (
        year_only
        and state.pending_question in DATE_FIELDS
        and not any(field in changes for field in DATE_FIELDS)
    ):
        year = int(year_only.group(1))
        dates = [
            pending.get(field)
            for field in (SearchField.CHECK_IN_DATE, SearchField.CHECK_OUT_DATE)
        ]
        dated = [
            item for item in dates if isinstance(item, PendingDate) and item.month is not None
        ]
        if len(dated) == 2:
            try:
                check_in = date(year, dated[0].month, dated[0].day)
                check_out = date(year, dated[1].month, dated[1].day)
            except ValueError:
                pass
            else:
                if check_out > check_in:
                    for item, resolved in zip(dated, (check_in, check_out)):
                        values[item.field.value] = resolved
                        pending.pop(item.field)
                else:
                    values[dated[0].field.value] = check_in
                    pending.pop(dated[0].field)
        elif dated:
            item = dated[0]
            try:
                resolved = date(year, item.month, item.day)
            except ValueError:
                pass
            else:
                values[item.field.value] = resolved
                pending.pop(item.field)


def apply_changes(
    state: SearchState, extracted: ExtractedChanges, *, message: str = "", today: date | None = None
) -> SearchState:
    """Keep unresolved edits in caller state; only confirmed criteria enter availability."""

    values = state.model_dump(by_alias=True)
    pending = {_pending_key(item): item for item in state.pending}
    ambiguous = set(extracted.ambiguities)
    changes = {change.field: change for change in extracted.changes}
    try:
        for change in extracted.changes:
            field = change.field
            if field is SearchField.BUDGET_BASIS:
                continue
            if field is SearchField.BUDGET:
                for money in MONEY_FIELDS - {SearchField.BUDGET}:
                    pending.pop(money, None)
                if change.action == "CLEAR":
                    pending.pop(SearchField.BUDGET, None)
                    for money in MONEY_FIELDS - {SearchField.BUDGET}:
                        values[money.value] = None
                else:
                    amount = _parse_value(field, change.value or "")
                    previous = pending.get(SearchField.BUDGET)
                    basis = previous.basis if isinstance(previous, PendingBudget) else None
                    pending[SearchField.BUDGET] = PendingBudget(amount=amount, basis=basis)
                continue
            if field in DATE_FIELDS:
                previous_date = pending.pop(field, None)
                if change.action == "CLEAR":
                    values[field.value] = None
                elif (
                    re.fullmatch(r"\s*(?:năm\s*)?(?:19|20)\d{2}\s*[.!]?\s*", message, re.IGNORECASE)
                    and isinstance(previous_date, PendingDate)
                    and previous_date.month is not None
                    and _date_parts(change.value or "") != (previous_date.month, previous_date.day)
                ):
                    pending[field] = previous_date
                elif field in ambiguous or not _date_is_explicit(
                    message, change.value or "", today
                ):
                    month, day = _date_parts(change.value or "")
                    values[field.value] = None
                    pending[field] = PendingDate(field=field, month=month, day=day)
                else:
                    values[field.value] = _parse_value(field, change.value or "")
                continue
            if field in MONEY_FIELDS:
                pending.pop(field, None)
                if change.action == "CLEAR":
                    if field in (SearchField.MAX_PRICE, SearchField.TOTAL_BUDGET):
                        pending.pop(SearchField.BUDGET, None)
                    values[field.value] = None
                elif SearchField.BUDGET_BASIS in ambiguous:
                    pending[SearchField.BUDGET] = PendingBudget(
                        amount=_parse_value(field, change.value or "")
                    )
                else:
                    if field in (SearchField.MAX_PRICE, SearchField.TOTAL_BUDGET):
                        pending.pop(SearchField.BUDGET, None)
                    values[field.value] = _parse_value(field, change.value or "")
                continue
            pending.pop(field, None)
            if change.action == "CLEAR":
                values[field.value] = [] if field in LIST_FIELDS else None
            elif field in ambiguous:
                values[field.value] = [] if field in LIST_FIELDS else None
                pending[field] = PendingField(field=field, value=change.value)
            else:
                values[field.value] = _parse_value(field, change.value or "")
            if field is SearchField.ROOM_TYPE_NAME and change.action == "SET":
                values["roomTypeId"] = None
            if field is SearchField.ROOM_TYPE_ID and change.action == "SET":
                values["roomTypeName"] = None

        budget_was_cleared = any(
            change.action == "CLEAR"
            for field, change in changes.items()
            if field in (SearchField.BUDGET, SearchField.MAX_PRICE, SearchField.TOTAL_BUDGET)
        )
        if (
            SearchField.BUDGET_BASIS in ambiguous
            and not budget_was_cleared
            and SearchField.BUDGET not in pending
        ):
            pending[SearchField.BUDGET] = PendingBudget()
        for field in ambiguous - set(changes):
            if field in (SearchField.BUDGET, SearchField.BUDGET_BASIS):
                if not budget_was_cleared and SearchField.BUDGET not in pending:
                    pending[SearchField.BUDGET] = PendingBudget()
            elif field in DATE_FIELDS:
                if field not in pending:
                    pending[field] = PendingDate(field=field)
                    values[field.value] = None
            elif field not in (SearchField.BUDGET,):
                if field not in pending:
                    pending[field] = PendingField(field=field)
                    values[field.value] = [] if field in LIST_FIELDS else None

        _resolve_budget_basis(state, values, pending, changes, ambiguous, budget_was_cleared)
        _resolve_pending_year(state, values, pending, changes, message)

        values["pending"] = list(pending.values())
        values["pendingQuestion"] = _next_pending_question(pending)
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
        scoring_config: ScoringConfig | None = None,
    ) -> None:
        self._backend = backend
        self._extractor = extractor
        self._timezone = timezone
        self._clock = clock
        self._scoring_config = scoring_config

    async def _extract_changes(
        self, request: ConversationRequest, *, request_id: str, today: date,
        proposal: RelaxationProposal | None,
    ) -> tuple[ExtractedChanges, bool]:
        area_answer = _area_answer_to_capacity_question(request.message, request.state)
        scope_pending = any(
            isinstance(item, PendingField) and item.field is SearchField.BUDGET_SCOPE
            for item in request.state.pending
        )
        direct_decision = (
            _explicit_relaxation_decision(request.message)
            if proposal is not None or scope_pending else None
        )
        if area_answer:
            extracted = ExtractedChanges.model_validate({
                "changes": [{
                    "field": SearchField.CAPACITY_PREFERENCE,
                    "action": "CLEAR", "value": None,
                }],
                "ambiguities": [], "unsupportedIntent": True,
            })
        elif scope_pending and direct_decision is not None:
            scope = (
                BudgetScope.ROOM_CHARGE if direct_decision is RelaxationDecision.ACCEPT
                else BudgetScope.ALL_COSTS
            )
            extracted = ExtractedChanges.model_validate({
                "changes": [{
                    "field": SearchField.BUDGET_SCOPE, "action": "SET", "value": scope.value,
                }],
                "ambiguities": [], "unsupportedIntent": False,
            })
        elif direct_decision is not None:
            extracted = ExtractedChanges.model_validate({
                "changes": [], "ambiguities": [], "unsupportedIntent": False,
                "relaxationDecision": direct_decision,
            })
        else:
            extracted = await self._extractor.extract(
                request.message, request.state, today=today, request_id=request_id
            )
        if not area_answer and _ambiguous_room_size(request.message):
            # A provider may still label "phòng rộng" as SPACIOUS. Never score that
            # inference; preserve other extracted search edits while asking what was meant.
            extracted = extracted.model_copy(update={
                "changes": [
                    change for change in extracted.changes
                    if not (
                        change.field is SearchField.CAPACITY_PREFERENCE
                        and change.action == "SET"
                    )
                ],
                "ambiguities": list(dict.fromkeys([
                    *extracted.ambiguities, SearchField.CAPACITY_PREFERENCE,
                ])),
            })
        if (
            _mentions_unavailable_costs(request.message)
            and not any(change.field is SearchField.BUDGET_SCOPE for change in extracted.changes)
            and SearchField.BUDGET_SCOPE not in extracted.ambiguities
        ):
            extracted = extracted.model_copy(
                update={"ambiguities": [*extracted.ambiguities, SearchField.BUDGET_SCOPE]}
            )
        if proposal is not None and proposal.criterion in (
            SearchField.MAX_PRICE, SearchField.TOTAL_BUDGET
        ):
            extracted = extracted.model_copy(
                update={
                    "changes": [
                        change.model_copy(update={"field": proposal.criterion})
                        if change.field is SearchField.BUDGET
                        and SearchField.BUDGET_BASIS not in extracted.ambiguities
                        else change
                        for change in extracted.changes
                    ]
                }
            )
        return extracted, area_answer

    async def execute(
        self, request: ConversationRequest, *, request_id: str
    ) -> ConversationResponse:
        today = self._clock().astimezone(self._timezone).date()
        proposal = request.state.pending_relaxation
        extracted, area_answer = await self._extract_changes(
            request, request_id=request_id, today=today, proposal=proposal
        )
        explicit_changes = bool(extracted.changes or extracted.ambiguities)
        if proposal is not None and not explicit_changes:
            if extracted.unsupported_intent:
                return ConversationResponse(
                    status=ConversationStatus.UNSUPPORTED,
                    reply="Tôi chỉ hỗ trợ tìm và gợi ý phòng phù hợp.",
                    state=request.state,
                    clarificationFields=[], result=None, requestId=request_id,
                )
            if extracted.relaxation_decision is RelaxationDecision.REJECT:
                state = request.state.model_copy(update={"pending_relaxation": None})
                return ConversationResponse(
                    status=ConversationStatus.NO_MATCH,
                    reply="Đã giữ nguyên các điều kiện tìm kiếm. Chưa có phòng đáp ứng yêu cầu hiện tại.",
                    state=state,
                    clarificationFields=[], result=None, requestId=request_id,
                )
            if extracted.relaxation_decision is RelaxationDecision.ACCEPT:
                if proposal.criterion is SearchField.REQUIRED_AMENITIES:
                    kept = [
                        item for item in request.state.required_amenities
                        if item != proposal.value
                    ]
                    values = request.state.model_dump(by_alias=True)
                    values["requiredAmenities"] = kept
                    values["pendingRelaxation"] = None
                    state_input = SearchState.model_validate(values)
                else:
                    return ConversationResponse(
                        status=ConversationStatus.NEEDS_CLARIFICATION,
                        reply=_relaxation_question(proposal),
                        state=request.state,
                        clarificationFields=[proposal.criterion],
                        result=None, requestId=request_id,
                    )
            else:
                return ConversationResponse(
                    status=ConversationStatus.NEEDS_CLARIFICATION,
                    reply=_relaxation_question(proposal),
                    state=request.state,
                    clarificationFields=[proposal.criterion], result=None, requestId=request_id,
                )
        else:
            state_input = request.state.model_copy(update={"pending_relaxation": None})
        state = apply_changes(state_input, extracted, message=request.message, today=today)

        def respond(
            status: ConversationStatus, reply: str, fields: list[SearchField] | None = None
        ) -> ConversationResponse:
            return ConversationResponse(
                status=status,
                reply=reply,
                state=state.model_copy(update={"pending_question": fields[0] if fields else None}),
                clarificationFields=fields or [],
                result=None,
                requestId=request_id,
            )

        if area_answer:
            return ConversationResponse(
                status=ConversationStatus.UNSUPPORTED,
                reply=(
                    "Hiện dữ liệu phòng chưa có diện tích để so sánh độ rộng. "
                    "Sức chứa chỉ cho biết số khách tối đa, không chứng minh phòng rộng hơn."
                ),
                state=state,
                clarificationFields=[],
                result=None,
                requestId=request_id,
            )
        if state.pending:
            field = state.pending_question
            if field in (SearchField.REQUIRED_AMENITIES, SearchField.PREFERRED_AMENITIES):
                return respond(
                    ConversationStatus.NEEDS_CLARIFICATION,
                    "Tôi chưa xác nhận được tiện nghi này. Bạn hãy nhập lại toàn bộ danh sách muốn giữ, dùng tên cụ thể như Wi-Fi, ban công, minibar, TV, điều hòa, bồn tắm hoặc bếp.",
                    [field],
                )
            return respond(ConversationStatus.NEEDS_CLARIFICATION, FIELD_QUESTIONS[field], [field])
        if extracted.unsupported_intent:
            return respond(
                ConversationStatus.UNSUPPORTED, "Tôi chỉ hỗ trợ tìm và gợi ý phòng phù hợp."
            )
        if state.budget_scope is BudgetScope.ALL_COSTS:
            return respond(
                ConversationStatus.UNSUPPORTED,
                "Chưa thể lọc ngân sách gồm thuế, dịch vụ, voucher hoặc chi phí khác. "
                "Hiện chỉ hỗ trợ tổng tiền phòng cơ bản do hệ thống trả về.",
            )
        if state.room_count is not None and state.room_count != 1:
            return respond(
                ConversationStatus.UNSUPPORTED,
                "Hiện chỉ hỗ trợ tìm một phòng cho mỗi lần yêu cầu.",
            )
        try:
            resolve_criteria(state.required_amenities, state.preferred_amenities)
        except AmenityCriteriaError as exc:
            field = SearchField(exc.field)
            values = state.model_dump(by_alias=True)
            original = values[field.value]
            values[field.value] = []
            values["pending"] = [
                *state.pending,
                PendingField(field=field, value=", ".join(original)),
            ]
            values["pendingQuestion"] = field
            state = SearchState.model_validate(values)
            detail = (
                "Tên tiện nghi chưa có trong danh mục."
                if exc.reason == "UNKNOWN"
                else "Một tiện nghi đang được đánh dấu vừa bắt buộc vừa ưu tiên."
            )
            return respond(
                ConversationStatus.NEEDS_CLARIFICATION,
                f"{detail} Bạn hãy nhập lại toàn bộ danh sách tiện nghi muốn giữ hoặc xóa yêu cầu; các tên hỗ trợ gồm Wi-Fi, ban công, minibar, TV, điều hòa, bồn tắm và bếp.",
                [field],
            )
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
        if (
            state.min_price is not None
            and state.max_price is not None
            and state.min_price > state.max_price
        ):
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
                "totalBudget": state.total_budget,
                "sortBy": state.sort_by,
                "requiredAmenities": state.required_amenities,
                "preferences": {
                    "amenities": state.preferred_amenities,
                    "price": state.price_preference,
                    "capacity": state.capacity_preference,
                },
            }
        )
        result = await RecommendationPipeline(
            self._backend, scorer=MultiCriteriaScorer(self._scoring_config)
        ).execute(
            criteria, request_id=request_id
        )
        if result.status is RecommendationStatus.NO_MATCH:
            proposal = _suggest_relaxation(state)
            state = state.model_copy(update={"pending_relaxation": proposal})
            reply = (
                "Chưa tìm thấy phòng đáp ứng đồng thời các điều kiện hiện tại. "
                "Chưa xác định điều kiện nào là nguyên nhân. "
                + _relaxation_question(proposal)
            )
            return ConversationResponse(
                status=ConversationStatus.NO_MATCH,
                reply=reply,
                state=state,
                clarificationFields=[],
                result=result,
                requestId=request_id,
            )

        rooms = result.recommendations
        budget_note = (
            " Giới hạn toàn kỳ chỉ tính tổng tiền phòng cơ bản, chưa gồm thuế, dịch vụ, "
            "voucher hoặc chi phí khác."
            if state.total_budget is not None else ""
        )
        return ConversationResponse(
            status=ConversationStatus.RECOMMENDED,
            reply=(
                f"Có {len(rooms)} phòng phù hợp. Gợi ý này không giữ chỗ; "
                f"tình trạng có thể thay đổi.{budget_note}"
            ),
            state=state,
            clarificationFields=[],
            result=result,
            requestId=request_id,
        )
