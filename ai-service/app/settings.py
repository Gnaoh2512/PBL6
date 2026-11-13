"""Server-only configuration; dependency readiness is never an environment flag."""

from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    index_path: Path | None = Field(default=None, validation_alias="AI_INDEX_PATH")
    corpus_mode: Literal["production", "demo_synthetic"] = Field(
        default="production",
        validation_alias="AI_CORPUS_MODE",
    )

    @field_validator("service_token")
    @classmethod
    def usable_token(cls, value: SecretStr | None) -> SecretStr | None:
        if value is not None:
            secret = value.get_secret_value()
            if not 1 <= len(secret) <= 512 or any(not 33 <= ord(c) <= 126 for c in secret):
                raise ValueError("Service credential must be printable ASCII without whitespace")
        return value
