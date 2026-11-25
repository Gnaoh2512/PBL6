"""Host publication pins. No model response can supply review authority or artifact paths."""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GroundingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, hide_input_in_errors=True)
    catalog_path: Path | None = None
    catalog_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    sources_path: Path | None = None
    sources_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    authorities: frozenset[str] = frozenset()
    context_input_tokens: int = Field(default=6000, ge=1, le=8000)
    max_evidence: int = Field(default=3, ge=1, le=3)
    proposal_mode: Literal["claim_draft", "fact_selection"] = "claim_draft"
