import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
import simplejson
from pydantic import ValidationError

from ai_service.application.recommendation import (
    AvailabilitySearchRequest,
    RecommendationRequest,
    RecommendationStatus,
)
from ai_service.application.recommendation.pipeline import RecommendationPipeline
from ai_service.application.recommendation.scoring import (
    BaselineAmenityScorer,
    MultiCriteriaScorer,
    ScoringConfig,
)
from ai_service.infrastructure.backend import (
    BackendConnectionError,
    BackendHttpError,
    BackendInvalidResponseError,
    BackendTimeoutError,
)
from ai_service.infrastructure.backend.models import AvailableRoomCandidate

FIXED_NOW = datetime(2026, 10, 9, 8, 0, tzinfo=timezone.utc)


class StubBackendClient:
    def __init__(
        self,
        candidates: list[AvailableRoomCandidate] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.candidates = candidates or []
        self.error = error
        self.calls: list[tuple[AvailabilitySearchRequest, str]] = []

    async def find_available_rooms(
        self,
        search: AvailabilitySearchRequest,
        *,
        request_id: str,
    ) -> list[AvailableRoomCandidate]:
        self.calls.append((search, request_id))
        if self.error is not None:
            raise self.error
        return self.candidates


def candidate(
    room_id: int,
    *,
    capacity: int = 2,
    room_type_id: int = 2,
    price: str = "1000000.00",
    amenities: str | None = "Wifi, Minibar",
    room_number: str | None = None,
) -> AvailableRoomCandidate:
    per_night = Decimal(price)
    return AvailableRoomCandidate.model_validate(
        {
            "roomId": room_id,
            "roomNumber": room_number or f"SYN-{room_id}",
            "floor": 2,
            "status": "AVAILABLE",
            "note": None,
            "roomType": {
                "roomTypeId": room_type_id,
                "typeName": "Synthetic room type",
                "capacity": capacity,
                "basePrice": per_night,
                "amenities": amenities,
                "description": "Synthetic fixture only",
            },
            "checkInDate": "2026-11-10",
            "checkOutDate": "2026-11-12",
            "nights": 2,
            "pricePerNight": per_night,
            "totalRoomCharge": per_night * 2,
            "depositPercentage": 30,
            "estimatedDeposit": per_night * Decimal("0.6"),
        }
    )


def recommendation_request(**changes: object) -> RecommendationRequest:
    payload: dict[str, object] = {
        "checkInDate": "2026-11-10",
        "checkOutDate": "2026-11-12",
        "guestCount": 2,
        "roomTypeId": 2,
        "minPrice": "500000.00",
        "maxPrice": "1500000.00",
        "sortBy": "PRICE_DESC",
        "preferences": {"amenities": ["wifi", "minibar"]},
        "topK": 5,
    }
    return RecommendationRequest.model_validate(payload | changes)


def run_pipeline(
    backend: StubBackendClient,
    request: RecommendationRequest | None = None,
    *,
    scorer=None,
):
    pipeline = RecommendationPipeline(
        backend, clock=lambda: FIXED_NOW, scorer=scorer or BaselineAmenityScorer()
    )
    return asyncio.run(
        pipeline.execute(request or recommendation_request(), request_id="req-pipeline_1")
    )


def test_calls_availability_once_with_every_supported_hard_constraint() -> None:
    backend = StubBackendClient([candidate(1)])
    request = recommendation_request()

    result = run_pipeline(backend, request)

    assert result.status is RecommendationStatus.OK
    assert len(backend.calls) == 1
    search, request_id = backend.calls[0]
    assert request_id == "req-pipeline_1"
    assert search.model_dump(by_alias=True) == {
        "checkInDate": date(2026, 11, 10),
        "checkOutDate": date(2026, 11, 12),
        "guestCount": 2,
        "roomTypeId": 2,
        "minPrice": Decimal("500000.00"),
        "maxPrice": Decimal("1500000.00"),
        "sortBy": "PRICE_DESC",
    }


def test_hard_filter_is_inclusive_and_uses_only_current_response() -> None:
    current_response = [
        candidate(1, capacity=2, price="500000.00"),
        candidate(2, capacity=3, price="1500000.00"),
        candidate(3, capacity=1),
        candidate(4, room_type_id=9),
        candidate(5, price="499999.99"),
        candidate(6, price="1500000.01"),
    ]
    backend = StubBackendClient(current_response)

    result = run_pipeline(backend)

    assert {room.room_id for room in result.recommendations} == {1, 2}
    assert {room.room_id for room in result.recommendations}.issubset(
        {room.room_id for room in current_response}
    )


@pytest.mark.parametrize("candidates", [[], [candidate(1, capacity=1)]])
def test_empty_or_fully_filtered_result_is_no_match(
    candidates: list[AvailableRoomCandidate],
) -> None:
    result = run_pipeline(StubBackendClient(candidates))

    assert result.status is RecommendationStatus.NO_MATCH
    assert result.recommendations == []


@pytest.mark.parametrize(
    "error",
    [
        BackendTimeoutError("timeout"),
        BackendConnectionError("offline"),
        BackendHttpError(503),
        BackendInvalidResponseError("invalid"),
    ],
)
def test_backend_failures_are_preserved_not_converted_to_no_match(error: Exception) -> None:
    with pytest.raises(type(error)):
        run_pipeline(StubBackendClient(error=error))


def test_filtered_candidate_cannot_return_through_soft_scoring() -> None:
    ineligible_but_matching = candidate(
        1,
        capacity=1,
        price="500000.00",
        amenities="Wifi, Minibar",
    )
    eligible_without_matches = candidate(2, amenities="Balcony")

    result = run_pipeline(StubBackendClient([ineligible_but_matching, eligible_without_matches]))

    assert [room.room_id for room in result.recommendations] == [2]
    assert result.recommendations[0].score == Decimal("0")


def test_amenity_prefixes_are_normalized_deduplicated_and_ground_reasons() -> None:
    backend = StubBackendClient(
        [candidate(1, amenities="  WiFi , Minibar, Ban công ngắm cảnh biển  ")]
    )
    request = recommendation_request(
        preferences={"amenities": [" wifi ", "WIFI", "minibar", "ban công"]}
    )

    result = run_pipeline(backend, request)
    room = result.recommendations[0]

    assert room.score == Decimal("1")
    assert room.reasons == [
        "Amenity preference matched: Ban công ngắm cảnh biển",
        "Amenity preference matched: Minibar",
        "Amenity preference matched: WiFi",
    ]
    assert all("Synthetic fixture only" not in reason for reason in room.reasons)


def test_amenity_prefix_requires_word_boundary() -> None:
    backend = StubBackendClient([candidate(1, amenities="Minibar, Wifi tốc độ cao")])
    with pytest.raises(ValidationError, match="Unknown amenity: bar"):
        recommendation_request(preferences={"amenities": ["bar", "wifi"]})
    assert backend.calls == []


def test_required_amenity_filters_absent_unknown_and_unconfirmed_phrases() -> None:
    backend = StubBackendClient(
        [
            candidate(1, amenities="WiFi, Ban công ngắm cảnh biển"),
            candidate(2, amenities="WiFi, Không có ban công"),
            candidate(3, amenities="WiFi"),
            candidate(4, amenities=None),
            candidate(5, amenities="WiFi, Ban công không có"),
            candidate(6, amenities="WiFi, Ban công không rõ"),
        ]
    )
    request = recommendation_request(
        requiredAmenities=["BALCONY"], preferences={"amenities": ["wifi"]}
    )

    result = run_pipeline(backend, request)

    assert [room.room_id for room in result.recommendations] == [1]
    assert result.recommendations[0].reasons == [
        "Required amenity verified: Ban công ngắm cảnh biển",
        "Amenity preference matched: WiFi",
    ]


def test_all_required_amenities_must_be_verified() -> None:
    backend = StubBackendClient(
        [
            candidate(1, amenities="WiFi, Balcony"),
            candidate(2, amenities="WiFi"),
            candidate(3, amenities="Balcony"),
        ]
    )
    result = run_pipeline(
        backend,
        recommendation_request(
            requiredAmenities=["wi-fi", "ban cong"], preferences={"amenities": []}
        ),
    )
    assert [room.room_id for room in result.recommendations] == [1]


def test_alias_duplicates_do_not_inflate_preference_score() -> None:
    backend = StubBackendClient([candidate(1, amenities="WiFi, Balcony")])
    request = recommendation_request(
        preferences={"amenities": ["wi-fi", "WIFI", "ban cong", "ban công", "minibar"]}
    )
    result = run_pipeline(backend, request)
    assert result.recommendations[0].score == Decimal("2") / Decimal("3")
    assert len(result.recommendations[0].reasons) == 2


def test_negative_preference_does_not_score_or_generate_a_reason() -> None:
    result = run_pipeline(
        StubBackendClient([candidate(1, amenities="Không có ban công, WiFi")]),
        recommendation_request(preferences={"amenities": ["balcony", "wifi"]}),
    )
    room = result.recommendations[0]
    assert room.score == Decimal("0.5")
    assert room.reasons == ["Amenity preference matched: WiFi"]


def test_missing_amenities_and_no_preferences_give_equal_neutral_scores() -> None:
    backend = StubBackendClient(
        [
            candidate(2, price="900000.00", amenities=None),
            candidate(1, price="900000.00", amenities="Wifi"),
        ]
    )
    request = recommendation_request(preferences={"amenities": []})

    result = run_pipeline(backend, request)

    assert [room.score for room in result.recommendations] == [Decimal("0"), Decimal("0")]
    assert [room.reasons for room in result.recommendations] == [[], []]
    assert [room.room_id for room in result.recommendations] == [1, 2]


def test_missing_candidate_amenities_cannot_create_a_match() -> None:
    result = run_pipeline(StubBackendClient([candidate(1, amenities=None)]))

    assert result.recommendations[0].score == Decimal("0")
    assert result.recommendations[0].reasons == []


@pytest.mark.parametrize(
    ("sort_by", "expected"),
    [
        ("PRICE_ASC", [10, 20, 25, 30]),
        ("PRICE_DESC", [10, 25, 30, 20]),
        (None, [10, 20, 25, 30]),
    ],
)
def test_ranking_is_independent_of_backend_order_and_uses_tie_breakers(
    sort_by: str | None, expected: list[int]
) -> None:
    candidates = [
        candidate(10, price="1400000.00", amenities="Wifi, Minibar"),
        candidate(30, price="800000.00", amenities="Wifi"),
        candidate(20, price="600000.00", amenities="Wifi"),
        candidate(25, price="800000.00", amenities="Wifi"),
        candidate(5, price="500000.00", amenities="Balcony"),
    ]
    payload = recommendation_request(topK=4).model_dump(by_alias=True)
    if sort_by is None:
        payload.pop("sortBy")
    else:
        payload["sortBy"] = sort_by
    request = RecommendationRequest.model_validate(payload)
    first = run_pipeline(StubBackendClient(candidates), request)
    reversed_result = run_pipeline(StubBackendClient(list(reversed(candidates))), request)

    assert [room.room_id for room in first.recommendations] == expected
    assert [room.room_id for room in reversed_result.recommendations] == expected
    assert first.recommendations[0].score == Decimal("1")


def test_identical_duplicate_is_collapsed_before_top_k() -> None:
    repeated = candidate(1)
    backend = StubBackendClient([repeated, candidate(2), repeated])
    request = recommendation_request(topK=1)

    result = run_pipeline(backend, request)

    assert [room.room_id for room in result.recommendations] == [1]


def test_conflicting_duplicate_is_an_invalid_backend_response() -> None:
    backend = StubBackendClient([candidate(1), candidate(1, price="1100000.00")])

    with pytest.raises(BackendInvalidResponseError, match="roomId=1"):
        run_pipeline(backend)


@pytest.mark.parametrize(
    "changes",
    [
        {"status": "BLOCKED"},
        {"check_in_date": date(2026, 11, 11)},
        {"check_out_date": date(2026, 11, 13)},
        {"nights": 3},
        {"price_per_night": Decimal("-1")},
    ],
)
def test_inconsistent_backend_room_is_an_integration_failure(changes: dict[str, object]) -> None:
    inconsistent = candidate(1).model_copy(update=changes)

    with pytest.raises(BackendInvalidResponseError, match="inconsistent"):
        run_pipeline(StubBackendClient([inconsistent]))


def test_money_and_score_serialize_as_precise_json_numbers() -> None:
    precise = candidate(1, price="999999.99", amenities="Wifi")
    result = run_pipeline(StubBackendClient([precise]))

    encoded = result.to_contract_json()
    decoded = simplejson.loads(encoded, use_decimal=True)

    room = decoded["recommendations"][0]
    assert room["pricePerNight"] == Decimal("999999.99")
    assert room["totalRoomCharge"] == Decimal("1999999.98")
    assert room["score"] == Decimal("0.5")
    assert '"pricePerNight":999999.99' in encoded


def test_multi_criteria_activates_only_expressed_preferences() -> None:
    rooms = [candidate(1, price="900000", capacity=2, amenities="Wifi"),
             candidate(2, price="600000", capacity=4, amenities="Balcony")]
    request = recommendation_request(
        preferences={"amenities": ["wifi"], "price": "SAVE", "capacity": "SPACIOUS"}
    )
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    assert result.scoring_version == "multi-criteria-experimental-v1"
    assert [room.room_id for room in result.recommendations] == [2, 1]
    assert result.recommendations[0].score == Decimal("0.6")
    assert result.recommendations[0].score_breakdown["amenities"].score == 0
    assert result.recommendations[0].score_breakdown["price"].score == 1
    assert result.recommendations[0].score_breakdown["capacity"].score == 1
    assert [item.criterion for item in result.recommendations[0].matched_preferences] == [
        "price", "capacity"
    ]
    assert [item.requested for item in result.recommendations[0].unmatched_preferences] == [
        "WIFI"
    ]


@pytest.mark.parametrize(
    ("preferences", "expected"),
    [
        ({"amenities": ["wifi"]}, [1, 2]),
        ({"price": "SAVE"}, [2, 1]),
        ({"price": "PREMIUM"}, [1, 2]),
        ({"capacity": "CLOSE_FIT"}, [1, 2]),
        ({"capacity": "SPACIOUS"}, [2, 1]),
    ],
)
def test_each_requested_criterion_controls_order(preferences, expected) -> None:
    rooms = [candidate(1, price="900000", capacity=2, amenities="Wifi"),
             candidate(2, price="600000", capacity=4, amenities="Balcony")]
    request = recommendation_request(preferences=preferences)
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    assert [room.room_id for room in result.recommendations] == expected


def test_budget_limit_is_not_savings_preference_and_inactive_components_are_neutral() -> None:
    rooms = [candidate(1, price="900000", capacity=2), candidate(2, price="600000", capacity=4)]
    request = recommendation_request(preferences={})
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    assert [room.score for room in result.recommendations] == [0, 0]
    assert [room.room_id for room in result.recommendations] == [1, 2]
    assert all(component.score is None for component in result.recommendations[0].score_breakdown.values())


def test_missing_amenity_evidence_is_unmatched_and_cannot_make_a_reason() -> None:
    request = recommendation_request(preferences={"amenities": ["wifi"]})
    result = run_pipeline(
        StubBackendClient([candidate(1, amenities=None)]), request,
        scorer=MultiCriteriaScorer(),
    )
    room = result.recommendations[0]
    assert room.score == 0
    assert room.reasons == []
    assert room.unmatched_preferences[0].evidence is None


@pytest.mark.parametrize("sort_by,expected", [(None, [2, 3, 1]),
                                             ("PRICE_ASC", [2, 3, 1]),
                                             ("PRICE_DESC", [1, 2, 3])])
def test_multi_ties_use_sort_by_then_room_id_independent_of_backend_order(sort_by, expected) -> None:
    rooms = [candidate(1, price="900000"), candidate(3, price="700000"),
             candidate(2, price="700000")]
    payload = recommendation_request(preferences={}, topK=2).model_dump(by_alias=True)
    payload["sortBy"] = sort_by
    request = RecommendationRequest.model_validate(payload)
    forward = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    reverse = run_pipeline(StubBackendClient(list(reversed(rooms))), request,
                           scorer=MultiCriteriaScorer())
    assert [room.room_id for room in forward.recommendations] == expected[:2]
    assert [room.room_id for room in reverse.recommendations] == expected[:2]


def test_multi_hard_filters_before_relative_scoring() -> None:
    rooms = [candidate(1, capacity=1, price="500000"),
             candidate(2, capacity=2, price="700000"),
             candidate(3, capacity=2, price="900000")]
    request = recommendation_request(preferences={"price": "SAVE"}, topK=1)
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    assert [room.room_id for room in result.recommendations] == [2]
    assert result.recommendations[0].score == 1


def test_config_weights_are_validated_and_can_change_rank() -> None:
    with pytest.raises(ValidationError):
        ScoringConfig(amenity_weight=0, price_weight=0, capacity_weight=0)
    with pytest.raises(ValidationError):
        ScoringConfig(version="unknown")
    rooms = [candidate(1, price="900000", amenities="Wifi"),
             candidate(2, price="600000", amenities="Balcony")]
    request = recommendation_request(preferences={"amenities": ["wifi"], "price": "SAVE"})
    config = ScoringConfig(amenity_weight=Decimal("0.1"), price_weight=Decimal("0.9"))
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer(config))
    assert [room.room_id for room in result.recommendations] == [2, 1]


