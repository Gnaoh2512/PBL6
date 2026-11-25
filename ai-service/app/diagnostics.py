"""Allowlisted diagnostics only. Never serialize input, exceptions, headers or payloads."""

import asyncio
import json
import logging
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from enum import StrEnum
from threading import Lock
from time import monotonic
from uuid import uuid4

import httpx


class Operation(StrEnum):
    PROBE = "probe"
    CLASSIFY = "classify"
    ANSWER = "answer"
    INDEX_VALIDATE = "index_validate"
    RETRIEVAL = "retrieval"
    TURN = "turn"


class Phase(StrEnum):
    COUNT = "countTokens"
    GENERATE = "generateContent"
    VALIDATE = "response_validation"
    INDEX = "index"
    APPLICATION = "application"


class Category(StrEnum):
    APPLICATION_DEADLINE = "application_deadline"
    CONNECT_TIMEOUT = "connect_timeout"
    READ_TIMEOUT = "read_timeout"
    WRITE_TIMEOUT = "write_timeout"
    POOL_TIMEOUT = "pool_timeout"
    HTTP_STATUS = "http_status"
    TRANSPORT_CONNECT = "transport_connect"
    TRANSPORT_READ = "transport_read"
    TRANSPORT_WRITE = "transport_write"
    TRANSPORT_PROTOCOL = "transport_protocol"
    TRANSPORT_OTHER = "transport_other"
    JSON_DECODE = "json_decode"
    RESPONSE_SCHEMA = "response_schema"
    RESPONSE_SIZE = "response_size"
    INDEX_VALIDATION = "index_validation"
    INDEX_QUERY = "index_query"
    INDEX_IO = "index_io"
    BUDGET_LIMIT = "budget_limit"
    CANCELLED = "cancelled"
    UNEXPECTED = "unexpected"


_id = ContextVar("diagnostic_id", default=None)
_operation = ContextVar("diagnostic_operation", default=Operation.TURN)
_budget = ContextVar("diagnostic_budget", default=None)
_lock = Lock()
LOGGER = logging.getLogger("ai_service.diagnostics")


def diagnostic_identity() -> tuple[str, str]:
    """Internal correlation only; never use request/account identifiers."""
    return _id.get() or str(uuid4()), _operation.get().value


def configure():
    """Own one stderr handler; do not configure root or third-party loggers."""
    with _lock:
        if not LOGGER.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(message)s"))
            LOGGER.addHandler(handler)
        LOGGER.propagate = False
        LOGGER.setLevel(logging.INFO)


@contextmanager
def context(*, operation=None, budget=None, new=False):
    if operation is not None and not isinstance(operation, Operation):
        raise TypeError("Invalid diagnostic operation")
    tokens = []
    if new or _id.get() is None:
        tokens.append((_id, _id.set(str(uuid4()))))
    if operation is not None:
        tokens.append((_operation, _operation.set(operation)))
    if new or budget is not None:
        tokens.append((_budget, _budget.set(budget)))
    try:
        yield
    finally:
        for variable, token in reversed(tokens):
            variable.reset(token)


def bind_budget(budget):
    # The enclosing turn context restores this binding, including on cancellation.
    _budget.set(budget)


@asynccontextmanager
async def deadline(seconds):
    """Attribute only the timeout owned by this context to the application deadline."""
    timeout = asyncio.timeout(seconds)
    try:
        async with timeout:
            yield
    except TimeoutError as error:
        if timeout.expired():
            error.diagnostic_category = Category.APPLICATION_DEADLINE
        raise


def category(error):
    known = getattr(error, "diagnostic_category", None)
    if isinstance(known, Category):
        return known
    for kind, value in (
        (asyncio.CancelledError, Category.CANCELLED),
        (httpx.ConnectTimeout, Category.CONNECT_TIMEOUT),
        (httpx.ReadTimeout, Category.READ_TIMEOUT),
        (httpx.WriteTimeout, Category.WRITE_TIMEOUT),
        (httpx.PoolTimeout, Category.POOL_TIMEOUT),
        (httpx.ConnectError, Category.TRANSPORT_CONNECT),
        (httpx.ReadError, Category.TRANSPORT_READ),
        (httpx.WriteError, Category.TRANSPORT_WRITE),
        (httpx.ProtocolError, Category.TRANSPORT_PROTOCOL),
        (httpx.HTTPError, Category.TRANSPORT_OTHER),
        (sqlite3.Error, Category.INDEX_QUERY),
    ):
        if isinstance(error, kind):
            return value
    return Category.UNEXPECTED


@dataclass
class Step:
    http_status: int | None = None
    error_category: Category | None = None


@contextmanager
def step(phase: Phase, *, operation=None, http_status=None, provider_method=None):
    if not isinstance(phase, Phase) or (
        provider_method is not None
        and (
            not isinstance(provider_method, Phase)
            or provider_method not in (Phase.COUNT, Phase.GENERATE)
        )
    ):
        raise TypeError("Invalid diagnostic phase")
    configure()
    with context(operation=operation):
        event, started, outcome = Step(http_status), monotonic(), "success"
        try:
            yield event
        except BaseException as error:
            outcome = "cancelled" if isinstance(error, asyncio.CancelledError) else "error"
            if event.error_category is None:
                event.error_category = category(error)
            raise
        finally:
            budget = _budget.get()
            remaining = (
                max(0, budget.remaining_ms - (monotonic() - budget.started) * 1000)
                if budget is not None
                else None
            )
            # All strings originate from enums or a generated UUID. No exc_info/extra/args.
            record = {
                "diagnostic_id": _id.get(),
                "operation": _operation.get().value,
                "phase": phase.value,
                "provider_method": provider_method.value if provider_method is not None else None,
                "outcome": outcome,
                "duration_ms": round(max(0, (monotonic() - started) * 1000), 3),
                "remaining_budget_ms": round(remaining, 3) if remaining is not None else None,
                "http_status": (
                    event.http_status
                    if type(event.http_status) is int and 100 <= event.http_status <= 599
                    else None
                ),
                "error_category": (
                    event.error_category.value
                    if isinstance(event.error_category, Category) and outcome != "success"
                    else None
                ),
            }
            LOGGER.log(
                logging.INFO if outcome == "success" else logging.WARNING, json.dumps(record)
            )
