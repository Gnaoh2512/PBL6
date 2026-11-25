"""Deterministic D2 business-tool planning and grounded resume rendering."""

from decimal import Decimal
from uuid import uuid4

from app.diagnostics import Category
from app.orchestration.continuations import ContinuationStore, PendingCall
from app.providers.contracts import DependencyError, TurnBudget
from app.schemas.turn import ResumeTurn, RoomList, ServiceList, StartTurn, ToolResult
from app.tools.schemas import TurnPlan, validate_room_search_plan, validate_service_list_plan

_MAX_ANSWER_LEN = 4000
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
        if payload.budget.remainingToolCalls < 1 or payload.budget.remainingBrokerBatches < 1:
            raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)
        call_id = uuid4()
        continuation_id = continuations.create(
            conversation_id=payload.conversationId,
            turn_id=payload.turnId,
            pending_calls=[PendingCall(call_id=call_id, name="search_rooms")],
            remaining_ms=max(1, int(budget.seconds() * 1000)),
        )
        return {
            "requestId": payload.requestId,
            "conversationId": str(payload.conversationId),
            "turnId": str(payload.turnId),
            "kind": "tool_calls",
            "continuationId": str(continuation_id),
            "toolCalls": [
                {
                    "callId": str(call_id),
                    "name": "search_rooms",
                    "arguments": arguments,
                }
            ],
            "usage": usage,
            "evidence": [],
        }

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
        if payload.budget.remainingToolCalls < 1 or payload.budget.remainingBrokerBatches < 1:
            raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)
        arguments = validate_service_list_plan(plan)
        call_id = uuid4()
        continuation_id = continuations.create(
            conversation_id=payload.conversationId,
            turn_id=payload.turnId,
            pending_calls=[PendingCall(call_id=call_id, name="list_services")],
            remaining_ms=max(1, int(budget.seconds() * 1000)),
        )
        return {
            "requestId": payload.requestId,
            "conversationId": str(payload.conversationId),
            "turnId": str(payload.turnId),
            "kind": "tool_calls",
            "continuationId": str(continuation_id),
            "toolCalls": [
                {
                    "callId": str(call_id),
                    "name": "list_services",
                    "arguments": arguments,
                }
            ],
            "usage": usage,
            "evidence": [],
        }

    return _final_response(
        request_id=payload.requestId,
        conversation_id=str(payload.conversationId),
        turn_id=str(payload.turnId),
        status="capability_unavailable",
        answer=(
            "Chức năng tra cứu đơn đặt phòng cá nhân hoặc thao tác đặt/hủy/thanh toán "
            "chưa hỗ trợ trực tiếp trong khung chat. Bạn vui lòng sử dụng các màn hình "
            "nghiệp vụ tương ứng trên website."
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
    lines.append(
        "Lưu ý: Đây là giá phòng dự kiến (room_charge_estimate), chưa bao gồm thuế VAT "
        "và các dịch vụ phát sinh."
    )
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


def _handle_tool_error(result: ToolResult, payload: ResumeTurn, mode: str) -> dict:
    assert result.error is not None
    code = result.error.code
    if code == "TIMEOUT":
        raise DependencyError("DEADLINE_EXCEEDED")
    if code == "DEPENDENCY_UNAVAILABLE":
        raise DependencyError("DEPENDENCY_UNAVAILABLE")
    if code == "DATA_UNAVAILABLE":
        raise DependencyError("DATA_UNAVAILABLE")
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


def render_resume(payload: ResumeTurn, mode: str) -> dict:
    """Deterministically render verified business tool results without another LLM call."""
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
        else:
            raise DependencyError("AI_PROTOCOL_ERROR")
        if status == "answered":
            any_answered = True
        sections.append(text)
        for action in item_actions:
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
        actions=actions,
    )
