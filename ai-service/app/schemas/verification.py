"""Private, immutable D1.19 gate contracts; no hotel facts or model configuration."""

import json
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.turn import WireDate

Id = Annotated[str, Field(min_length=1, max_length=128, pattern=r"^\S+$")]
Sha = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Text = Annotated[str, Field(min_length=1, max_length=4000)]
DecimalText = Annotated[str, Field(max_length=32, pattern=r"^(0|[1-9][0-9]*)(\.[0-9]+)?$")]
Unit = Literal[
    "minute",
    "hour",
    "calendar_day",
    "working_day",
    "night",
    "percent",
    "vnd",
    "guest",
    "room",
]


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True, hide_input_in_errors=True)


class BooleanValue(Frozen):
    kind: Literal["boolean"]
    data: bool


class EnumValue(Frozen):
    kind: Literal["enum"]
    data: Id


class DecimalValue(Frozen):
    kind: Literal["decimal"]
    data: DecimalText


Value = Annotated[BooleanValue | EnumValue | DecimalValue, Field(discriminator="kind")]


class NoTime(Frozen):
    kind: Literal["none"]


class SameDay(Frozen):
    kind: Literal["same_local_day"]
    timeZone: Literal["Asia/Ho_Chi_Minh"]


class RollingTime(Frozen):
    kind: Literal["rolling_duration"]
    amount: DecimalText
    unit: Unit


class DateRange(Frozen):
    kind: Literal["local_date_range"]
    from_: WireDate = Field(alias="from")
    through: WireDate
    timeZone: Literal["Asia/Ho_Chi_Minh"]

    @model_validator(mode="after")
    def ordered(self):
        if self.through < self.from_:
            raise ValueError("Invalid time range")
        return self


TimeScope = Annotated[NoTime | SameDay | RollingTime | DateRange, Field(discriminator="kind")]


class Validity(Frozen):
    validFrom: WireDate
    validThrough: WireDate | None
    timeZone: Literal["Asia/Ho_Chi_Minh"]

    @model_validator(mode="after")
    def ordered(self):
        if self.validThrough is not None and self.validThrough < self.validFrom:
            raise ValueError("Invalid validity")
        return self


class Approval(Frozen):
    status: Literal["approved", "pending_review", "rejected", "revoked"]
    decisionId: Id | None
    authorityRef: Id | None
    reviewedContentSha256: Sha | None

    @model_validator(mode="after")
    def decision(self):
        values = (self.decisionId, self.authorityRef, self.reviewedContentSha256)
        if self.status == "pending_review":
            if any(v is not None for v in values):
                raise ValueError("Invalid pending approval")
        elif any(v is None for v in values):
            raise ValueError("Missing review decision")
        return self


class Binding(Frozen):
    bindingId: Id
    factId: Id
    documentId: Id
    sourceVersion: Id
    sourceRef: Id
    sourceSha256: Sha
    snapshotId: Id
    citationId: Id
    chunkId: Id
    sectionId: Id
    excerptSha256: Sha
    spans: Annotated[tuple[tuple[int, int], ...], Field(min_length=1, max_length=4)]

    @model_validator(mode="after")
    def bounds(self):
        if any(not 0 <= start < end <= 2000 for start, end in self.spans):
            raise ValueError("Invalid source span")
        return self


class Provenance(Frozen):
    bindings: Annotated[tuple[Binding, ...], Field(min_length=1, max_length=3)]


class RendererRef(Frozen):
    key: Id
    version: Id
    hash: Sha
    ordinal: int = Field(ge=0)


class Proposition(Frozen):
    subjectId: Id
    predicate: Id
    value: Value
    unit: Unit | None
    qualifierIds: Annotated[tuple[Id, ...], Field(max_length=8)]
    timeScope: TimeScope

    @model_validator(mode="after")
    def domains(self):
        if len(set(self.qualifierIds)) != len(self.qualifierIds):
            raise ValueError("Duplicate qualifier")
        if (self.value.kind == "decimal") != (self.unit is not None):
            raise ValueError("Invalid value unit")
        return self


