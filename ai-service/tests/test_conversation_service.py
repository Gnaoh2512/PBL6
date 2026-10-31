import asyncio
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
import simplejson

from ai_service.application.recommendation.conversation_models import (
    ConversationRequest,
    ConversationStatus,
    ExtractedChanges,
    SearchState,
)
from ai_service.application.recommendation.conversation_service import (
    ConversationService,
    apply_changes,
)
from ai_service.infrastructure.backend.errors import BackendTimeoutError
from ai_service.infrastructure.backend.models import AvailableRoomCandidate, BackendRoomType
from ai_service.infrastructure.llm import ExtractionInvalidResponse

FIXED_NOW = datetime(2026, 10, 31, 3, 0, tzinfo=timezone.utc)
FIXTURE = Path(__file__).parent / "fixtures" / "available_rooms_success.json"


def room() -> AvailableRoomCandidate:
    return AvailableRoomCandidate.model_validate(
        simplejson.loads(FIXTURE.read_text(encoding="utf-8"), use_decimal=True)["data"][0]
    )


class FakeExtractor:
    def __init__(self, output: dict | Exception) -> None:
        self.output = output
        self.today = None

    async def extract(self, message, state, *, today, request_id):
        self.today = today
        if isinstance(self.output, Exception):
            raise self.output
        return ExtractedChanges.model_validate(self.output)


class FakeBackend:
    def __init__(self, rooms=None, *, error=None) -> None:
        self.rooms = [room()] if rooms is None else rooms
        self.error = error
        self.searches = []
        self.type_calls = 0

    async def find_available_rooms(self, search, *, request_id):
        self.searches.append(search)
        if self.error:
            raise self.error
        return self.rooms

    async def list_room_types(self, *, request_id):
        self.type_calls += 1
        return [
            BackendRoomType.model_validate(
                {
                    "roomTypeId": 2,
                    "typeName": "Synthetic Deluxe",
                    "capacity": 2,
                    "basePrice": "1250000.50",
                    "amenities": "minibar, balcony",
                    "description": None,
                }
            )
        ]


def change(field, value=None, action="SET"):
    return {"field": field, "action": action, "value": value}


def output(*changes, ambiguities=None, unsupported=False):
    return {
        "changes": list(changes),
        "ambiguities": ambiguities or [],
        "unsupportedIntent": unsupported,
    }


def full_output(*extra):
    return output(
        change("checkInDate", "2026-11-10"),
        change("checkOutDate", "2026-11-12"),
        change("guestCount", "2"),
        change("roomCount", "1"),
        *extra,
    )


def run(backend, extractor, *, state=None, message="Tìm phòng ngày 10-12/11/2026"):
    service = ConversationService(
        backend, extractor, timezone=ZoneInfo("Asia/Ho_Chi_Minh"), clock=lambda: FIXED_NOW
    )
    request = ConversationRequest(message=message, state=state or SearchState())
    return asyncio.run(service.execute(request, request_id="conversation-test"))


def test_complete_extraction_uses_live_room_and_decimal_price() -> None:
    backend = FakeBackend()
    extractor = FakeExtractor(
        full_output(change("maxPrice", "1500000"), change("preferredAmenities", "balcony"))
    )

    response = run(backend, extractor)

    assert extractor.today.isoformat() == "2026-10-31"
    assert response.status is ConversationStatus.RECOMMENDED
    assert len(backend.searches) == 1
    assert backend.searches[0].max_price == Decimal("1500000")
    recommended = response.result.recommendations[0]
    assert recommended.room_id == 101
    assert recommended.price_per_night == room().price_per_night
    assert recommended.score == Decimal("1")
    assert "ban công" not in " ".join(recommended.reasons).lower()
    assert "balcony" in " ".join(recommended.reasons).lower()
    assert "không giữ chỗ" in response.reply


