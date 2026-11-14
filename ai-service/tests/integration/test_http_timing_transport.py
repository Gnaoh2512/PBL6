"""Real HTTPX/httpcore parsing and trace flow over a synthetic, in-memory network backend."""

import asyncio
import json
from collections import deque
from importlib.metadata import version
from types import SimpleNamespace

import httpcore
import httpx
import pytest

from app.diagnostics import Phase
from app.providers.http_timing import HttpTiming

CORE_ERRORS = (httpcore.TimeoutException, httpcore.NetworkError, httpcore.ProtocolError)


class Clock:
    value = 0.0

    def __call__(self):
        return self.value


class MemorySink:
    def __init__(self):
        self.records = []

    def offer(self, record):
        self.records.append(record)


def frames(payload=b'{"ok":true}', status=200, combined=False):
    header = f"HTTP/1.1 {status} Synthetic\r\nContent-Length: {len(payload)}\r\n\r\n".encode()
    return [("headers", header + payload)] if combined else [("headers", header), ("body", payload)]


class ScriptedBackend(httpcore.AsyncNetworkBackend):
    def __init__(self, responses, *, fail=None, block=None, clock=None, delays=None):
        self.responses = deque(responses)
        self.fail, self.block, self.clock = fail, block, clock or Clock()
        self.delays = delays or {}
        self.entered, self.release = asyncio.Event(), asyncio.Event()
        self.streams, self.connects = [], 0

    async def stage(self, name):
        self.clock.value += self.delays.get(name, 0.001)
        if self.fail == name:
            self.fail = None
            error = (
                httpcore.ConnectTimeout
                if name in ("connect", "tls")
                else httpcore.WriteTimeout
                if name.startswith("write")
                else httpcore.ReadTimeout
            )
            raise error("synthetic private-key customer@example.invalid")
        if self.block == name:
            self.entered.set()
            await self.release.wait()

    async def connect_tcp(self, *args, **kwargs):
        self.connects += 1
        await self.stage("connect")
        stream = ScriptedStream(self)
        self.streams.append(stream)
        return stream


class ScriptedStream(httpcore.AsyncNetworkStream):
    def __init__(self, backend):
        self.backend, self.closed = backend, 0

    async def start_tls(self, *args, **kwargs):
        try:
            await self.backend.stage("tls")
        except BaseException:
            # This synthetic backend owns its stream until TLS returns. It is not a test
            # of AnyIO/OpenSSL cancellation internals or of a real certificate handshake.
            await self.aclose()
            raise
        return self  # Synthetic TLS, never a real handshake or certificate check.

    async def write(self, buffer, timeout=None):
        name = (
            "write_headers" if buffer.startswith((b"POST ", b"GET ", b"CONNECT ")) else "write_body"
        )
        await self.backend.stage(name)

    async def read(self, max_bytes, timeout=None):
        if not self.backend.responses:
            return b""
        name, data = self.backend.responses.popleft()
        await self.backend.stage(name)
        return data

    async def aclose(self):
        self.closed += 1

    def get_extra_info(self, info):
        return None


def convert(error):
    for core, client in (
        (httpcore.ConnectTimeout, httpx.ConnectTimeout),
        (httpcore.ReadTimeout, httpx.ReadTimeout),
        (httpcore.WriteTimeout, httpx.WriteTimeout),
        (httpcore.PoolTimeout, httpx.PoolTimeout),
        (httpcore.RemoteProtocolError, httpx.RemoteProtocolError),
        (httpcore.WriteError, httpx.WriteError),
    ):
        if isinstance(error, core):
            return client("synthetic transport failure")
    return httpx.TransportError("synthetic transport failure")


class CoreBody(httpx.AsyncByteStream):
    def __init__(self, response):
        self.response = response

    async def __aiter__(self):
        try:
            async for chunk in self.response.aiter_stream():
                yield chunk
        except CORE_ERRORS as error:
            raise convert(error) from None

    async def aclose(self):
        await self.response.aclose()


