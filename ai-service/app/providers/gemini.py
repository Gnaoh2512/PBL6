"""Bounded Gemini REST adapter: no retries, tools, URL context or browser credentials."""

import asyncio
import json
import re

import httpx
from pydantic import BaseModel, ValidationError

from app.diagnostics import Category, Phase, category, context, step
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.http_timing import HttpTiming

_DROP_SCHEMA_KEYS = frozenset(
    {"$defs", "title", "pattern", "minLength", "maxLength", "discriminator", "format"}
)
_ALLOWED_THINKING_LEVELS = frozenset({"MINIMAL", "LOW", "MEDIUM", "HIGH"})
_TRANSIENT_HTTP_STATUSES = frozenset({429, 503})
_MAX_TRANSIENT_RETRIES = 2
_MAX_RETRY_BACKOFF_MS = 5000
_MIN_REMAINING_AFTER_BACKOFF_S = 1.0


class _TransientHttpError(DependencyError):
    def __init__(self, status_code: int, retry_after_s: float | None):
        self.status_code = status_code
        self.retry_after_s = retry_after_s
        super().__init__("DEPENDENCY_UNAVAILABLE", diagnostic_category=Category.HTTP_STATUS)


def _parse_retry_after_seconds(raw: str | None) -> float | None:
    """Parse numeric Retry-After seconds header; return None if missing or non-numeric."""
    if not raw:
        return None
    text = raw.strip()
    if not re.fullmatch(r"\d+(?:\.\d+)?", text):
        return None
    value = float(text)
    return value if value >= 0 else None


def _gemini_schema(node, *, defs=None, seen=(), root=True):
    """Translate Pydantic JSON Schema into a flat Gemini responseJsonSchema subset.

    Host-side Pydantic validation (`schema.model_validate_json`) still enforces every
    regex, length, format, and discriminated-union constraint strictly.
    """
    if isinstance(node, list):
        return [_gemini_schema(item, defs=defs, seen=seen, root=False) for item in node]
    if not isinstance(node, dict):
        return node
    defs = node.get("$defs", defs) or {}
    ref = node.get("$ref")
    if isinstance(ref, str) and ref.startswith("#/$defs/"):
        name = ref.removeprefix("#/$defs/")
        if name in defs and name not in seen:
            return _gemini_schema(defs[name], defs=defs, seen=(*seen, name), root=False)
    out = {}
    for key, value in node.items():
        if key in _DROP_SCHEMA_KEYS and not (root and key == "title"):
            continue
        if key == "const":
            out["enum"] = [value]
        elif key == "oneOf":
            out["anyOf"] = _gemini_schema(value, defs=defs, seen=seen, root=False)
        else:
            out[key] = _gemini_schema(value, defs=defs, seen=seen, root=False)
    return out


