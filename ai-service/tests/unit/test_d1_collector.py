"""Offline artifact boundaries. No Settings instance or model connection is needed."""

import asyncio
import json
import logging
import sys
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "evaluation"))

import httpx  # noqa: E402
from d1_collector_capture import Capture, RecordingGemini  # noqa: E402
from d1_collector_schema import (  # noqa: E402
    BUDGET,
    ArtifactWriter,
    Attempt,
    CaseRecord,
    CollectorStop,
    Diagnostic,
    Generation,
    Input,
    Manifest,
    Privacy,
)

from app.diagnostics import Operation, Phase, context  # noqa: E402
from app.prompts.faq import CLASSIFY  # noqa: E402
from app.providers.contracts import TurnBudget  # noqa: E402
from app.providers.http_timing import HttpTiming  # noqa: E402
from app.schemas.faq import Intent  # noqa: E402
from app.schemas.turn import Context  # noqa: E402


def case_record():
    return CaseRecord(
        run_id=str(uuid4()),
        case_id="synthetic-case",
        split="dev",
        order=1,
        expected_status="answered",
        input=Input(message="Synthetic FAQ"),
        context=Context(
            locale="vi-VN", timeZone="Asia/Ho_Chi_Minh", today="2026-11-13", currency="VND"
        ),
        initial_budget=dict(BUDGET),
    )


def diagnostic():
    return {
        "diagnostic_id": str(uuid4()),
        "operation": "turn",
        "phase": "application",
        "provider_method": None,
        "outcome": "success",
        "duration_ms": 1.0,
        "remaining_budget_ms": 19999.0,
        "http_status": None,
        "error_category": None,
    }


def manifest():
    case = case_record()
    return Manifest(
        run_id=case.run_id,
        started_at="2026-11-19T00:00:00+00:00",
        context=case.context,
        prompt_sha256={"classify": "a" * 64, "answer": "b" * 64},
        snapshot_id="a" * 64,
        dataset_sha256="b" * 64,
        source_sha256={},
        planned_cases=[case.case_id],
        full_retention_until="2026-12-03",
        summary_retention_until="2027-02-17",
    )


def test_schema_rejects_unknown_fields_categories_and_nonfinite_values():
    for patch in ({"headers": {}}, {"duration_ms": float("inf")}, {"error_category": "raw secret"}):
        with pytest.raises(ValidationError):
            Diagnostic.model_validate(diagnostic() | patch)
    value = case_record()
    assert value.retrieval.state == "not_reached" and value.retrieval.evidence is None
    value.retrieval.state, value.retrieval.evidence = "captured", []
    assert json.loads(value.model_dump_json())["retrieval"]["evidence"] == []


@pytest.mark.parametrize(
    "value",
    [
        "Bearer abcdefghijklmnop",
        "customer@example.invalid",
        "AIza" + "a" * 32,
        "+84901234567",
        "known-private-credential",
        {"thoughtSignature": "opaque"},
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzeW50aGV0aWMifQ.synthetic-signature",
        {"nested": [{"Authorization": "synthetic"}]},
    ],
)
def test_privacy_rejects_content_without_echoing_it(value):
    with pytest.raises(CollectorStop) as caught:
        Privacy(["known-private-credential"]).encode(value)
    assert str(caught.value) == "privacy_omitted"


def test_capture_bytes_are_bounded_and_unicode_is_preserved():
    privacy = Privacy()
    assert json.loads(privacy.encode({"answer": "Dữ liệu giả lập"}))["answer"] == "Dữ liệu giả lập"
    with pytest.raises(CollectorStop, match="capture_limit"):
        privacy.encode("x" * 33, limit=32)


