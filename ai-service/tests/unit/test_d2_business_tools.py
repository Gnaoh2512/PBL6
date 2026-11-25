"""Unit tests for D2 continuation store, TurnPlan validation, and VND formatting."""

from datetime import date
from uuid import uuid4

import pytest

from app.orchestration.continuations import (
    ContinuationNotFoundError,
    ContinuationStore,
    PendingCall,
)
from app.orchestration.tools import format_vnd
from app.providers.contracts import DependencyError
from app.schemas.turn import ToolResult
from app.tools.schemas import TurnPlan, validate_room_search_plan, validate_service_list_plan


def _ok_services_result(call_id):
    return ToolResult.model_validate(
        {
            "callId": str(call_id),
            "name": "list_services",
            "status": "ok",
            "data": {"items": [], "hasMore": False},
            "error": None,
        }
    )


def test_continuation_store_single_use_and_binding():
    now = [100.0]
    store = ContinuationStore(clock=lambda: now[0])
    conv, turn, call = uuid4(), uuid4(), uuid4()
    cid = store.create(
        conversation_id=conv,
        turn_id=turn,
        pending_calls=[PendingCall(call_id=call, name="list_services")],
        remaining_ms=15000,
    )
    entry = store.consume(
        continuation_id=cid,
        conversation_id=conv,
        turn_id=turn,
        tool_results=[_ok_services_result(call)],
    )
    assert entry.continuation_id == cid

    # Replay must always fail.
    with pytest.raises(ContinuationNotFoundError):
        store.consume(
            continuation_id=cid,
            conversation_id=conv,
            turn_id=turn,
            tool_results=[_ok_services_result(call)],
        )


def test_continuation_store_expires_and_rejects_mismatches():
    now = [100.0]
    store = ContinuationStore(clock=lambda: now[0])
    conv, turn, call = uuid4(), uuid4(), uuid4()
    cid = store.create(
        conversation_id=conv,
        turn_id=turn,
        pending_calls=[PendingCall(call_id=call, name="list_services")],
        remaining_ms=5000,
    )
    now[0] = 106.0
    with pytest.raises(ContinuationNotFoundError):
        store.consume(
            continuation_id=cid,
            conversation_id=conv,
            turn_id=turn,
            tool_results=[_ok_services_result(call)],
        )

    # Mismatched callId consumes/invalidates the entry immediately.
    cid2 = store.create(
        conversation_id=conv,
        turn_id=turn,
        pending_calls=[PendingCall(call_id=call, name="list_services")],
        remaining_ms=10000,
    )
    with pytest.raises(ContinuationNotFoundError):
        store.consume(
            continuation_id=cid2,
            conversation_id=conv,
            turn_id=turn,
            tool_results=[_ok_services_result(uuid4())],
        )
    with pytest.raises(ContinuationNotFoundError):
        store.consume(
            continuation_id=cid2,
            conversation_id=conv,
            turn_id=turn,
            tool_results=[_ok_services_result(call)],
        )


def test_continuation_store_capacity_limit():
    store = ContinuationStore(max_entries=1)
    store.create(
        conversation_id=uuid4(),
        turn_id=uuid4(),
        pending_calls=[PendingCall(call_id=uuid4(), name="list_services")],
        remaining_ms=10000,
    )
    with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
        store.create(
            conversation_id=uuid4(),
            turn_id=uuid4(),
            pending_calls=[PendingCall(call_id=uuid4(), name="list_services")],
            remaining_ms=10000,
        )


def test_validate_room_search_plan_checks_required_dates_and_filters():
    today = date(2026, 11, 25)

    args, missing, msg = validate_room_search_plan(
        TurnPlan(intent="search_rooms", query="Tìm phòng trống"), today
    )
    assert args is None
    assert missing == ["checkInDate", "checkOutDate", "guestCount"]
    assert msg is not None

    args, missing, _ = validate_room_search_plan(
        TurnPlan(
            intent="search_rooms",
            query="Tìm phòng",
            checkInDate="2026-11-24",
            checkOutDate="2026-11-26",
            guestCount=2,
        ),
        today,
    )
    assert args is None and missing == ["checkInDate"]

    args, missing, _ = validate_room_search_plan(
        TurnPlan(
            intent="search_rooms",
            query="Tìm phòng",
            checkInDate="2026-12-01",
            checkOutDate="2026-12-01",
            guestCount=2,
        ),
        today,
    )
    assert args is None and missing == ["checkOutDate"]

    args, missing, _ = validate_room_search_plan(
        TurnPlan(
            intent="search_rooms",
            query="Tìm phòng",
            checkInDate="2026-12-01",
            checkOutDate="2026-12-03",
            guestCount=2,
            minPrice="2000000",
            maxPrice="1000000",
        ),
        today,
    )
    assert args is None and missing == []

    args, missing, msg = validate_room_search_plan(
        TurnPlan(
            intent="search_rooms",
            query="Tìm phòng 2 khách",
            checkInDate="2026-12-01",
            checkOutDate="2026-12-03",
            guestCount=2,
            minPrice="1000000",
            maxPrice="2500000",
            sortBy="PRICE_DESC",
            limit=3,
        ),
        today,
    )
    assert missing == [] and msg is None
    assert args == {
        "checkInDate": "2026-12-01",
        "checkOutDate": "2026-12-03",
        "guestCount": 2,
        "minPrice": "1000000",
        "maxPrice": "2500000",
        "sortBy": "PRICE_DESC",
        "limit": 3,
    }


def test_validate_service_list_plan_and_vnd_formatting():
    assert validate_service_list_plan(
        TurnPlan(intent="list_services", query="Dịch vụ spa", categoryId=2, limit=4)
    ) == {"categoryId": 2, "limit": 4}
    assert validate_service_list_plan(
        TurnPlan(intent="list_services", query="Dịch vụ", categoryId=0, limit=99)
    ) == {"limit": 5}
    assert format_vnd("1500000") == "1.500.000 VND"
    assert format_vnd("200000.50") == "200.000,5 VND"


def test_public_text_preserves_dates_while_redacting_contacts_and_tokens():
    from app.orchestration.faq import public_text

    cleaned = public_text(
        "Tìm phòng từ 2026-12-01 đến 03-12-2026, liên hệ +84901234567, 090-123-4567, "
        "guest@example.invalid, Bearer secret-token-123"
    )
    assert "2026-12-01" in cleaned
    assert "03-12-2026" in cleaned
    assert "84901234567" not in cleaned
    assert "090-123-4567" not in cleaned
    assert "example.invalid" not in cleaned
    assert "secret-token-123" not in cleaned
