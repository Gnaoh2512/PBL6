"""Versioned, bounded synthetic investigation artifacts; no runtime imports configure logging."""

import hashlib
import json
import re
from pathlib import Path
from typing import Annotated, Literal, get_args
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.diagnostics import Category
from app.providers.contracts import Evidence
from app.schemas.faq import GroundedAnswer, Intent
from app.schemas.turn import Context
from app.schemas.verification import CandidateDraft

MAX_CASE_BYTES = 256 * 1024
MAX_EVENT_BYTES = 32 * 1024
MAX_EVENTS = 1024
MAX_RUN_BYTES = 16 * 1024 * 1024
MODEL = "gemini-3.1-flash-lite"
BUDGET = {
    "remainingToolCalls": 1,
    "remainingBrokerBatches": 0,
    "remainingMs": 20000,
    "remainingInputTokens": 8000,
    "remainingOutputTokens": 2000,
}
Identifier = Annotated[str, Field(pattern=r"^[a-z0-9-]{1,64}$")]
Uuid = Annotated[
    str, Field(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
]
Sha = Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
State = Literal["captured", "not_reached", "unavailable", "omitted", "missing", "ambiguous"]
Operation = Literal["classify", "answer"]
Method = Literal["countTokens", "generateContent"]
Millis = Annotated[float, Field(ge=0, allow_inf_nan=False)]
Reason = Literal[
    "capture_limit",
    "invalid_capture",
    "privacy_omitted",
    "correlation_failure",
    "missing_timing",
    "missing_diagnostic",
    "ambiguous_timing",
    "ambiguous_diagnostic",
    "orphan_event",
    "pre_dispatch_timing",
    "incomplete_trace",
    "truncated_trace",
    "delivery_loss",
    "missing_model_version",
    "model_drift",
    "source_drift",
    "evidence_mismatch",
    "writer_failure",
    "http_status_stop",
    "user_cancelled",
    "unexpected",
    "cleanup_failure",
]


class CollectorStop(RuntimeError):
    """Only a fixed reason is safe to surface; never carry inputs or exception messages."""

    def __init__(self, reason: Reason):
        if reason not in get_args(Reason):
            reason = "unexpected"
        super().__init__(reason)
        self.reason = reason


class Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", strict=True, hide_input_in_errors=True, validate_assignment=True
    )


class DatasetCase(Strict):
    id: Identifier
    group: Identifier
    query: str = Field(min_length=1, max_length=2000)
    status: Literal["answered", "insufficient_evidence", "capability_unavailable"]
    section: str | None = Field(default=None, max_length=128)


class Dataset(Strict):
    corpusMode: Literal["demo_synthetic"]
    dev: list[DatasetCase] = Field(min_length=12, max_length=12)
    held_out: list[DatasetCase] = Field(min_length=12, max_length=12)


class Input(Strict):
    message: str = Field(min_length=1, max_length=4000)
    history: list = Field(default_factory=list, max_length=0)
    query: str | None = Field(default=None, max_length=2000)
    evidence: list[Evidence] = Field(default_factory=list, max_length=3)
    offeredFacts: list[dict] = Field(default_factory=list, max_length=128)
    requiredFactKeys: list[str] = Field(default_factory=list, max_length=6)


class Generation(Strict):
    operation: Operation
    input_state: State = "not_reached"
    input: Input | None = None
    input_keys: list[
        Literal["message", "history", "query", "evidence", "offeredFacts", "requiredFactKeys"]
    ] = Field(default_factory=list, max_length=5)
    result_state: State = "not_reached"
    result: Intent | GroundedAnswer | CandidateDraft | None = None
    model_version: str | None = Field(default=None, max_length=128)
    error_category: str | None = Field(default=None, max_length=32)


class Retrieval(Strict):
    state: State = "not_reached"
    query: str | None = Field(default=None, max_length=2000)
    today: str | None = Field(default=None, max_length=10)
    top_k: int = Field(default=3, ge=1, le=3)
    category: str | None = Field(default=None, max_length=64)
    evidence: list[Evidence] | None = Field(default=None, max_length=3)


class Citation(Strict):
    citationId: str = Field(min_length=1, max_length=128)
    documentId: str = Field(min_length=1, max_length=128)
    version: str = Field(min_length=1, max_length=64)
    chunkId: str = Field(min_length=1, max_length=128)
    sectionId: str = Field(min_length=1, max_length=128)
    title: str = Field(min_length=1, max_length=256)
    sourceRef: str = Field(min_length=1, max_length=256)


