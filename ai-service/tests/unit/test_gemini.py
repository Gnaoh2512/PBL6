import asyncio
import json

import httpx
import pytest
from pydantic import BaseModel, ConfigDict

from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini


class Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str


def response():
    return {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {
                    "parts": [
                        {
                            "text": '{"answer":"synthetic"}',
                            "thoughtSignature": "test-only-opaque-signature",
                        }
                    ]
                },
            }
        ],
        "usageMetadata": {"promptTokenCount": 20, "candidatesTokenCount": 5},
    }


def test_success_accounts_cumulative_budget_and_keeps_key_out_of_payload(caplog):
    calls = []

    def handler(request):
        calls.append(request)
        assert "private-test-key" not in request.content.decode()
        return httpx.Response(
            200,
            json={"totalTokens": 20} if request.url.path.endswith(":countTokens") else response(),
        )

    async def run():
        client = Gemini("private-test-key", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        budget = TurnBudget()
        try:
            for _ in range(2):
                assert (await client.generate("system", {"message": "demo"}, Answer, budget)).answer
            with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
                await client.generate("system", {}, Answer, budget)
            assert (budget.input_used, budget.output_used, budget.calls) == (40, 10, 2)
        finally:
            await client.close()

    asyncio.run(run())
    assert len(calls) == 4
    assert "private-test-key" not in caplog.text


@pytest.mark.parametrize(
    "failure", ["auth", "quota", "timeout", "json", "huge", "schema", "usage", "tool"]
)
def test_provider_failures_are_safe(failure):
    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 20})
        if failure in {"auth", "quota"}:
            return httpx.Response(401 if failure == "auth" else 429, text="private-test-key")
        if failure == "timeout":
            raise httpx.ReadTimeout("private-test-key")
        if failure == "json":
            return httpx.Response(200, text="broken")
        if failure == "huge":
            return httpx.Response(200, text="x" * (256 * 1024 + 1))
        result = response()
        if failure == "tool":
            result["candidates"][0]["content"]["parts"][0]["functionCall"] = {"name": "execute_sql"}
            return httpx.Response(200, json=result)
        if failure == "schema":
            result["candidates"][0]["content"]["parts"][0]["text"] = json.dumps({"wrong": 1})
        else:
            result["usageMetadata"] = {}
        return httpx.Response(200, json=result)

    async def run():
        client = Gemini("private-test-key", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            with pytest.raises(DependencyError) as error:
                await client.generate("system", {}, Answer, TurnBudget())
            assert "private-test-key" not in str(error.value)
        finally:
            await client.close()

    asyncio.run(run())


def test_exhausted_budget_does_not_call_provider():
    def handler(request):
        pytest.fail("No network request expected")

    async def run():
        client = Gemini("test", "gemini-3.1-flash-lite", httpx.MockTransport(handler))
        try:
            with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
                await client.generate("system", {}, Answer, TurnBudget(output_limit=0))
        finally:
            await client.close()

    asyncio.run(run())
