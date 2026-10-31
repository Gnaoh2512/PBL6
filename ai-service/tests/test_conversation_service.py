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
    PendingBudget,
    PendingDate,
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
        self.seen_state = None

    async def extract(self, message, state, *, today, request_id):
        self.today = today
        self.seen_state = state
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


def run(backend, extractor, *, state=None, message="Tìm phòng ngày 10-12/11/2026", now=FIXED_NOW):
    service = ConversationService(
        backend, extractor, timezone=ZoneInfo("Asia/Ho_Chi_Minh"), clock=lambda: now
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


def test_explicit_price_and_capacity_preferences_reach_scorer() -> None:
    backend = FakeBackend()
    response = run(
        backend,
        FakeExtractor(full_output(
            change("pricePreference", "SAVE"),
            change("capacityPreference", "SPACIOUS"),
        )),
    )
    assert response.status is ConversationStatus.RECOMMENDED
    assert response.state.price_preference.value == "SAVE"
    assert response.state.capacity_preference.value == "SPACIOUS"
    room_result = response.result.recommendations[0]
    assert room_result.score_breakdown["price"].score == 1
    assert room_result.score_breakdown["capacity"].score == 1
    assert backend.searches[0].max_price is None


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
        FakeExtractor(
            output(change("guestCount", "3"), change("preferredAmenities", action="CLEAR"))
        ),
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
        backend,
        FakeExtractor(output(change("checkInDate", "2026-11-20"))),
        state=prior,
        message="Đổi ngày nhận thành 20/11/2026",
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.clarification_fields[0].value == "checkOutDate"
    assert backend.searches == []


def test_ambiguous_budget_does_not_query_backend() -> None:
    backend = FakeBackend()
    response = run(backend, FakeExtractor(output(ambiguities=["budgetBasis"])))
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.clarification_fields[0].value == "budget"
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


def test_required_amenity_uses_same_filter_as_json_pipeline() -> None:
    backend = FakeBackend()
    response = run(
        backend,
        FakeExtractor(full_output(change("requiredAmenities", "ban cong"))),
    )
    assert response.status is ConversationStatus.RECOMMENDED
    assert len(backend.searches) == 1
    assert response.result.recommendations[0].room_type.amenities == "minibar, balcony"
    assert any("balcony" in reason for reason in response.result.recommendations[0].reasons)


def test_required_amenity_without_backend_evidence_returns_no_match() -> None:
    backend = FakeBackend()
    response = run(
        backend,
        FakeExtractor(full_output(change("requiredAmenities", "bồn tắm"))),
    )
    assert response.status is ConversationStatus.NO_MATCH
    assert response.result.recommendations == []
    assert "tiện nghi bắt buộc" in response.reply
    assert len(backend.searches) == 1


def test_unknown_amenity_is_pending_until_corrected_or_cleared() -> None:
    backend = FakeBackend()
    first = run(backend, FakeExtractor(full_output(change("requiredAmenities", "minibar, hồ bơi"))))
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert first.state.pending_question.value == "requiredAmenities"
    assert first.state.pending[0].value == "minibar, hồ bơi"
    assert backend.searches == []
    again = run(backend, FakeExtractor(output()), state=first.state, message="Tôi muốn phòng đẹp")
    assert again.status is ConversationStatus.NEEDS_CLARIFICATION
    assert backend.searches == []
    corrected = run(
        backend,
        FakeExtractor(output(change("requiredAmenities", "minibar, ban công"))),
        state=again.state,
    )
    assert corrected.status is ConversationStatus.RECOMMENDED
    assert len(backend.searches) == 1
    cleared = run(
        backend,
        FakeExtractor(output(change("requiredAmenities", action="CLEAR"))),
        state=first.state,
    )
    assert cleared.state.required_amenities == []
    assert cleared.state.pending == []


def test_conflicting_required_and_preferred_amenity_asks_without_search() -> None:
    backend = FakeBackend()
    response = run(
        backend,
        FakeExtractor(
            full_output(
                change("requiredAmenities", "ban công"),
                change("preferredAmenities", "balcony"),
            )
        ),
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.state.pending_question.value == "preferredAmenities"
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


def test_ambiguous_amount_survives_per_night_followup_and_reaches_backend() -> None:
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(full_output(change("budget", "1000000")) | {"ambiguities": ["budgetBasis"]}),
        message="Một phòng hai người ngày 10-12/11/2026, ngân sách một triệu",
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert first.state.max_price is None
    assert first.state.pending_question.value == "budgetBasis"
    assert isinstance(first.state.pending[0], PendingBudget)
    assert first.state.pending[0].amount == Decimal("1000000")
    assert backend.searches == []

    carried = SearchState.model_validate(first.state.model_dump(by_alias=True, mode="json"))
    extractor = FakeExtractor(output(change("budgetBasis", "PER_NIGHT")))
    second = run(backend, extractor, state=carried, message="Mỗi đêm")
    assert extractor.seen_state.pending[0].amount == Decimal("1000000")
    assert second.status is ConversationStatus.NO_MATCH
    assert second.state.max_price == Decimal("1000000")
    assert second.state.pending == []
    assert backend.searches[0].max_price == Decimal("1000000")


def test_new_ambiguous_budget_supersedes_old_and_unrelated_reply_keeps_waiting() -> None:
    previous = SearchState.model_validate(
        {
            "checkInDate": "2026-11-10",
            "checkOutDate": "2026-11-12",
            "guestCount": 2,
            "roomCount": 1,
            "maxPrice": "1500000",
        }
    )
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(change("budget", "900000"), ambiguities=["budgetBasis"])),
        state=previous,
        message="Đổi ngân sách thành chín trăm nghìn",
    )
    assert first.state.max_price is None
    assert first.state.pending[0].amount == Decimal("900000")
    assert backend.searches == []

    second = run(backend, FakeExtractor(output()), state=first.state, message="Tôi thích phòng đẹp")
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert second.state.pending[0].amount == Decimal("900000")
    assert backend.searches == []