def test_writer_is_exclusive_fixed_name_and_preserves_prior_files(tmp_path):
    privacy = Privacy()
    writer = ArtifactWriter(tmp_path, "synthetic-run", privacy)
    writer.write("manifest.json", manifest())
    with pytest.raises(CollectorStop, match="writer_failure"):
        ArtifactWriter(tmp_path, "synthetic-run", privacy)
    with pytest.raises(CollectorStop, match="writer_failure"):
        writer.write("../snapshot.json", {})
    before = (writer.path / "manifest.json").read_bytes()
    with pytest.raises(CollectorStop, match="privacy_omitted"):
        writer.write("manifest.json", {"answer": "customer@example.invalid"})
    assert (writer.path / "manifest.json").read_bytes() == before
    writer.write("cases.jsonl", [case_record()])
    with pytest.raises(CollectorStop, match="invalid_capture"):
        writer.write("cases.jsonl", [{"raw": "unknown"}])


def test_writer_limit_and_atomic_failure_leave_no_temporary_content(tmp_path, monkeypatch):
    writer = ArtifactWriter(tmp_path, "synthetic-run", Privacy())
    value = manifest()
    writer.write("manifest.json", value)
    writer.limit = sum(writer.sizes.values()) + 1
    before = (writer.path / "manifest.json").read_bytes()
    with pytest.raises(CollectorStop, match="capture_limit"):
        writer.write("cases.jsonl", [case_record()])
    writer.limit = 16 * 1024 * 1024

    def fail_replace(*args, **kwargs):
        raise OSError("private filesystem error")

    monkeypatch.setattr(Path, "replace", fail_replace)
    with pytest.raises(CollectorStop, match="writer_failure"):
        writer.write("manifest.json", value.model_copy(update={"state": "stopped"}))
    assert (writer.path / "manifest.json").read_bytes() == before
    assert not list(writer.path.glob("*.tmp"))


def registered_capture(**kwargs):
    case = case_record()
    capture = Capture(case.run_id, Privacy(), **kwargs)
    capture.add_case(case)
    with context(new=True):
        capture.bind(case)
    return capture, case


def emit(capture, data, timing=False):
    record = logging.LogRecord("synthetic", logging.INFO, "", 0, json.dumps(data), (), None)
    capture.record(record, timing)


def method_and_turn(capture, case, *, duplicate=False):
    event = diagnostic() | {
        "diagnostic_id": case.diagnostic_id,
        "operation": "classify",
        "phase": "countTokens",
        "provider_method": "countTokens",
    }
    emit(capture, event)
    if duplicate:
        emit(capture, event)
    emit(capture, diagnostic() | {"diagnostic_id": case.diagnostic_id})


def timing(case, attempt_id):
    return {
        "schema_version": 1,
        "event_type": "http_timing",
        "diagnostic_id": case.diagnostic_id,
        "http_attempt_id": attempt_id,
        "operation": "classify",
        "provider_method": "countTokens",
        "protocol": "unknown",
        "protocol_source": "unavailable",
        "outcome": "success",
        "error_category": None,
        "http_status": 200,
        "duration_ms": 1.0,
        "remaining_budget_ms": 19999.0,
        "trace_state": "unavailable",
        "pre_trace_ms": None,
        "truncated": False,
        "delivery_loss_observed": False,
        "samples": [],
    }


def add_attempt(case):
    value = Attempt(
        http_attempt_id=str(uuid4()),
        diagnostic_id=case.diagnostic_id,
        operation="classify",
        provider_method="countTokens",
        ordinal=1,
    )
    case.attempts.append(value)
    return value


def test_event_and_aggregate_bounds_fail_closed_without_dumping_input():
    capture, case = registered_capture(event_limit=1)
    emit(capture, diagnostic() | {"diagnostic_id": case.diagnostic_id})
    emit(capture, diagnostic() | {"diagnostic_id": case.diagnostic_id})
    assert len(capture.events) == 1 and capture.stop_reason == "capture_limit"
    tiny = Capture(str(uuid4()), Privacy(), byte_limit=1)
    with pytest.raises(CollectorStop, match="capture_limit"):
        tiny.add_case(case_record())
    assert tiny.cases == []
    invalid, _ = registered_capture()
    emit(invalid, diagnostic() | {"headers": {"Authorization": "private"}})
    assert invalid.stop_reason == "invalid_capture" and invalid.events == []


