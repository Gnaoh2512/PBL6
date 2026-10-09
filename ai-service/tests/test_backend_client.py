import asyncio
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import simplejson

from ai_service.application.recommendation import RecommendationRequest
from ai_service.infrastructure.backend import (
    BackendClient,
    BackendConnectionError,
    BackendHttpError,
    BackendInvalidResponseError,
    BackendTimeoutError,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def search_request() -> RecommendationRequest:
    return RecommendationRequest.model_validate(
        {
            "checkInDate": "2026-11-10",
            "checkOutDate": "2026-11-12",
            "guestCount": 2,
            "roomTypeId": 2,
            "minPrice": "500000.25",
            "maxPrice": "1500000.75",
            "sortBy": "PRICE_ASC",
            "preferences": {"amenities": ["balcony"]},
            "topK": 5,
        }
    )


def fixture_response() -> bytes:
    return (FIXTURE_DIR / "available_rooms_success.json").read_bytes()


def run_client(handler, request_id: str = "req_2026-10.09"):
    async def execute():
        transport = httpx.MockTransport(handler)
        async with BackendClient(
            base_url="http://backend.test",
            timeout_seconds=5,
            transport=transport,
        ) as client:
            return await client.find_available_rooms(
                search_request().availability_search(), request_id=request_id
            )

    return asyncio.run(execute())


def test_maps_request_and_typed_response_without_authorization() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path == "/api/public/rooms/available"
        assert request.headers["X-Request-ID"] == "req_2026-10.09"
        assert "Authorization" not in request.headers
        payload = simplejson.loads(request.content, use_decimal=True)
        assert payload == {
            "checkInDate": "2026-11-10",
            "checkOutDate": "2026-11-12",
            "guestCount": 2,
            "roomTypeId": 2,
            "minPrice": Decimal("500000.25"),
            "maxPrice": Decimal("1500000.75"),
            "sortBy": "PRICE_ASC",
        }
        return httpx.Response(200, content=fixture_response())

    rooms = run_client(handler)

    assert len(rooms) == 1
    assert rooms[0].room_id == 101
    assert rooms[0].room_type.room_type_id == 2
    assert rooms[0].price_per_night == Decimal("1250000.50")
    assert isinstance(rooms[0].price_per_night, Decimal)


def test_empty_availability_is_a_successful_empty_list() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "success": True,
                "message": "Success",
                "data": [],
                "timestamp": "2026-10-09T10:00:00",
            },
        )

    assert run_client(handler) == []


@pytest.mark.parametrize(
    ("raised", "expected"),
    [
        (httpx.ReadTimeout("slow"), BackendTimeoutError),
        (httpx.ConnectError("offline"), BackendConnectionError),
    ],
)
def test_transport_failures_are_classified(raised: Exception, expected: type[Exception]) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise raised

    with pytest.raises(expected):
        run_client(handler)


@pytest.mark.parametrize("status_code", [400, 404, 500, 503])
def test_http_errors_preserve_status_category(status_code: int) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"message": "synthetic error"})

    with pytest.raises(BackendHttpError) as exc_info:
        run_client(handler)

    assert exc_info.value.status_code == status_code


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"not-json"),
        httpx.Response(200, json={"success": True, "data": []}),
        httpx.Response(
            200,
            json={
                "success": False,
                "message": "failed",
                "data": None,
                "timestamp": "2026-10-09T10:00:00",
            },
        ),
    ],
)
def test_invalid_response_is_not_treated_as_empty_availability(response: httpx.Response) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return response

    with pytest.raises(BackendInvalidResponseError):
        run_client(handler)


@pytest.mark.parametrize("request_id", ["", "contains space", "x" * 65, "unicode-đ"])
def test_invalid_request_id_is_rejected_before_transport(request_id: str) -> None:
    called = False

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, content=fixture_response())

    with pytest.raises(ValueError, match="X-Request-ID"):
        run_client(handler, request_id=request_id)

    assert called is False


def test_client_closes_its_connection_pool() -> None:
    async def execute() -> bool:
        client = BackendClient(base_url="http://backend.test", timeout_seconds=5)
        await client.aclose()
        return client.is_closed

    assert asyncio.run(execute()) is True