class PublicCoreTransport(httpx.AsyncBaseTransport):
    """Test adapter using public APIs only; no default transport/pool mutation."""

    def __init__(self, pool):
        self.pool, self.extensions, self.closed = pool, [], 0

    async def handle_async_request(self, request):
        self.extensions.append(dict(request.extensions))
        core_request = httpcore.Request(
            method=request.method,
            url=str(request.url),
            headers=request.headers.raw,
            content=request.stream,
            extensions=request.extensions,
        )
        try:
            response = await self.pool.handle_async_request(core_request)
        except CORE_ERRORS as error:
            raise convert(error) from None
        return httpx.Response(
            response.status,
            headers=response.headers,
            stream=CoreBody(response),
            extensions=response.extensions,
        )

    async def aclose(self):
        self.closed += 1
        await self.pool.aclose()


def timing(backend):
    sink = MemorySink()
    observer = HttpTiming(
        Phase.GENERATE,
        SimpleNamespace(started=0, remaining_ms=20000),
        clock=backend.clock,
        emitter=sink,
    )
    return observer, sink


def test_request_scoped_extension_reaches_real_httpcore_without_global_or_private_mutation():
    assert (version("httpx"), version("httpcore")) == ("0.28.1", "1.0.9")

    async def run():
        backend = ScriptedBackend(frames() + frames())
        transport = PublicCoreTransport(httpcore.AsyncConnectionPool(network_backend=backend))
        observer, sink = timing(backend)
        callback = observer.trace
        async with httpx.AsyncClient(transport=transport) as client:
            hooks = {k: list(v) for k, v in client.event_hooks.items()}
            with observer:
                async with client.stream(
                    "POST",
                    "https://synthetic.invalid/",
                    json={"test": True},
                    extensions={"trace": callback},
                ) as response:
                    observer.observe_response(
                        response.status_code, response.extensions.get("http_version")
                    )
                    assert await response.aread() == b'{"ok":true}'
            snapshot = json.dumps(sink.records)
            assert transport.extensions[0]["trace"] is callback
            assert client.event_hooks == hooks
            assert (await client.post("https://synthetic.invalid/", json={})).status_code == 200
            assert "trace" not in transport.extensions[1]
            assert json.dumps(sink.records) == snapshot  # No trace leaked to request 2.
        assert transport.closed == 1 and backend.connects == 1
        assert all(s.closed == 1 for s in backend.streams)
        record = sink.records[0]
        assert record["protocol"] == "http1" and record["protocol_source"] == "response_extension"
        assert record["trace_state"] == "observed"
        assert [s["phase"] for s in record["samples"]] == [
            "connect_tcp",
            "tls",
            "write_headers",
            "write_body",
            "wait_headers",
            "read_body",
            "close",
        ]
        assert all(s["outcome"] == "complete" for s in record["samples"])
        assert {s["phase"]: s["duration_ms"] for s in record["samples"]} == {
            "connect_tcp": 1,
            "tls": 1,
            "write_headers": 1,
            "write_body": 2,
            "wait_headers": 1,
            "read_body": 1,
            "close": 0,
        }

    asyncio.run(run())


@pytest.mark.parametrize(
    "phase", ["connect", "tls", "write_headers", "write_body", "headers", "body"]
)
def test_real_trace_failure_and_cancellation_then_cleanup(phase):
    async def run(cancel):
        backend = ScriptedBackend(frames(), **({"block": phase} if cancel else {"fail": phase}))
        transport = PublicCoreTransport(httpcore.AsyncConnectionPool(network_backend=backend))
        observer, sink = timing(backend)
        original = None
        async with httpx.AsyncClient(transport=transport) as client:

            async def request():
                nonlocal original
                try:
                    with observer:
                        async with client.stream(
                            "POST",
                            "https://synthetic.invalid/",
                            json={},
                            extensions={"trace": observer.trace},
                        ) as response:
                            observer.observe_response(
                                response.status_code, response.extensions.get("http_version")
                            )
                            await response.aread()
                except BaseException as error:
                    original = error
                    raise

            if cancel:
                task = asyncio.create_task(request())
                await asyncio.wait_for(backend.entered.wait(), 1)
                task.cancel("synthetic cancellation")
                with pytest.raises(asyncio.CancelledError) as caught:
                    await asyncio.wait_for(task, 1)
                assert caught.value is original and task.cancelling() == 1
            else:
                with pytest.raises(httpx.TimeoutException) as caught:
                    await request()
                assert caught.value is original
            assert all(s.closed == 1 for s in backend.streams)
            backend.block = backend.fail = None
            backend.responses = deque(frames())
            assert (await client.post("https://synthetic.invalid/", json={})).status_code == 200
        assert all(s.closed == 1 for s in backend.streams) and transport.closed == 1
        record = sink.records[0]
        wanted = {"connect": "connect_tcp", "headers": "wait_headers", "body": "read_body"}.get(
            phase, phase
        )
        assert any(s["phase"] == wanted and s["outcome"] == "failed" for s in record["samples"])
        assert record["outcome"] == ("cancelled" if cancel else "error")
        if phase != "body":
            assert record["protocol"] == "unknown"

    asyncio.run(run(False))
    asyncio.run(run(True))


