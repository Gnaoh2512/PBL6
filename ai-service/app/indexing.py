"""Offline indexing configuration, independent of the online generation model/budget."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class IndexingError(Exception):
    """Stable CLI/internal error code; never includes provider bodies or credentials."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class EmbeddingProfile(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)
    provider: Literal["gemini"] = "gemini"
    model: Literal["gemini-embedding-001", "gemini-embedding-2"] = "gemini-embedding-001"
    api_version: Literal["v1beta"] = "v1beta"
    dimension: Literal[768, 1536, 3072] = 768
    document_task: Literal["RETRIEVAL_DOCUMENT"] = "RETRIEVAL_DOCUMENT"
    query_task: Literal["RETRIEVAL_QUERY"] = "RETRIEVAL_QUERY"
    normalization: Literal["l2-v1"] = "l2-v1"
    input_recipe: Literal["text-search-v1"] = "text-search-v1"
    # Operator-controlled revision: the upstream model name is not an immutable weights pin.
    revision: str = Field(default="001", min_length=1, max_length=64)


class ChunkingConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)
    algorithm: Literal["complete-section-with-preamble-v1"] = "complete-section-with-preamble-v1"
    max_characters: int = Field(default=2000, ge=200, le=2000)
    overlap: Literal[0] = 0  # Whole sections are atomic; document context is repeated explicitly.


class HybridConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)
    bm25_top_k: int = Field(default=10, ge=1, le=100)
    vector_top_k: int = Field(default=10, ge=1, le=100)
    final_top_k: int = Field(default=3, ge=1, le=100)
    rrf_constant: int = Field(default=60, ge=1, le=1000)


class IndexingSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", populate_by_name=True, hide_input_in_errors=True
    )
    gemini_key: SecretStr | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    embedding: EmbeddingProfile = Field(
        default_factory=EmbeddingProfile, validation_alias="AI_EMBEDDING"
    )
    chunking: ChunkingConfig = Field(default_factory=ChunkingConfig, validation_alias="AI_CHUNKING")
    hybrid: HybridConfig = Field(default_factory=HybridConfig, validation_alias="AI_HYBRID")
    qdrant_url: str = Field(default="http://127.0.0.1:6333", validation_alias="AI_QDRANT_URL")
    qdrant_key: SecretStr | None = Field(default=None, validation_alias="AI_QDRANT_API_KEY")
    http_timeout: float = Field(
        default=30.0, gt=0, le=120, validation_alias="AI_INDEX_HTTP_TIMEOUT"
    )
    demo_source_pack: Literal["d1_fixture", "academic_policies"] = Field(
        default="d1_fixture", validation_alias="AI_DEMO_SOURCE_PACK"
    )