@pytest.mark.parametrize("problem", ["missing", "duplicate_timing", "duplicate_method", "orphan"])
def test_reconciliation_records_missing_ambiguous_and_orphan_states(problem):
    capture, case = registered_capture()
    attempt = add_attempt(case)
    method_and_turn(capture, case, duplicate=problem == "duplicate_method")
    if problem != "missing":
        emit(capture, timing(case, attempt.http_attempt_id), True)
    if problem == "duplicate_timing":
        emit(capture, timing(case, attempt.http_attempt_id), True)
    if problem == "orphan":
        emit(capture, timing(case, str(uuid4())) | {"diagnostic_id": str(uuid4())}, True)
    asyncio.run(capture.settle(case, 0))
    expected = {
        "missing": "missing_timing",
        "duplicate_timing": "ambiguous_timing",
        "duplicate_method": "ambiguous_diagnostic",
        "orphan": "orphan_event",
    }[problem]
    assert expected in case.gaps and capture.stop_reason == expected
    if problem in ("missing", "duplicate_timing"):
        assert attempt.summary_state == ("missing" if problem == "missing" else "ambiguous")


def test_late_timing_uses_parent_id_and_preserves_incomplete_trace():
    capture, first = registered_capture()
    attempt = add_attempt(first)
    method_and_turn(capture, first)
    second = case_record().model_copy(
        update={"run_id": capture.run_id, "case_id": "second", "order": 2}
    )
    capture.add_case(second)
    with context(new=True):
        capture.bind(second)
    emit(
        capture,
        timing(first, attempt.http_attempt_id) | {"trace_state": "partial", "truncated": True},
        True,
    )
    capture.reconcile(first)
    assert attempt.summary_state == "captured" and second.attempts == []
    assert {"incomplete_trace", "truncated_trace"} <= set(first.gaps)
    assert capture.stop_reason is None


def test_dispatch_guard_counts_hooks_and_prevents_retries_or_excess_attempts():
    async def run(full):
        capture, case = registered_capture()
        with context(operation=Operation.CLASSIFY, new=True):
            # Use the already registered turn ID, rather than bind a second one.
            observer = HttpTiming(
                Phase.COUNT, TurnBudget(), emitter=SimpleNamespace(offer=lambda r: None)
            )
        observer.identity = case.diagnostic_id
        request = httpx.Request(
            "POST", "https://synthetic.invalid", extensions={"trace": observer.trace}
        )
        if full:
            capture.counts["countTokens"] = 48
        else:
            await capture.request(request)
            assert case.attempts[0].http_attempt_id == observer.attempt_id
        with pytest.raises(CollectorStop, match="capture_limit" if full else "correlation_failure"):
            await capture.request(request)
        assert len(case.attempts) == (0 if full else 1)

    asyncio.run(run(False))
    asyncio.run(run(True))


@pytest.mark.parametrize(
    "problem,reason",
    [
        ("missing_turn", "missing_diagnostic"),
        ("missing_method", "missing_diagnostic"),
        ("duplicate_turn", "ambiguous_diagnostic"),
        ("wrong_operation", "orphan_event"),
        ("wrong_method", "orphan_event"),
    ],
)
def test_reconciliation_rejects_absent_turn_method_and_mismatched_attempt(problem, reason):
    capture, case = registered_capture()
    attempt = add_attempt(case)
    turn = diagnostic() | {"diagnostic_id": case.diagnostic_id}
    if problem != "missing_turn":
        emit(capture, turn)
    if problem == "duplicate_turn":
        emit(capture, turn)
    if problem != "missing_method":
        emit(
            capture,
            turn
            | {"operation": "classify", "phase": "countTokens", "provider_method": "countTokens"},
        )
    row = timing(case, attempt.http_attempt_id) | {"trace_state": "observed"}
    if problem == "wrong_operation":
        row["operation"] = "answer"
    if problem == "wrong_method":
        row["provider_method"] = "generateContent"
    emit(capture, row, True)
    capture.reconcile(case)
    assert capture.stop_reason == reason and reason in case.gaps
    assert attempt.summary_state == "captured"  # Presence alone does not establish a valid join.


