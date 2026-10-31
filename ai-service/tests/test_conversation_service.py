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
        self.calls = 0

    async def extract(self, message, state, *, today, request_id):
        self.calls += 1
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


def output(*changes, ambiguities=None, unsupported=False, decision="NONE"):
    return {
        "changes": list(changes),
        "ambiguities": ambiguities or [],
        "unsupportedIntent": unsupported,
        "relaxationDecision": decision,
    }


def full_output(*extra):
    return output(
        change("checkInDate", "2026-11-10"),
        change("checkOutDate", "2026-11-12"),
        change("guestCount", "2"),
        change("roomCount", "1"),
        *extra,
    )


def complete_state(**changes):
    return SearchState.model_validate({
        "checkInDate": "2026-11-10", "checkOutDate": "2026-11-12",
        "guestCount": 2, "roomCount": 1,
    } | changes)


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


def test_unsupported_room_count_is_not_silently_dropped() -> None:
    extra = change("roomCount", "2")
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
    assert "tiện nghi" in response.reply
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


def test_new_ambiguous_budget_preserves_old_until_confirmed() -> None:
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
    assert first.state.max_price == Decimal("1500000")
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
    assert first.state.max_price == Decimal("1500000")
    assert first.state.pending[0].amount is None
    second = run(
        backend,
        FakeExtractor(output(change("budgetBasis", "PER_NIGHT"))),
        state=first.state,
        message="Mỗi đêm",
    )
    assert second.status is ConversationStatus.NEEDS_CLARIFICATION
    assert second.state.pending_question.value == "budget"
    assert second.state.max_price == Decimal("1500000")
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


def test_total_stay_confirmation_is_supported_after_other_fields_are_known() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(change("budget", "1000000"), ambiguities=["budgetBasis"])),
        state=SearchState.model_validate({
            "checkInDate": "2026-11-10", "checkOutDate": "2026-11-12",
            "guestCount": 2, "roomCount": 1,
        }),
        message="Ngân sách một triệu",
    )
    second = run(
        backend,
        FakeExtractor(output(change("budgetBasis", "TOTAL_STAY"))),
        state=first.state,
        message="Cho toàn kỳ",
    )
    assert second.status is ConversationStatus.NO_MATCH
    assert second.state.total_budget == Decimal("1000000")
    assert len(backend.searches) == 1
    assert backend.searches[0].max_price is None


def test_total_budget_and_nightly_bound_coexist_across_conversation_turns() -> None:
    backend = FakeBackend()
    state = complete_state(maxPrice="1300000")
    response = run(
        backend, FakeExtractor(output(change("totalBudget", "2500001.00"))),
        state=state, message="Tổng tiền phòng cơ bản toàn kỳ tối đa 2500001",
    )
    assert response.status is ConversationStatus.RECOMMENDED
    assert response.state.max_price == Decimal("1300000")
    assert response.state.total_budget == Decimal("2500001.00")
    assert backend.searches[0].max_price == Decimal("1300000")
    assert "totalBudget" not in backend.searches[0].model_dump(by_alias=True)
    assert "tiền phòng cơ bản" in response.reply


def test_new_nightly_bound_does_not_erase_confirmed_total_budget() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output(change("maxPrice", "1300000"))),
        state=complete_state(totalBudget="2500001"),
        message="Mỗi đêm tối đa 1,3 triệu",
    )
    assert response.status is ConversationStatus.RECOMMENDED
    assert response.state.total_budget == Decimal("2500001")
    assert response.state.max_price == Decimal("1300000")
    assert len(backend.searches) == 1


def test_basis_only_with_two_limits_asks_for_amount_and_keeps_both() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output(change("budgetBasis", "TOTAL_STAY"))),
        state=complete_state(maxPrice="1300000", totalBudget="2500001"),
        message="Đổi cơ sở ngân sách sang toàn kỳ",
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.state.pending_question.value == "budget"
    assert response.state.max_price == Decimal("1300000")
    assert response.state.total_budget == Decimal("2500001")
    assert backend.searches == []


