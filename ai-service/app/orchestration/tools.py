"""Deterministic D2/D3/D4 business, booking, and combined policy planning & rendering."""

from decimal import Decimal
from uuid import uuid4

from app.diagnostics import Category
from app.orchestration.continuations import (
    CombinedPolicyContext,
    ContinuationStore,
    FollowupClarification,
    PendingCall,
)
from app.providers.contracts import DependencyError, TurnBudget
from app.schemas.turn import (
    BookingDetail,
    BookingList,
    ResumeTurn,
    RoomList,
    ServiceList,
    StartTurn,
    ToolResult,
)
from app.tools.schemas import (
    TurnPlan,
    validate_booking_with_policy_plan,
    validate_get_booking_plan,
    validate_list_bookings_plan,
    validate_room_search_plan,
    validate_service_list_plan,
)

_MAX_ANSWER_LEN = 4000
_COMBINED_DISCLAIMER = (
    "Lưu ý: Trợ lý không tự tính khoản hoàn tiền hoặc phí phát sinh cuối cùng cho đơn đặt phòng "
    "cụ thể; mức áp dụng thực tế cần nhân viên xác minh theo chứng từ và trạng thái giao dịch "
    "tại thời điểm xử lý."
)
_ACTION_OPEN_ROOM_SEARCH = {
    "type": "open_room_search",
    "label": "Mở trang tìm & đặt phòng",
    "targetId": None,
}
_ACTION_OPEN_SERVICES = {
    "type": "open_services",
    "label": "Xem trang dịch vụ",
    "targetId": None,
}
_ACTION_OPEN_LOGIN = {
    "type": "open_login",
    "label": "Đăng nhập tài khoản",
    "targetId": None,
}
_BOOKING_STATUS_LABELS = {
    "PENDING_DEPOSIT": "Chờ thanh toán cọc",
    "CONFIRMED": "Đã xác nhận",
    "CHECKED_IN": "Đang lưu trú",
    "CHECKED_OUT": "Đã trả phòng",
    "CANCELED": "Đã hủy",
    "EXPIRED": "Đã hết hạn",
}


def format_vnd(amount: str) -> str:
    """Format a validated decimal string (e.g. '1500000' or '200000.5') as '1.500.000 VND'."""
    value = Decimal(amount)
    if value == value.to_integral_value():
        return f"{int(value):,}".replace(",", ".") + " VND"
    integer_part = int(value)
    frac_part = format(value - Decimal(integer_part), "f").split(".", 1)[1].rstrip("0")
    return f"{integer_part:,}".replace(",", ".") + f",{frac_part} VND"


def _final_response(
    *,
    request_id: str,
    conversation_id: str,
    turn_id: str,
    status: str,
    answer: str,
    mode: str,
    missing_fields: list[str] | None = None,
    actions: list[dict] | None = None,
    usage: dict | None = None,
) -> dict:
    trimmed = answer.strip()
    if len(trimmed) > _MAX_ANSWER_LEN:
        trimmed = trimmed[: _MAX_ANSWER_LEN - 1].rstrip() + "…"
    return {
        "requestId": request_id,
        "conversationId": conversation_id,
        "turnId": turn_id,
        "kind": "final",
        "continuationId": None,
        "toolCalls": [],
        "final": {
            "status": status,
            "answer": trimmed,
            "missingFields": list(missing_fields or []),
            "citations": [],
            "cards": [],
            "actions": list(actions or []),
            "corpusMode": mode,
        },
        "evidence": [],
        "usage": usage
        or {
            "toolCallsUsed": 0,
            "brokerBatchesUsed": 0,
            "inputTokensUsed": 0,
            "outputTokensUsed": 0,
        },
    }


