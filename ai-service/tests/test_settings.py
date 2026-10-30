from ai_service.config.settings import Settings


def test_settings_read_environment_variables(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("BACKEND_REQUEST_TIMEOUT_SECONDS", "7.5")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.backend_request_timeout_seconds == 7.5
