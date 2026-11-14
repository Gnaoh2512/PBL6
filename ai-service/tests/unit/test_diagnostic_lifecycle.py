import asyncio
import json
import logging
import socket
from uuid import UUID

import httpx
import pytest
from pydantic import BaseModel

from app.diagnostics import LOGGER, Category, Operation, Phase, configure, context, step
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini


class Output(BaseModel):
    ok: bool


class TrackedStream(httpx.AsyncByteStream):
    def __init__(self, data, gate=None):
        self.data, self.gate, self.closed = data, gate, 0

    async def __aiter__(self):
        if self.gate is not None:
            self.gate.set()
            await asyncio.Event().wait()
        yield self.data

    async def aclose(self):
        self.closed += 1


class TrackedTransport(httpx.MockTransport):
    def __init__(self, handler):
        super().__init__(handler)
        self.closed = 0

    async def aclose(self):
        self.closed += 1


def body(request):
    if request.url.path.endswith(":countTokens"):
        return b'{"totalTokens":10}'
    return json.dumps(
        {
            "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 1},
            "candidates": [
                {"finishReason": "STOP", "content": {"parts": [{"text": '{"ok":true}'}]}}
            ],
        }
    ).encode()


@pytest.mark.parametrize("where", ["headers", "body", "between"])
def test_cancellation_closes_stream_and_next_request_works(where, diagnostic_records):
    async def run():
        gate, streams, fail = asyncio.Event(), [], [True]

        async def handler(request):
            blocked = fail[0]
            fail[0] = False
            if blocked and where == "headers":
                gate.set()
                await asyncio.Event().wait()
            stream = TrackedStream(body(request), gate if blocked and where == "body" else None)
            streams.append(stream)
            return httpx.Response(200, stream=stream)

        transport = TrackedTransport(handler)
        client = Gemini("synthetic-key", "gemini-3.1-flash-lite", transport)
        original = client._post

        async def between(method, data, budget):
            value = await original(method, data, budget)
            if where == "between" and method == "countTokens":
                gate.set()
                await asyncio.Event().wait()
            return value

        client._post = between
        try:
            task = asyncio.create_task(client.generate("test", {}, Output, TurnBudget()))
            await asyncio.wait_for(gate.wait(), 1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert all(s.closed == 1 for s in streams)
            assert not client.client.is_closed and transport.closed == 0
            client._post = original
            assert (await client.generate("test", {}, Output, TurnBudget())).ok
            assert all(s.closed == 1 for s in streams)
        finally:
            await client.close()
        assert client.client.is_closed and transport.closed == 1

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert any(e["outcome"] == "cancelled" and e["error_category"] == "cancelled" for e in events)
    assert not any(e["error_category"] == "application_deadline" for e in events)


@pytest.mark.parametrize("failure", ["http", "json", "transport", "timeout"])
def test_failed_request_releases_stream_and_reuses_client(failure):
    async def run():
        fail, streams = [True], []

        def handler(request):
            if fail[0]:
                fail[0] = False
                if failure == "transport":
                    raise httpx.RemoteProtocolError("synthetic secret")
                if failure == "timeout":
                    raise httpx.ReadTimeout("synthetic secret")
                stream = TrackedStream(b"bad-json")
                streams.append(stream)
                return httpx.Response(503 if failure == "http" else 200, stream=stream)
            stream = TrackedStream(body(request))
            streams.append(stream)
            return httpx.Response(200, stream=stream)

        transport = TrackedTransport(handler)
        client = Gemini("test", "gemini-3.1-flash-lite", transport)
        try:
            with pytest.raises(DependencyError):
                await client.generate("test", {}, Output, TurnBudget())
            assert all(s.closed == 1 for s in streams)
            assert (await client.generate("test", {}, Output, TurnBudget())).ok
            assert all(s.closed == 1 for s in streams)
        finally:
            await client.close()
        assert transport.closed == 1

    asyncio.run(run())


def test_inner_application_timeout_is_not_http_timeout(monkeypatch, diagnostic_records):
    import app.providers.gemini as gemini_module

    original_timeout = asyncio.timeout

    async def run():
        gate, timeouts = asyncio.Event(), []

        def timeout(delay):
            value = original_timeout(delay)
            timeouts.append(value)
            return value

        monkeypatch.setattr(gemini_module.asyncio, "timeout", timeout)

        async def handler(request):
            gate.set()
            await asyncio.Event().wait()

        client = Gemini("test", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            task = asyncio.create_task(client.generate("test", {}, Output, TurnBudget()))
            await asyncio.wait_for(gate.wait(), 1)
            timeouts[0].reschedule(asyncio.get_running_loop().time())
            with pytest.raises(DependencyError) as error:
                await task
            assert error.value.code == "DEADLINE_EXCEEDED"
            assert error.value.diagnostic_category is Category.APPLICATION_DEADLINE
        finally:
            await client.close()

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert any(
        e["phase"] == "countTokens" and e["error_category"] == "application_deadline"
        for e in events
    )


def test_context_isolation_reset_safe_unexpected_and_single_handler(diagnostic_records):
    handlers = list(LOGGER.handlers)
    configure()
    configure()
    assert LOGGER.handlers == handlers and not LOGGER.propagate

    async def run():
        gate = asyncio.Event()

        async def worker(operation):
            with context(operation=operation, new=True):
                with step(Phase.APPLICATION):
                    gate.set()
                    await asyncio.sleep(0)
                with step(Phase.VALIDATE):
                    pass

        await asyncio.gather(worker(Operation.CLASSIFY), worker(Operation.ANSWER))
        with pytest.raises(RuntimeError):
            with context(new=True), step(Phase.APPLICATION):
                raise RuntimeError("private-key\nforged-log customer@example.invalid")
        with step(Phase.APPLICATION):
            pass

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert len(events) == 6
    for operation in ("classify", "answer"):
        ids = {e["diagnostic_id"] for e in events if e["operation"] == operation}
        assert len(ids) == 1
    assert len({e["diagnostic_id"] for e in events}) == 4
    assert events[-1]["operation"] == "turn"
    assert events[-2]["error_category"] == "unexpected"
    assert all(UUID(e["diagnostic_id"]).version == 4 for e in events)
    assert "private-key" not in repr([r.__dict__ for r in diagnostic_records])
    assert all(r.levelno in (logging.INFO, logging.WARNING) for r in diagnostic_records)


def test_offline_guard_blocks_outbound_and_dns():
    with pytest.raises(AssertionError, match="Network is disabled"):
        socket.socket()
    pair = socket.socketpair()
    try:
        with pytest.raises(AssertionError, match="Network is disabled"):
            pair[0].connect(("127.0.0.1", 1))
    finally:
        for sock in pair:
            sock.close()
    with pytest.raises(AssertionError, match="Network is disabled"):
        socket.getaddrinfo("generativelanguage.googleapis.com", 443)

    async def run():
        with pytest.raises(AssertionError, match="Network is disabled"):
            await asyncio.get_running_loop().create_connection(asyncio.Protocol, "127.0.0.1", 443)

    asyncio.run(run())


def test_unowned_timeout_is_not_misreported_as_application_deadline(diagnostic_records):
    from app.diagnostics import deadline

    async def run():
        with step(Phase.APPLICATION):
            async with deadline(20):
                raise TimeoutError("synthetic secret")

    with pytest.raises(TimeoutError):
        asyncio.run(run())
    assert json.loads(diagnostic_records[-1].getMessage())["error_category"] == "unexpected"


def test_invalid_labels_cannot_inject_or_leak_context(diagnostic_records):
    with context(operation=Operation.CLASSIFY, new=True):
        with step(Phase.APPLICATION):
            pass
        with pytest.raises(TypeError):
            with context(operation="private-key\nforged", new=True):
                pytest.fail("Invalid operation was accepted")
        with pytest.raises(TypeError):
            with step(Phase.VALIDATE, provider_method="countTokens"):
                pytest.fail("Non-enum method was accepted")
        with step(Phase.APPLICATION):
            pass
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert len(events) == 2
    assert events[0]["diagnostic_id"] == events[1]["diagnostic_id"]
    assert events[0]["operation"] == events[1]["operation"] == "classify"
    assert "private-key" not in repr([r.__dict__ for r in diagnostic_records])