def test_missing_then_followup_then_correction_preserves_other_fields() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(
            output(
                change("checkInDate", "2026-11-10"),
                change("checkOutDate", "2026-11-12"),
                change("roomCount", "1"),
                change("preferredAmenities", "balcony"),
            )
        ),
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert first.clarification_fields[0].value == "guestCount"
    assert backend.searches == []

    second = run(backend, FakeExtractor(output(change("guestCount", "2"))), state=first.state)
    assert second.status is ConversationStatus.RECOMMENDED
    assert second.state.preferred_amenities == ["balcony"]

    third = run(
        backend,
        FakeExtractor(output(change("guestCount", "3"), change("preferredAmenities", action="CLEAR"))),
        state=second.state,
    )
    assert third.status is ConversationStatus.NO_MATCH
    assert third.state.preferred_amenities == []
    assert third.state.check_in_date == first.state.check_in_date


def test_date_change_without_checkout_change_asks_again() -> None:
    prior = SearchState.model_validate(
        {"checkInDate": "2026-11-10", "checkOutDate": "2026-11-12", "guestCount": 2, "roomCount": 1}
    )
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output(change("checkInDate", "2026-11-20"))), state=prior
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.clarification_fields[0].value == "checkOutDate"
    assert backend.searches == []


def test_ambiguous_budget_does_not_query_backend() -> None:
    backend = FakeBackend()
    response = run(backend, FakeExtractor(output(ambiguities=["budgetBasis"])))
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.clarification_fields[0].value == "budgetBasis"
    assert backend.searches == []


def test_missing_year_cannot_be_guessed_by_llm() -> None:
    backend = FakeBackend()
    response = run(
        backend,
        FakeExtractor(full_output()),
        message="Một phòng hai người từ ngày 10 đến 12 tháng 11",
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.clarification_fields[0].value == "checkInDate"
    assert response.state.check_in_date is None
    assert response.state.check_out_date is None
    assert backend.searches == []


def test_relative_dates_use_injected_reference_day() -> None:
    backend = FakeBackend(rooms=[])
    response = run(
        backend,
        FakeExtractor(
            output(
                change("checkInDate", "2026-10-31"),
                change("checkOutDate", "2026-11-01"),
                change("guestCount", "2"),
                change("roomCount", "1"),
            )
        ),
        message="Hôm nay tôi cần một phòng cho hai người, trả ngày mai",
    )
    assert response.status is ConversationStatus.NO_MATCH
    assert backend.searches[0].check_in_date.isoformat() == "2026-10-31"


@pytest.mark.parametrize(
    "extra",
    [
        change("roomCount", "2"),
        change("totalBudget", "1000000"),
        change("requiredAmenities", "balcony"),
    ],
)
def test_unsupported_constraints_are_not_silently_dropped(extra) -> None:
    changes = [change("checkInDate", "2026-11-10"), change("checkOutDate", "2026-11-12")]
    changes.append(change("guestCount", "2"))
    if extra["field"] != "roomCount":
        changes.append(change("roomCount", "1"))
    changes.append(extra)
    backend = FakeBackend()
    response = run(backend, FakeExtractor(output(*changes)))
    assert response.status is ConversationStatus.UNSUPPORTED
    assert backend.searches == []


def test_room_type_name_is_resolved_from_backend_catalogue() -> None:
    backend = FakeBackend()
    response = run(backend, FakeExtractor(full_output(change("roomTypeName", "synthetic deluxe"))))
    assert response.status is ConversationStatus.RECOMMENDED
    assert backend.type_calls == 1
    assert backend.searches[0].room_type_id == 2


def test_invalid_extraction_is_a_technical_error() -> None:
    with pytest.raises(ExtractionInvalidResponse):
        run(FakeBackend(), FakeExtractor(full_output(change("maxPrice", "NaN"))))


def test_backend_timeout_is_not_no_match() -> None:
    with pytest.raises(BackendTimeoutError):
        run(FakeBackend(error=BackendTimeoutError("slow")), FakeExtractor(full_output()))


def test_apply_changes_distinguishes_keep_set_and_clear() -> None:
    state = SearchState.model_validate(
        {"guestCount": 2, "roomCount": 1, "preferredAmenities": ["balcony"]}
    )
    updated = apply_changes(
        state,
        ExtractedChanges.model_validate(
            output(change("guestCount", "3"), change("preferredAmenities", action="CLEAR"))
        ),
    )
    assert updated.guest_count == 3
    assert updated.room_count == 1
    assert updated.preferred_amenities == []
