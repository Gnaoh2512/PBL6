"""Server-only configuration; dependency readiness is never an environment flag."""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.orchestration.verification.settings import GroundingConfig


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
        hide_input_in_errors=True,
    )

    service_token: SecretStr | None = Field(default=None, validation_alias="AI_SERVICE_AUTH_TOKEN")
    gemini_key: SecretStr | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    gemini_model: str = Field(default="gemini-3.1-flash-lite", validation_alias="GEMINI_MODEL")
    gemini_thinking_level: Literal["MINIMAL", "LOW", "MEDIUM", "HIGH"] | None = Field(
        default=None, validation_alias="GEMINI_THINKING_LEVEL"
    )
    gemini_transient_retries: int = Field(
        default=0, ge=0, le=2, validation_alias="GEMINI_TRANSIENT_RETRIES"
    )
    gemini_retry_backoff_ms: int = Field(
        default=400, ge=0, le=5000, validation_alias="GEMINI_RETRY_BACKOFF_MS"
    )
    index_path: Path | None = Field(default=None, validation_alias="AI_INDEX_PATH")
    retrieval_mode: Literal["bm25", "hybrid"] = Field(
        default="hybrid", validation_alias="AI_RETRIEVAL_MODE"
    )
    grounding: GroundingConfig = Field(
        default_factory=GroundingConfig, validation_alias="AI_GROUNDING"
    )
    corpus_mode: Literal["production", "demo_synthetic"] = Field(
        default="production",
        validation_alias="AI_CORPUS_MODE",
    )
    demo_source_pack: Literal["d1_fixture", "academic_policies"] = Field(
        default="d1_fixture",
        validation_alias="AI_DEMO_SOURCE_PACK",
    )
    dependency_latch_cooldown_s: float = Field(
        default=0.0,
        ge=0.0,
        le=3600.0,
        validation_alias="AI_DEPENDENCY_LATCH_COOLDOWN_S",
    )

    @field_validator("gemini_thinking_level", mode="before")
    @classmethod
    def normalize_thinking_level(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped.upper() if stripped else None
        return value

    @field_validator("service_token")
    @classmethod
    def usable_token(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            secret = value.get_secret_value()
            if not 1 <= len(secret) <= 512 or any(not 33 <= ord(c) <= 126 for c in secret):
                raise ValueError("Service credential must be printable ASCII without whitespace")
        return value