def test_buffered_body_and_missing_trace_do_not_invent_network_latency():
    async def run():
        backend = ScriptedBackend(frames(combined=True))
        transport = PublicCoreTransport(httpcore.AsyncConnectionPool(network_backend=backend))
        observer, sink = timing(backend)
        async with httpx.AsyncClient(transport=transport) as client:
            with observer:
                response = await client.get(
                    "https://synthetic.invalid/", extensions={"trace": observer.trace}
                )
                observer.observe_response(
                    response.status_code, response.extensions.get("http_version")
                )
        body_sample = next(s for s in sink.records[0]["samples"] if s["phase"] == "read_body")
        assert body_sample["duration_ms"] == 0  # Real observed interval over buffered bytes.

    asyncio.run(run())


@pytest.mark.parametrize(
    "phase", ["connect", "tls", "write_headers", "write_body", "headers", "body"]
)
def test_slow_phase_uses_actual_core_boundaries(phase):
    async def run():
        backend = ScriptedBackend(frames(), delays={phase: 0.05})
        transport = PublicCoreTransport(httpcore.AsyncConnectionPool(network_backend=backend))
        observer, sink = timing(backend)
        async with httpx.AsyncClient(transport=transport) as client:
            with observer:
                response = await client.post(
                    "https://synthetic.invalid/", json={}, extensions={"trace": observer.trace}
                )
                observer.observe_response(
                    response.status_code, response.extensions.get("http_version")
                )
        wanted = {"connect": "connect_tcp", "headers": "wait_headers", "body": "read_body"}.get(
            phase, phase
        )
        assert next(s for s in sink.records[0]["samples"] if s["phase"] == wanted)[
            "duration_ms"
        ] == (100 if phase == "write_body" else 50)

    asyncio.run(run())


def test_pool_timeout_has_no_invented_pool_or_connect_phase():
    async def run():
        backend = ScriptedBackend(frames())
        transport = PublicCoreTransport(
            httpcore.AsyncConnectionPool(network_backend=backend, max_connections=1)
        )
        observer, sink = timing(backend)
        async with httpx.AsyncClient(transport=transport) as client:
            held = await client.send(
                client.build_request("GET", "https://synthetic.invalid/"), stream=True
            )
            try:
                with pytest.raises(httpx.PoolTimeout), observer:
                    await client.get(
                        "https://synthetic.invalid/",
                        extensions={"trace": observer.trace, "timeout": {"pool": 0}},
                    )
            finally:
                await held.aclose()
            backend.responses = deque(frames())
            assert (await client.get("https://synthetic.invalid/")).status_code == 200
        row = sink.records[0]
        assert row["trace_state"] == "unavailable" and row["samples"] == []
        assert row["pre_trace_ms"] is None and row["protocol"] == "unknown"
        assert row["error_category"] == "pool_timeout"
        assert all(s.closed == 1 for s in backend.streams)

    asyncio.run(run())


def test_proxy_connect_trace_is_not_confused_with_origin_protocol():
    async def run():
        backend = ScriptedBackend(frames(b"", combined=True) + frames())
        pool = httpcore.AsyncHTTPProxy(
            proxy_url="http://synthetic-proxy.invalid:8080", network_backend=backend
        )
        transport = PublicCoreTransport(pool)
        observer, sink = timing(backend)
        async with httpx.AsyncClient(transport=transport) as client:
            with observer:
                response = await client.get(
                    "https://synthetic.invalid/", extensions={"trace": observer.trace}
                )
                observer.observe_response(
                    response.status_code, response.extensions.get("http_version")
                )
        phases = [s["phase"] for s in sink.records[0]["samples"]]
        assert phases.count("wait_headers") == 2 and "proxy_tls" in phases
        assert sink.records[0]["protocol"] == "http1"
        assert all(s.closed == 1 for s in backend.streams)

    asyncio.run(run())
