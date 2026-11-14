"""Client-observed transport intervals, not provider compute time. Never inspect trace info."""

import asyncio
import json
import logging
import math
from queue import Full, Queue
from threading import Event, Lock, Thread
from time import monotonic
from uuid import uuid4

from app.diagnostics import Phase, category, diagnostic_identity

LOGGER = logging.getLogger("ai_service.http_timing")
_emitter = None
_lock = Lock()


class SafeStreamHandler(logging.StreamHandler):
    def handleError(self, record):
        # Standard logging.handleError may print a raw sink exception and traceback.
        # Let only the isolated worker see a constant failure, never stderr diagnostics.
        raise OSError("Diagnostic sink unavailable") from None


# Verified against httpcore 1.0.9. Families describe code paths, not negotiated protocol.
EVENTS = {
    "connection.connect_tcp": ("connect_tcp", "connection"),
    "connection.start_tls": ("tls", "connection"),
    "proxy.start_tls": ("proxy_tls", "proxy"),
    **{
        f"{family}.{name}": (phase, family)
        for family in ("http11", "http2")
        for name, phase in (
            ("send_request_headers", "write_headers"),
            ("send_request_body", "write_body"),
            ("receive_response_headers", "wait_headers"),
            ("receive_response_body", "read_body"),
            ("response_closed", "close"),
        )
    },
}


class BoundedEmitter:
    """No sink I/O on request/cancellation paths. Delivery is explicitly best effort."""

    def __init__(self, sink, capacity=128):
        self.queue = Queue(maxsize=capacity)
        self.loss = Event()
        self.sink = sink
        self.worker = Thread(target=self._run, name="assistant-http-timing", daemon=True)
        self.worker.start()

    def offer(self, record):
        try:
            self.queue.put_nowait((dict(record, delivery_loss_observed=self.loss.is_set()), None))
        except Full:
            self.loss.set()

    def _run(self):
        while True:
            record, fence = self.queue.get()
            if record is None:
                if fence is None:
                    return
                fence.set()
                continue
            try:
                self.sink(record)
            except BaseException:  # noqa: BLE001 -- isolated worker, never an asyncio request task
                # This worker owns no asyncio task. Never print a sink exception/traceback.
                self.loss.set()

    def drain(self, timeout=1):
        """Offline verification only; never called from the request/lifespan path."""
        fence = Event()
        try:
            self.queue.put((None, fence), timeout=timeout)
        except Full:
            return False
        return fence.wait(timeout)

    def close(self, timeout=1):
        """For isolated test emitters. Production daemon never joins on client shutdown."""
        try:
            self.queue.put((None, None), timeout=timeout)
        except Full:
            return False
        self.worker.join(timeout)
        return not self.worker.is_alive()


def _log(record):
    LOGGER.log(
        logging.INFO if record["outcome"] == "success" else logging.WARNING,
        json.dumps(record, allow_nan=False),
    )


def get_emitter():
    global _emitter
    with _lock:
        if _emitter is None:
            if not LOGGER.handlers:
                handler = SafeStreamHandler()
                handler.setFormatter(logging.Formatter("%(message)s"))
                LOGGER.addHandler(handler)
            LOGGER.propagate = False
            LOGGER.setLevel(logging.INFO)
            _emitter = BoundedEmitter(_log)
    return _emitter


