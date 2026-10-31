import asyncio
import json
from datetime import date

import httpx
import pytest

from ai_service.application.recommendation.conversation_models import SearchState
from ai_service.infrastructure.llm import (
    ExtractionInvalidResponse,
    ExtractionTimeout,
    ExtractionUnavailable,
    GeminiExtractor,
)


def execute(handler, *, state=None):
    async def run():
        extractor = GeminiExtractor(
            api_key="test-key",
            model="gemini-2.5-flash",
            timezone_name="Asia/Ho_Chi_Minh",
            timeout_seconds=3,
            transport=httpx.MockTransport(handler),
        )
        try:
            return await extractor.extract(
                "Ngày mai, một phòng hai người",
                state or SearchState(),
                today=date(2026, 10, 31),
                request_id="test-provider-1",
            )
        finally:
            await extractor.aclose()

    return asyncio.run(run())


def test_provider_request_and_structured_response() -> None:
    def handler(request):
        assert request.url.path == "/v1beta/models/gemini-2.5-flash:generateContent"
        assert request.headers["x-goog-api-key"] == "test-key"
        body = json.loads(request.content)
        assert body["generationConfig"]["responseMimeType"] == "application/json"
        assert body["generationConfig"]["responseJsonSchema"]["type"] == "object"
        user_data = json.loads(body["contents"][0]["parts"][0]["text"])
        assert user_data["referenceDate"] == "2026-10-31"
        assert user_data["timezone"] == "Asia/Ho_Chi_Minh"
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "changes": [
                                                {
                                                    "field": "checkInDate",
                                                    "action": "SET",
                                                    "value": "2026-11-01",
                                                }
                                            ],
                                            "ambiguities": [],
                                            "unsupportedIntent": False,
                                        }
                                    ),
                                }
                            ]
                        },
                    }
                ],
            },
        )

    result = execute(handler)
    assert result.changes[0].value == "2026-11-01"


def test_provider_receives_pending_amount_and_question() -> None:
    state = SearchState.model_validate(
        {"pending": [{"kind": "budget", "amount": 1000000}], "pendingQuestion": "budgetBasis"}
    )

    def handler(request):
        user_data = json.loads(json.loads(request.content)["contents"][0]["parts"][0]["text"])
        assert user_data["previousState"]["pending"][0]["amount"] == "1000000"
        assert user_data["previousState"]["pendingQuestion"] == "budgetBasis"
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [
                                {
                                    "text": json.dumps(
                                        {
                                            "changes": [
                                                {
                                                    "field": "budgetBasis",
                                                    "action": "SET",
                                                    "value": "PER_NIGHT",
                                                }
                                            ],
                                            "ambiguities": [],
                                            "unsupportedIntent": False,
                                        }
                                    )
                                }
                            ]
                        },
                    }
                ],
            },
        )

    result = execute(handler, state=state)
    assert result.changes[0].value == "PER_NIGHT"


@pytest.mark.parametrize(
    ("handler", "error"),
    [
        (lambda _: httpx.Response(429, json={"error": "private"}), ExtractionUnavailable),
        (
            lambda _: httpx.Response(200, json={"candidates": [{"finishReason": "MAX_TOKENS"}]}),
            ExtractionInvalidResponse,
        ),
        (lambda _: httpx.Response(200, json={"candidates": []}), ExtractionInvalidResponse),
        (lambda _: (_ for _ in ()).throw(httpx.ReadTimeout("slow")), ExtractionTimeout),
    ],
)
def test_provider_failures_are_not_search_outcomes(handler, error) -> None:
    with pytest.raises(error):
        execute(handler)