def test_delayed_summary_is_awaited_and_post_cutoff_event_preserves_missing_evidence(tmp_path):
    async def run():
        capture, case = registered_capture()
        attempt = add_attempt(case)
        method_and_turn(capture, case)

        async def deliver():
            await asyncio.sleep(0)
            emit(capture, timing(case, attempt.http_attempt_id), True)

        delivery = asyncio.create_task(deliver())
        await capture.settle(case)
        await delivery
        assert attempt.summary_state == "captured" and capture.stop_reason is None
        assert case.reconciled_through_sequence == 3

        missing, failed = registered_capture()
        failed_attempt = add_attempt(failed)
        method_and_turn(missing, failed)
        await missing.settle(failed, 0)
        cutoff = failed.reconciled_through_sequence
        emit(missing, timing(failed, failed_attempt.http_attempt_id), True)
        assert failed_attempt.summary_state == "missing" and "missing_timing" in failed.gaps
        assert missing.events[-1].capture_sequence > cutoff
        writer = ArtifactWriter(tmp_path, "late-run", Privacy())
        writer.write("cases.jsonl", missing.cases)
        writer.write("http-timing.jsonl", [missing.events[-1]])
        exported = json.loads((writer.path / "cases.jsonl").read_text())
        assert exported["reconciled_through_sequence"] == cutoff
        assert exported["attempts"][0]["summary_state"] == "missing"
        assert (
            json.loads((writer.path / "http-timing.jsonl").read_text())["capture_sequence"] > cutoff
        )

    asyncio.run(run())


def test_pre_dispatch_and_delivery_loss_are_explicit_without_inventing_durations():
    capture, case = registered_capture()
    method_and_turn(capture, case)
    emit(capture, timing(case, str(uuid4())) | {"delivery_loss_observed": True}, True)
    capture.reconcile(case)
    assert {"pre_dispatch_timing", "incomplete_trace", "delivery_loss"} <= set(case.gaps)
    assert capture.stop_reason is None and case.attempts == []
    event = capture.events[-1].event
    assert event.pre_trace_ms is None and event.samples == []


def test_diagnostic_binding_rejects_identity_reuse_and_rebinding():
    capture, first = registered_capture()
    second = case_record().model_copy(update={"run_id": capture.run_id, "case_id": "second"})
    with context(new=True):
        capture.bind(second)
        with pytest.raises(CollectorStop, match="correlation_failure"):
            capture.bind(first)
    assert first.diagnostic_id != second.diagnostic_id
    with context(new=True):
        third = case_record()
        capture.bind(third)
        with pytest.raises(CollectorStop, match="correlation_failure"):
            capture.bind(case_record())


