import pytest
from pydantic import ValidationError

from ai_service.config.settings import Settings


def test_settings_read_environment_variables(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("BACKEND_REQUEST_TIMEOUT_SECONDS", "7.5")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.backend_request_timeout_seconds == 7.5


def test_scoring_weights_validate_on_settings_load() -> None:
    with pytest.raises(ValidationError):
        Settings(
            _env_file=None, scoring_amenity_weight=0,
            scoring_price_weight=0, scoring_capacity_weight=0,
        )