def test_baseline_and_experimental_scorer_can_be_compared_on_identical_candidates() -> None:
    rooms = [candidate(1, price="900000", amenities="Wifi"),
             candidate(2, price="600000", amenities="Balcony")]
    request = recommendation_request(preferences={"amenities": ["wifi"], "price": "SAVE"})
    baseline = run_pipeline(StubBackendClient(rooms), request)
    experimental = run_pipeline(
        StubBackendClient(rooms), request,
        scorer=MultiCriteriaScorer(ScoringConfig(amenity_weight=1, price_weight=2)),
    )
    assert baseline.scoring_version == "amenity-baseline-v1"
    assert [room.room_id for room in baseline.recommendations] == [1, 2]
    assert [room.room_id for room in experimental.recommendations] == [2, 1]


def test_partial_price_fit_has_grounded_vietnamese_reason_and_structured_score() -> None:
    rooms = [candidate(1, price="600000"), candidate(2, price="750000"),
             candidate(3, price="900000")]
    request = recommendation_request(preferences={"price": "SAVE"})
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    middle = next(room for room in result.recommendations if room.room_id == 2)
    assert middle.score_breakdown["price"].score == Decimal("0.5")
    assert middle.unmatched_preferences[0].evidence == "750000"
    assert middle.reasons == ["Giá mỗi đêm 750000; điểm ưu tiên tiết kiệm: 0.5"]
    assert "Wifi" not in " ".join(middle.reasons)