class Fact(Proposition):
    schemaVersion: Literal["d1-fact-1"]
    factId: Id
    factVersion: Id
    factKey: Id
    validity: Validity
    approval: Approval
    provenance: Provenance
    renderer: RendererRef


class Predicate(Frozen):
    id: Id
    valueKind: Literal["boolean", "enum", "decimal"]
    enumValues: tuple[Id, ...]
    units: tuple[Unit, ...]
    cardinality: Literal["single", "multi"]


class Qualifier(Frozen):
    id: Id
    kind: Literal["scope", "condition", "exception"]
    value: BooleanValue | EnumValue
    rendererToken: Text
    supportBindingIds: tuple[Id, ...]


class Vocabulary(Frozen):
    version: Id
    subjects: tuple[Id, ...]
    predicates: tuple[Predicate, ...]
    qualifiers: tuple[Qualifier, ...]


class Requirement(Frozen):
    factKey: Id
    subjectId: Id
    qualifierIds: tuple[Id, ...]
    unit: Unit | None
    timeScope: TimeScope


ParamKind = Literal[
    "time_hhmm",
    "date_dmy",
    "vnd_amount",
    "percent",
    "age_years",
    "count",
    "duration",
]


class ParamSpec(Frozen):
    kind: ParamKind
    minCount: int = Field(default=1, ge=1, le=4)
    minValue: int | None = None
    maxValue: int | None = None

    @model_validator(mode="after")
    def ordered_bounds(self):
        if (
            self.minValue is not None
            and self.maxValue is not None
            and self.maxValue < self.minValue
        ):
            raise ValueError("Invalid parameter bounds")
        return self


class QuestionPattern(Frozen):
    patternId: Id
    allOf: Annotated[
        tuple[Annotated[tuple[Text, ...], Field(min_length=1, max_length=24)], ...],
        Field(min_length=1, max_length=6),
    ]
    noneOf: Annotated[tuple[Text, ...], Field(max_length=24)] = ()
    requiredParams: Annotated[tuple[ParamSpec, ...], Field(max_length=4)] = ()
    disallowedParams: Annotated[tuple[ParamKind, ...], Field(max_length=4)] = ()
    asciiFold: bool = True

    @model_validator(mode="after")
    def disjoint_params(self):
        req = {p.kind for p in self.requiredParams}
        if len(req) != len(self.requiredParams):
            raise ValueError("Duplicate required parameter kind")
        if req & set(self.disallowedParams):
            raise ValueError("Conflicting parameter constraints")
        return self


class QuestionRule(Frozen):
    bindingKey: Id
    aliases: Annotated[tuple[Text, ...], Field(min_length=1, max_length=64)]
    requirements: Annotated[tuple[Requirement, ...], Field(min_length=1, max_length=6)]
    permittedFactKeys: tuple[Id, ...]
    patterns: Annotated[tuple[QuestionPattern, ...], Field(max_length=16)] = ()


class Segment(Frozen):
    kind: Literal["literal", "value", "unit", "scope", "qualifier"]
    text: Text | None
    qualifierId: Id | None

    @model_validator(mode="after")
    def fields_match_kind(self):
        if (self.kind == "literal") != (self.text is not None):
            raise ValueError("Invalid renderer literal")
        if (self.kind == "qualifier") != (self.qualifierId is not None):
            raise ValueError("Invalid renderer qualifier")
        return self


class ValueLabel(Frozen):
    value: Value
    text: Text


class Template(Frozen):
    key: Id
    version: Id
    segments: Annotated[tuple[Segment, ...], Field(min_length=1, max_length=32)]
    valueLabels: Annotated[tuple[ValueLabel, ...], Field(min_length=1, max_length=32)]
    unitText: Text | None
    scopeText: Text | None


