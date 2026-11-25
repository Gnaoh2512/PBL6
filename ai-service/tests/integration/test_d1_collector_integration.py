"""Collector integration uses synthetic snapshots/transport only, never live Gemini."""

import asyncio
import builtins
import io
import json
import logging
import os
import shutil
import sys
from contextlib import nullcontext
from pathlib import Path

import pytest
from grounding_support import gate_for, proposal
from http_timing_support import Clock, PublicCoreTransport, ScriptedBackend, frames, synthetic_pool
from test_faq_http_deadline import GenerationBackend

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "evaluation"))

import collect_d1_live as collector  # noqa: E402
from d1_collector_capture import Capture, RecordingFaq  # noqa: E402
from d1_collector_schema import BUDGET, ArtifactWriter, CaseRecord, CollectorStop, Input, Privacy  # noqa: E402

from app.ingestion.snapshot import ROOT, build  # noqa: E402
from app.orchestration.faq import Faq  # noqa: E402
from app.providers.gemini import Gemini  # noqa: E402
from app.providers.http_timing import get_emitter  # noqa: E402


@pytest.fixture
def pinned(tmp_path, monkeypatch):
    root = tmp_path / "service"
    for name in (collector.SOURCE, collector.DATASET, *collector.CODE):
        dest = root / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, dest)
    # Fixture construction is offline; the collector itself must never build.
    snapshot = build("demo_synthetic", collector.TODAY, root)
    pinned = collector.preflight(snapshot.name, root=root)
    aliases = [
        i.query for i in [*pinned.dataset.dev, *pinned.dataset.held_out] if i.status == "answered"
    ]
    test_gate = gate_for(pinned.index, aliases=aliases)
    original = RecordingFaq.__init__

    def with_reviewed_fixture(self, provider, index, capture, case, *, verification_gate=None):
        original(
            self, provider, index, capture, case, verification_gate=verification_gate or test_gate
        )

    monkeypatch.setattr(RecordingFaq, "__init__", with_reviewed_fixture)
    pinned.test_gate = test_gate
    return pinned


