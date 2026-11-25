import asyncio
import json

import httpx
import pytest
from pydantic import BaseModel

from app.diagnostics import Category, Phase
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini

SENSITIVE = "private-key Bearer private.jwt.value customer@example.invalid +84901234567\nFORGED"


class Output(BaseModel):
    ok: bool


def result():
    return {
        "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 2},
        "candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": '{"ok":true}'}]}}],
    }


def success(request):
    return httpx.Response(
        200, json={"totalTokens": 10} if request.url.path.endswith(":countTokens") else result()
    )


FAILURES = [
    *[
        (str(status), Category.HTTP_STATUS, "DEPENDENCY_UNAVAILABLE")
        for status in (400, 401, 403, 429, 500, 503)
    ],
    ("connect_timeout", Category.CONNECT_TIMEOUT, "DEADLINE_EXCEEDED"),
    ("read_timeout", Category.READ_TIMEOUT, "DEADLINE_EXCEEDED"),
    ("write_timeout", Category.WRITE_TIMEOUT, "DEADLINE_EXCEEDED"),
    ("pool_timeout", Category.POOL_TIMEOUT, "DEADLINE_EXCEEDED"),
    ("connect", Category.TRANSPORT_CONNECT, "DEPENDENCY_UNAVAILABLE"),
    ("read", Category.TRANSPORT_READ, "DEPENDENCY_UNAVAILABLE"),
    ("write", Category.TRANSPORT_WRITE, "DEPENDENCY_UNAVAILABLE"),
    ("protocol", Category.TRANSPORT_PROTOCOL, "DEPENDENCY_UNAVAILABLE"),
    ("json", Category.JSON_DECODE, "DEPENDENCY_UNAVAILABLE"),
    ("shape", Category.RESPONSE_SCHEMA, "AI_PROTOCOL_ERROR"),
    ("schema", Category.RESPONSE_SCHEMA, "AI_PROTOCOL_ERROR"),
    ("huge", Category.RESPONSE_SIZE, "AI_PROTOCOL_ERROR"),
]


@pytest.mark.parametrize("method", [Phase.COUNT, Phase.GENERATE])
@pytest.mark.parametrize("failure,category,code", FAILURES)
def test_exact_error_mapping_and_safe_records(diagnostic_records, method, failure, category, code):
    calls = []
    errors = {
        "connect_timeout": httpx.ConnectTimeout,
        "read_timeout": httpx.ReadTimeout,
        "write_timeout": httpx.WriteTimeout,
        "pool_timeout": httpx.PoolTimeout,
        "connect": httpx.ConnectError,
        "read": httpx.ReadError,
        "write": httpx.WriteError,
        "protocol": httpx.RemoteProtocolError,
    }

    def handler(request):
        calls.append(request.url.path)
        if not request.url.path.endswith(":" + method.value):
            return success(request)
        if failure in errors:
            raise errors[failure](SENSITIVE, request=request)
        if failure.isdigit():
            return httpx.Response(
                int(failure), text=SENSITIVE, headers={"x-sensitive": SENSITIVE[:10]}
            )
        if failure == "json":
            return httpx.Response(200, content=SENSITIVE.encode())
        if failure == "huge":
            return httpx.Response(200, content=b"x" * (256 * 1024 + 1))
        return httpx.Response(200, json=[] if failure == "shape" else {"private": SENSITIVE})

    async def run():
        client = Gemini(SENSITIVE, "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            with pytest.raises(DependencyError) as caught:
                await client.generate(SENSITIVE, {"message": SENSITIVE}, Output, TurnBudget())
            assert caught.value.code == code
            assert caught.value.diagnostic_category == category
        finally:
            await client.close()

    asyncio.run(run())
    assert len(calls) == (1 if method is Phase.COUNT else 2)  # No retries.
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    errors_seen = [e for e in events if e["error_category"] == category]
    assert errors_seen
    relevant = [e for e in errors_seen if e["provider_method"] == method]
    assert relevant
    assert relevant[0]["http_status"] == (
        int(failure) if failure.isdigit() else None if failure in errors else 200
    )
    for record in diagnostic_records:
        wire = repr(record.__dict__)
        for secret in [
            SENSITIVE,
            "private-key",
            "private.jwt.value",
            "example.invalid",
            "84901234567",
            "FORGED",
            "x-sensitive",
            "generativelanguage.googleapis.com",
        ]:
            assert secret not in wire
        assert record.exc_info is None and not record.args
    assert all(e["duration_ms"] >= 0 and e["remaining_budget_ms"] >= 0 for e in events)


@pytest.mark.parametrize("field", ["usage", "text", "finish", "signature", "tool"])
def test_generated_content_validation(diagnostic_records, field):
    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return success(request)
        data = result()
        part = data["candidates"][0]["content"]["parts"][0]
        if field == "usage":
            data["usageMetadata"] = {"private": SENSITIVE}
        elif field == "text":
            part["text"] = SENSITIVE
        elif field == "finish":
            data["candidates"][0]["finishReason"] = SENSITIVE
        else:
            part["thoughtSignature" if field == "signature" else "functionCall"] = SENSITIVE
        return httpx.Response(200, json=data)

    async def run():
        client = Gemini("test", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            if field == "signature":
                assert (await client.generate("test", {}, Output, TurnBudget())).ok
            else:
                with pytest.raises(DependencyError, match="AI_PROTOCOL_ERROR"):
                    await client.generate("test", {}, Output, TurnBudget())
        finally:
            await client.close()

    asyncio.run(run())
    assert "private-key" not in repr([r.__dict__ for r in diagnostic_records])


def test_fake_clock_preserves_cumulative_time_and_call_budget(monkeypatch, diagnostic_records):
    import app.diagnostics as diagnostics
    import app.providers.contracts as contracts

    clock, calls = [0.0], []
    monkeypatch.setattr(contracts, "monotonic", lambda: clock[0])
    monkeypatch.setattr(diagnostics, "monotonic", lambda: clock[0])

    def handler(request):
        calls.append(request.url.path)
        clock[0] += 6 if len(calls) <= 2 else 9
        return success(request)

    async def run():
        client = Gemini("test", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        budget = TurnBudget(started=0)
        try:
            await client.generate("test", {}, Output, budget)
            with pytest.raises(DependencyError, match="DEADLINE_EXCEEDED"):
                await client.generate("test", {}, Output, budget)
            assert len(calls) == 3  # The fourth request is never sent.
            assert budget.calls == 1
        finally:
            await client.close()

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert any(e["remaining_budget_ms"] == 8000 for e in events)
    assert events[-1]["remaining_budget_ms"] == 0
    assert events[-1]["error_category"] == "application_deadline"


@pytest.mark.parametrize("limit", ["calls", "input", "output"])
def test_exhausted_budget_does_not_send_more_requests(limit, diagnostic_records):
    calls = []

    def handler(request):
        calls.append(request)
        return success(request)

    async def run():
        client = Gemini("test", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        budget = TurnBudget()
        try:
            await client.generate("test", {}, Output, budget)
            await client.generate("test", {}, Output, budget)
            if limit == "input":
                budget.input_limit = budget.input_used - 1
            elif limit == "output":
                budget.output_limit = budget.output_used
            with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
                await client.generate("test", {}, Output, budget)
            assert len(calls) == 4
            assert budget.calls == 2
        finally:
            await client.close()

    asyncio.run(run())
    assert json.loads(diagnostic_records[-1].getMessage())["error_category"] == "budget_limit"