class Final(Strict):
    status: Literal["answered", "insufficient_evidence", "capability_unavailable"]
    answer: str = Field(min_length=1, max_length=4000)
    missingFields: list = Field(max_length=0)
    citations: list[Citation] = Field(max_length=3)
    cards: list = Field(max_length=0)
    actions: list = Field(max_length=0)
    corpusMode: Literal["demo_synthetic"]


class Usage(Strict):
    toolCallsUsed: int = Field(ge=0, le=1)
    brokerBatchesUsed: Literal[0]
    inputTokensUsed: int = Field(ge=0, le=8000)
    outputTokensUsed: int = Field(ge=0, le=2000)


class Attempt(Strict):
    http_attempt_id: Uuid
    diagnostic_id: Uuid
    operation: Operation
    provider_method: Method
    ordinal: int = Field(ge=1, le=4)
    dispatch_hook_seen: bool = True
    http_status: int | None = Field(default=None, ge=100, le=599)
    summary_state: State = "missing"


class CaseRecord(Strict):
    schema_version: Literal[1] = 1
    run_id: Uuid
    case_id: Identifier
    split: Literal["dev", "held_out"]
    order: int = Field(ge=1, le=24)
    expected_status: Literal["answered", "insufficient_evidence", "capability_unavailable"]
    diagnostic_id: Uuid | None = None
    input: Input
    context: Context
    initial_budget: dict[str, int]
    retrieval: Retrieval = Field(default_factory=Retrieval)
    generations: list[Generation] = Field(default_factory=list, max_length=2)
    attempts: list[Attempt] = Field(default_factory=list, max_length=4)
    outcome: Literal["final", "error", "cancelled", "collector_aborted", "not_run"] = "not_run"
    final_state: State = "not_reached"
    final: Final | None = None
    returned_status: (
        Literal["answered", "insufficient_evidence", "capability_unavailable"] | None
    ) = None
    response_evidence: list[Evidence] | None = Field(default=None, max_length=3)
    usage: Usage | None = None
    error_code: str | None = Field(default=None, max_length=32)
    error_category: str | None = Field(default=None, max_length=32)
    elapsed_ms: Millis = 0.0
    reconciled_through_sequence: int = Field(default=0, ge=0, le=MAX_EVENTS)
    gaps: list[Reason] = Field(default_factory=list, max_length=32)

    @field_validator("initial_budget")
    @classmethod
    def fixed_budget(cls, value):
        if value != BUDGET:
            raise ValueError("Unexpected budget")
        return value


class Diagnostic(Strict):
    diagnostic_id: Uuid
    operation: Literal["probe", "classify", "answer", "index_validate", "retrieval", "turn"]
    phase: Literal["countTokens", "generateContent", "response_validation", "index", "application"]
    provider_method: Method | None
    outcome: Literal["success", "error", "cancelled"]
    duration_ms: Millis
    remaining_budget_ms: Millis | None
    http_status: int | None = Field(ge=100, le=599)
    error_category: str | None = Field(max_length=32)

    @field_validator("error_category")
    @classmethod
    def known_category(cls, value):
        if value is not None:
            Category(value)
        return value


class Sample(Strict):
    phase: Literal[
        "connect_tcp",
        "tls",
        "proxy_tls",
        "write_headers",
        "write_body",
        "wait_headers",
        "read_body",
        "close",
    ]
    trace_family: Literal["connection", "proxy", "http11", "http2"]
    sequence: int = Field(ge=1, le=32)
    outcome: Literal["incomplete", "complete", "failed"]
    duration_ms: Millis | None
    duration_kind: Literal["observed_interval", "elapsed_until_abort", "unavailable"]


class Timing(Strict):
    schema_version: Literal[1]
    event_type: Literal["http_timing"]
    diagnostic_id: Uuid
    http_attempt_id: Uuid
    operation: Operation
    provider_method: Method
    protocol: Literal["unknown", "http1", "http2"]
    protocol_source: Literal["unavailable", "response_extension"]
    outcome: Literal["success", "error", "cancelled"]
    error_category: str | None = Field(max_length=32)
    http_status: int | None = Field(ge=100, le=599)
    duration_ms: Millis
    remaining_budget_ms: Millis
    trace_state: Literal["partial", "observed", "unavailable"]
    pre_trace_ms: Millis | None
    truncated: bool
    delivery_loss_observed: bool
    samples: list[Sample] = Field(max_length=32)

    _known_category = field_validator("error_category")(Diagnostic.known_category.__func__)


