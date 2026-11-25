"""Provider-neutral contracts. Credentials and transport details never enter these values."""

from dataclasses import dataclass, field
from datetime import date
from time import monotonic
from typing import Protocol

from pydantic import BaseModel, ConfigDict, Field

from app.diagnostics import Category


class DependencyError(Exception):
    def __init__(
        self, code: str = "DEPENDENCY_UNAVAILABLE", *, diagnostic_category: Category | None = None
    ):
        self.code = code
        self.diagnostic_category = diagnostic_category
        super().__init__(code)


@dataclass
class TurnBudget:
    remaining_ms: int = 20000
    input_limit: int = 8000
    output_limit: int = 2000
    input_used: int = 0
    output_used: int = 0
    calls: int = 0
    started: float = field(default_factory=monotonic)
    per_call_input_limit: int | None = None

    def seconds(self) -> float:
        remaining = self.remaining_ms / 1000 - (monotonic() - self.started)
        if remaining <= 0:
            raise DependencyError(
                "DEADLINE_EXCEEDED", diagnostic_category=Category.APPLICATION_DEADLINE
            )
        return remaining

    def reserve(self, input_tokens: int):
        self.seconds()
        if (
            self.calls >= 2
            or input_tokens < 0
            or self.input_used + input_tokens > self.input_limit
            or self.output_used >= self.output_limit
            or (self.per_call_input_limit is not None and input_tokens > self.per_call_input_limit)
        ):
            raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)

    def record(self, input_tokens: int, output_tokens: int):
        if input_tokens < 0 or output_tokens < 0:
            raise DependencyError("AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA)
        self.calls += 1
        self.input_used += input_tokens
        self.output_used += output_tokens
        if (
            self.input_used > self.input_limit
            or self.output_used > self.output_limit
            or (self.per_call_input_limit is not None and input_tokens > self.per_call_input_limit)
        ):
            raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)


class Evidence(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    citationId: str = Field(min_length=1, max_length=128)
    documentId: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=64)
    chunkId: str = Field(min_length=1, max_length=128)
    sectionId: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=256)
    sourceRef: str = Field(min_length=1, max_length=256)
    excerpt: str = Field(min_length=1, max_length=2000)
    corpusMode: str = Field(pattern=r"^(production|demo_synthetic)$")


class Generator(Protocol):
    async def generate(
        self, system: str, data: dict, schema: type[BaseModel], budget: TurnBudget
    ) -> BaseModel: ...


class Retriever(Protocol):
    snapshot_id: str

    def search(
        self, query: str, today: date, top_k: int = 3, category: str | None = None
    ) -> list[Evidence]: ...
