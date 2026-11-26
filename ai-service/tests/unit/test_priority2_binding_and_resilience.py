"""Offline tests for Priority 2: QuestionBinding natural phrasing & Gemini bounded transient retry."""

import asyncio
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest
from pydantic import BaseModel, ConfigDict, ValidationError

from app.orchestration.verification.questions import bind_question
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.schemas.verification import CatalogData
from app.settings import Settings

V5_CATALOG = (
    Path(__file__).resolve().parents[2]
    / ".local/grounding/demo_synthetic/academic-policies-2026-11-26-v5/catalog.json"
)


class _Answer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    answer: str


def _ok_body():
    return {
        "candidates": [
            {
                "finishReason": "STOP",
                "content": {"parts": [{"text": '{"answer":"ok"}'}]},
            }
        ],
        "usageMetadata": {"promptTokenCount": 12, "candidatesTokenCount": 4},
    }


def _load_v5_catalog():
    if not V5_CATALOG.is_file():
        pytest.skip("Local v5 catalog artifact not built")
    return SimpleNamespace(data=CatalogData.model_validate_json(V5_CATALOG.read_text("utf-8")))


@pytest.mark.parametrize(
    ("question", "expected_key"),
    [
        ("Giờ nhận phòng và trả phòng của khách sạn là mấy giờ?", "q-pol02-standard-hours"),
        (
            "Giờ nhận phòng và trả phòng ở Azure Bay tiêu chuẩn là mấy giờ?",
            "q-pol02-standard-hours",
        ),
        ("Nhận phòng lúc mấy giờ, trả phòng lúc mấy giờ?", "q-pol02-standard-hours"),
        ("Hủy phòng thì được hoàn cọc bao nhiêu?", "q-pol04-cancellation"),
        ("Hủy đặt phòng trước 3 ngày có được hoàn 100% cọc không?", "q-pol04-cancellation"),
        ("Hủy đơn thì có bị mất cọc không?", "q-pol04-cancellation"),
        (
            "Đơn BK-CUSTOMER1-DEMO của tôi nếu hủy phòng áp dụng chính sách hoàn cọc thế nào?",
            "q-pol04-cancellation",
        ),
        ("Đặt phòng phải cọc bao nhiêu %?", "q-pol03-deposit-rate"),
        ("Trả phòng muộn lúc 15h có tính phí không?", "q-pol02-late-checkout"),
    ],
)
def test_v5_natural_phrasings_bind_cleanly(question, expected_key):
    catalog = _load_v5_catalog()
    result = bind_question(catalog, question)
    assert result.status == "bound", f"Expected bound for {question!r}, got {result}"
    assert result.key == expected_key


@pytest.mark.parametrize(
    "question",
    [
        "Khách sạn có cho mang thú cưng và có hồ bơi không?",
        "Giờ nhận phòng mấy giờ và Wi-Fi ở đâu?",
        "Chính sách hủy phòng thế nào và có bãi đỗ xe không?",
        "Giờ nhận phòng và trả phòng của khách sạn mấy giờ và Wi-Fi ở đâu?",
    ],
)
def test_v5_adversarial_compound_questions_remain_fail_closed(question):
    catalog = _load_v5_catalog()
    result = bind_question(catalog, question)
    assert result.status == "unknown"
    assert result.reason == "compound_question_uncovered"


def test_gemini_default_zero_retries_never_retries_503_or_429():
    for status_code in (503, 429):
        calls = []

        def handler(request, code=status_code):
            calls.append(request.url.path)
            if request.url.path.endswith(":countTokens"):
                return httpx.Response(200, json={"totalTokens": 12})
            return httpx.Response(code, text="upstream busy")

        async def run():
            client = Gemini("test-key", "gemini-3.6-flash", httpx.MockTransport(handler))
            try:
                with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
                    await client.generate("sys", {}, _Answer, TurnBudget())
            finally:
                await client.close()

        asyncio.run(run())
        assert calls == [
            "/v1beta/models/gemini-3.6-flash:countTokens",
            "/v1beta/models/gemini-3.6-flash:generateContent",
        ]


def test_gemini_bounded_retry_recovers_from_transient_503_within_budget():
    attempts = {"gen": 0}
    slept: list[float] = []

    async def fake_sleep(seconds: float):
        slept.append(seconds)

    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        attempts["gen"] += 1
        if attempts["gen"] == 1:
            return httpx.Response(503, text="temporarily unavailable")
        return httpx.Response(200, json=_ok_body())

    async def run():
        client = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler),
            transient_retries=1,
            retry_backoff_ms=400,
            sleep=fake_sleep,
        )
        budget = TurnBudget(remaining_ms=10000)
        try:
            result = await client.generate("sys", {"q": "demo"}, _Answer, budget)
            assert result.answer == "ok"
            assert budget.calls == 1
        finally:
            await client.close()

    asyncio.run(run())
    assert attempts["gen"] == 2
    assert slept == [0.4]


