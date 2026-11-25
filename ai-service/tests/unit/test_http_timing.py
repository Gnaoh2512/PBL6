import asyncio
import json
import logging
from contextlib import redirect_stderr
from io import StringIO
from threading import Event
from types import SimpleNamespace
from uuid import UUID

import pytest

from app.diagnostics import Operation, Phase, context
from app.providers.http_timing import (
    EVENTS,
    LOGGER,
    BoundedEmitter,
    HttpTiming,
    SafeStreamHandler,
    _log,
    get_emitter,
)


class Clock:
    value = 0.0

    def __call__(self):
        return self.value


class Sink:
    def __init__(self):
        self.records = []

    def offer(self, record):
        self.records.append(record)


class HostileInfo:
    def __getattribute__(self, name):
        raise AssertionError("Trace info must never be read")

    def __repr__(self):
        raise AssertionError("Trace info must never be formatted")


def observer(clock=None, sink=None, method=Phase.COUNT):
    clock, sink = clock or Clock(), sink or Sink()
    timing = HttpTiming(
        method, SimpleNamespace(started=0, remaining_ms=20000), clock=clock, emitter=sink
    )
    return timing, clock, sink


@pytest.mark.parametrize("name,expected", EVENTS.items())
@pytest.mark.parametrize("ending", ["complete", "failed"])
def test_exact_event_names_and_intervals_without_reading_info(name, expected, ending):
    timing, clock, sink = observer()

    async def run():
        clock.value = 0.010
        await timing.trace(name + ".started", HostileInfo())
        clock.value = 0.035
        await timing.trace(name + "." + ending, HostileInfo())

    asyncio.run(run())
    timing.finish()
    row = sink.records[0]
    sample = row["samples"][0]
    assert (sample["phase"], sample["trace_family"]) == expected
    assert sample["duration_ms"] == 25
    assert sample["outcome"] == ending
    assert row["pre_trace_ms"] == 10 and row["duration_ms"] == 35
    assert row["trace_state"] == "observed"
    assert row["protocol"] == "unknown" and row["protocol_source"] == "unavailable"


@pytest.mark.parametrize(
    "version,protocol",
    [
        (None, "unknown"),
        (b"HTTP/1.1", "http1"),
        (b"HTTP/1.0", "http1"),
        (b"HTTP/2", "http2"),
        (b"HTTP/9", "unknown"),
        ("HTTP/1.1", "unknown"),
        (b"private-key customer@example.invalid", "unknown"),
    ],
)
def test_protocol_requires_explicit_allowlisted_response_extension(version, protocol):
    timing, clock, sink = observer()
    timing.observe_response(200, version)
    timing.finish()
    assert sink.records[0]["protocol"] == protocol
    assert sink.records[0]["protocol_source"] == (
        "unavailable" if protocol == "unknown" else "response_extension"
    )
    assert "private-key" not in json.dumps(sink.records)


def test_missing_unmatched_unknown_and_overflow_are_not_zero_latency_or_reuse():
    timing, clock, sink = observer()
    timing.finish()
    assert sink.records[0]["trace_state"] == "unavailable"
    assert sink.records[0]["samples"] == [] and sink.records[0]["pre_trace_ms"] is None

    timing, clock, sink = observer()

    async def run():
        await timing.trace("private-key\nforged.started", HostileInfo())
        await timing.trace("http11.receive_response_headers.complete", HostileInfo())
        for _ in range(33):
            await timing.trace("http11.send_request_body.started", HostileInfo())
        # Overflow must not match this terminal event to the wrong older start.
        await timing.trace("http11.send_request_body.complete", HostileInfo())

    asyncio.run(run())
    clock.value = 1
    timing.finish(asyncio.CancelledError())
    row = sink.records[0]
    assert row["trace_state"] == "partial" and row["truncated"] is True
    assert len(row["samples"]) == 32
    assert all(
        s["outcome"] == "incomplete"
        and s["duration_ms"] is None
        and s["duration_kind"] == "unavailable"
        for s in row["samples"]
    )
    assert "private-key" not in json.dumps(row)
    timing.finish()
    assert len(sink.records) == 1