class Envelope(Strict):
    schema_version: Literal[1] = 1
    run_id: Uuid
    capture_sequence: int = Field(ge=1, le=MAX_EVENTS)
    event: Diagnostic | Timing


class Manifest(Strict):
    schema_version: Literal[1] = 1
    run_id: Uuid
    state: Literal["running", "completed", "stopped"] = "running"
    active_case_id: Identifier | None = None
    started_at: str = Field(max_length=40)
    context: Context
    model: Literal["gemini-3.1-flash-lite"] = MODEL
    prompt_version: Literal["d1-faq-1", "d1-verified-faq-1"] = "d1-verified-faq-1"
    prompt_sha256: dict[str, Sha]
    snapshot_id: Sha
    dataset_sha256: Sha
    source_sha256: dict[str, Sha]
    planned_cases: list[Identifier] = Field(max_length=24)
    completed_cases: int = Field(default=0, ge=0, le=24)
    initial_budget: dict[str, int] = Field(default_factory=lambda: dict(BUDGET))
    limits: dict[str, int] = Field(
        default_factory=lambda: {
            "cases": 24,
            "countTokens": 48,
            "generateContent": 48,
            "http_attempts": 96,
            "case_bytes": MAX_CASE_BYTES,
            "event_records": MAX_EVENTS,
            "event_bytes": MAX_EVENT_BYTES,
            "run_bytes": MAX_RUN_BYTES,
        }
    )
    policy: dict[str, bool] = Field(
        default_factory=lambda: {
            "sequential": True,
            "retry": False,
            "probe": False,
            "warmup": False,
        }
    )
    head: str | None = Field(default=None, pattern=r"^[0-9a-f]{40}$")
    working_tree_dirty: bool = True
    full_retention_until: str = Field(max_length=40)
    summary_retention_until: str = Field(max_length=40)

    @field_validator("initial_budget")
    @classmethod
    def fixed_budget(cls, value):
        if value != BUDGET:
            raise ValueError("Unexpected budget")
        return value


class Corpus(Strict):
    schema_version: Literal[1] = 1
    corpus_mode: Literal["demo_synthetic"] = "demo_synthetic"
    source: Literal["tests/fixtures/d1/faq.md"] = "tests/fixtures/d1/faq.md"
    source_sha256: Sha
    text: str = Field(min_length=1, max_length=16384)
    dataset: Dataset
    snapshot_manifest: dict

    @field_validator("snapshot_manifest")
    @classmethod
    def snapshot_fields(cls, value):
        if (
            set(value)
            != {
                "format",
                "algorithm",
                "chunking",
                "corpusMode",
                "sources",
                "snapshotId",
                "databaseChecksum",
            }
            or value.get("corpusMode") != "demo_synthetic"
            or set(value.get("sources", {})) != {"tests/fixtures/d1/faq.md"}
        ):
            raise ValueError("Unexpected snapshot manifest")
        return value


class NotRun(Strict):
    case_id: Identifier
    reason: Reason


class Summary(Strict):
    schema_version: Literal[1] = 1
    run_id: Uuid
    state: Literal["completed", "stopped"]
    stop_reason: Reason | None
    planned: int = Field(ge=1, le=24)
    attempted: int = Field(ge=0, le=24)
    final_cases: int = Field(ge=0, le=24)
    captured_final_cases: int = Field(ge=0, le=24)
    status_matches: int = Field(ge=0, le=24)
    outcomes: dict[str, int]
    errors: dict[str, int]
    http_attempts: dict[str, int]
    gaps: dict[str, int]
    not_run: list[NotRun] = Field(max_length=24)
    all_case_p50_ms: Millis | None
    all_case_p95_ms: Millis | None
    usage_for_final_cases_only: dict[str, int]
    provider_closed: bool
    baseline_unchanged: bool
    grounding: Literal["not_measured"] = "not_measured"
    total_cost: Literal["not_measured"] = "not_measured"
    acceptance: Literal["not_assessed"] = "not_assessed"
    artifact_sha256: dict[str, Sha]
    retention_until: str = Field(max_length=40)