def _emit_tool_calls(
    *,
    calls: list[tuple[str, dict]],
    payload: StartTurn,
    budget: TurnBudget,
    continuations: ContinuationStore,
    usage: dict,
    min_tool_calls: int | None = None,
    policy_context: CombinedPolicyContext | None = None,
    followup: FollowupClarification | None = None,
) -> dict:
    required_calls = max(len(calls), min_tool_calls or len(calls))
    if (
        payload.budget.remainingToolCalls < required_calls
        or payload.budget.remainingBrokerBatches < 1
    ):
        raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)
    pending: list[PendingCall] = []
    wire_calls: list[dict] = []
    for tool_name, arguments in calls:
        call_id = uuid4()
        pending.append(PendingCall(call_id=call_id, name=tool_name))
        wire_calls.append(
            {
                "callId": str(call_id),
                "name": tool_name,
                "arguments": arguments,
            }
        )
    continuation_id = continuations.create(
        conversation_id=payload.conversationId,
        turn_id=payload.turnId,
        pending_calls=pending,
        remaining_ms=max(1, int(budget.seconds() * 1000)),
        policy_context=policy_context,
        followup=followup,
    )
    return {
        "requestId": payload.requestId,
        "conversationId": str(payload.conversationId),
        "turnId": str(payload.turnId),
        "kind": "tool_calls",
        "continuationId": str(continuation_id),
        "toolCalls": wire_calls,
        "usage": usage,
        "evidence": [],
    }


def _emit_single_tool_call(
    *,
    tool_name: str,
    arguments: dict,
    payload: StartTurn,
    budget: TurnBudget,
    continuations: ContinuationStore,
    usage: dict,
    min_tool_calls: int = 1,
    policy_context: CombinedPolicyContext | None = None,
    followup: FollowupClarification | None = None,
) -> dict:
    return _emit_tool_calls(
        calls=[(tool_name, arguments)],
        payload=payload,
        budget=budget,
        continuations=continuations,
        usage=usage,
        min_tool_calls=min_tool_calls,
        policy_context=policy_context,
        followup=followup,
    )


