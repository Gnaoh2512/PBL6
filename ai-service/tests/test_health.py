import asyncio

import httpx
import pytest

from ai_service.config import Settings, get_settings
from ai_service.main import app


async def request(method: str, path: str, **kwargs) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.request(method, path, **kwargs)


@pytest.fixture(autouse=True)
def isolated_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(
        app.dependency_overrides,
        get_settings,
        lambda: Settings(_env_file=None, app_name="ai-service", ai_service_auth_token="test-token"),
    )


def test_health_returns_service_status_without_external_dependencies() -> None:
    response = asyncio.run(request("GET", "/health"))

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "ai-service",
        "version": "0.1.0",
    }


def test_chat_is_not_stubbed_and_recommendations_require_authorization() -> None:
    chat_response = asyncio.run(request("POST", "/api/v1/ai/chat", json={"message": "hello"}))
    recommendation_response = asyncio.run(
        request(
            "POST",
            "/api/v1/ai/recommendations",
            json={
                "check_in_date": "2026-11-10",
                "check_out_date": "2026-11-12",
                "guests": 2,
            },
        )
    )

    assert chat_response.status_code == 404
    assert recommendation_response.status_code == 401
    assert recommendation_response.json()["error"]["code"] == "SERVICE_UNAUTHORIZED"


def test_application_lifespan_owns_backend_client_without_connecting() -> None:
    async def exercise_lifespan():
        async with app.router.lifespan_context(app):
            backend_client = app.state.backend_client
            assert backend_client.is_closed is False
            assert (await request("GET", "/health")).status_code == 200
        return backend_client

    backend_client = asyncio.run(exercise_lifespan())
    assert backend_client.is_closed is True