class Source(Frozen):
    documentId: Id
    sourceVersion: Id
    sourceRef: Id
    sourceSha256: Sha
    snapshotId: Id
    validity: Validity
    approval: Approval


class CatalogData(Frozen):
    schemaVersion: Literal["d1-catalog-1"]
    catalogVersion: Id
    mode: Literal["demo_synthetic", "production"]
    snapshotId: Id
    vocabulary: Vocabulary
    questionRulesVersion: Id
    questionRules: Annotated[tuple[QuestionRule, ...], Field(max_length=512)]
    rendererVersion: Id
    templates: Annotated[tuple[Template, ...], Field(max_length=512)]
    sources: Annotated[tuple[Source, ...], Field(max_length=256)]
    facts: Annotated[tuple[Fact, ...], Field(max_length=512)]
    reviewedChunkHashes: dict[Id, Sha]
    reviewDeclarations: dict[Id, Literal["complete", "partial", "unknown"]]
    approval: Approval


class SupportRef(Frozen):
    citationId: Id
    bindingId: Id


class TypedClaim(Proposition):
    claimId: Id
    factId: Id
    supportRefs: Annotated[tuple[SupportRef, ...], Field(min_length=1, max_length=3)]


class CandidateDraft(Frozen):
    schemaVersion: Literal["d1-claim-proposal-2"]
    decision: Literal["abstain", "propose_answer"]
    claims: Annotated[tuple[TypedClaim, ...], Field(max_length=6)]

    @classmethod
    def model_validate_json(cls, json_data, **kwargs):
        # Reject ambiguous raw fields before provider parsing loses them. The gate
        # receives a model instance from Gemini and cannot recover discarded keys.
        def unique_fields(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("Duplicate JSON field")
                result[key] = value
            return result

        json.loads(json_data, object_pairs_hook=unique_fields)
        return super().model_validate_json(json_data, **kwargs)

    @model_validator(mode="after")
    def consistency(self):
        if (self.decision == "abstain") != (len(self.claims) == 0):
            raise ValueError("Invalid decision")
        for name in ("claimId", "factId"):
            ids = [getattr(c, name) for c in self.claims]
            if len(ids) != len(set(ids)):
                raise ValueError("Duplicate claim")
        for claim in self.claims:
            pairs = [(r.citationId, r.bindingId) for r in claim.supportRefs]
            if len(pairs) != len(set(pairs)):
                raise ValueError("Duplicate support")
        return self


class FactSelectionProposal(Frozen):
    schemaVersion: Literal["d1-fact-selection-1"]
    decision: Literal["abstain", "propose_answer"]
    factIds: Annotated[tuple[Id, ...], Field(max_length=6)]
    abstainReason: Text | None = None

    @classmethod
    def model_validate_json(cls, json_data, **kwargs):
        def unique_fields(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise ValueError("Duplicate JSON field")
                result[key] = value
            return result

        json.loads(json_data, object_pairs_hook=unique_fields)
        return super().model_validate_json(json_data, **kwargs)

    @model_validator(mode="after")
    def consistency(self):
        if (self.decision == "abstain") != (len(self.factIds) == 0):
            raise ValueError("Invalid decision")
        if self.decision == "propose_answer" and self.abstainReason is not None:
            raise ValueError("Unexpected abstainReason")
        if len(self.factIds) != len(set(self.factIds)):
            raise ValueError("Duplicate factId")
        return self


class VerificationContext(Frozen):
    requestId: Id
    conversationId: Id
    turnId: Id
    diagnosticId: Id
    registryTurnId: Id
    asOfDate: WireDate
    mode: Literal["demo_synthetic", "production"]
    snapshotId: Id
    registryHash: Sha
    catalogHash: Sha
    vocabularyHash: Sha
    questionRulesHash: Sha
    rendererHash: Sha