def test_missing_terminal_on_success_is_unavailable_not_the_remaining_request_duration():
    timing, clock, sink = observer()
    asyncio.run(timing.trace("connection.start_tls.started", HostileInfo()))
    clock.value = 5
    timing.finish()
    sample = sink.records[0]["samples"][0]
    assert sample["outcome"] == "incomplete" and sample["duration_ms"] is None
    assert sample["duration_kind"] == "unavailable"
    assert sink.records[0]["trace_state"] == "partial"


def test_failed_write_is_not_relabelled_when_later_headers_are_cancelled():
    timing, clock, sink = observer()

    async def run():
        await timing.trace("http11.send_request_headers.started", None)
        await timing.trace("http11.send_request_headers.failed", None)
        await timing.trace("http11.receive_response_headers.started", None)

    asyncio.run(run())
    timing.finish(asyncio.CancelledError())
    assert [s["outcome"] for s in sink.records[0]["samples"]] == ["failed", "incomplete"]
    assert sink.records[0]["error_category"] == "cancelled"


def test_repeated_phases_and_context_ids_are_request_scoped():
    with context(operation=Operation.ANSWER, new=True):
        first, clock, sink = observer()
        second, _, _ = observer(clock, sink)

        async def run():
            await asyncio.gather(
                first.trace("http11.send_request_body.started", None),
                second.trace("http2.send_request_body.started", None),
            )
            await first.trace("http11.send_request_body.complete", None)
            await first.trace("http11.send_request_body.started", None)
            await first.trace("http11.send_request_body.complete", None)
            await second.trace("http2.send_request_body.complete", None)

        asyncio.run(run())
        first.finish()
        second.finish()
    a, b = sink.records
    assert a["protocol"] == b["protocol"] == "unknown"  # Trace family is not wire protocol.
    assert a["diagnostic_id"] == b["diagnostic_id"]
    assert a["http_attempt_id"] != b["http_attempt_id"]
    assert a["operation"] == b["operation"] == "answer"
    assert [s["sequence"] for s in a["samples"]] == [1, 2]
    assert all(
        UUID(r["diagnostic_id"]).version == UUID(r["http_attempt_id"]).version == 4
        for r in sink.records
    )


@pytest.mark.parametrize("failure", ["clock", "emitter"])
@pytest.mark.parametrize("kind", [RuntimeError, asyncio.CancelledError])
def test_observer_fault_cannot_replace_original_exception(failure, kind):
    timing, clock, sink = observer()
    original = kind("private-key Bearer jwt customer@example.invalid")

    def broken(*args):
        raise ValueError("sensitive observer failure")

    if failure == "clock":
        timing.clock = broken
    else:
        sink.offer = broken
    with pytest.raises(kind) as caught, timing:
        raise original
    assert caught.value is original


def test_callback_failure_during_exception_unwind_does_not_replace_original():
    timing, clock, sink = observer()
    original = RuntimeError("synthetic transport error")

    def broken():
        raise ValueError("private-key callback failure")

    async def run():
        await timing.trace("http11.receive_response_headers.started", HostileInfo())
        timing.clock = broken
        await timing.trace("http11.receive_response_headers.failed", HostileInfo())
        timing.clock = clock
        raise original

    with pytest.raises(RuntimeError) as caught, timing:
        asyncio.run(run())
    assert caught.value is original
    assert sink.records[0]["trace_state"] == "partial"
    assert sink.records[0]["samples"][0]["duration_ms"] is None
    assert "private-key" not in json.dumps(sink.records)


def test_emitter_is_bounded_nonblocking_and_does_not_delay_cancellation():
    entered, release, returned, records = Event(), Event(), Event(), []

    def blocked(record):
        entered.set()
        release.wait(2)
        returned.set()
        records.append(record)

    emitter = BoundedEmitter(blocked, capacity=1)
    emitter.offer({"marker": "safe"})
    assert entered.wait(1)
    timing, clock, _ = observer(sink=emitter)

    async def run():
        ready = asyncio.Event()
        original = asyncio.CancelledError("synthetic cancellation")

        async def work():
            with timing:
                ready.set()
                try:
                    await asyncio.Event().wait()
                except asyncio.CancelledError as error:
                    assert error.args == original.args
                    raise

        task = asyncio.create_task(work())
        await ready.wait()
        task.cancel(*original.args)
        with pytest.raises(asyncio.CancelledError):
            await asyncio.wait_for(task, 1)
        assert not release.is_set() and not returned.is_set() and task.cancelling() == 1
        # The queued timing record fills the queue; the next one must drop, never wait.
        emitter.offer({"marker": "safe"})
        assert emitter.loss.is_set()

    try:
        asyncio.run(run())
    finally:
        release.set()
        assert emitter.drain()
        assert emitter.close()
    assert any(r.get("outcome") == "cancelled" for r in records)


