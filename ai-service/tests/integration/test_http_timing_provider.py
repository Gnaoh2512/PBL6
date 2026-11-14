import asyncio
import json
import logging
from collections import deque
from threading import Event

import httpx
import pytest
from http_timing_support import PublicCoreTransport, ScriptedBackend, frames, synthetic_pool
from pydantic import BaseModel

from app.diagnostics import Phase
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.providers.http_timing import LOGGER, HttpTiming, get_emitter


class Output(BaseModel):
    ok: bool


def generation_frames():
    count = frames(b'{"totalTokens":10}')
    answer = {
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
        "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": '{"ok":true}'}]}}],
    }
    return count + frames(json.dumps(answer).encode())


@pytest.fixture
def timing_records():
    emitter = get_emitter()
    assert emitter.drain()
    records = []

    class Collector(logging.Handler):
        def emit(self, record):
            records.append(json.loads(record.getMessage()))

    handler = Collector()
    LOGGER.addHandler(handler)
    try:
        yield records
    finally:
        assert emitter.drain()
        LOGGER.removeHandler(handler)


def test_provider_wires_trace_per_attempt_without_changing_budgets_or_client(timing_records):
    async def run():
        backend = ScriptedBackend(generation_frames() + generation_frames())
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", transport)
        budget = TurnBudget()
        hooks = {k: list(v) for k, v in client.client.event_hooks.items()}
        try:
            assert (await client.generate("synthetic", {}, Output, budget)).ok
            assert (await client.generate("synthetic", {}, Output, budget)).ok
            with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
                await client.generate("synthetic", {}, Output, budget)
            assert budget.calls == 2 and budget.input_used == 20 and budget.output_used == 10
            assert client.client.event_hooks == hooks
            assert len(transport.extensions) == 4
            assert len({e["trace"].__self__.attempt_id for e in transport.extensions}) == 4
            assert all(
                e["timeout"] == {"connect": 20, "read": 20, "write": 20, "pool": 20}
                for e in transport.extensions
            )
        finally:
            await client.close()
        assert transport.closed == 1 and all(s.closed == 1 for s in backend.streams)

    asyncio.run(run())
    assert get_emitter().drain()
    assert len(timing_records) == 4
    assert [r["provider_method"] for r in timing_records] == ["countTokens", "generateContent"] * 2
    assert timing_records[0]["diagnostic_id"] == timing_records[1]["diagnostic_id"]
    assert all(r["trace_state"] == "observed" and r["protocol"] == "http1" for r in timing_records)


@pytest.mark.parametrize(
    "stage,category",
    [
        ("connect", "connect_timeout"),
        ("tls", "connect_timeout"),
        ("write_headers", "write_timeout"),
        ("write_body", "write_timeout"),
        ("headers", "read_timeout"),
        ("body", "read_timeout"),
    ],
)
def test_provider_mapping_with_real_core_failures_and_successor_request(
    timing_records, stage, category
):
    async def run():
        backend = ScriptedBackend(generation_frames(), fail=stage)
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", transport)
        try:
            with pytest.raises(DependencyError) as caught:
                await client.generate("synthetic", {}, Output, TurnBudget())
            assert caught.value.code == "DEADLINE_EXCEEDED"
            assert caught.value.diagnostic_category == category
            assert all(s.closed == 1 for s in backend.streams)
            backend.responses = deque(generation_frames())
            assert (await client.generate("synthetic", {}, Output, TurnBudget())).ok
        finally:
            await client.close()

    asyncio.run(run())
    assert get_emitter().drain()
    failed = timing_records[0]
    assert failed["error_category"] == category and failed["outcome"] == "error"
    assert failed["provider_method"] == "countTokens"
    assert failed["protocol"] == ("http1" if stage == "body" else "unknown")
    assert len(timing_records) == 3  # One failed HTTP attempt, two for the next generation.