class HttpTiming:
    MAX_SAMPLES = 32

    def __init__(self, method: Phase, budget, *, clock=monotonic, emitter=None):
        self.method = method
        self.budget, self.clock = budget, clock
        self.samples, self.active = [], {}
        self.partial, self.truncated, self.finished = False, False, False
        self.first = self.started = None
        self.protocol, self.protocol_source = "unknown", "unavailable"
        self.http_status = None
        self.emitter = None
        try:
            self.identity, self.operation = diagnostic_identity()
            self.attempt_id = str(uuid4())
            self.started = self._now()
            if method not in (Phase.COUNT, Phase.GENERATE) or not isinstance(method, Phase):
                self.partial = True
                return
            self.emitter = emitter if emitter is not None else get_emitter()
        except Exception:  # noqa: BLE001 -- optional instrumentation must not change requests
            self.partial = True

    def _now(self):
        value = self.clock()
        if type(value) not in (int, float) or not math.isfinite(value):
            raise ValueError("Invalid diagnostic clock")
        return value

    async def trace(self, name, info):
        # Deliberately never read/retain info, including exception/return_value/headers.
        if self.finished or self.emitter is None or self.truncated:
            return
        try:
            if type(name) is not str:
                self.partial = True
                return
            base, separator, action = name.rpartition(".")
            known = EVENTS.get(base)
            if not separator or known is None or action not in ("started", "complete", "failed"):
                self.partial = True
                return
            now = self._now()
            if self.first is None:
                self.first = now
            if action == "started":
                if len(self.samples) >= self.MAX_SAMPLES:
                    self.partial = self.truncated = True
                    return
                phase, family = known
                index = len(self.samples)
                self.samples.append(
                    {
                        "phase": phase,
                        "trace_family": family,
                        "sequence": index + 1,
                        "started": now,
                        "outcome": "incomplete",
                        "duration_ms": None,
                        "duration_kind": "elapsed_until_abort",
                    }
                )
                self.active.setdefault(base, []).append(index)
            elif self.active.get(base):
                sample = self.samples[self.active[base].pop()]
                sample.update(
                    outcome="complete" if action == "complete" else "failed",
                    duration_ms=round(max(0, now - sample["started"]) * 1000, 3),
                    duration_kind=(
                        "observed_interval" if action == "complete" else "elapsed_until_abort"
                    ),
                )
            else:
                self.partial = True
        except Exception:  # noqa: BLE001 -- do not expose/replace trace callback failures
            self.partial = True

    def observe_response(self, status, version):
        # Explicit extension only: Response.http_version defaults to HTTP/1.1 if absent.
        if type(status) is int and 100 <= status <= 599:
            self.http_status = status
        if type(version) is bytes and version in (b"HTTP/1.0", b"HTTP/1.1", b"HTTP/2"):
            self.protocol = "http2" if version == b"HTTP/2" else "http1"
            self.protocol_source = "response_extension"

    def observe_httpx_response(self, response):
        """Read only explicit status/version; never retain a Response or inspect its body."""
        try:
            self.observe_response(response.status_code, None)
            self.observe_response(response.status_code, response.extensions.get("http_version"))
        except Exception:  # noqa: BLE001 -- metadata inspection cannot change request handling
            self.partial = True

    def finish(self, error=None):
        if self.finished:
            return
        self.finished = True
        if self.emitter is None:
            return
        try:
            now = self._now()
            cancelled = isinstance(error, asyncio.CancelledError)
            for stack in self.active.values():
                for index in stack:
                    sample = self.samples[index]
                    sample.update(
                        outcome="cancelled" if cancelled else "incomplete",
                        duration_ms=round(max(0, now - sample["started"]) * 1000, 3),
                    )
                    self.partial = True
            remaining = max(0, self.budget.remaining_ms - (now - self.budget.started) * 1000)
            record = {
                "schema_version": 1,
                "event_type": "http_timing",
                "diagnostic_id": self.identity,
                "http_attempt_id": self.attempt_id,
                "operation": self.operation,
                "provider_method": self.method.value,
                "protocol": self.protocol,
                "protocol_source": self.protocol_source,
                "outcome": "cancelled"
                if cancelled
                else "error"
                if error is not None
                else "success",
                "error_category": category(error).value if error is not None else None,
                "http_status": self.http_status,
                "duration_ms": round(max(0, now - self.started) * 1000, 3),
                "remaining_budget_ms": round(remaining, 3),
                "trace_state": ("partial" if self.partial else "observed")
                if self.samples
                else "unavailable",
                "pre_trace_ms": round(max(0, self.first - self.started) * 1000, 3)
                if self.first is not None
                else None,
                "truncated": self.truncated,
                "delivery_loss_observed": False,
                "samples": [
                    {k: v for k, v in sample.items() if k != "started"} for sample in self.samples
                ],
            }
            self.emitter.offer(record)
        except Exception:  # noqa: BLE001 -- preserve the original result/exception/cancellation
            self.partial = True
        finally:
            self.active.clear()
            self.samples.clear()

    def __enter__(self):
        return self

    def __exit__(self, kind, error, traceback):
        self.finish(error)
        return False