def test_unprovided_tax_service_or_voucher_scope_is_clarified_before_search() -> None:
    backend = FakeBackend()
    first = run(
        backend,
        FakeExtractor(output(change("totalBudget", "3000000"), ambiguities=["budgetScope"])),
        state=complete_state(),
        message="Tối đa 3 triệu toàn kỳ gồm thuế và dịch vụ",
    )
    assert first.status is ConversationStatus.NEEDS_CLARIFICATION
    assert first.state.pending_question.value == "budgetScope"
    assert first.state.total_budget == Decimal("3000000")
    assert backend.searches == []
    accepted = run(
        backend, FakeExtractor(output(change("budgetScope", "ROOM_CHARGE"))),
        state=first.state, message="Đồng ý chỉ tính tiền phòng cơ bản",
    )
    assert accepted.status is ConversationStatus.RECOMMENDED
    assert len(backend.searches) == 1


def test_cost_scope_mention_cannot_be_missed_by_extractor() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output(change("totalBudget", "3000000"))),
        state=complete_state(), message="Tổng ba triệu bao gồm thuế và voucher",
    )
    assert response.status is ConversationStatus.NEEDS_CLARIFICATION
    assert response.state.pending_question.value == "budgetScope"
    assert backend.searches == []


def test_ordinary_room_rental_word_does_not_trigger_tax_clarification() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output()),
        state=complete_state(totalBudget="3000000"),
        message="Tôi muốn thuê một phòng",
    )
    assert response.status is ConversationStatus.RECOMMENDED
    assert len(backend.searches) == 1


def test_all_costs_scope_is_not_falsely_supported() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output(change("budgetScope", "ALL_COSTS"))),
        state=complete_state(totalBudget="3000000"),
        message="Tôi vẫn muốn gồm mọi chi phí",
    )
    assert response.status is ConversationStatus.UNSUPPORTED
    assert backend.searches == []
    assert "thuế" in response.reply


def test_exact_scope_acceptance_or_rejection_needs_no_provider_guess() -> None:
    backend = FakeBackend()
    first = run(
        backend, FakeExtractor(output(ambiguities=["budgetScope"])),
        state=complete_state(totalBudget="3000000"),
        message="Ngân sách gồm dịch vụ",
    )
    accept_extractor = FakeExtractor(ExtractionInvalidResponse("unused"))
    accepted = run(
        backend, accept_extractor, state=first.state, message="Đồng ý",
    )
    assert accepted.status is ConversationStatus.RECOMMENDED
    assert accept_extractor.calls == 0
    assert len(backend.searches) == 1
    reject_extractor = FakeExtractor(ExtractionInvalidResponse("unused"))
    rejected = run(
        backend, reject_extractor, state=first.state, message="Không",
    )
    assert rejected.status is ConversationStatus.UNSUPPORTED
    assert reject_extractor.calls == 0
    assert len(backend.searches) == 1


def test_no_match_retains_constraints_and_proposes_without_diagnostic_query() -> None:
    backend = FakeBackend()
    response = run(
        backend, FakeExtractor(output()),
        state=complete_state(totalBudget="1000000", maxPrice="1300000"),
    )
    assert response.status is ConversationStatus.NO_MATCH
    assert response.result.status.value == "NO_MATCH"
    assert response.state.total_budget == Decimal("1000000")
    assert response.state.max_price == Decimal("1300000")
    assert response.state.pending_relaxation.criterion.value == "totalBudget"
    assert "Chưa xác định điều kiện nào" in response.reply
    assert len(backend.searches) == 1


def test_rejecting_relaxation_keeps_original_search_and_skips_backend() -> None:
    backend = FakeBackend()
    first = run(backend, FakeExtractor(output()), state=complete_state(totalBudget="1000000"))
    extractor = FakeExtractor(ExtractionInvalidResponse("should not call provider"))
    rejected = run(
        backend, extractor, state=first.state,
        message="Không",
    )
    assert rejected.status is ConversationStatus.NO_MATCH
    assert rejected.result is None
    assert rejected.state.total_budget == Decimal("1000000")
    assert rejected.state.pending_relaxation is None
    assert len(backend.searches) == 1
    assert extractor.calls == 0