class Privacy:
    """Synthetic-only boundary, not a general-purpose PII detector."""

    pattern = re.compile(
        r"(?i)bearer\s+\S+|AIza[\w-]{20,}|eyJ[\w-]+\.[\w-]+\.[\w-]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?<!\w)\+?\d{10,15}(?!\w)"
    )
    forbidden = {
        "authorization",
        "headers",
        "api_key",
        "secret",
        "thoughtsignature",
        "raw_exception",
        "traceback",
    }

    def __init__(self, secrets=()):
        self.secrets = tuple(secret for secret in secrets if secret)

    def check(self, value):
        if isinstance(value, BaseModel):
            value = value.model_dump(mode="json")
        if isinstance(value, dict):
            for key, item in value.items():
                if key.lower() in self.forbidden:
                    raise CollectorStop("privacy_omitted")
                self.check(key)
                self.check(item)
        elif isinstance(value, list):
            for item in value:
                self.check(item)
        elif isinstance(value, str):
            if any(secret in value for secret in self.secrets):
                raise CollectorStop("privacy_omitted")
            structural = re.fullmatch(r"[0-9a-f]{64}|[0-9a-f-]{36}", value)
            if not structural and self.pattern.search(value):
                raise CollectorStop("privacy_omitted")

    def encode(self, value, limit=MAX_RUN_BYTES):
        if isinstance(value, BaseModel):
            value = value.model_dump(mode="json")
        try:
            data = json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8")
        except (TypeError, ValueError):
            raise CollectorStop("invalid_capture") from None
        if len(data) > limit:
            raise CollectorStop("capture_limit")
        self.check(value)
        return data


class ArtifactWriter:
    """Only called outside Faq.run; unique directory, atomic file replacement, fixed filenames."""

    filenames = {
        "manifest.json",
        "corpus.json",
        "cases.jsonl",
        "diagnostics.jsonl",
        "http-timing.jsonl",
        "summary.json",
    }

    def __init__(self, parent: Path, run_name: str, privacy: Privacy, limit=MAX_RUN_BYTES):
        if not re.fullmatch(r"[a-zA-Z0-9_-]{1,100}", run_name) or not 1 <= limit <= MAX_RUN_BYTES:
            raise CollectorStop("writer_failure")
        self.parent = parent.resolve()
        self.path = self.parent / run_name
        self.privacy, self.limit, self.sizes = privacy, limit, {}
        try:
            self.path.mkdir(parents=True, exist_ok=False)
        except OSError:
            raise CollectorStop("writer_failure") from None

    def write(self, name, value):
        if (
            name not in self.filenames
            or self.path.resolve() != self.path
            or self.path.is_symlink()
            or self.path.is_junction()
        ):
            raise CollectorStop("writer_failure")
        if name.endswith(".jsonl"):
            model = CaseRecord if name == "cases.jsonl" else Envelope
            if not isinstance(value, list) or len(value) > (
                24 if model is CaseRecord else MAX_EVENTS
            ):
                raise CollectorStop("capture_limit")
            try:
                rows = [model.model_validate_json(self.privacy.encode(row)) for row in value]
            except ValidationError:
                raise CollectorStop("invalid_capture") from None
            data = b"".join(
                self.privacy.encode(row, MAX_CASE_BYTES if model is CaseRecord else MAX_EVENT_BYTES)
                + b"\n"
                for row in rows
            )
        else:
            model = {"manifest.json": Manifest, "corpus.json": Corpus, "summary.json": Summary}[
                name
            ]
            try:
                validated = model.model_validate_json(self.privacy.encode(value))
            except ValidationError:
                raise CollectorStop("invalid_capture") from None
            data = self.privacy.encode(validated)
        if sum(self.sizes.values()) - self.sizes.get(name, 0) + len(data) > self.limit:
            raise CollectorStop("capture_limit")
        destination = self.path / name
        temporary = self.path / (name + "." + uuid4().hex + ".tmp")
        if destination.is_symlink():
            raise CollectorStop("writer_failure")
        try:
            with temporary.open("xb") as stream:
                stream.write(data)
            temporary.replace(destination)
        except OSError:
            if temporary.parent.resolve() == self.path.resolve():
                try:
                    temporary.unlink(missing_ok=True)
                except OSError:
                    pass
            raise CollectorStop("writer_failure") from None
        self.sizes[name] = len(data)
        return hashlib.sha256(data).hexdigest()