def plan_business_turn(
    plan: TurnPlan,
    payload: StartTurn,
    budget: TurnBudget,
    continuations: ContinuationStore,
    mode: str,
) -> dict:
    """Translate a validated TurnPlan into either kind=tool_calls or a final response."""
    usage = {
        "toolCallsUsed": 0,
        "brokerBatchesUsed": 0,
        "inputTokensUsed": budget.input_used,
        "outputTokensUsed": budget.output_used,
    }

    if plan.intent == "search_rooms":
        if "search_rooms" not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="capability_unavailable",
                answer="Chức năng tra cứu phòng trống hiện chưa được bật cho phiên này.",
                mode=mode,
                actions=[_ACTION_OPEN_ROOM_SEARCH],
                usage=usage,
            )
        arguments, missing, clarification = validate_room_search_plan(plan, payload.context.today)
        if arguments is None:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="needs_clarification",
                answer=clarification
                or "Bạn vui lòng cung cấp ngày nhận phòng, ngày trả phòng và số khách.",
                mode=mode,
                missing_fields=missing,
                actions=[_ACTION_OPEN_ROOM_SEARCH],
                usage=usage,
            )
        return _emit_single_tool_call(
            tool_name="search_rooms",
            arguments=arguments,
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
        )

    if plan.intent == "list_services":
        if "list_services" not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="capability_unavailable",
                answer="Chức năng tra cứu dịch vụ hiện chưa được bật cho phiên này.",
                mode=mode,
                usage=usage,
            )
        return _emit_single_tool_call(
            tool_name="list_services",
            arguments=validate_service_list_plan(plan),
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
        )

    if plan.intent == "rooms_and_services":
        can_rooms = "search_rooms" in payload.allowedTools
        can_services = "list_services" in payload.allowedTools
        if not (can_rooms or can_services):
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="capability_unavailable",
                answer="Chức năng tra cứu phòng trống và dịch vụ hiện chưa được bật cho phiên này.",
                mode=mode,
                actions=[_ACTION_OPEN_ROOM_SEARCH],
                usage=usage,
            )
        room_args, missing, clarification = (
            validate_room_search_plan(plan, payload.context.today)
            if can_rooms
            else (None, [], None)
        )
        service_args = validate_service_list_plan(plan) if can_services else None

        if can_rooms and can_services:
            if room_args is not None and service_args is not None:
                return _emit_tool_calls(
                    calls=[("search_rooms", room_args), ("list_services", service_args)],
                    payload=payload,
                    budget=budget,
                    continuations=continuations,
                    usage=usage,
                    min_tool_calls=2,
                )
            # Dates/guests missing for rooms: still fetch live services immediately and
            # append a clear room-price clarification on resume.
            room_note = (
                f"Về giá phòng trống: {clarification}"
                if clarification
                else "Về giá phòng trống: Bạn vui lòng cung cấp thêm ngày nhận phòng, ngày trả phòng và số lượng khách nhé."
            )
            return _emit_single_tool_call(
                tool_name="list_services",
                arguments=service_args or {"limit": 5},
                payload=payload,
                budget=budget,
                continuations=continuations,
                usage=usage,
                followup=FollowupClarification(
                    note=room_note,
                    missing_fields=tuple(missing),
                    actions=(_ACTION_OPEN_ROOM_SEARCH,),
                ),
            )
        if can_services and service_args is not None:
            return _emit_single_tool_call(
                tool_name="list_services",
                arguments=service_args,
                payload=payload,
                budget=budget,
                continuations=continuations,
                usage=usage,
            )
        if room_args is None:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="needs_clarification",
                answer=clarification
                or "Bạn vui lòng cung cấp ngày nhận phòng, ngày trả phòng và số khách.",
                mode=mode,
                missing_fields=missing,
                actions=[_ACTION_OPEN_ROOM_SEARCH],
                usage=usage,
            )
        return _emit_single_tool_call(
            tool_name="search_rooms",
            arguments=room_args,
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
        )

    if plan.intent == "policy_and_rooms":
        if "search_rooms" in payload.allowedTools:
            room_args, _, _ = validate_room_search_plan(plan, payload.context.today)
            if room_args is not None and "search_knowledge" in payload.allowedTools:
                policy_query = (plan.policyQuery or plan.query).strip() or plan.query.strip()
                return _emit_single_tool_call(
                    tool_name="search_rooms",
                    arguments=room_args,
                    payload=payload,
                    budget=budget,
                    continuations=continuations,
                    usage=usage,
                    min_tool_calls=2,
                    policy_context=CombinedPolicyContext(
                        original_message=policy_query,
                        policy_query=policy_query,
                        today=payload.context.today,
                        allowed_tools=tuple(payload.allowedTools),
                    ),
                )

    if plan.intent == "list_my_bookings":
        if "list_my_bookings" not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="requires_login",
                answer=(
                    "Để xem danh sách đơn đặt phòng của bạn, vui lòng đăng nhập tài khoản "
                    "khách hàng trước nhé."
                ),
                mode=mode,
                actions=[_ACTION_OPEN_LOGIN],
                usage=usage,
            )
        return _emit_single_tool_call(
            tool_name="list_my_bookings",
            arguments=validate_list_bookings_plan(plan),
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
        )

    if plan.intent == "get_my_booking":
        if "get_my_booking" not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="requires_login",
                answer=(
                    "Để xem chi tiết đơn đặt phòng cá nhân, vui lòng đăng nhập tài khoản "
                    "khách hàng trước nhé."
                ),
                mode=mode,
                actions=[_ACTION_OPEN_LOGIN],
                usage=usage,
            )
        arguments, missing, clarification = validate_get_booking_plan(plan)
        if arguments is None:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="needs_clarification",
                answer=clarification or "Bạn vui lòng cung cấp mã đơn đặt phòng cần kiểm tra.",
                mode=mode,
                missing_fields=missing,
                usage=usage,
            )
        return _emit_single_tool_call(
            tool_name="get_my_booking",
            arguments=arguments,
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
        )

    if plan.intent == "booking_with_policy":
        tool_name, arguments, missing, clarification = validate_booking_with_policy_plan(plan)
        assert tool_name is not None
        if tool_name not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="requires_login",
                answer=(
                    "Để đối chiếu chính sách với đơn đặt phòng cá nhân của bạn, vui lòng "
                    "đăng nhập tài khoản khách hàng trước nhé."
                ),
                mode=mode,
                actions=[_ACTION_OPEN_LOGIN],
                usage=usage,
            )
        if "search_knowledge" not in payload.allowedTools:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="capability_unavailable",
                answer="Chức năng đối chiếu chính sách hiện chưa được bật cho phiên này.",
                mode=mode,
                usage=usage,
            )
        if arguments is None:
            return _final_response(
                request_id=payload.requestId,
                conversation_id=str(payload.conversationId),
                turn_id=str(payload.turnId),
                status="needs_clarification",
                answer=clarification or "Bạn vui lòng cung cấp mã đơn đặt phòng hợp lệ.",
                mode=mode,
                missing_fields=missing,
                usage=usage,
            )
        policy_query = (plan.policyQuery or plan.query).strip() or plan.query.strip()
        return _emit_single_tool_call(
            tool_name=tool_name,
            arguments=arguments,
            payload=payload,
            budget=budget,
            continuations=continuations,
            usage=usage,
            min_tool_calls=2,
            policy_context=CombinedPolicyContext(
                original_message=payload.message,
                policy_query=policy_query,
                today=payload.context.today,
                allowed_tools=tuple(payload.allowedTools),
            ),
        )

    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status="capability_unavailable",
        answer=(
            "Các thao tác đặt phòng, hủy phòng, thanh toán hoặc thay đổi hồ sơ chưa thực hiện "
            "trực tiếp trong khung chat. Bạn vui lòng sử dụng các màn hình nghiệp vụ trên website."
        ),
        mode=mode,
        usage=usage,
    )


