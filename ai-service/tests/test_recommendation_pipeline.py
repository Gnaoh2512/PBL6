import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
import simplejson

from ai_service.application.recommendation import (
    AvailabilitySearchRequest,
    RecommendationRequest,
    RecommendationStatus,
)
from ai_service.application.recommendation.pipeline import RecommendationPipeline
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
):
    pipeline = RecommendationPipeline(backend, clock=lambda: FIXED_NOW)
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

    assert [room.room_id for room in result.recommendations] == [1, 2]
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


def test_exact_amenity_tokens_are_normalized_deduplicated_and_ground_reasons() -> None:
    backend = StubBackendClient(
        [candidate(1, amenities="  WiFi , Minibar, Ban công ngắm cảnh biển  ")]
    )
    request = recommendation_request(
        preferences={"amenities": [" wifi ", "WIFI", "minibar", "ban công"]}
    )

    result = run_pipeline(backend, request)
    room = result.recommendations[0]

    assert room.score == Decimal("2") / Decimal("3")
    assert room.reasons == [
        "Exact amenity token matched: Minibar",
        "Exact amenity token matched: WiFi",
    ]
    assert all("Ban công" not in reason for reason in room.reasons)
    assert all("Synthetic fixture only" not in reason for reason in room.reasons)


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


def test_ranking_is_independent_of_backend_order_and_uses_tie_breakers() -> None:
    candidates = [
        candidate(30, price="800000.00", amenities="Wifi"),
        candidate(20, price="700000.00", amenities="Wifi"),
        candidate(10, price="700000.00", amenities="Wifi"),
        candidate(5, price="600000.00", amenities="Balcony"),
    ]
    first = run_pipeline(StubBackendClient(candidates))
    reversed_result = run_pipeline(StubBackendClient(list(reversed(candidates))))

    expected = [10, 20, 30, 5]
    assert [room.room_id for room in first.recommendations] == expected
    assert [room.room_id for room in reversed_result.recommendations] == expected


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
