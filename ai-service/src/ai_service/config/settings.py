"""Environment-backed application settings."""

from decimal import Decimal
from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo

from pydantic import Field, HttpUrl, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from ai_service.application.recommendation.scoring import ScoringConfig


class Settings(BaseSettings):
    """Settings for live availability and optional language extraction."""

    app_name: str = "ai-service"
    app_env: Literal["development", "test", "staging", "production"] = "development"
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"

    backend_api_url: HttpUrl = HttpUrl("http://localhost:9090")
    backend_request_timeout_seconds: float = Field(default=5.0, gt=0)
    ai_service_auth_token: SecretStr | None = None
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-2.5-flash"
    gemini_request_timeout_seconds: float = Field(default=15.0, gt=0, le=60)
    hotel_timezone: str = "Asia/Ho_Chi_Minh"
    scoring_amenity_weight: Decimal = Field(default=Decimal("0.4"), ge=0, allow_inf_nan=False)
    scoring_price_weight: Decimal = Field(default=Decimal("0.35"), ge=0, allow_inf_nan=False)
    scoring_capacity_weight: Decimal = Field(default=Decimal("0.25"), ge=0, allow_inf_nan=False)

    @property
    def scoring_config(self) -> ScoringConfig:
        return ScoringConfig(
            amenity_weight=self.scoring_amenity_weight,
            price_weight=self.scoring_price_weight,
            capacity_weight=self.scoring_capacity_weight,
        )

    @model_validator(mode="after")
    def valid_scoring_weights(self) -> "Settings":
        self.scoring_config
        return self

    @field_validator("hotel_timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        ZoneInfo(value)
        return value

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
