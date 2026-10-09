from ai_service.config.settings import Settings


def test_settings_read_environment_variables(monkeypatch) -> None:
    monkeypatch.setenv("APP_ENV", "test")
    monkeypatch.setenv("APP_PORT", "9000")

    settings = Settings(_env_file=None)

    assert settings.app_env == "test"
    assert settings.app_port == 9000
