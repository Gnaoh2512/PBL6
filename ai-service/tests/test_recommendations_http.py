"""HTTP contract checks for the live recommendation route."""

import asyncio
from decimal import Decimal
from pathlib import Path

import httpx
import pytest
import simplejson

from ai_service.config import Settings, get_settings
from ai_service.infrastructure.backend import BackendClient
from ai_service.main import app

FIXTURE = Path(__file__).parent / "fixtures" / "available_rooms_success.json"
PATH = "/api/v1/ai/recommendations"
HEADERS = {"Authorization": "Bearer test-service-token", "X-Request-ID": "req-http-1"}
BODY = {
    "checkInDate": "2026-11-10",
    "checkOutDate": "2026-11-12",
    "guestCount": 2,
    "preferences": {"amenities": ["minibar"]},
    "topK": 1,
}


async def call_endpoint(
    body: dict[str, object] | None = None,
    *,
    headers: dict[str, str] | None = None,
) -> httpx.Response:
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.post(
            PATH,
            json=BODY if body is None else body,
            headers=HEADERS if headers is None else headers,
        )


def exercise(
    handler,
    *,
    body: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
    token: str | None = "test-service-token",
) -> httpx.Response:
    async def run() -> httpx.Response:
        backend = BackendClient(
            base_url="http://spring.test", timeout_seconds=5, transport=httpx.MockTransport(handler)
        )
        previous_override = app.dependency_overrides.get(get_settings)
        app.dependency_overrides[get_settings] = lambda: Settings(
            _env_file=None, ai_service_auth_token=token
        )
        app.state.backend_client = backend
        try:
            return await call_endpoint(body, headers=headers)
        finally:
            await backend.aclose()
            del app.state.backend_client
            if previous_override is None:
                app.dependency_overrides.pop(get_settings, None)
            else:
                app.dependency_overrides[get_settings] = previous_override

    return asyncio.run(run())


def test_success_uses_live_availability_and_preserves_decimal_numbers() -> None:
    backend_requests = []

    def backend(request: httpx.Request) -> httpx.Response:
        backend_requests.append(request)
        return httpx.Response(200, content=FIXTURE.read_bytes())

    response = exercise(backend)

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "req-http-1"
    data = simplejson.loads(response.content, use_decimal=True)
    assert data["status"] == "OK"
    assert data["requestId"] == "req-http-1"
    assert [room["roomId"] for room in data["recommendations"]] == [101]
    assert data["recommendations"][0]["pricePerNight"] == Decimal("1250000.50")
    assert data["recommendations"][0]["score"] == 1
    assert data["scoringVersion"] == "multi-criteria-experimental-v1"
    assert data["recommendations"][0]["scoreBreakdown"]["amenities"]["score"] == 1
    assert data["recommendations"][0]["scoreBreakdown"]["price"]["score"] is None
    assert data["recommendations"][0]["matchedPreferences"][0]["requested"] == "MINIBAR"
    assert len(backend_requests) == 1
    assert backend_requests[0].url.path == "/api/public/rooms/available"
    assert backend_requests[0].headers["X-Request-ID"] == "req-http-1"
    assert "Authorization" not in backend_requests[0].headers
    outbound = simplejson.loads(backend_requests[0].content, use_decimal=True)
    assert outbound == {
        "checkInDate": "2026-11-10",
        "checkOutDate": "2026-11-12",
        "guestCount": 2,
    }


def test_no_available_rooms_is_a_successful_no_match() -> None:
    fixture = simplejson.loads(FIXTURE.read_text(encoding="utf-8"))
    fixture["data"] = []
    response = exercise(lambda _: httpx.Response(200, json=fixture))

    assert response.status_code == 200
    assert response.json()["status"] == "NO_MATCH"
    assert response.json()["recommendations"] == []


def test_structured_total_budget_filters_backend_charge_without_forwarding_it() -> None:
    backend_requests = []

    def backend(request: httpx.Request) -> httpx.Response:
        backend_requests.append(request)
        return httpx.Response(200, content=FIXTURE.read_bytes())

    accepted = exercise(backend, body={**BODY, "totalBudget": "2500001.00"})
    rejected = exercise(backend, body={**BODY, "totalBudget": "2500000.99"})
    assert accepted.json()["status"] == "OK"
    assert rejected.json()["status"] == "NO_MATCH"
    assert len(backend_requests) == 2
    assert all("totalBudget" not in request.content.decode() for request in backend_requests)


