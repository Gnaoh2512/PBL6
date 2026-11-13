"""D1 output contracts. Business tools and arbitrary model metadata are not accepted."""

from typing import Literal

from pydantic import Field

from app.schemas.turn import StrictModel


class Intent(StrictModel):
    intent: Literal["faq", "unavailable"]
    query: str = Field(min_length=1, max_length=2000)


class GroundedAnswer(StrictModel):
    supported: bool
    answer: str = Field(min_length=1, max_length=4000)
    citationIds: list[str] = Field(max_length=3)


class Probe(StrictModel):
    ok: bool