def test_ambiguous_new_budget_without_amount_does_not_reuse_old_amount() -> None:
    previous = SearchState.model_validate(
        {
            "checkInDate": "2026-11-10",
            "checkOutDate": "2026-11-12",
            "guestCount": 2,
            "roomCount": 1,
            "maxPrice": "1500000",
        }
    )
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(ambiguities=["budgetBasis"])),
        state=previous,
        message="Tôi muốn đổi ngân sách",
    )
    assert first.state.max_price is None
    assert first.state.pending[0].amount is None
    second = run(
        backend,
        FakeExtractor(output(change("budgetBasis", "PER_NIGHT"))),
        state=first.state,
        message="Mỗi đêm",
    )
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert second.state.pending_question.value == "budget"
    assert second.state.max_price is None
    assert backend.searches == []


def test_pending_budget_can_be_replaced_or_cleared() -> None:
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(output(change("budget", "1000000"), ambiguities=["budgetBasis"])),
        message="Ngân sách một triệu",
    )
    replaced = run(
        backend,
        FakeExtractor(output(change("budget", "800000"), ambiguities=["budgetBasis"])),
        state=first.state,
        message="Thay bằng tám trăm nghìn",
    )
    assert replaced.state.pending[0].amount == Decimal("800000")
    assert backend.searches == []
    cleared = run(
        backend,
        FakeExtractor(output(change("budget", action="CLEAR"))),
        state=replaced.state,
        message="Bỏ ngân sách",
    )
    assert cleared.state.pending == []
    assert cleared.state.max_price is None
    assert cleared.state.total_budget is None


def test_budget_clear_removes_confirmed_and_pending_without_restoring_old_value() -> None:
    previous = SearchState.model_validate({"maxPrice": "1500000"})
    backend = FakeBackend(rooms=[])
    response = run(
        backend,
        FakeExtractor(output(change("budget", action="CLEAR"), change("budgetBasis", "PER_NIGHT"))),
        state=previous,
        message="Bỏ ngân sách mỗi đêm",
    )
    assert response.state.max_price is None
    assert response.state.pending == []


def test_total_stay_confirmation_remains_unsupported() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(change("budget", "1000000"), ambiguities=["budgetBasis"])),
        message="Ngân sách một triệu",
    )
    second = run(
        backend,
        FakeExtractor(output(change("budgetBasis", "TOTAL_STAY"))),
        state=first.state,
        message="Cho toàn kỳ",
    )
    assert second.status is ConversationStatus.UNSUPPORTED
    assert second.state.total_budget == Decimal("1000000")
    assert backend.searches == []
    third = run(backend, FakeExtractor(output()), state=second.state, message="Vẫn vậy")
    assert third.status is ConversationStatus.UNSUPPORTED
    assert backend.searches == []


def test_yearless_dates_survive_unrelated_turn_then_explicit_year() -> None:
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(full_output()),
        message="Một phòng hai người từ 10 đến 12 tháng 11",
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert [(item.month, item.day) for item in first.state.pending] == [(11, 10), (11, 12)]
    second = run(backend, FakeExtractor(output()), state=first.state, message="Tôi thích ban công")
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert backend.searches == []
    third = run(backend, FakeExtractor(output()), state=second.state, message="Năm 2027")
    assert third.status is ConversationStatus.NO_MATCH
    assert third.state.check_in_date.isoformat() == "2027-11-10"
    assert third.state.check_out_date.isoformat() == "2027-11-12"
    assert backend.searches[0].check_in_date.isoformat() == "2027-11-10"