def test_accepting_budget_relaxation_waits_for_amount_then_requeries_once() -> None:
    backend = FakeBackend()
    first = run(
        backend, FakeExtractor(output()),
        state=complete_state(totalBudget="1000000", maxPrice="1300000"),
    )
    accept_extractor = FakeExtractor(ExtractionInvalidResponse("should not call provider"))
    accepted = run(
        backend, accept_extractor, state=first.state,
        message="Đồng ý",
    )
    assert accepted.status is ConversationStatus.NEEDS_CLARIFICATION
    assert accepted.state.pending_relaxation is not None
    assert len(backend.searches) == 1
    assert accept_extractor.calls == 0
    revised = run(
        backend, FakeExtractor(output(change("budget", "2600000"))),
        state=accepted.state, message="Tăng lên 2,6 triệu",
    )
    assert revised.status is ConversationStatus.RECOMMENDED
    assert revised.state.total_budget == Decimal("2600000")
    assert revised.state.max_price == Decimal("1300000")
    assert revised.state.pending_relaxation is None
    assert len(backend.searches) == 2


def test_explicit_one_point_two_million_edit_requeries_without_promising_a_room() -> None:
    backend = FakeBackend()
    first = run(backend, FakeExtractor(output()), state=complete_state(maxPrice="1000000"))
    revised = run(
        backend, FakeExtractor(output(change("budget", "1200000"))),
        state=first.state, message="Tăng lên 1,2 triệu",
    )
    assert revised.status is ConversationStatus.NO_MATCH
    assert revised.state.max_price == Decimal("1200000")
    assert revised.result.recommendations == []
    assert len(backend.searches) == 2


def test_accepting_amenity_relaxation_removes_only_named_requirement() -> None:
    backend = FakeBackend()
    first = run(
        backend, FakeExtractor(output()),
        state=complete_state(requiredAmenities=["bathtub"]),
    )
    assert first.status is ConversationStatus.NO_MATCH
    assert first.state.pending_relaxation.value == "bathtub"
    second = run(
        backend, FakeExtractor(output(decision="ACCEPT")), state=first.state,
        message="Đồng ý bỏ tiện nghi đó",
    )
    assert second.status is ConversationStatus.RECOMMENDED
    assert second.state.required_amenities == []
    assert len(backend.searches) == 2


def test_date_relaxation_requires_explicit_new_dates() -> None:
    backend = FakeBackend(rooms=[])
    first = run(backend, FakeExtractor(output()), state=complete_state())
    assert first.state.pending_relaxation.criterion.value == "checkInDate"
    accepted = run(
        backend, FakeExtractor(output(decision="ACCEPT")), state=first.state,
        message="Đồng ý đổi ngày",
    )
    assert accepted.status is ConversationStatus.NEEDS_CLARIFICATION
    assert accepted.state.check_in_date == first.state.check_in_date
    assert accepted.state.check_out_date == first.state.check_out_date
    assert accepted.state.guest_count == 2
    assert len(backend.searches) == 1


def test_backend_error_does_not_create_relaxation_proposal() -> None:
    backend = FakeBackend(error=BackendTimeoutError("slow"))
    with pytest.raises(BackendTimeoutError):
        run(backend, FakeExtractor(output()), state=complete_state(totalBudget="1000000"))
    assert len(backend.searches) == 1


def test_backend_error_on_revised_search_is_not_reported_as_no_match() -> None:
    backend = FakeBackend()
    first = run(backend, FakeExtractor(output()), state=complete_state(totalBudget="1000000"))
    backend.error = BackendTimeoutError("slow")
    with pytest.raises(BackendTimeoutError):
        run(
            backend, FakeExtractor(output(change("totalBudget", "2600000"))),
            state=first.state, message="Tăng tổng tiền phòng lên 2,6 triệu",
        )
    assert len(backend.searches) == 2


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