@pytest.mark.parametrize(
    "guard", ["case", "generate", "total", "trace", "identity", "operation", "stopped"]
)
def test_request_guards_abort_before_transport_dispatch(guard):
    async def run():
        capture, case = registered_capture()
        with context(operation=Operation.CLASSIFY, new=True):
            observer = HttpTiming(
                Phase.COUNT, TurnBudget(), emitter=SimpleNamespace(offer=lambda r: None)
            )
        observer.identity = case.diagnostic_id
        if guard == "case":
            case.attempts = [
                Attempt(
                    http_attempt_id=str(uuid4()),
                    diagnostic_id=case.diagnostic_id,
                    operation=operation,
                    provider_method=method,
                    ordinal=i,
                )
                for i, (operation, method) in enumerate(
                    [
                        (op, method)
                        for op in ("classify", "answer")
                        for method in ("countTokens", "generateContent")
                    ],
                    1,
                )
            ]
        elif guard == "generate":
            observer.method = Phase.GENERATE
            capture.counts["generateContent"] = 48
        elif guard == "total":
            # Defensive aggregate guard, independent of the selected method's counter.
            capture.counts.update(countTokens=47, generateContent=49)
        elif guard == "identity":
            observer.identity = str(uuid4())
        elif guard == "operation":
            observer.operation = "probe"
        elif guard == "stopped":
            capture.stop("privacy_omitted")
        dispatched = []

        async def respond(request):
            dispatched.append(request)
            return httpx.Response(200)

        before = len(case.attempts), dict(capture.counts)
        expected = (
            "capture_limit"
            if guard in ("case", "generate", "total")
            else "privacy_omitted"
            if guard == "stopped"
            else "correlation_failure"
        )
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            with capture.loggers(client):
                with pytest.raises(CollectorStop, match=expected):
                    await client.post(
                        "https://synthetic.invalid",
                        extensions={} if guard == "trace" else {"trace": observer.trace},
                    )
        assert not dispatched
        assert (len(case.attempts), dict(capture.counts)) == before

    asyncio.run(run())


def test_capture_case_event_byte_and_reservation_limits():
    from d1_collector_schema import MAX_CASE_BYTES, MAX_EVENT_BYTES

    capture, case = registered_capture()
    for i in range(2, 25):
        capture.add_case(case.model_copy(update={"case_id": f"case-{i}", "order": i}))
    with pytest.raises(CollectorStop, match="capture_limit"):
        capture.add_case(case_record())
    assert len(capture.cases) == 24
    oversized, _ = registered_capture()
    emit(oversized, diagnostic() | {"error_category": "x" * MAX_EVENT_BYTES})
    assert oversized.stop_reason == "capture_limit" and not oversized.events
    bounded, value = registered_capture()
    bounded.byte_limit = bounded.semantic_bytes
    emit(bounded, diagnostic())
    assert bounded.stop_reason == "capture_limit" and not bounded.events
    assert bounded.model(Input, {"message": "!" * MAX_CASE_BYTES}, value) is None
    assert value.final_state == "omitted" and value.retrieval.state == "omitted"
    for event_limit, byte_limit in [(0, 1), (1025, 1), (1, 0), (1, 16 * 1024 * 1024 + 1)]:
        with pytest.raises(CollectorStop, match="capture_limit"):
            Capture(str(uuid4()), Privacy(), event_limit=event_limit, byte_limit=byte_limit)


@pytest.mark.parametrize(
    "guard", ["prompt", "schema", "keys", "generation_count", "privacy", "size", "stopped"]
)
def test_generation_guards_prevent_delegate_call(guard):
    async def run():
        capture, case = registered_capture()
        calls = []

        async def generate(*args):
            calls.append(args)
            return Intent(intent="faq", query="wifi")

        delegate = SimpleNamespace(generate=generate, model_version="gemini-3.1-flash-lite")
        proxy = RecordingGemini(delegate, capture, case)
        system, schema, data = CLASSIFY, Intent, {"message": "Synthetic FAQ", "history": []}
        if guard == "prompt":
            system = "synthetic unexpected prompt"
        elif guard == "schema":
            schema = Input
        elif guard == "keys":
            data["query"] = "unexpected"
        elif guard == "generation_count":
            case.generations = [Generation(operation="classify"), Generation(operation="answer")]
        elif guard == "privacy":
            data["message"] = "customer@example.invalid"
        elif guard == "size":
            data["message"] = "!" * (256 * 1024)
        elif guard == "stopped":
            capture.stop("writer_failure")
        reason = {
            "privacy": "privacy_omitted",
            "size": "capture_limit",
            "stopped": "writer_failure",
        }.get(guard, "source_drift")
        with context(operation=Operation.CLASSIFY, new=True):
            with pytest.raises(CollectorStop, match=reason):
                await proxy.generate(system, data, schema, TurnBudget())
        assert calls == [] and capture.stop_reason == reason
        if guard in ("privacy", "size"):
            assert case.generations[-1].input_state == "omitted"
            assert case.generations[-1].input is None and case.final_state == "omitted"

    asyncio.run(run())