def _render_rooms(data: RoomList) -> tuple[str, str, list[dict]]:
    if not data.items:
        return (
            "no_results",
            "Hiện không tìm thấy phòng trống phù hợp với ngày lưu trú và bộ lọc bạn yêu cầu. "
            "Bạn có thể thử đổi ngày nhận/trả phòng hoặc điều chỉnh bộ lọc trên trang đặt phòng.",
            [_ACTION_OPEN_ROOM_SEARCH],
        )
    first = data.items[0]
    lines = [
        f"Tìm thấy {len(data.items)} phòng trống phù hợp cho kỳ ở "
        f"{first.checkInDate.isoformat()} → {first.checkOutDate.isoformat()} ({first.nights} đêm):"
    ]
    for item in data.items:
        lines.append(
            f"- {item.typeName} (tối đa {item.capacity} khách): "
            f"{format_vnd(item.pricePerNight)}/đêm · "
            f"Tiền phòng dự kiến {format_vnd(item.totalRoomCharge)} · "
            f"Cọc dự kiến {item.depositPercentage}% ({format_vnd(item.estimatedDeposit)})."
        )
    lines.append("Lưu ý: Đây là giá phòng dự kiến, chưa bao gồm thuế VAT và các dịch vụ phát sinh.")
    if data.hasMore:
        lines.append(
            "Vẫn còn thêm phòng trống phù hợp ngoài danh sách rút gọn này; bạn có thể thu hẹp "
            "bộ lọc (hạng phòng, khoảng giá) hoặc mở trang tìm phòng để xem đầy đủ."
        )
    return "answered", "\n".join(lines), [_ACTION_OPEN_ROOM_SEARCH]


