"""Evaluation-only recording proxies and bounded logger capture; no filesystem I/O."""

import asyncio
import logging
from collections import Counter
from contextlib import contextmanager
from threading import Lock
from time import monotonic

from d1_collector_schema import (
    MAX_CASE_BYTES,
    MAX_EVENT_BYTES,
    MAX_EVENTS,
    MAX_RUN_BYTES,
    MODEL,
    Attempt,
    CollectorStop,
    Diagnostic,
    Envelope,
    Final,
    Generation,
    Input,
    Privacy,
    Retrieval,
    Timing,
    Usage,
)
from pydantic import ValidationError

from app.diagnostics import category, diagnostic_identity
from app.orchestration.faq import Faq
from app.prompts.faq import CLASSIFY
from app.prompts.verified_faq import ANSWER
from app.providers.contracts import DependencyError, Evidence
from app.providers.http_timing import HttpTiming, get_emitter
from app.schemas.faq import Intent
from app.schemas.verification import CandidateDraft


class Capture:
    def __init__(
        self, run_id, privacy: Privacy, *, event_limit=MAX_EVENTS, byte_limit=MAX_RUN_BYTES
    ):
        if not 1 <= event_limit <= MAX_EVENTS or not 1 <= byte_limit <= MAX_RUN_BYTES:
            raise CollectorStop("capture_limit")
        self.run_id, self.privacy = run_id, privacy
        self.event_limit, self.byte_limit = event_limit, byte_limit
        self.cases, self.events, self.by_diagnostic = [], [], {}
        self.stop_reason = None
        self.counts = Counter()
        self.bytes = 0
        self.semantic_bytes = 0
        self.lock = Lock()

    def stop(self, reason):
        if self.stop_reason is None:
            self.stop_reason = CollectorStop(reason).reason

    def gap(self, case, reason, *, fatal=False):
        if reason not in case.gaps:
            case.gaps.append(reason)
        if fatal:
            self.stop(reason)

    def add_case(self, case):
        if len(self.cases) >= 24:
            raise CollectorStop("capture_limit")
        self.reserve(len(self.privacy.encode(case, MAX_CASE_BYTES)))
        self.cases.append(case)

    def reserve(self, size):
        with self.lock:
            if self.bytes + self.semantic_bytes + size > self.byte_limit:
                raise CollectorStop("capture_limit")
            self.semantic_bytes += size

    def omit(self, case, reason):
        case.final, case.response_evidence, case.usage = None, None, None
        case.final_state = "omitted"
        case.retrieval = Retrieval(state="omitted")
        for generation in case.generations:
            generation.input = generation.result = None
            generation.input_state = generation.result_state = "omitted"
        self.gap(case, reason, fatal=True)

    def model(self, model, value, case):
        try:
            data = self.privacy.encode(value, MAX_CASE_BYTES)
            self.reserve(len(data))
            return model.model_validate_json(data)
        except CollectorStop as error:
            self.omit(case, error.reason)
        except ValidationError:
            self.omit(case, "invalid_capture")
        return None

    def bind(self, case):
        identity, _ = diagnostic_identity()
        if (case.diagnostic_id is not None and case.diagnostic_id != identity) or (
            identity in self.by_diagnostic and self.by_diagnostic[identity] is not case
        ):
            self.stop("correlation_failure")
            raise CollectorStop("correlation_failure")
        case.diagnostic_id = identity
        self.by_diagnostic[identity] = case

    def record(self, record, timing=False):
        try:
            if not isinstance(record.msg, str) or record.args:
                raise CollectorStop("invalid_capture")
            if len(record.msg.encode("utf-8")) > MAX_EVENT_BYTES:
                raise CollectorStop("capture_limit")
            event = (Timing if timing else Diagnostic).model_validate_json(record.msg)
            self.privacy.check(event)
            with self.lock:
                if len(self.events) >= self.event_limit:
                    raise CollectorStop("capture_limit")
                envelope = Envelope(
                    run_id=self.run_id, capture_sequence=len(self.events) + 1, event=event
                )
                size = len(self.privacy.encode(envelope, MAX_EVENT_BYTES))
                if self.bytes + self.semantic_bytes + size > self.byte_limit:
                    raise CollectorStop("capture_limit")
                self.events.append(envelope)
                self.bytes += size
        except CollectorStop as error:
            self.stop(error.reason)
        except (ValidationError, ValueError, TypeError):
            self.stop("invalid_capture")

    @contextmanager
    def loggers(self, client):
        # Initialize the existing emitter before saving logger state. Otherwise first use
        # inside capture would leave an initialized emitter with a restored NOTSET logger,
        # suppressing subsequent INFO summaries. This setup is outside the timed turn.
        get_emitter()
        owner = self

        class Handler(logging.Handler):
            def __init__(self, timing):
                super().__init__()
                self.timing = timing

            def emit(self, record):
                owner.record(record, self.timing)

        saved = []
        for name, timing in (("ai_service.diagnostics", False), ("ai_service.http_timing", True)):
            logger = logging.getLogger(name)
            saved.append((logger, logger.handlers[:], logger.level, logger.propagate))
            logger.handlers = [Handler(timing)]
            logger.setLevel(logging.INFO)
            logger.propagate = False
        client.event_hooks["request"].append(self.request)
        client.event_hooks["response"].append(self.response)
        try:
            yield
        finally:
            client.event_hooks["request"].remove(self.request)
            client.event_hooks["response"].remove(self.response)
            for logger, handlers, level, propagate in saved:
                logger.handlers = handlers
                logger.setLevel(level)
                logger.propagate = propagate

    async def request(self, request):
        if self.stop_reason:
            raise CollectorStop(self.stop_reason)
        observer = getattr(request.extensions.get("trace"), "__self__", None)
        if not isinstance(observer, HttpTiming):
            self.stop("correlation_failure")
            raise CollectorStop("correlation_failure")
        case = self.by_diagnostic.get(observer.identity)
        method, operation = observer.method.value, observer.operation
        if case is None or operation not in ("classify", "answer"):
            self.stop("correlation_failure")
            raise CollectorStop("correlation_failure")
        if len(case.attempts) >= 4 or self.counts[method] >= 48 or sum(self.counts.values()) >= 96:
            self.stop("capture_limit")
            raise CollectorStop("capture_limit")
        if any(a.operation == operation and a.provider_method == method for a in case.attempts):
            self.stop("correlation_failure")
            raise CollectorStop("correlation_failure")
        case.attempts.append(
            Attempt(
                http_attempt_id=observer.attempt_id,
                diagnostic_id=observer.identity,
                operation=operation,
                provider_method=method,
                ordinal=len(case.attempts) + 1,
            )
        )
        self.counts[method] += 1

    async def response(self, response):
        observer = getattr(response.request.extensions.get("trace"), "__self__", None)
        case = self.by_diagnostic.get(getattr(observer, "identity", None))
        if case is None:
            self.stop("correlation_failure")
            return
        attempt = next((a for a in case.attempts if a.http_attempt_id == observer.attempt_id), None)
        if attempt is None:
            self.stop("correlation_failure")
            return
        attempt.http_status = response.status_code
        if response.status_code in (401, 403, 429):
            self.stop("http_status_stop")

    def event_snapshot(self):
        with self.lock:
            return list(self.events)

    async def settle(self, case, seconds=1.0):
        if not 0 <= seconds <= 1:
            raise CollectorStop("capture_limit")
        end = monotonic() + seconds
        expected = {a.http_attempt_id for a in case.attempts}
        while True:
            seen = {
                e.event.http_attempt_id
                for e in self.event_snapshot()
                if isinstance(e.event, Timing)
            }
            if expected <= seen or self.stop_reason or monotonic() >= end:
                break
            await asyncio.sleep(min(0.01, max(0, end - monotonic())))
        self.reconcile(case)

    def reconcile(self, case):
        snapshot = self.event_snapshot()
        case.reconciled_through_sequence = len(snapshot)
        events = [e.event for e in snapshot if e.event.diagnostic_id == case.diagnostic_id]
        diagnostic = [e for e in events if isinstance(e, Diagnostic)]
        turns = [e for e in diagnostic if e.operation == "turn" and e.phase == "application"]
        if len(turns) != 1:
            self.gap(
                case, "missing_diagnostic" if not turns else "ambiguous_diagnostic", fatal=True
            )
        timings = [e for e in events if isinstance(e, Timing)]
        for attempt in case.attempts:
            matching = [e for e in timings if e.http_attempt_id == attempt.http_attempt_id]
            attempt.summary_state = (
                "captured" if len(matching) == 1 else "missing" if not matching else "ambiguous"
            )
            if len(matching) != 1:
                self.gap(case, "missing_timing" if not matching else "ambiguous_timing", fatal=True)
            elif (matching[0].operation, matching[0].provider_method) != (
                attempt.operation,
                attempt.provider_method,
            ):
                self.gap(case, "orphan_event", fatal=True)
            methods = [
                e
                for e in diagnostic
                if e.phase == attempt.provider_method and e.operation == attempt.operation
            ]
            if len(methods) != 1:
                self.gap(
                    case,
                    "missing_diagnostic" if not methods else "ambiguous_diagnostic",
                    fatal=True,
                )
        for timing in timings:
            if timing.http_attempt_id not in {a.http_attempt_id for a in case.attempts}:
                self.gap(case, "pre_dispatch_timing")
            if timing.trace_state != "observed" or any(
                s.duration_kind == "unavailable" for s in timing.samples
            ):
                self.gap(case, "incomplete_trace")
            if timing.truncated:
                self.gap(case, "truncated_trace")
            if timing.delivery_loss_observed:
                self.gap(case, "delivery_loss")
        for generation in case.generations:
            if generation.result_state == "captured" and generation.model_version is None:
                self.gap(case, "missing_model_version")
            if (
                generation.operation == "answer"
                and generation.input is not None
                and case.retrieval.state == "captured"
            ):
                if (
                    generation.input.query != case.retrieval.query
                    or generation.input.evidence != case.retrieval.evidence
                ):
                    self.gap(case, "evidence_mismatch", fatal=True)
        if (
            case.response_evidence is not None
            and case.retrieval.state == "captured"
            and case.response_evidence != case.retrieval.evidence
        ):
            self.gap(case, "evidence_mismatch", fatal=True)
        if any(e.event.diagnostic_id not in self.by_diagnostic for e in self.event_snapshot()):
            self.gap(case, "orphan_event", fatal=True)
        try:
            size = sum(len(self.privacy.encode(c, MAX_CASE_BYTES)) for c in self.cases)
            if size + self.bytes > self.byte_limit:
                raise CollectorStop("capture_limit")
        except CollectorStop as error:
            self.omit(case, error.reason)


