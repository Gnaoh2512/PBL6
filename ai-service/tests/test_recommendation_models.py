from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from ai_service.application.recommendation import RecommendationRequest, SortBy


def valid_payload() -> dict[str, object]:
    return {
        "checkInDate": "2026-11-10",
        "checkOutDate": "2026-11-12",
        "guestCount": 2,
        "roomTypeId": 3,
        "minPrice": "500000.25",
        "maxPrice": "1500000.75",
        "sortBy": "PRICE_ASC",
        "preferences": {"amenities": ["balcony"]},
    }


def test_recommendation_request_maps_contract_and_preserves_decimal() -> None:
    request = RecommendationRequest.model_validate(valid_payload())

    assert request.check_in_date == date(2026, 11, 10)
    assert request.min_price == Decimal("500000.25")
    assert isinstance(request.min_price, Decimal)
    assert request.sort_by is SortBy.PRICE_ASC
    assert request.top_k == 5

    backend_search = request.availability_search()
    assert "preferences" not in backend_search.model_dump()
    assert "top_k" not in backend_search.model_dump()


@pytest.mark.parametrize(
    ("changes", "error_fragment"),
    [
        ({"checkOutDate": "2026-11-10"}, "checkOutDate"),
        ({"guestCount": 0}, "guestCount"),
        ({"roomTypeId": "3"}, "roomTypeId"),
        ({"minPrice": "-0.01"}, "minPrice"),
        ({"minPrice": "10", "maxPrice": "9"}, "minPrice"),
        ({"topK": 0}, "topK"),
        ({"topK": 21}, "topK"),
        ({"topK": 1.5}, "topK"),
        ({"city": "Da Nang"}, "city"),
        ({"preferences": {"amenities": ["x"] * 21}}, "amenities"),
        ({"preferences": {"amenities": ["x" * 101]}}, "amenities"),
        ({"preferences": {"price": "CHEAPEST"}}, "price"),
        ({"preferences": {"capacity": "SMALLEST"}}, "capacity"),
    ],
)
def test_recommendation_request_rejects_invalid_values(
    changes: dict[str, object], error_fragment: str
) -> None:
    payload = valid_payload() | changes

    with pytest.raises(ValidationError) as exc_info:
        RecommendationRequest.model_validate(payload)

    assert error_fragment in str(exc_info.value)


def test_recommendation_request_rejects_python_field_names_on_the_json_boundary() -> None:
    payload = {
        "check_in_date": "2026-11-10",
        "check_out_date": "2026-11-12",
        "guest_count": 2,
    }

    with pytest.raises(ValidationError):
        RecommendationRequest.model_validate(payload)


def test_past_dates_are_not_rejected_without_an_agreed_timezone_rule() -> None:
    payload = valid_payload() | {
        "checkInDate": "2020-01-01",
        "checkOutDate": "2020-01-02",
    }

    request = RecommendationRequest.model_validate(payload)

    assert request.check_in_date == date(2020, 1, 1)


@pytest.mark.parametrize("top_k", [1, 20])
def test_temporary_top_k_boundaries_are_valid(top_k: int) -> None:
    request = RecommendationRequest.model_validate(valid_payload() | {"topK": top_k})

    assert request.top_k == top_k