@pytest.mark.parametrize(
    "exception", [RuntimeError, SystemExit, KeyboardInterrupt, asyncio.CancelledError]
)
def test_worker_sink_failure_is_isolated_and_loss_is_reported_later(exception):
    records = []

    def sink(record):
        if not records:
            records.append(record)
            raise exception("private-key sink failure")
        records.append(record)

    emitter = BoundedEmitter(sink)
    try:
        emitter.offer({"marker": "safe"})
        assert emitter.drain()
        assert emitter.loss.is_set()
        emitter.offer({"marker": "safe"})
        assert emitter.drain()
        assert records[-1]["delivery_loss_observed"] is True
    finally:
        assert emitter.close()


def test_no_timing_sink_is_required_for_success():
    timing, clock, sink = observer()
    sink.offer = lambda record: (_ for _ in ()).throw(RuntimeError("sink failure"))
    with timing:
        pass


def test_broken_response_metadata_is_optional_and_not_retained():
    class Broken:
        def get(self, name):
            raise RuntimeError("private-key metadata failure")

    timing, clock, sink = observer()
    response = SimpleNamespace(status_code=200, extensions=Broken())
    timing.observe_httpx_response(response)
    timing.finish()
    row = sink.records[0]
    assert row["protocol"] == "unknown" and row["http_status"] == 200
    assert "private-key" not in json.dumps(row)
    assert all(value is not response for value in vars(timing).values())


def test_logrecord_schema_and_sink_io_failure_do_not_expose_secrets(capsys):
    assert get_emitter().drain()
    records = []

    class Collector(logging.Handler):
        def emit(self, record):
            records.append(record)

    class BrokenStream:
        def write(self, text):
            raise ValueError("private-key Bearer jwt customer@example.invalid")

        def flush(self):
            pass

    old = list(LOGGER.handlers), LOGGER.level, LOGGER.propagate
    LOGGER.handlers, LOGGER.propagate = [Collector(), SafeStreamHandler(BrokenStream())], False
    LOGGER.setLevel(logging.INFO)
    emitter = BoundedEmitter(_log)
    try:
        timing, clock, _ = observer(sink=emitter)
        timing.observe_response(200, b"HTTP/1.1")
        timing.finish(RuntimeError("private-key Bearer jwt customer@example.invalid +84901234567"))
        assert emitter.drain() and emitter.loss.is_set()
        assert len(records) == 1
        record = records[0]
        data = json.loads(record.getMessage())
        assert set(data) == {
            "schema_version",
            "event_type",
            "diagnostic_id",
            "http_attempt_id",
            "operation",
            "provider_method",
            "protocol",
            "protocol_source",
            "outcome",
            "error_category",
            "http_status",
            "duration_ms",
            "remaining_budget_ms",
            "trace_state",
            "pre_trace_ms",
            "truncated",
            "delivery_loss_observed",
            "samples",
        }
        assert record.args == () and record.exc_info is None and record.stack_info is None
        text = repr(record.__dict__) + capsys.readouterr().err
        for secret in ("private-key", "Bearer jwt", "example.invalid", "84901234567"):
            assert secret not in text
    finally:
        assert emitter.close()
        LOGGER.handlers, LOGGER.level, LOGGER.propagate = old


def test_default_sink_resolves_current_stderr_without_retaining_closed_capture_stream():
    first, second = StringIO(), StringIO()
    with redirect_stderr(first):
        handler = SafeStreamHandler()
    first.close()
    with redirect_stderr(second):
        handler.emit(logging.makeLogRecord({"msg": "safe", "args": ()}))
    assert second.getvalue() == "safe\n"
