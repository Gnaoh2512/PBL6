"""An explicit, inactive Academic Demo profile; never loads or exports environment values."""

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, model_validator

from app.indexing import ChunkingConfig, EmbeddingProfile, HybridConfig
from app.orchestration.verification.catalog import _pairs
from app.orchestration.verification.settings import GroundingConfig

ENTRYPOINT = (
    "python",
    "-m",
    "uvicorn",
    "app.main:create_app",
    "--factory",
    "--host",
    "127.0.0.1",
    "--port",
    "8006",
)


class DemoEnvironment(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, hide_input_in_errors=True)

    AI_CORPUS_MODE: Literal["demo_synthetic"]
    AI_DEMO_SOURCE_PACK: Literal["academic_policies"]
    AI_RETRIEVAL_MODE: Literal["hybrid"]
    GEMINI_MODEL: Literal["gemini-3.6-flash"]
    GEMINI_THINKING_LEVEL: Literal["MINIMAL"]
    GEMINI_TRANSIENT_RETRIES: Literal[1]
    GEMINI_RETRY_BACKOFF_MS: Literal[400]
    AI_EMBEDDING: EmbeddingProfile
    AI_CHUNKING: ChunkingConfig
    AI_HYBRID: HybridConfig
    AI_QDRANT_URL: Literal["http://127.0.0.1:6333"]
    AI_INDEX_HTTP_TIMEOUT: Literal[30.0]
    AI_DEPENDENCY_LATCH_COOLDOWN_S: Literal[5.0]
    AI_GROUNDING: GroundingConfig

    @model_validator(mode="before")
    @classmethod
    def explicit_nested_profiles(cls, raw):
        # Shared runtime models have defaults. The contract must state every choice.
        if isinstance(raw, dict):
            for key, model in (
                ("AI_EMBEDDING", EmbeddingProfile),
                ("AI_CHUNKING", ChunkingConfig),
                ("AI_HYBRID", HybridConfig),
                ("AI_GROUNDING", GroundingConfig),
            ):
                if not isinstance(raw.get(key), dict) or set(raw[key]) != set(model.model_fields):
                    raise ValueError("Nested profile must be complete: " + key)
        return raw


class AcademicDemoContract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True, hide_input_in_errors=True)

    schema_version: Literal["academic-demo-configuration-1"]
    working_directory: Literal["ai-service"]
    entrypoint: tuple[str, ...]
    snapshot_family: Literal["paired_bm25_vector"]
    secret_environment: tuple[Literal["GEMINI_API_KEY", "AI_SERVICE_AUTH_TOKEN"], ...]
    environment: DemoEnvironment

    @model_validator(mode="after")
    def fixed_entrypoint_and_secrets(self):
        if self.entrypoint != ENTRYPOINT:
            raise ValueError("Entrypoint must use the existing factory without a build wrapper")
        if self.secret_environment != ("GEMINI_API_KEY", "AI_SERVICE_AUTH_TOKEN"):
            raise ValueError("Declare secret names only, in the documented order")
        return self


def read_contract(path: Path) -> AcademicDemoContract:
    raw = path.read_bytes()
    if len(raw) > 64 * 1024:
        raise ValueError("Oversized contract")
    json.loads(raw, object_pairs_hook=_pairs)
    return AcademicDemoContract.model_validate_json(raw)