def _render_services(data: ServiceList) -> tuple[str, str, list[dict]]:
    if not data.items:
        return (
            "no_results",
            "Hiện chưa có dịch vụ đang hoạt động nào phù hợp với yêu cầu của bạn.",
            [_ACTION_OPEN_SERVICES],
        )
    lines = [f"Danh sách {len(data.items)} dịch vụ đang hoạt động tại khách sạn:"]
    for item in data.items:
        lines.append(
            f"- {item.serviceName} ({item.categoryName}): "
            f"{format_vnd(item.unitPrice)} / {item.unit}."
        )
    if data.hasMore:
        lines.append(
            "Vẫn còn thêm dịch vụ khác ngoài danh sách rút gọn này; bạn có thể lọc theo danh mục "
            "hoặc xem thêm trong mục dịch vụ."
        )
    return "answered", "\n".join(lines), [_ACTION_OPEN_SERVICES]


def _render_booking_list(data: BookingList) -> tuple[str, str, list[dict]]:
    if not data.items:
        return (
            "no_results",
            "Hiện chưa có đơn đặt phòng nào trong tài khoản của bạn phù hợp với yêu cầu.",
            [],
        )
    lines = [f"Bạn hiện có {len(data.items)} đơn đặt phòng phù hợp:"]
    for item in data.items:
        status_label = _BOOKING_STATUS_LABELS.get(item.bookingStatus, item.bookingStatus)
        room_part = f" · {item.roomTypeName}" if item.roomTypeName else ""
        lines.append(
            f"- Mã đơn {item.bookingCode} ({status_label}){room_part}: "
            f"{item.checkInDate.isoformat()} → {item.checkOutDate.isoformat()} "
            f"({item.nights} đêm, {item.guestCount} khách)."
        )
    if data.hasMore:
        lines.append(
            "Vẫn còn thêm đơn đặt phòng cũ hơn ngoài danh sách rút gọn này; bạn có thể lọc theo "
            "trạng thái hoặc xem đầy đủ trong trang lịch sử đặt phòng."
        )
    return "answered", "\n".join(lines), []


def _render_booking_detail(data: BookingDetail) -> tuple[str, str, list[dict]]:
    status_label = _BOOKING_STATUS_LABELS.get(data.bookingStatus, data.bookingStatus)
    room_part = f" · Hạng phòng: {data.roomTypeName}" if data.roomTypeName else ""
    lines = [
        f"Thông tin đơn đặt phòng {data.bookingCode}:",
        f"- Trạng thái: {status_label}{room_part}.",
        f"- Kỳ lưu trú: {data.checkInDate.isoformat()} → {data.checkOutDate.isoformat()} "
        f"({data.nights} đêm, {data.guestCount} khách).",
    ]
    financial_parts: list[str] = []
    if data.depositRequired is not None:
        financial_parts.append(f"Cọc yêu cầu: {format_vnd(data.depositRequired)}")
    if data.depositPaid is not None:
        financial_parts.append(f"Cọc đã nộp: {format_vnd(data.depositPaid)}")
    if data.totalAmount is not None:
        financial_parts.append(f"Tổng cộng: {format_vnd(data.totalAmount)}")
    if data.remainingBalance is not None:
        financial_parts.append(f"Còn lại: {format_vnd(data.remainingBalance)}")
    if financial_parts:
        lines.append("- Thanh toán: " + " · ".join(financial_parts) + ".")
    return "answered", "\n".join(lines), []