class RecordingIndex:
    def __init__(self, delegate, capture, case):
        self.delegate, self.capture, self.case = delegate, capture, case
        self.snapshot_id = delegate.snapshot_id

    def validate(self, today):
        self.capture.bind(self.case)
        return self.delegate.validate(today)

    def search(self, query, today, top_k=3, category=None):
        initial = self.capture.model(
            Retrieval,
            {
                "state": "unavailable",
                "query": query,
                "today": today.isoformat(),
                "top_k": top_k,
                "category": category,
                "evidence": None,
            },
            self.case,
        )
        if initial is not None:
            self.case.retrieval = initial
        result = self.delegate.search(query, today, top_k, category)
        captured = self.capture.model(
            Retrieval,
            {
                "state": "captured",
                "query": query,
                "today": today.isoformat(),
                "top_k": top_k,
                "category": category,
                "evidence": [e.model_dump(mode="json") for e in result],
            },
            self.case,
        )
        if captured is not None:
            self.case.retrieval = captured
        return result


class RecordingGemini:
    def __init__(self, delegate, capture, case):
        self.delegate, self.capture, self.case = delegate, capture, case

    async def generate(self, system, data, schema, budget):
        _, operation = diagnostic_identity()
        if self.capture.stop_reason:
            raise CollectorStop(self.capture.stop_reason)
        if (
            operation not in ("classify", "answer")
            or system != {"classify": CLASSIFY, "answer": ANSWER}[operation]
            or len(self.case.generations) >= 2
        ):
            self.capture.stop("source_drift")
            raise CollectorStop("source_drift")
        generation = Generation(operation=operation)
        self.case.generations.append(generation)
        keys = (
            {"message", "history"}
            if operation == "classify"
            else {"message", "query", "evidence", "offeredFacts", "requiredFactKeys"}
        )
        expected = Intent if operation == "classify" else CandidateDraft
        if set(data) != keys or schema is not expected:
            self.capture.stop("source_drift")
            raise CollectorStop("source_drift")
        generation.input_keys = sorted(data)
        generation.input = self.capture.model(Input, data, self.case)
        generation.input_state = "captured" if generation.input is not None else "omitted"
        if self.capture.stop_reason:
            raise CollectorStop(self.capture.stop_reason)
        try:
            result = await self.delegate.generate(system, data, schema, budget)
        except BaseException as error:
            generation.result_state = "unavailable"
            generation.error_category = category(error).value
            raise
        generation.result = self.capture.model(expected, result, self.case)
        generation.result_state = "captured" if generation.result is not None else "omitted"
        version = self.delegate.model_version
        if isinstance(version, str) and len(version) <= 128:
            try:
                self.capture.privacy.check(version)
                generation.model_version = version
            except CollectorStop as error:
                self.capture.omit(self.case, error.reason)
            if version != MODEL:
                self.capture.stop("model_drift")
        return result


