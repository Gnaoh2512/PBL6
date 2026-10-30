"""Environment-backed application settings."""

from functools import lru_cache
from typing import Literal

from pydantic import Field, HttpUrl, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Bootstrap settings that do not require an AI provider or database."""

    app_name: str = "ai-service"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    backend_api_url: HttpUrl = HttpUrl("http://localhost:9090")
    backend_request_timeout_seconds: float = Field(default=5.0, gt=0)
    ai_service_auth_token: SecretStr | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Return one validated settings object per process."""

    return Settings()
