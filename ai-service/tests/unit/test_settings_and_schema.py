import pytest
from pydantic import ValidationError


def test_environment_overrides_private_dotenv_and_secret_repr_is_masked(tmp_path, monkeypatch):
    from app.settings import Settings

    env_file = tmp_path / ".env"
    env_file.write_text("AI_SERVICE_AUTH_TOKEN=file-secret\n", encoding="utf-8")
    monkeypatch.setenv("AI_SERVICE_AUTH_TOKEN", "environment-secret")
    settings = Settings(_env_file=env_file)
    assert settings.service_token.get_secret_value() == "environment-secret"
    assert "environment-secret" not in repr(settings)


@pytest.mark.parametrize("token", ["", " ", "secret\nvalue", "x" * 513])
def test_unusable_credentials_are_configuration_errors_without_leak(token):
    from app.settings import Settings

    with pytest.raises(ValidationError) as error:
        Settings(_env_file=None, service_token=token)
    assert "input_value=" not in str(error.value)


def test_environment_cannot_claim_unimplemented_dependencies_ready(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.settings import Settings

    monkeypatch.setenv("AI_LLM_READY", "true")
    monkeypatch.setenv("AI_INDEX_READY", "true")
    settings = Settings(
        _env_file=None, service_token="test-only-secret", corpus_mode="demo_synthetic"
    )
    with TestClient(create_app(settings)) as client:
        result = client.get("/ready")
        assert result.status_code == 503
        assert result.json()["corpusMode"] == "demo_synthetic"
        assert not result.json()["checks"]["llm"]
        assert not result.json()["checks"]["retrieval"]


@pytest.mark.parametrize(
    "mutate",
    [
        lambda result: result["data"].update({"customerEmail": "private@example.invalid"}),
        lambda result: result.update({"status": "error"}),
        lambda result: result.update({"name": "execute_sql"}),
        lambda result: result["data"].update({"hasMore": 1}),
    ],
)
def test_tool_result_rejects_pii_unknown_tools_and_inconsistent_data(mutate):
    from uuid import uuid4

    from app.schemas.turn import ToolResult

    result = {
        "callId": str(uuid4()),
        "name": "list_services",
        "status": "ok",
        "data": {"items": [], "hasMore": False},
        "error": None,
    }
    mutate(result)
    with pytest.raises(ValidationError):
        ToolResult.model_validate(result)


@pytest.mark.parametrize("value", [0, 1794528000, "2026-11-13T00:00:00"])
def test_dates_reject_non_date_wire_values(value):
    from app.schemas.turn import BookingItem, Context

    with pytest.raises(ValidationError):
        Context.model_validate(
            {
                "locale": "vi-VN",
                "timeZone": "Asia/Ho_Chi_Minh",
                "today": value,
                "currency": "VND",
            }
        )
    with pytest.raises(ValidationError):
        BookingItem.model_validate(
            {
                "bookingCode": "TEST-ONLY",
                "bookingStatus": "CONFIRMED",
                "roomTypeName": "Test",
                "checkInDate": value,
                "checkOutDate": "2026-11-15",
                "nights": 2,
                "guestCount": 2,
            }
        )


def test_service_active_requires_json_boolean():
    from app.schemas.turn import ServiceItem

    with pytest.raises(ValidationError):
        ServiceItem.model_validate(
            {
                "serviceId": 1,
                "categoryName": "Test",
                "serviceName": "Test",
                "unitPrice": "1.00",
                "unit": "Test",
                "isActive": 1,
                "currency": "VND",
            }
        )