def _handle_tool_error(result: ToolResult, payload: ResumeTurn, mode: str) -> dict:
    assert result.error is not None
    code = result.error.code
    if code == "TIMEOUT":
        raise DependencyError("DEADLINE_EXCEEDED")
    if code == "DEPENDENCY_UNAVAILABLE":
        raise DependencyError("DEPENDENCY_UNAVAILABLE")
    if code == "DATA_UNAVAILABLE":
        raise DependencyError("DATA_UNAVAILABLE")
    if code == "AUTH_REQUIRED":
        return _final_response(
            request_id=payload.requestId,
            conversation_id=str(payload.conversationId),
            turn_id=str(payload.turnId),
            status="requires_login",
            answer=result.error.message,
            mode=mode,
            actions=[_ACTION_OPEN_LOGIN],
        )
    if code == "VALIDATION_ERROR":
        actions = [_ACTION_OPEN_ROOM_SEARCH] if result.name == "search_rooms" else []
        return _final_response(
            request_id=payload.requestId,
            conversation_id=str(payload.conversationId),
            turn_id=str(payload.turnId),
            status="needs_clarification",
            answer=result.error.message,
            mode=mode,
            actions=actions,
        )
    if code == "NOT_FOUND":
        return _final_response(
            request_id=payload.requestId,
            conversation_id=str(payload.conversationId),
            turn_id=str(payload.turnId),
            status="no_results",
            answer=result.error.message,
            mode=mode,
        )
    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status="capability_unavailable",
        answer=result.error.message,
        mode=mode,
    )


def render_resume(
    payload: ResumeTurn,
    mode: str,
    *,
    followup: FollowupClarification | None = None,
) -> dict:
    """Deterministically render verified business/booking tool results without another LLM call."""
    for result in payload.toolResults:
        if result.status == "error":
            return _handle_tool_error(result, payload, mode)

    sections: list[str] = []
    actions: list[dict] = []
    seen_action_types: set[str] = set()
    any_answered = False

    for result in payload.toolResults:
        if result.name == "search_rooms" and isinstance(result.data, RoomList):
            status, text, item_actions = _render_rooms(result.data)
        elif result.name == "list_services" and isinstance(result.data, ServiceList):
            status, text, item_actions = _render_services(result.data)
        elif result.name == "list_my_bookings" and isinstance(result.data, BookingList):
            status, text, item_actions = _render_booking_list(result.data)
        elif result.name == "get_my_booking" and isinstance(result.data, BookingDetail):
            status, text, item_actions = _render_booking_detail(result.data)
        else:
            raise DependencyError("AI_PROTOCOL_ERROR")
        if status == "answered":
            any_answered = True
        sections.append(text)
        for action in item_actions:
            if action["type"] not in seen_action_types:
                seen_action_types.add(action["type"])
                actions.append(action)

    missing_fields: list[str] = []
    if followup is not None:
        sections.append(followup.note)
        missing_fields.extend(followup.missing_fields)
        for action in followup.actions:
            if action["type"] not in seen_action_types:
                seen_action_types.add(action["type"])
                actions.append(action)

    final_status = "answered" if any_answered else "no_results"
    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status=final_status,
        answer="\n\n".join(sections),
        mode=mode,
        missing_fields=missing_fields,
        actions=actions,
    )