def test_yearless_new_date_does_not_inherit_old_date_year_across_new_year() -> None:
    previous = SearchState.model_validate(
        {"checkInDate": "2026-12-31", "checkOutDate": "2027-01-01", "guestCount": 2, "roomCount": 1}
    )
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(output(change("checkOutDate", "2027-01-02"))),
        state=previous,
        message="Đổi ngày trả thành 2/1",
        now=datetime(2026, 12, 30, 3, tzinfo=timezone.utc),
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert first.state.check_out_date is None
    assert isinstance(first.state.pending[0], PendingDate)
    assert (first.state.pending[0].month, first.state.pending[0].day) == (1, 2)
    assert backend.searches == []
    second = run(
        backend,
        FakeExtractor(output()),
        state=first.state,
        message="2027",
        now=datetime(2026, 12, 30, 3, tzinfo=timezone.utc),
    )
    assert second.status is ConversationStatus.NO_MATCH
    assert backend.searches[0].check_out_date.isoformat() == "2027-01-02"


def test_two_yearless_dates_across_year_boundary_need_two_year_answers() -> None:
    backend = FakeBackend(rooms=[])
    now = datetime(2026, 12, 30, 3, tzinfo=timezone.utc)
    first = run(
        backend,
        FakeExtractor(
            output(
                change("checkInDate", "2026-12-31"),
                change("checkOutDate", "2027-01-02"),
                change("guestCount", "2"),
                change("roomCount", "1"),
            )
        ),
        message="Một phòng hai người từ 31/12 đến 2/1",
        now=now,
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert len(first.state.pending) == 2
    second = run(backend, FakeExtractor(output()), state=first.state, message="2026", now=now)
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert second.state.check_in_date.isoformat() == "2026-12-31"
    assert second.state.check_out_date is None
    assert backend.searches == []
    third = run(backend, FakeExtractor(output()), state=second.state, message="2027", now=now)
    assert third.status is ConversationStatus.NO_MATCH
    assert backend.searches[0].check_in_date.isoformat() == "2026-12-31"
    assert backend.searches[0].check_out_date.isoformat() == "2027-01-02"


def test_repeated_ambiguity_does_not_erase_pending_amount_or_dates() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(full_output(change("budget", "1000000")) | {"ambiguities": ["budgetBasis"]}),
        message="Một phòng hai người từ 10 đến 12 tháng 11, ngân sách một triệu",
    )
    second = run(
        backend,
        FakeExtractor(output(ambiguities=["budgetBasis", "checkInDate", "checkOutDate"])),
        state=first.state,
        message="Tôi chưa rõ",
    )
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    budget = next(item for item in second.state.pending if isinstance(item, PendingBudget))
    dates = [item for item in second.state.pending if isinstance(item, PendingDate)]
    assert budget.amount == Decimal("1000000")
    assert sorted((item.month, item.day) for item in dates) == [(11, 10), (11, 12)]
    assert backend.searches == []


def test_budget_clear_wins_over_repeated_budget_ambiguity() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(change("budget", "1000000"), ambiguities=["budgetBasis"])),
        message="Ngân sách một triệu",
    )
    cleared = run(
        backend,
        FakeExtractor(output(change("budget", action="CLEAR"), ambiguities=["budgetBasis"])),
        state=first.state,
        message="Bỏ ngân sách",
    )
    assert cleared.state.pending == []
    assert cleared.state.max_price is None


def test_budget_basis_is_kept_when_amount_is_supplied_later() -> None:
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(output(ambiguities=["budget"])),
        message="Tôi có ngân sách",
    )
    assert first.state.pending_question.value == "budget"
    second = run(
        backend,
        FakeExtractor(output(change("budgetBasis", "PER_NIGHT"))),
        state=first.state,
        message="Mỗi đêm",
    )
    assert second.state.pending[0].basis.value == "PER_NIGHT"
    assert second.state.pending_question.value == "budget"
    third = run(
        backend,
        FakeExtractor(output(change("budget", "800000"))),
        state=second.state,
        message="Tám trăm nghìn",
    )
    assert third.state.max_price == Decimal("800000")
    assert third.state.pending == []


def test_year_answer_cannot_change_pending_day_or_month() -> None:
    backend = FakeBackend(rooms=[])
    first = run(
        backend,
        FakeExtractor(output(change("checkInDate", "2026-11-10"))),
        message="Nhận ngày 10/11",
    )
    second = run(
        backend,
        FakeExtractor(output(change("checkInDate", "2027-11-12"))),
        state=first.state,
        message="2027",
    )
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert second.state.check_in_date is None
    assert (second.state.pending[0].month, second.state.pending[0].day) == (11, 10)
    assert backend.searches == []


def test_clearing_ambiguous_price_removes_its_pending_value() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(ambiguities=["minPrice"])),
        message="Giá tối thiểu tôi chưa rõ",
    )
    assert first.state.pending[0].field.value == "minPrice"
    second = run(
        backend,
        FakeExtractor(output(change("minPrice", action="CLEAR"))),
        state=first.state,
        message="Bỏ giá tối thiểu",
    )
    assert second.state.pending == []
    assert second.state.min_price is None
    assert backend.searches == []