def test_writer_rechecks_privacy_after_capture_and_cleans_partial_write(tmp_path, monkeypatch):
    writer = ArtifactWriter(tmp_path, "synthetic-run", Privacy(["synthetic-private-credential"]))
    case = case_record()
    writer.write("cases.jsonl", [case])
    before = (writer.path / "cases.jsonl").read_bytes()
    case.input.message = "synthetic-private-credential"
    with pytest.raises(CollectorStop, match="privacy_omitted"):
        writer.write("cases.jsonl", [case])
    assert (writer.path / "cases.jsonl").read_bytes() == before

    original_open = Path.open

    @contextmanager
    def partial_open(path, *args, **kwargs):
        with original_open(path, *args, **kwargs) as stream:
            if path.suffix == ".tmp":

                def fail(data):
                    stream.write(data[:16])
                    raise OSError("synthetic-private-credential")

                yield SimpleNamespace(write=fail)
            else:
                yield stream

    monkeypatch.setattr(Path, "open", partial_open)
    with pytest.raises(CollectorStop, match="^writer_failure$"):
        writer.write("manifest.json", manifest())
    assert not list(writer.path.glob("*.tmp"))
    assert not (writer.path / "manifest.json").exists()
    assert (writer.path / "cases.jsonl").read_bytes() == before


@pytest.mark.parametrize(
    "version,reason,gap",
    [
        (None, None, "missing_model_version"),
        ("!" * 129, None, "missing_model_version"),
        ("synthetic-other-revision", "model_drift", None),
        ("customer@example.invalid", "privacy_omitted", "privacy_omitted"),
    ],
)
def test_observed_generation_revision_is_never_filled_from_requested_model(version, reason, gap):
    async def run():
        capture, case = registered_capture()
        calls = []

        async def generate(*args):
            calls.append(args)
            return Intent(intent="faq", query="wifi")

        proxy = RecordingGemini(
            SimpleNamespace(generate=generate, model_version=version), capture, case
        )
        budget = TurnBudget()
        with context(operation=Operation.CLASSIFY, new=True):
            result = await proxy.generate(
                CLASSIFY, {"message": "Synthetic", "history": []}, Intent, budget
            )
        assert result.intent == "faq" and len(calls) == 1 and calls[0][-1] is budget
        emit(capture, diagnostic() | {"diagnostic_id": case.diagnostic_id})
        capture.reconcile(case)
        assert capture.stop_reason == reason
        generation = case.generations[0]
        if reason == "model_drift":
            assert generation.model_version == version
        else:
            assert generation.model_version is None
        if gap:
            assert gap in case.gaps
        if reason == "privacy_omitted":
            assert generation.result_state == "omitted" and generation.result is None

    asyncio.run(run())


@pytest.mark.parametrize(
    "value,limit",
    [("x" * (256 * 1024), 256 * 1024), ({"message": "x" * 4096}, 128), ("あ" * 32, 64)],
    ids=["alphabetic-case-limit", "nested", "utf8-bytes"],
)
def test_oversized_encoding_is_rejected_before_privacy_scan(value, limit):
    class ScannerMustNotRun(Privacy):
        def check(self, value):
            raise AssertionError("Oversized data reached the privacy scanner")

    with pytest.raises(CollectorStop, match="^capture_limit$"):
        ScannerMustNotRun().encode(value, limit)