class Gemini:
    def __init__(
        self,
        key: str,
        model: str,
        transport=None,
        *,
        thinking_level: str | None = None,
        transient_retries: int = 0,
        retry_backoff_ms: int = 400,
        sleep=asyncio.sleep,
    ):
        if not key or not re.fullmatch(r"gemini-[a-z0-9.-]+", model) or "latest" in model:
            raise DependencyError("AI_NOT_CONFIGURED")
        if (
            type(transient_retries) is not int
            or not 0 <= transient_retries <= _MAX_TRANSIENT_RETRIES
            or type(retry_backoff_ms) is not int
            or not 0 <= retry_backoff_ms <= _MAX_RETRY_BACKOFF_MS
        ):
            raise DependencyError("AI_NOT_CONFIGURED")
        normalized_level = None
        if thinking_level is not None:
            candidate = thinking_level.strip().upper()
            if candidate not in _ALLOWED_THINKING_LEVELS:
                raise DependencyError("AI_NOT_CONFIGURED")
            normalized_level = candidate
        self.model = model
        self.thinking_level = normalized_level
        self.transient_retries = transient_retries
        self.retry_backoff_ms = retry_backoff_ms
        self._sleep = sleep
        self.model_version = None
        self.client = httpx.AsyncClient(
            base_url="https://generativelanguage.googleapis.com/v1beta/",
            headers={"x-goog-api-key": key},
            transport=transport,
            follow_redirects=False,
            trust_env=False,
            timeout=20,
            limits=httpx.Limits(max_connections=8),
        )

    async def close(self):
        await self.client.aclose()

    async def _post(self, method: str, body: dict, budget: TurnBudget):
        phase = Phase(method)
        for attempt in range(self.transient_retries + 1):
            can_retry = attempt < self.transient_retries
            try:
                with step(phase, provider_method=phase) as event:
                    with HttpTiming(phase, budget) as timing:
                        return await self._request(
                            method, body, budget, event, timing, allow_transient_retry=can_retry
                        )
            except _TransientHttpError as transient:
                remaining = budget.seconds()
                base_delay = (self.retry_backoff_ms / 1000.0) * (2**attempt)
                if transient.retry_after_s is not None:
                    if transient.retry_after_s > _MAX_RETRY_BACKOFF_MS / 1000.0:
                        raise DependencyError(diagnostic_category=Category.HTTP_STATUS) from None
                    delay_s = max(base_delay, transient.retry_after_s)
                else:
                    delay_s = base_delay
                if delay_s + _MIN_REMAINING_AFTER_BACKOFF_S >= remaining:
                    raise DependencyError(diagnostic_category=Category.HTTP_STATUS) from None
                if delay_s > 0:
                    try:
                        async with asyncio.timeout(budget.seconds()):
                            await self._sleep(delay_s)
                    except TimeoutError:
                        raise DependencyError(
                            "DEADLINE_EXCEEDED",
                            diagnostic_category=Category.APPLICATION_DEADLINE,
                        ) from None
        raise DependencyError(diagnostic_category=Category.HTTP_STATUS)

    async def _request(self, method, body, budget, event, timing, *, allow_transient_retry=False):
        timeout = None
        try:
            timeout = asyncio.timeout(budget.seconds())
            async with timeout:
                async with self.client.stream(
                    "POST",
                    f"models/{self.model}:{method}",
                    json=body,
                    extensions={"trace": timing.trace},
                ) as response:
                    event.http_status = response.status_code
                    timing.observe_httpx_response(response)
                    if response.status_code != 200:
                        if (
                            allow_transient_retry
                            and response.status_code in _TRANSIENT_HTTP_STATUSES
                        ):
                            retry_after = _parse_retry_after_seconds(
                                response.headers.get("Retry-After")
                            )
                            raise _TransientHttpError(response.status_code, retry_after)
                        raise DependencyError(diagnostic_category=Category.HTTP_STATUS)
                    chunks = bytearray()
                    async for chunk in response.aiter_bytes():
                        chunks.extend(chunk)
                        if len(chunks) > 256 * 1024:
                            raise DependencyError(
                                "AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SIZE
                            )
                    try:
                        parsed = json.loads(chunks)
                    except ValueError:
                        raise DependencyError(diagnostic_category=Category.JSON_DECODE) from None
                    if not isinstance(parsed, dict):
                        raise DependencyError(
                            "AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA
                        )
                    return parsed
        except httpx.TimeoutException as error:
            raise DependencyError(
                "DEADLINE_EXCEEDED", diagnostic_category=category(error)
            ) from None
        except TimeoutError:
            raise DependencyError(
                "DEADLINE_EXCEEDED",
                diagnostic_category=(
                    Category.APPLICATION_DEADLINE
                    if timeout is not None and timeout.expired()
                    else Category.UNEXPECTED
                ),
            ) from None
        except (httpx.HTTPError, ValueError) as error:
            raise DependencyError(diagnostic_category=category(error)) from None

    async def generate(
        self, system: str, data: dict, schema: type[BaseModel], budget: TurnBudget
    ) -> BaseModel:
        with context(budget=budget), step(Phase.APPLICATION):
            return await self._generate(system, data, schema, budget)

    async def _generate(self, system, data, schema, budget):
        budget.reserve(0)
        generation_config = {
            "responseMimeType": "application/json",
            "responseJsonSchema": _gemini_schema(schema.model_json_schema()),
            "maxOutputTokens": budget.output_limit - budget.output_used,
        }
        if self.thinking_level is not None:
            generation_config["thinkingConfig"] = {"thinkingLevel": self.thinking_level}
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [
                {"role": "user", "parts": [{"text": json.dumps(data, ensure_ascii=False)}]}
            ],
            "generationConfig": generation_config,
        }
        count = await self._post(
            "countTokens",
            {"generateContentRequest": {"model": f"models/{self.model}", **body}},
            budget,
        )
        with step(Phase.VALIDATE, http_status=200, provider_method=Phase.COUNT):
            tokens = count.get("totalTokens")
            if type(tokens) is not int:
                raise DependencyError(
                    "AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA
                )
        budget.reserve(tokens)
        result = await self._post("generateContent", body, budget)
        with step(Phase.VALIDATE, http_status=200, provider_method=Phase.GENERATE):
            return self._parse(result, schema, budget)

    def _parse(self, result, schema, budget):
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
            raise DependencyError(
                "AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA
            ) from None
