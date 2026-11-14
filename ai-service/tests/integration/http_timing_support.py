"""Synthetic network backend and public HTTPX/httpcore test adapter; never used in runtime."""

import asyncio
from collections import deque

import httpcore
import httpx

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