def test_json_required_amenity_is_enforced_and_not_forwarded_to_spring() -> None:
    backend_requests = []

    def backend(request: httpx.Request) -> httpx.Response:
        backend_requests.append(request)
        return httpx.Response(200, content=FIXTURE.read_bytes())

    response = exercise(
        backend,
        body={**BODY, "requiredAmenities": ["ban công"], "preferences": {"amenities": ["wifi"]}},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "OK"
    assert response.json()["recommendations"][0]["reasons"] == [
            "Đã xác nhận tiện nghi bắt buộc: balcony"
    ]
    assert len(backend_requests) == 1
    assert "requiredAmenities" not in backend_requests[0].content.decode()


def test_json_unknown_or_conflicting_amenity_is_rejected_before_backend() -> None:
    def unused(_: httpx.Request) -> httpx.Response:
        pytest.fail("backend must not be called")

    unknown = exercise(unused, body={**BODY, "requiredAmenities": ["hồ bơi"]})
    conflict = exercise(unused, body={**BODY, "requiredAmenities": ["minibar"]})
    assert unknown.status_code == conflict.status_code == 422
    assert unknown.json()["error"]["code"] == "VALIDATION_ERROR"
    assert unknown.json()["error"]["details"] == [
        {
            "field": "body.requiredAmenities",
            "type": "UNKNOWN_AMENITY",
            "supportedCodes": sorted(
                [
                    "WIFI",
                    "BALCONY",
                    "MINIBAR",
                    "TV",
                    "AIR_CONDITIONING",
                    "BATHTUB",
                    "WATER_HEATER",
                    "KITCHEN",
                    "LIVING_ROOM",
                    "KING_BED",
                    "SOFA_BED",
                ]
            ),
        }
    ]
    assert conflict.json()["error"]["details"] == [
        {"field": "body.preferredAmenities", "type": "AMENITY_CONFLICT"}
    ]


def test_service_token_is_required_and_compared(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AI_SERVICE_AUTH_TOKEN", "unrelated-machine-token")

    def unused(_: httpx.Request) -> httpx.Response:
        raise AssertionError("backend must not be called")

    missing = exercise(unused, headers={"X-Request-ID": "req-http-1"})
    invalid = exercise(
        unused,
        headers={"X-Request-ID": "req-http-1", "Authorization": "Bearer wrong"},
    )
    missing_both = exercise(unused, headers={"unrelated": "value"})
    unconfigured = exercise(unused, token=None)
    empty_token = exercise(unused, token="")

    assert missing.status_code == invalid.status_code == missing_both.status_code == 401
    assert missing.json()["error"]["code"] == "SERVICE_UNAUTHORIZED"
    assert invalid.json()["error"]["code"] == "SERVICE_UNAUTHORIZED"
    assert unconfigured.status_code == 503
    assert unconfigured.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
    assert empty_token.status_code == 503


@pytest.mark.parametrize(
    ("body", "headers"),
    [
        ({**BODY, "checkOutDate": "2026-11-10"}, HEADERS),
        ({**BODY, "hotelId": 99}, HEADERS),
        (
            {"check_in_date": "2026-11-10", "check_out_date": "2026-11-12", "guest_count": 2},
            HEADERS,
        ),
        (BODY, {"Authorization": "Bearer test-service-token"}),
        (BODY, {**HEADERS, "X-Request-ID": "bad id"}),
    ],
)
def test_invalid_requests_have_safe_validation_envelopes(body, headers) -> None:
    response = exercise(
        lambda _: pytest.fail("backend must not be called"), body=body, headers=headers
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.headers["X-Request-ID"] == response.json()["error"]["requestId"]


@pytest.mark.parametrize(
    ("status", "expected_status", "expected_code"),
    [
        (400, 422, "BACKEND_REJECTED_REQUEST"),
        (422, 422, "BACKEND_REJECTED_REQUEST"),
        (401, 502, "BACKEND_UNAVAILABLE"),
        (404, 502, "BACKEND_UNAVAILABLE"),
        (503, 502, "BACKEND_UNAVAILABLE"),
    ],
)
def test_backend_status_is_mapped_without_leaking_body(
    status, expected_status, expected_code
) -> None:
    response = exercise(lambda _: httpx.Response(status, text="private backend error"))

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == expected_code
    assert "private backend error" not in response.text


def test_backend_timeout_is_distinct_from_no_match() -> None:
    def timeout(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("private timeout detail")

    response = exercise(timeout)

    assert response.status_code == 504
    assert response.json()["error"]["code"] == "BACKEND_TIMEOUT"
    assert "private timeout detail" not in response.text


def test_invalid_backend_data_cannot_be_reported_as_no_match() -> None:
    response = exercise(lambda _: httpx.Response(200, json={"success": True, "data": []}))

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "BACKEND_UNAVAILABLE"


def test_inconsistent_backend_availability_cannot_be_recommended() -> None:
    fixture = simplejson.loads(FIXTURE.read_text(encoding="utf-8"))
    fixture["data"][0]["status"] = "BLOCKED"

    response = exercise(lambda _: httpx.Response(200, json=fixture))

    assert response.status_code == 502
    assert response.json()["error"]["code"] == "BACKEND_UNAVAILABLE"


def test_oversized_request_is_rejected_before_json_validation_or_backend_call() -> None:
    response = exercise(
        lambda _: pytest.fail("backend must not be called"),
        body={**BODY, "padding": "x" * 20_000},
    )

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"
    assert response.headers["X-Request-ID"] == "req-http-1"


def test_streamed_request_without_content_length_has_the_same_limit() -> None:
    async def call() -> httpx.Response:
        async def chunks():
            yield b'{"padding":"'
            yield b"x" * 20_000
            yield b'"}'

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url="http://test"
        ) as client:
            return await client.post(PATH, content=chunks(), headers=HEADERS)

    response = asyncio.run(call())

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "REQUEST_TOO_LARGE"
