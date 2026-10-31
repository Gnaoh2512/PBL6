"""Strict schemas and loaders for synthetic, provisional evaluation data."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ai_service.application.recommendation.conversation_models import (
    ExtractedChanges,
    SearchState,
)
from ai_service.application.recommendation.models import RecommendationRequest
from ai_service.infrastructure.backend.models import AvailableRoomCandidate

DATA_DIR = Path(__file__).resolve().parents[3] / "evaluation"
Split = Literal["dev", "heldout"]


class EvaluationTurn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1)
    reference_patch: ExtractedChanges = Field(alias="referencePatch")
    expected_status: Literal[
        "NEEDS_CLARIFICATION", "RECOMMENDED", "NO_MATCH", "UNSUPPORTED", "TECHNICAL_ERROR"
    ] = Field(alias="expectedStatus")
    expected_state: dict[str, object] = Field(alias="expectedState")
    expected_backend_calls: int = Field(alias="expectedBackendCalls", ge=0)

    @model_validator(mode="after")
    def known_state_fields(self) -> EvaluationTurn:
        aliases = {field.alias for field in SearchState.model_fields.values()}
        if set(self.expected_state) - aliases:
            raise ValueError("expectedState contains an unknown state field")
        return self


class Scenario(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(pattern=r"^(dev|test)-[0-9]{2}$")
    split: Split
    group: Literal[
        "complete", "missing", "multiturn", "amenity", "budget", "capacity",
        "no_match", "unsupported", "dependency",
    ]
    source: Literal["synthetic"]
    label_status: Literal["provisional"] = Field(alias="labelStatus")
    initial_state: SearchState = Field(alias="initialState")
    backend: Literal["normal", "empty", "timeout", "connection", "extractor_timeout"]
    turns: list[EvaluationTurn] = Field(min_length=1)

    @model_validator(mode="after")
    def split_matches_id(self) -> Scenario:
        if self.id.startswith("dev-") != (self.split == "dev"):
            raise ValueError("scenario ID and split disagree")
        return self


class RoomFixture(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal["synthetic-rooms-v1"]
    source: Literal["synthetic"]
    rooms: list[AvailableRoomCandidate] = Field(min_length=1)

    @model_validator(mode="after")
    def unique_rooms(self) -> RoomFixture:
        ids = [room.room_id for room in self.rooms]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate synthetic room ID")
        return self


class RankingCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    split: Split
    source: Literal["synthetic"]
    label_status: Literal["provisional"] = Field(alias="labelStatus")
    scenario: str
    request: RecommendationRequest
    eligible_room_ids: list[int] = Field(alias="eligibleRoomIds")
    relevance: dict[int, int] | None
    rationale: str | None

    @model_validator(mode="after")
    def valid_relevance(self) -> RankingCase:
        if len(self.eligible_room_ids) != len(set(self.eligible_room_ids)):
            raise ValueError("duplicate eligible room ID")
        if self.relevance is not None:
            if set(self.relevance) != set(self.eligible_room_ids):
                raise ValueError("relevance must label every eligible room, and no others")
            if any(not 0 <= grade <= 3 for grade in self.relevance.values()):
                raise ValueError("relevance grades must be 0..3")
            if not self.rationale:
                raise ValueError("provisional relevance needs a rationale")
        return self


class RankingDataset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    version: Literal["ranking-provisional-v1"]
    source: Literal["synthetic"]
    label_status: Literal["provisional"] = Field(alias="labelStatus")
    cases: list[RankingCase] = Field(min_length=1)


def load_scenarios(path: Path = DATA_DIR / "scenarios.jsonl") -> list[Scenario]:
    scenarios: list[Scenario] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            scenarios.append(Scenario.model_validate_json(line))
        except ValueError as exc:
            raise ValueError(f"invalid scenario at line {number}") from exc
    ids = [case.id for case in scenarios]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate scenario ID")
    return scenarios


def load_rooms(path: Path = DATA_DIR / "rooms.json") -> RoomFixture:
    return RoomFixture.model_validate_json(path.read_text(encoding="utf-8"))


def load_ranking(path: Path = DATA_DIR / "ranking.json") -> RankingDataset:
    return RankingDataset.model_validate(json.loads(path.read_text(encoding="utf-8")))