def test_explicit_price_preference_scores_before_conflicting_sort_by() -> None:
    rooms = [candidate(1, price="600000"), candidate(2, price="900000")]
    request = recommendation_request(
        sortBy="PRICE_DESC", preferences={"price": "SAVE"}
    )
    result = run_pipeline(StubBackendClient(rooms), request, scorer=MultiCriteriaScorer())
    assert [room.room_id for room in result.recommendations] == [1, 2]


def test_total_budget_uses_backend_stay_charge_with_exact_inclusive_boundary() -> None:
    backend = StubBackendClient([
        candidate(1, price="600000.005"),
        candidate(2, price="600000.01"),
    ])
    request = recommendation_request(totalBudget="1200000.010")
    result = run_pipeline(backend, request, scorer=MultiCriteriaScorer())
    assert [room.room_id for room in result.recommendations] == [1]
    assert result.recommendations[0].total_room_charge == Decimal("1200000.010")
    assert len(backend.calls) == 1
    assert "totalBudget" not in backend.calls[0][0].model_dump(by_alias=True)


def test_total_budget_for_multiple_nights_and_per_night_limit_both_apply() -> None:
    rooms = [
        candidate(1, price="600000").model_copy(update={
            "check_out_date": date(2026, 11, 13), "nights": 3,
            "total_room_charge": Decimal("1800000"),
        }),
        candidate(2, price="650000").model_copy(update={
            "check_out_date": date(2026, 11, 13), "nights": 3,
            "total_room_charge": Decimal("1950000"),
        }),
        candidate(3, price="750000").model_copy(update={
            "check_out_date": date(2026, 11, 13), "nights": 3,
            "total_room_charge": Decimal("2250000"),
        }),
    ]
    request = recommendation_request(
        checkOutDate="2026-11-13", maxPrice="700000", totalBudget="1800000"
    )
    result = run_pipeline(StubBackendClient(rooms), request)
    assert [room.room_id for room in result.recommendations] == [1]


def test_total_budget_does_not_change_backend_error_semantics() -> None:
    backend = StubBackendClient(error=BackendTimeoutError("slow"))
    with pytest.raises(BackendTimeoutError):
        run_pipeline(backend, recommendation_request(totalBudget="1000000"))
    assert len(backend.calls) == 1