@pytest.mark.parametrize(
    "payload,status,code,category",
    [
        (b"private-key malformed", 200, "DEPENDENCY_UNAVAILABLE", "json_decode"),
        (b"private-key upstream", 503, "DEPENDENCY_UNAVAILABLE", "http_status"),
        (b"[]", 200, "AI_PROTOCOL_ERROR", "response_schema"),
    ],
)
def test_malformed_and_http_errors_keep_existing_public_mapping(
    timing_records, payload, status, code, category
):
    async def run():
        backend = ScriptedBackend(frames(payload, status))
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", transport)
        try:
            with pytest.raises(DependencyError) as caught:
                await client.generate("synthetic", {}, Output, TurnBudget())
            assert caught.value.code == code
        finally:
            await client.close()

    asyncio.run(run())
    assert get_emitter().drain()
    assert timing_records[0]["http_status"] == status
    assert timing_records[0]["error_category"] == category
    assert "private-key" not in json.dumps(timing_records)


def test_transport_without_trace_and_version_does_not_infer_http11(timing_records):
    def handler(request):
        return httpx.Response(200, json={"totalTokens": 10})

    async def run():
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            with pytest.raises(DependencyError, match="AI_PROTOCOL_ERROR"):
                await client.generate("synthetic", {}, Output, TurnBudget())
        finally:
            await client.close()

    asyncio.run(run())
    assert get_emitter().drain()
    assert all(
        r["protocol"] == "unknown" and r["trace_state"] == "unavailable" and not r["samples"]
        for r in timing_records
    )


def test_blocked_and_failing_log_sink_cannot_hold_provider_cancellation_or_cleanup(
    timing_records, capsys
):
    entered, release, returned = Event(), Event(), Event()

    class BrokenSink(logging.Handler):
        def emit(self, record):
            entered.set()
            release.wait()
            returned.set()
            raise RuntimeError("private-key sink exception customer@example.invalid")

    handler = BrokenSink()
    LOGGER.addHandler(handler)

    async def run():
        backend = ScriptedBackend(generation_frames(), block="headers")
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", transport)
        original = None

        async def request():
            nonlocal original
            try:
                await client.generate("synthetic", {}, Output, TurnBudget())
            except asyncio.CancelledError as error:
                original = error
                raise

        try:
            # Prepare the verified SSL context/client before occupying the sink.
            # Phase 1 proves cancellation/cleanup while the sink is still blocked.
            HttpTiming(Phase.COUNT, TurnBudget()).finish()
            assert entered.wait(1)
            task = asyncio.create_task(request())
            await asyncio.wait_for(backend.entered.wait(), 1)
            task.cancel("synthetic cancel")
            with pytest.raises(asyncio.CancelledError) as caught:
                await asyncio.wait_for(task, 1)
            assert caught.value is original and task.cancelling() == 1
            assert not returned.is_set() and not release.is_set()
            assert all(s.closed == 1 for s in backend.streams)
            # Phase 2 is a separate check: explicitly release and acknowledge the
            # failing sink before testing the successor, rather than racing wall time.
            release.set()
            assert await asyncio.to_thread(get_emitter().drain)
            assert returned.is_set() and get_emitter().loss.is_set()
            backend.block = None
            backend.responses = deque(generation_frames())
            assert (await client.generate("synthetic", {}, Output, TurnBudget())).ok
            assert returned.is_set() and release.is_set()
        finally:
            await client.close()
        assert transport.closed == 1 and all(s.closed == 1 for s in backend.streams)

    try:
        asyncio.run(run())
    finally:
        release.set()
        try:
            assert get_emitter().drain()
        finally:
            LOGGER.removeHandler(handler)
    assert get_emitter().loss.is_set()
    assert any(row["delivery_loss_observed"] for row in timing_records)
    text = capsys.readouterr().err + json.dumps(timing_records)
    assert "private-key" not in text and "example.invalid" not in text