def response_frames(value):
    return frames(
        json.dumps(
            {
                "modelVersion": collector.MODEL,
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
                "candidates": [
                    {"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(value)}]}}
                ],
            }
        ).encode()
    )


def provider(pinned, *, answer="Synthetic answer.", status=None, responses_filter=None):
    cid = pinned.index.search("wifi", collector.TODAY)[0].citationId
    responses = []
    for item in [*pinned.dataset.dev, *pinned.dataset.held_out]:
        query = "quasarxyz" if item.status == "insufficient_evidence" else "wifi"
        intent = "unavailable" if item.status == "capability_unavailable" else "faq"
        responses += frames(b'{"totalTokens":10}')
        responses += response_frames({"intent": intent, "query": query})
        if item.status == "answered":
            responses += frames(b'{"totalTokens":10}')
            responses += response_frames(
                (
                    proposal(cid)
                    if answer == "Synthetic answer."
                    else {
                        **proposal(cid),
                        "claims": [
                            {**proposal(cid)["claims"][0], "claimId": answer.replace(" ", "_")}
                        ],
                    }
                )
            )
    if status:
        responses = frames(b"safe synthetic failure", status)
    if responses_filter:
        responses = responses_filter(responses)
    backend = ScriptedBackend(responses)
    transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
    return Gemini("synthetic-collector-credential", collector.MODEL, transport), transport


def writer_for(pinned):
    return ArtifactWriter(
        pinned.root / "runs", pinned.manifest.run_id, Privacy(["synthetic-collector-credential"])
    )


def test_pinned_preflight_is_read_only_and_rejects_source_or_path_drift(pinned):
    before = {p: p.read_bytes() for p in pinned.files}
    again = collector.preflight(pinned.manifest.snapshot_id, root=pinned.root)
    assert again.manifest.snapshot_id == pinned.manifest.snapshot_id
    assert all(p.read_bytes() == data for p, data in before.items())
    assert not (pinned.root / "runs").exists()
    with pytest.raises(CollectorStop, match="source_drift"):
        collector.preflight("../production", root=pinned.root)
    (pinned.root / collector.DATASET).write_text("{}", encoding="utf-8")
    with pytest.raises(CollectorStop, match="source_drift"):
        pinned.verify()


def test_default_cli_only_validates_without_settings_provider_build_or_output(
    pinned, monkeypatch, capsys
):
    import app.ingestion.snapshot as ingestion

    original = collector.preflight
    monkeypatch.setattr(collector, "preflight", lambda sid: original(sid, root=pinned.root))

    def forbidden(*args, **kwargs):
        raise AssertionError("Validation must not build, load credentials, connect, or write")

    for name in ("Settings", "Gemini", "ArtifactWriter"):
        monkeypatch.setattr(collector, name, forbidden)
    monkeypatch.setattr(ingestion, "build", forbidden)
    before = {p: p.read_bytes() for p in pinned.files}
    assert collector.main(["--snapshot-id", pinned.manifest.snapshot_id]) == 0
    assert json.loads(capsys.readouterr().out)["live"] is False
    assert all(p.read_bytes() == data for p, data in before.items())
    assert not (pinned.root / ".local/assistant-evaluation").exists()


def test_preflight_rejects_corrupt_snapshot_without_repair(pinned):
    database = pinned.index.path / "index.sqlite"
    database.write_bytes(database.read_bytes() + b"corrupt")
    before = database.read_bytes()
    with pytest.raises(CollectorStop, match="source_drift"):
        collector.preflight(pinned.manifest.snapshot_id, root=pinned.root)
    assert database.read_bytes() == before


def test_successful_capture_exports_complete_semantics_and_correlated_attempts(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    active = [False]
    original_run, original_write = collector.RecordingFaq.run, writer.write

    async def timed(self, payload):
        active[0] = True
        try:
            return await original_run(self, payload)
        finally:
            active[0] = False

    def write(name, value):
        assert not active[0], "Writer called on the timed request path"
        return original_write(name, value)

    monkeypatch.setattr(collector.RecordingFaq, "run", timed)
    monkeypatch.setattr(writer, "write", write)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.state == "completed" and summary.attempted == summary.final_cases == 24
    assert summary.status_matches == 24 and summary.provider_closed and summary.baseline_unchanged
    assert summary.http_attempts == {"countTokens": 32, "generateContent": 32}
    assert summary.grounding == "not_measured" and summary.acceptance == "not_assessed"
    assert transport.closed == 1
    assert logging.getLogger("ai_service.http_timing").isEnabledFor(logging.INFO)
    rows = [
        json.loads(line)
        for line in (writer.path / "cases.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    timings = [
        json.loads(line)["event"]
        for line in (writer.path / "http-timing.jsonl").read_text().splitlines()
    ]
    assert len({row["diagnostic_id"] for row in rows}) == 24
    assert len({t["http_attempt_id"] for t in timings}) == 64
    for row in rows:
        assert all(a["summary_state"] == "captured" for a in row["attempts"])
        for attempt in row["attempts"]:
            match = [t for t in timings if t["http_attempt_id"] == attempt["http_attempt_id"]]
            assert len(match) == 1 and match[0]["diagnostic_id"] == row["diagnostic_id"]
        if row["final"]["status"] == "answered":
            assert row["retrieval"]["query"] == "wifi"
            assert (
                row["generations"][1]["input"]["evidence"]
                == row["retrieval"]["evidence"]
                == row["response_evidence"]
            )
            assert (
                row["final"]["citations"][0]["citationId"]
                == row["retrieval"]["evidence"][0]["citationId"]
            )
            assert row["generations"][1]["model_version"] == collector.MODEL
        elif row["final"]["status"] == "insufficient_evidence":
            assert row["retrieval"]["state"] == "captured" and row["retrieval"]["evidence"] == []
        else:
            assert (
                row["retrieval"]["state"] == "not_reached" and row["retrieval"]["evidence"] is None
            )
    runtime_logs = (writer.path / "diagnostics.jsonl").read_text() + (
        writer.path / "http-timing.jsonl"
    ).read_text()
    assert (
        "Synthetic answer" not in runtime_logs
        and "synthetic-collector-credential" not in runtime_logs
    )
    corpus = json.loads((writer.path / "corpus.json").read_text(encoding="utf-8"))
    assert corpus["dataset"]["corpusMode"] == "demo_synthetic"
    pinned.verify()


def test_sensitive_output_is_omitted_and_stops_without_persistence(pinned):
    client, transport = provider(
        pinned, answer="Private customer@example.invalid synthetic-collector-credential"
    )
    writer = writer_for(pinned)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "privacy_omitted" and summary.attempted == 1
    assert summary.final_cases == 1 and summary.captured_final_cases == 0
    assert len(transport.extensions) == 4 and transport.closed == 1
    exported = b"".join(p.read_bytes() for p in writer.path.iterdir())
    assert (
        b"customer@example.invalid" not in exported
        and b"synthetic-collector-credential" not in exported
    )
    row = json.loads((writer.path / "cases.jsonl").read_text())
    assert row["final_state"] in {"omitted", "unavailable"} and row["final"] is None


@pytest.mark.parametrize("status", [401, 403, 429])
def test_http_stop_status_has_no_retry_and_records_not_run_cases(pinned, status):
    client, transport = provider(pinned, status=status)
    writer = writer_for(pinned)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "http_status_stop" and summary.attempted == 1
    assert len(summary.not_run) == 23 and len(transport.extensions) == 1 and transport.closed == 1
    row = json.loads((writer.path / "cases.jsonl").read_text())
    assert row["outcome"] == "error" and row["retrieval"]["state"] == "not_reached"
    assert row["generations"][0]["result_state"] == "unavailable"
    assert row["generations"][0]["model_version"] is None


def test_failed_answer_does_not_inherit_classify_model_version(pinned):
    def fail_answer(responses):
        return responses[:6] + frames(b"safe synthetic failure", 503, combined=True) + responses[8:]

    client, transport = provider(pinned, responses_filter=fail_answer)
    writer = writer_for(pinned)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.state == "completed" and summary.final_cases == 23
    assert summary.errors == {"DEPENDENCY_UNAVAILABLE": 1} and transport.closed == 1
    row = json.loads((writer.path / "cases.jsonl").read_text(encoding="utf-8").splitlines()[0])
    assert row["generations"][0]["model_version"] == collector.MODEL
    assert row["generations"][1]["model_version"] is None
    assert row["generations"][1]["result_state"] == "unavailable"


def test_writer_failure_closes_provider_stops_dispatch_and_leaves_running_marker(
    pinned, monkeypatch
):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    original = writer.write

    def fail(name, value):
        if name == "cases.jsonl" and value:
            raise CollectorStop("writer_failure")
        return original(name, value)

    monkeypatch.setattr(writer, "write", fail)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "writer_failure" and summary.provider_closed
    assert len(transport.extensions) == 4 and transport.closed == 1
    assert not (writer.path / "summary.json").exists()
    assert (
        json.loads((writer.path / "manifest.json").read_text())["active_case_id"]
        == pinned.dataset.dev[0].id
    )


@pytest.mark.parametrize("where", ["classify", "answer"])
def test_collector_keeps_application_deadline_and_failed_generation_provenance(
    pinned, monkeypatch, where
):
    item = pinned.dataset.dev[0]
    cid = pinned.index.search("wifi", collector.TODAY)[0].citationId
    responses = frames(b'{"totalTokens":10}') + response_frames({"intent": "faq", "query": "wifi"})
    responses += frames(b'{"totalTokens":10}') + response_frames(proposal(cid))
    backend = GenerationBackend(
        responses,
        clock=Clock(),
        attempt=2 if where == "classify" else 4,
        phase="headers",
        slow_classify=False,
    )
    transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
    client = Gemini("synthetic-collector-credential", collector.MODEL, transport)
    capture = Capture(pinned.manifest.run_id, Privacy())
    case = CaseRecord(
        run_id=capture.run_id,
        case_id=item.id,
        split="dev",
        order=1,
        expected_status=item.status,
        input=Input(message=item.query),
        context=pinned.manifest.context,
        initial_budget=dict(BUDGET),
    )
    capture.add_case(case)
    original_timeout, timers = asyncio.timeout, []

    def timeout(seconds):
        timer = original_timeout(seconds)
        timers.append(timer)
        return timer

    monkeypatch.setattr(asyncio, "timeout", timeout)

    async def run():
        task = None
        with capture.loggers(client.client):
            try:
                task = asyncio.create_task(
                    RecordingFaq(client, pinned.index, capture, case).run(
                        collector.payload_for(item, pinned.manifest.context)
                    )
                )
                await asyncio.wait_for(backend.entered.wait(), 1)
                timers[0].reschedule(asyncio.get_running_loop().time())
                with pytest.raises(TimeoutError):
                    await task
                await capture.settle(case)
                assert all(s.closed == 1 for s in backend.streams)
            finally:
                if task is not None and not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                await client.close()

    asyncio.run(run())
    assert case.outcome == "error" and case.error_category == "application_deadline"
    assert case.final_state == "unavailable" and case.final is None
    assert case.generations[-1].result_state == "unavailable"
    assert case.generations[-1].model_version is None
    assert capture.stop_reason is None
    assert len(case.attempts) == (2 if where == "classify" else 4)
    assert all(a.summary_state == "captured" for a in case.attempts)
    assert "missing_timing" not in case.gaps and "missing_diagnostic" not in case.gaps
    assert transport.closed == 1


def test_user_cancellation_exports_failure_and_reraises_after_cleanup(pinned):
    backend = GenerationBackend(
        frames(b'{"totalTokens":10}') + response_frames({"intent": "faq", "query": "wifi"}),
        clock=Clock(),
        attempt=2,
        phase="headers",
        slow_classify=False,
    )
    transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
    client = Gemini("synthetic-collector-credential", collector.MODEL, transport)
    writer = writer_for(pinned)
    get_emitter()
    hooks = {name: values[:] for name, values in client.client.event_hooks.items()}
    loggers = [
        logging.getLogger(name) for name in ("ai_service.diagnostics", "ai_service.http_timing")
    ]
    states = [(logger.handlers[:], logger.level, logger.propagate) for logger in loggers]

    async def run():
        task = asyncio.create_task(collector.investigate(pinned, client, writer))
        await asyncio.wait_for(backend.entered.wait(), 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    summary = json.loads((writer.path / "summary.json").read_text())
    assert summary["stop_reason"] == "user_cancelled" and summary["provider_closed"]
    assert summary["attempted"] == 1 and len(summary["not_run"]) == 23
    row = json.loads((writer.path / "cases.jsonl").read_text(encoding="utf-8"))
    assert row["outcome"] == "cancelled" and row["error_category"] == "cancelled"
    assert all(stream.closed == 1 for stream in backend.streams) and transport.closed == 1
    assert client.client.event_hooks == hooks
    assert [(logger.handlers, logger.level, logger.propagate) for logger in loggers] == states


def test_unexpected_provider_error_is_safe_and_stops_before_more_calls(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)

    async def fail(*args, **kwargs):
        raise RuntimeError("private-error-key customer@example.invalid")

    monkeypatch.setattr(client, "generate", fail)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "unexpected" and summary.attempted == 1
    assert summary.errors == {"UNEXPECTED": 1} and not transport.extensions
    assert summary.provider_closed and transport.closed == 1
    data = b"".join(p.read_bytes() for p in writer.path.iterdir())
    assert b"private-error-key" not in data and b"customer@example.invalid" not in data


def test_source_drift_during_case_stops_with_baseline_marked_changed(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    original = client.generate

    async def change_source(system, data, schema, budget):
        result = await original(system, data, schema, budget)
        if schema.__name__ == "CandidateDraft":
            source = pinned.root / collector.SOURCE
            source.write_bytes(source.read_bytes() + b"\nchanged")
        return result

    monkeypatch.setattr(client, "generate", change_source)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "source_drift" and not summary.baseline_unchanged
    assert summary.attempted == 1 and len(transport.extensions) == 4
    assert summary.provider_closed and transport.closed == 1


def test_failed_classify_does_not_inherit_previous_case_model_version(pinned):
    def fail_second_classify(responses):
        # First case succeeds; second classify generates a 503 after counting tokens.
        # Drop that case's unused answer frames so the following case remains aligned.
        return (
            responses[:10] + frames(b"safe synthetic failure", 503, combined=True) + responses[16:]
        )

    client, transport = provider(pinned, responses_filter=fail_second_classify)
    writer = writer_for(pinned)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    rows = [
        json.loads(line)
        for line in (writer.path / "cases.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert summary.state == "completed" and summary.final_cases == 23
    assert summary.errors == {"DEPENDENCY_UNAVAILABLE": 1} and transport.closed == 1
    assert rows[0]["generations"][-1]["model_version"] == collector.MODEL
    failed = rows[1]
    assert failed["diagnostic_id"] != rows[0]["diagnostic_id"]
    assert len(failed["generations"]) == 1 and len(failed["attempts"]) == 2
    assert failed["generations"][0]["model_version"] is None
    assert failed["generations"][0]["result_state"] == "unavailable"
    assert failed["retrieval"]["state"] == "not_reached"
    assert rows[2]["outcome"] == "final" and summary.http_attempts == {
        "countTokens": 31,
        "generateContent": 31,
    }


@pytest.mark.parametrize("target", ["corpus.json", "summary.json"])
def test_initial_and_final_export_failure_closes_provider_without_retry(
    pinned, monkeypatch, target
):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    original = writer.write
    failures = []

    def fail(name, value):
        if name == target:
            failures.append(name)
            raise CollectorStop("writer_failure")
        return original(name, value)

    monkeypatch.setattr(writer, "write", fail)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.state == "stopped" and summary.stop_reason == "writer_failure"
    assert summary.provider_closed and transport.closed == 1
    assert summary.attempted == (0 if target == "corpus.json" else 24)
    assert len(transport.extensions) == (0 if target == "corpus.json" else 64)
    assert not (writer.path / "summary.json").exists()
    assert failures == [target] * (2 if target == "corpus.json" else 1)
    if target == "summary.json":
        persisted = json.loads((writer.path / "manifest.json").read_text())
        assert persisted["state"] == summary.state, (
            "Final export failure must not leave a completed run marker"
        )


@pytest.mark.parametrize("changed", ["app/prompts/faq.py", "index.sqlite", "manifest.json"])
def test_pinned_drift_before_dispatch_never_rebuilds_or_repairs(pinned, monkeypatch, changed):
    import app.ingestion.snapshot as ingestion

    client, transport = provider(pinned)
    writer = writer_for(pinned)
    path = pinned.root / changed if changed.startswith("app/") else pinned.index.path / changed
    path.write_bytes(path.read_bytes() + b"\nsynthetic drift")
    before = path.read_bytes()

    def forbidden(*args, **kwargs):
        raise AssertionError("Collector must not rebuild a pinned snapshot")

    monkeypatch.setattr(ingestion, "build", forbidden)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.stop_reason == "source_drift" and not summary.baseline_unchanged
    assert summary.attempted == 0 and len(summary.not_run) == 24
    assert transport.closed == 1 and not transport.extensions
    assert path.read_bytes() == before


def test_timed_recording_callbacks_do_not_open_or_mutate_files(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    # Keep the existing index I/O out of this collector-only assertion. All delegate
    # evidence is prepared before timing; the real Gemini/HTTPX/core path stays in use.
    evidence = pinned.index.search("wifi", collector.TODAY)
    monkeypatch.setattr(pinned.index, "validate", lambda today: None)
    monkeypatch.setattr(
        pinned.index, "search", lambda query, *args: [] if query == "quasarxyz" else evidence
    )
    active, calls = [False], []
    original_run = collector.RecordingFaq.run

    async def timed(self, payload):
        active[0] = True
        try:
            return await original_run(self, payload)
        finally:
            active[0] = False

    def guard(original):
        def checked(*args, **kwargs):
            if active[0]:
                calls.append(original.__name__)
                raise AssertionError("Disk I/O inside timed recording path")
            return original(*args, **kwargs)

        return checked

    monkeypatch.setattr(collector.RecordingFaq, "run", timed)
    for owner, names in [
        (builtins, ("open",)),
        (io, ("open",)),
        (os, ("open", "stat", "lstat", "scandir", "mkdir", "unlink", "rename", "replace")),
    ]:
        for name in names:
            monkeypatch.setattr(owner, name, guard(getattr(owner, name)))
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert calls == [] and summary.state == "completed" and summary.attempted == 24
    assert transport.closed == 1


@pytest.mark.parametrize("exit_kind", ["success", "error", "cancelled"])
def test_logger_and_existing_hooks_restore_and_same_client_succeeds(pinned, exit_kind):
    client, transport = provider(pinned)
    capture = Capture(pinned.manifest.run_id, Privacy())
    item = pinned.dataset.dev[0]
    case = CaseRecord(
        run_id=capture.run_id,
        case_id=item.id,
        split="dev",
        order=1,
        expected_status=item.status,
        input=Input(message=item.query),
        context=pinned.manifest.context,
        initial_budget=dict(BUDGET),
    )
    capture.add_case(case)
    emitter = get_emitter()
    assert emitter.drain()
    loggers = [
        logging.getLogger(name) for name in ("ai_service.diagnostics", "ai_service.http_timing")
    ]
    saved = [(logger.handlers[:], logger.level, logger.propagate) for logger in loggers]
    restored_records, hooks_seen = [], []

    class Handler(logging.Handler):
        def emit(self, record):
            restored_records.append((record.name, json.loads(record.getMessage())))

    handler = Handler()
    for logger in loggers:
        logger.handlers = [handler]
        logger.setLevel(logging.DEBUG)
        logger.propagate = True

    async def request_hook(request):
        hooks_seen.append("request")

    async def response_hook(response):
        hooks_seen.append("response")

    client.client.event_hooks["request"].append(request_hook)
    client.client.event_hooks["response"].append(response_hook)
    hooks = {name: values[:] for name, values in client.client.event_hooks.items()}

    async def run():
        try:
            error = {"success": None, "error": RuntimeError, "cancelled": asyncio.CancelledError}[
                exit_kind
            ]
            with pytest.raises(error) if error else nullcontext():
                with capture.loggers(client.client):
                    result = await RecordingFaq(client, pinned.index, capture, case).run(
                        collector.payload_for(item, pinned.manifest.context)
                    )
                    assert result["final"]["status"] == "answered"
                    await capture.settle(case)
                    assert await asyncio.to_thread(emitter.drain)
                    if error:
                        raise error()
            assert client.client.event_hooks == hooks
            for logger in loggers:
                assert (
                    logger.handlers == [handler]
                    and logger.level == logging.DEBUG
                    and logger.propagate
                )
            count = len(capture.events)
            result = await Faq(
                client, pinned.index, "demo_synthetic", verification_gate=pinned.test_gate
            ).run(collector.payload_for(pinned.dataset.dev[1], pinned.manifest.context))
            assert result["final"]["status"] == "answered"
            assert await asyncio.to_thread(emitter.drain)
            assert len(capture.events) == count
            assert {name for name, _ in restored_records} == {logger.name for logger in loggers}
            assert hooks_seen == ["request", "response"] * 8
            assert len(transport.extensions) == 8 and client.client.event_hooks == hooks
        finally:
            await client.close()
            assert await asyncio.to_thread(emitter.drain)

    try:
        asyncio.run(run())
    finally:
        for logger, (handlers, level, propagate) in zip(loggers, saved):
            logger.handlers = handlers
            logger.setLevel(level)
            logger.propagate = propagate
    assert transport.closed == 1 and capture.stop_reason is None


def test_interruption_during_between_case_settle_exports_user_cancelled(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    entered = asyncio.Event()

    async def settle(self, case, seconds):
        entered.set()
        await asyncio.Event().wait()

    monkeypatch.setattr(Capture, "settle", settle)

    async def run():
        task = asyncio.create_task(collector.investigate(pinned, client, writer))
        await asyncio.wait_for(entered.wait(), 1)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

    asyncio.run(run())
    summary = json.loads((writer.path / "summary.json").read_text())
    assert summary["provider_closed"] and transport.closed == 1
    assert len(transport.extensions) == 4 and summary["attempted"] == 1
    assert summary["state"] == "stopped" and summary["stop_reason"] == "user_cancelled"
    assert {row["reason"] for row in summary["not_run"]} == {"user_cancelled"}
    manifest = json.loads((writer.path / "manifest.json").read_text())
    assert manifest["state"] == "stopped" and manifest["active_case_id"] is None
    assert manifest["completed_cases"] == 1


@pytest.mark.parametrize(
    "failure", ["summary_and_storage", "completion_marker", "marker_and_storage"]
)
def test_finalization_keeps_noncompleted_manifest_even_when_recovery_cannot_write(
    pinned, monkeypatch, failure
):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    original = writer.write
    writes, blocked = [], [False]

    def write(name, value):
        state = value.state if hasattr(value, "state") else None
        writes.append((name, state))
        if blocked[0]:
            raise CollectorStop("writer_failure")
        if name == "summary.json" and failure == "summary_and_storage":
            blocked[0] = True
            raise CollectorStop("writer_failure")
        if name == "manifest.json" and state == "completed":
            if failure == "marker_and_storage":
                blocked[0] = True
            raise CollectorStop("writer_failure")
        return original(name, value)

    monkeypatch.setattr(writer, "write", write)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.state == "stopped" and summary.stop_reason == "writer_failure"
    assert summary.attempted == 24 and summary.provider_closed and transport.closed == 1
    assert len(transport.extensions) == 64
    manifest = json.loads((writer.path / "manifest.json").read_text())
    assert manifest["state"] == "stopped" and manifest["completed_cases"] == 24
    if failure == "summary_and_storage":
        assert not (writer.path / "summary.json").exists()
        assert ("manifest.json", "completed") not in writes
    else:
        exported = json.loads((writer.path / "summary.json").read_text())
        expected = "completed" if failure == "marker_and_storage" else "stopped"
        assert exported["state"] == expected
        # A provisional completed summary is not a committed run without its manifest.
        if expected == "completed":
            assert exported["artifact_sha256"]["manifest.json"] != collector.sha(
                (writer.path / "manifest.json").read_bytes()
            )


def test_completed_manifest_is_last_export_and_all_summary_hashes_match(pinned, monkeypatch):
    client, transport = provider(pinned)
    writer = writer_for(pinned)
    original = writer.write
    writes = []

    def write(name, value):
        writes.append((name, getattr(value, "state", None)))
        if name == "summary.json":
            assert json.loads((writer.path / "manifest.json").read_text())["state"] != "completed"
        return original(name, value)

    monkeypatch.setattr(writer, "write", write)
    summary = asyncio.run(collector.investigate(pinned, client, writer))
    assert summary.state == "completed" and transport.closed == 1
    assert writes[-2:] == [("summary.json", "completed"), ("manifest.json", "completed")]
    exported = json.loads((writer.path / "summary.json").read_text())
    assert exported == summary.model_dump(mode="json")
    for name, digest in exported["artifact_sha256"].items():
        assert collector.sha((writer.path / name).read_bytes()) == digest