def compose_combined_room_policy(
    room_result: ToolResult,
    policy_result: dict,
    payload: ResumeTurn,
    mode: str,
) -> dict:
    """Deterministically combine live room search results with gate-verified hotel policy."""
    if not (room_result.name == "search_rooms" and isinstance(room_result.data, RoomList)):
        raise DependencyError("AI_PROTOCOL_ERROR")
    room_status, room_text, room_actions = _render_rooms(room_result.data)

    policy_final = policy_result.get("final") or {}
    policy_status = policy_final.get("status")
    policy_answer = str(policy_final.get("answer") or "").strip()
    policy_citations = list(policy_final.get("citations") or [])
    policy_evidence = list(policy_result.get("evidence") or [])
    usage = dict(
        policy_result.get("usage")
        or {
            "toolCallsUsed": 1,
            "brokerBatchesUsed": 0,
            "inputTokensUsed": 0,
            "outputTokensUsed": 0,
        }
    )

    if policy_status == "answered" and policy_answer and policy_citations:
        combined = f"{room_text}\n\nChính sách liên quan:\n{policy_answer}"
        if (
            len(combined) <= _MAX_ANSWER_LEN
            and len(combined.encode("utf-16-le")) // 2 <= _MAX_ANSWER_LEN
        ):
            return {
                "requestId": payload.requestId,
                "conversationId": str(payload.conversationId),
                "turnId": str(payload.turnId),
                "kind": "final",
                "continuationId": None,
                "toolCalls": [],
                "final": {
                    "status": "answered",
                    "answer": combined,
                    "missingFields": [],
                    "citations": policy_citations,
                    "cards": [],
                    "actions": room_actions,
                    "corpusMode": mode,
                },
                "evidence": policy_evidence,
                "usage": usage,
            }

    fallback_text = (
        f"{room_text}\n\n"
        "Về phần chính sách, bạn vui lòng nêu rõ chủ đề cụ thể (ví dụ: giờ nhận/trả phòng, "
        "tỷ lệ đặt cọc, hủy phòng hoàn cọc, thú cưng hoặc trẻ em) để tôi tra chính xác nhé."
    )
    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status="answered" if room_status == "answered" else "no_results",
        answer=fallback_text,
        mode=mode,
        actions=room_actions,
        usage=usage,
    )


def compose_combined_booking_policy(
    booking_result: ToolResult,
    policy_result: dict,
    payload: ResumeTurn,
    mode: str,
) -> dict:
    """Deterministically combine authorized booking facts with gate-verified hotel policy.

    Never computes refund or penalty totals on the booking; fails closed to
    `insufficient_evidence` if the policy portion could not be verified or would exceed
    the public answer length cap without clipping qualifiers.
    """
    if booking_result.name == "get_my_booking" and isinstance(booking_result.data, BookingDetail):
        _, booking_text, _ = _render_booking_detail(booking_result.data)
    elif booking_result.name == "list_my_bookings" and isinstance(booking_result.data, BookingList):
        _, booking_text, _ = _render_booking_list(booking_result.data)
    else:
        raise DependencyError("AI_PROTOCOL_ERROR")

    policy_final = policy_result.get("final") or {}
    policy_status = policy_final.get("status")
    policy_answer = str(policy_final.get("answer") or "").strip()
    policy_citations = list(policy_final.get("citations") or [])
    policy_evidence = list(policy_result.get("evidence") or [])
    usage = dict(
        policy_result.get("usage")
        or {
            "toolCallsUsed": 1,
            "brokerBatchesUsed": 0,
            "inputTokensUsed": 0,
            "outputTokensUsed": 0,
        }
    )

    if policy_status == "answered" and policy_answer and policy_citations:
        combined = (
            f"{booking_text}\n\n"
            f"Chính sách áp dụng từ nguồn đã duyệt:\n{policy_answer}\n\n"
            f"{_COMBINED_DISCLAIMER}"
        )
        if (
            len(combined) <= _MAX_ANSWER_LEN
            and len(combined.encode("utf-16-le")) // 2 <= _MAX_ANSWER_LEN
        ):
            return {
                "requestId": payload.requestId,
                "conversationId": str(payload.conversationId),
                "turnId": str(payload.turnId),
                "kind": "final",
                "continuationId": None,
                "toolCalls": [],
                "final": {
                    "status": "answered",
                    "answer": combined,
                    "missingFields": [],
                    "citations": policy_citations,
                    "cards": [],
                    "actions": [],
                    "corpusMode": mode,
                },
                "evidence": policy_evidence,
                "usage": usage,
            }

    abstain_answer = (
        f"{booking_text}\n\n"
        "Chưa có đủ nguồn chính sách đã duyệt để trả lời phần quy định áp dụng cho đơn này. "
        "Vui lòng liên hệ nhân viên khách sạn để được xác minh trực tiếp."
    )
    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status="insufficient_evidence",
        answer=abstain_answer,
        mode=mode,
        usage=usage,
    )