class RecordingFaq:
    def __init__(self, provider, index, capture, case, *, verification_gate=None):
        self.capture, self.case = capture, case
        self.delegate = Faq(
            RecordingGemini(provider, capture, case),
            RecordingIndex(index, capture, case),
            "demo_synthetic",
            verification_gate=verification_gate,
        )

    async def run(self, payload):
        started = monotonic()
        try:
            result = await self.delegate.run(payload)
        except BaseException as error:
            self.case.elapsed_ms = max(0, (monotonic() - started) * 1000)
            self.case.error_category = category(error).value
            if self.case.final_state != "omitted":
                self.case.final_state = "unavailable"
            if isinstance(error, CollectorStop):
                self.case.outcome = "collector_aborted"
                self.capture.stop(error.reason)
            elif isinstance(error, asyncio.CancelledError):
                self.case.outcome = "cancelled"
                self.capture.stop("user_cancelled")
            else:
                self.case.outcome = "error"
                known = {
                    "DEADLINE_EXCEEDED",
                    "DEPENDENCY_UNAVAILABLE",
                    "AI_PROTOCOL_ERROR",
                    "BUDGET_EXCEEDED",
                }
                code = getattr(error, "code", None)
                self.case.error_code = (
                    code
                    if code in known
                    else "DEADLINE_EXCEEDED"
                    if isinstance(error, TimeoutError)
                    else "UNEXPECTED"
                )
                if not isinstance(error, (DependencyError, TimeoutError)):
                    self.capture.stop("unexpected")
            raise
        self.case.elapsed_ms = max(0, (monotonic() - started) * 1000)
        self.case.outcome = "final"
        status = result.get("final", {}).get("status")
        if status in ("answered", "insufficient_evidence", "capability_unavailable"):
            self.case.returned_status = status
        if self.case.final_state == "omitted":
            # A safe rendered final must not undo omission of sensitive draft/input data.
            return result
        self.case.final = self.capture.model(Final, result["final"], self.case)
        if self.case.final is not None:
            self.case.final_state = "captured"
            self.case.usage = self.capture.model(Usage, result["usage"], self.case)
            self.case.response_evidence = [Evidence.model_validate(e) for e in result["evidence"]]
        return result
