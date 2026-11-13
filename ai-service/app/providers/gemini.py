"""Bounded Gemini REST adapter: no retries, tools, URL context or browser credentials."""

import asyncio
import json
import re

import httpx
from pydantic import BaseModel, ValidationError

from app.providers.contracts import DependencyError, TurnBudget


class Gemini:
    def __init__(self, key: str, model: str, transport=None):
        if not key or not re.fullmatch(r"gemini-[a-z0-9.-]+", model) or "latest" in model:
            raise DependencyError("AI_NOT_CONFIGURED")
        self.model = model
        self.model_version = None
        self.client = httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com/v1beta/",
            headers={"x-goog-api-key": key},
            transport=transport,
            follow_redirects=False,
            timeout=20,
            limits=httpx.Limits(max_connections=8),
        )

    async def close(self):
        await self.client.aclose()

    async def _post(self, method: str, body: dict, budget: TurnBudget):
        try:
            async with asyncio.timeout(budget.seconds()):
                async with self.client.stream(
                    "POST",
                    f"models/{self.model}:{method}",
                    json=body,
                ) as response:
                    if response.status_code != 200:
                        raise DependencyError()
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        chunks.extend(chunk)
                        if len(chunks) > 256 * 1024:
                            raise DependencyError("AI_PROTOCOL_ERROR")
                    parsed = json.loads(chunks)
                    if not isinstance(parsed, dict):
                        raise DependencyError("AI_PROTOCOL_ERROR")
                    return parsed
        except (TimeoutError, httpx.TimeoutException):
            raise DependencyError("DEADLINE_EXCEEDED") from None
        except (httpx.HTTPError, ValueError):
            raise DependencyError() from None

    async def generate(
        self, system: str, data: dict, schema: type[BaseModel], budget: TurnBudget
    ) -> BaseModel:
        budget.reserve(0)
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "user", "parts": [{"text": json.dumps(data, ensure_ascii=False)}]}
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseJsonSchema": schema.model_json_schema(),
                "maxOutputTokens": budget.output_limit - budget.output_used,
            },
        }
        count = await self._post(
            "countTokens",
            {"generateContentRequest": {"model": f"models/{self.model}", **body}},
            budget,
        )
        tokens = count.get("totalTokens")
        if type(tokens) is not int:
            raise DependencyError("AI_PROTOCOL_ERROR")
        budget.reserve(tokens)
        result = await self._post("generateContent", body, budget)
        try:
            usage = result["usageMetadata"]
            input_tokens = usage["promptTokenCount"]
            output_tokens = usage.get("candidatesTokenCount", 0) + usage.get(
                "thoughtsTokenCount", 0
            )
            if type(input_tokens) is not int or type(output_tokens) is not int:
                raise ValueError()
            budget.record(input_tokens, output_tokens)
            candidate = result["candidates"][0]
            if candidate["finishReason"] != "STOP":
                raise ValueError()
            parts = candidate["content"]["parts"]
            # Gemini 3 can attach opaque metadata to ordinary answer text.
            # Calls are independent in D1: discard it, never persist or expose it.
            if any(set(part) - {"text", "thoughtSignature"} for part in parts):
                raise ValueError()
            text = "".join(part["text"] for part in parts)
            parsed = schema.model_validate_json(text)
            self.model_version = result.get("modelVersion")
            return parsed
        except (KeyError, IndexError, TypeError, ValueError, ValidationError):
            raise DependencyError("AI_PROTOCOL_ERROR") from None