def test_gemini_bounded_retry_respects_retry_after_on_429():
    attempts = {"gen": 0}
    slept: list[float] = []

    async def fake_sleep(seconds: float):
        slept.append(seconds)

    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        attempts["gen"] += 1
        if attempts["gen"] == 1:
            return httpx.Response(429, headers={"Retry-After": "1"}, text="rate limited")
        return httpx.Response(200, json=_ok_body())

    async def run():
        client = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler),
            transient_retries=1,
            retry_backoff_ms=400,
            sleep=fake_sleep,
        )
        try:
            result = await client.generate("sys", {}, _Answer, TurnBudget(remaining_ms=10000))
            assert result.answer == "ok"
        finally:
            await client.close()

    asyncio.run(run())
    assert attempts["gen"] == 2
    assert slept == [1.0]


def test_gemini_bounded_retry_fails_fast_when_retry_after_or_budget_insufficient():
    slept: list[float] = []

    async def fake_sleep(seconds: float):
        slept.append(seconds)

    def handler_long_retry_after(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        return httpx.Response(429, headers={"Retry-After": "30"}, text="quota exhausted")

    def handler_503(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        return httpx.Response(503, text="busy")

    async def run():
        c1 = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler_long_retry_after),
            transient_retries=1,
            retry_backoff_ms=400,
            sleep=fake_sleep,
        )
        c2 = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler_503),
            transient_retries=1,
            retry_backoff_ms=400,
            sleep=fake_sleep,
        )
        try:
            with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
                await c1.generate("sys", {}, _Answer, TurnBudget(remaining_ms=15000))
            # Only 900ms remaining: 400ms backoff + 1000ms safety margin > 900ms -> fail fast.
            with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
                await c2.generate("sys", {}, _Answer, TurnBudget(remaining_ms=900))
        finally:
            await c1.close()
            await c2.close()

    asyncio.run(run())
    assert slept == []


@pytest.mark.parametrize("status_code", [400, 401, 403, 404])
def test_gemini_never_retries_non_transient_http_statuses(status_code):
    attempts = {"gen": 0}
    slept: list[float] = []

    async def fake_sleep(seconds: float):
        slept.append(seconds)

    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        attempts["gen"] += 1
        return httpx.Response(status_code, text="client error")

    async def run():
        client = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler),
            transient_retries=2,
            retry_backoff_ms=200,
            sleep=fake_sleep,
        )
        try:
            with pytest.raises(DependencyError, match="DEPENDENCY_UNAVAILABLE"):
                await client.generate("sys", {}, _Answer, TurnBudget(remaining_ms=10000))
        finally:
            await client.close()

    asyncio.run(run())
    assert attempts["gen"] == 1
    assert slept == []


def test_gemini_rejects_invalid_retry_configuration():
    with pytest.raises(DependencyError, match="AI_NOT_CONFIGURED"):
        Gemini("test-key", "gemini-3.6-flash", transient_retries=3)
    with pytest.raises(DependencyError, match="AI_NOT_CONFIGURED"):
        Gemini("test-key", "gemini-3.6-flash", retry_backoff_ms=6000)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, GEMINI_TRANSIENT_RETRIES=5)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, GEMINI_RETRY_BACKOFF_MS=9999)


def test_transient_retry_logs_http_status_category_not_unexpected(caplog):
    import json
    import logging

    attempts = {"gen": 0}

    async def fake_sleep(_seconds: float):
        return None

    def handler(request):
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 12})
        attempts["gen"] += 1
        if attempts["gen"] == 1:
            return httpx.Response(503, text="busy")
        return httpx.Response(200, json=_ok_body())

    async def run():
        client = Gemini(
            "test-key",
            "gemini-3.6-flash",
            httpx.MockTransport(handler),
            transient_retries=1,
            retry_backoff_ms=100,
            sleep=fake_sleep,
        )
        try:
            assert (await client.generate("sys", {}, _Answer, TurnBudget())).answer == "ok"
        finally:
            await client.close()

    diag_logger = logging.getLogger("ai_service.diagnostics")
    prev_propagate = diag_logger.propagate
    diag_logger.propagate = True
    try:
        with caplog.at_level(logging.INFO, logger="ai_service.diagnostics"):
            asyncio.run(run())
    finally:
        diag_logger.propagate = prev_propagate

    events = [
        json.loads(rec.getMessage())
        for rec in caplog.records
        if rec.name == "ai_service.diagnostics"
    ]
    failed_gen = [
        e for e in events if e.get("phase") == "generateContent" and e.get("outcome") == "error"
    ]
    assert len(failed_gen) == 1
    assert failed_gen[0]["http_status"] == 503
    assert failed_gen[0]["error_category"] == "http_status"


def test_merge_retrieval_query_preserves_domain_terms_and_deduplicates():
    from app.orchestration.faq import _merge_retrieval_query

    merged = _merge_retrieval_query(
        "tinh tien coc giam gia",
        "Gia su G=2.000.000, A_room=360.000, A_other=100.000 tinh coc the nao?",
    )
    assert "tinh tien coc giam gia" in merged
    assert "A_room" in merged and "A_other" in merged
    assert _merge_retrieval_query("nonexistent-xyz", "Wi-Fi o dau?") == "nonexistent-xyz"
    assert _merge_retrieval_query("", "chinh sach huy phong") == "chinh sach huy phong"
