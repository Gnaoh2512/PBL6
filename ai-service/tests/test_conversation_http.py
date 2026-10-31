"""HTTP boundary tests for the private Vietnamese search conversation."""

import asyncio
from decimal import Decimal
from pathlib import Path

import httpx
import simplejson

from ai_service.application.recommendation.conversation_models import ExtractedChanges
from ai_service.config import Settings, get_settings
from ai_service.infrastructure.backend import BackendClient
from ai_service.infrastructure.llm import ExtractionInvalidResponse, ExtractionTimeout
from ai_service.main import app

PATH = "/api/v1/ai/recommendations/conversation"
FIXTURE = Path(__file__).parent / "fixtures" / "available_rooms_success.json"
HEADERS = {"Authorization": "Bearer test-token", "X-Request-ID": "conversation-http"}


class FakeExtractor:
    def __init__(self, error=None) -> None:
        self.error = error
        self.calls = 0

    async def extract(self, message, state, *, today, request_id):
        self.calls += 1
        if self.error:
            raise self.error
        return ExtractedChanges.model_validate(
            {
                "changes": [
                    {"field": "checkInDate", "action": "SET", "value": "2099-11-10"},
                    {"field": "checkOutDate", "action": "SET", "value": "2099-11-12"},
                    {"field": "guestCount", "action": "SET", "value": "2"},
                    {"field": "roomCount", "action": "SET", "value": "1"},
                ],
                "ambiguities": [],
                "unsupportedIntent": False,
            }
        )


def fixture_response():
    fixture = simplejson.loads(FIXTURE.read_text(encoding="utf-8"), use_decimal=True)
    fixture["data"][0]["checkInDate"] = "2099-11-10"
    fixture["data"][0]["checkOutDate"] = "2099-11-12"
    return httpx.Response(200, content=simplejson.dumps(fixture, use_decimal=True))


def exercise(*, extractor=None, backend_handler=None, headers=None, body=None):
    async def run():
        backend = BackendClient(
            base_url="http://spring.test",
            timeout_seconds=3,
            transport=httpx.MockTransport(backend_handler or (lambda _: fixture_response())),
        )
        previous_settings = app.dependency_overrides.get(get_settings)
        previous_backend = getattr(app.state, "backend_client", None)
        previous_extractor = getattr(app.state, "extractor", None)
        app.dependency_overrides[get_settings] = lambda: Settings(
            _env_file=None, ai_service_auth_token="test-token"
        )
        app.state.backend_client = backend
        app.state.extractor = extractor
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app), base_url="http://test"
            ) as client:
                return await client.post(
                    PATH,
                    json=body or {"message": "Một phòng hai người từ 10 đến 12/11/2099"},
                    headers=HEADERS if headers is None else headers,
                )
        finally:
            await backend.aclose()
            app.state.backend_client = previous_backend
            app.state.extractor = previous_extractor
            if previous_settings is None:
                app.dependency_overrides.pop(get_settings, None)
            else:
                app.dependency_overrides[get_settings] = previous_settings

    return asyncio.run(run())


def test_conversation_requires_service_token() -> None:
    extractor = FakeExtractor()
    response = exercise(extractor=extractor, headers={"X-Request-ID": "conversation-http"})
    assert response.status_code == 401
    assert extractor.calls == 0


def test_conversation_uses_live_backend_room_and_precise_price() -> None:
    requests = []

    def backend(request):
        requests.append(request)
        return fixture_response()

    response = exercise(extractor=FakeExtractor(), backend_handler=backend)
    data = simplejson.loads(response.content, use_decimal=True)
    assert response.status_code == 200
    assert response.headers["X-Request-ID"] == "conversation-http"
    assert data["status"] == "RECOMMENDED"
    assert data["result"]["recommendations"][0]["roomId"] == 101
    assert data["result"]["recommendations"][0]["pricePerNight"] == Decimal("1250000.50")
    assert len(requests) == 1
    assert requests[0].url.path == "/api/public/rooms/available"


def test_conversation_without_provider_is_a_configuration_error() -> None:
    response = exercise(extractor=None)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "LLM_NOT_CONFIGURED"


def test_conversation_body_limit_is_applied_before_extraction() -> None:
    extractor = FakeExtractor()
    response = exercise(extractor=extractor, body={"message": "x" * 20_000})
    assert response.status_code == 413
    assert extractor.calls == 0


def test_caller_cannot_submit_conflicting_confirmed_and_pending_budget() -> None:
    extractor = FakeExtractor()
    response = exercise(
        extractor=extractor,
        body={
            "message": "Mỗi đêm",
            "state": {
                "maxPrice": 1000000,
                "pending": [{"kind": "budget", "amount": 1000000}],
                "pendingQuestion": "budgetBasis",
            },
        },
    )
    assert response.status_code == 422
    assert extractor.calls == 0


def test_provider_timeout_and_invalid_output_are_technical_errors() -> None:
    timeout = exercise(extractor=FakeExtractor(ExtractionTimeout("slow")))
    invalid = exercise(extractor=FakeExtractor(ExtractionInvalidResponse("bad")))
    assert timeout.status_code == 504
    assert timeout.json()["error"]["code"] == "LLM_TIMEOUT"
    assert invalid.status_code == 502
    assert invalid.json()["error"]["code"] == "LLM_UNAVAILABLE"


def test_backend_failure_is_not_a_no_match() -> None:
    response = exercise(
        extractor=FakeExtractor(), backend_handler=lambda _: httpx.Response(503, text="private")
    )
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "BACKEND_UNAVAILABLE"
