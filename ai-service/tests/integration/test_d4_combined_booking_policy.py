"""Integration tests for D4 combined personal booking + verified policy orchestration."""

import json
import shutil
from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from grounding_support import gate_for, proposal

from app.ingestion.snapshot import ROOT, build
from app.main import create_app
from app.orchestration.faq import Faq
from app.retrieval.index import KnowledgeIndex
from app.schemas.verification import CandidateDraft
from app.settings import Settings
from app.tools.schemas import TurnPlan

TOKEN = "d4-combined-secret"
CUSTOMER_TOOLS = [
    "search_knowledge",
    "search_rooms",
    "list_services",
    "list_my_bookings",
    "get_my_booking",
]
GUEST_TOOLS = ["search_knowledge", "search_rooms", "list_services"]


def _settings() -> Settings:
    return Settings(
        AI_SERVICE_AUTH_TOKEN=TOKEN,
        AI_CORPUS_MODE="demo_synthetic",
        GEMINI_API_KEY="test-key",
    )


def _headers(request_id: str = "d4-req-1") -> dict[str, str]:
    return {"Authorization": f"Bearer {TOKEN}", "X-Request-ID": request_id}


def _start_payload(
    message: str,
    allowed_tools: list[str],
    *,
    request_id: str = "d4-req-1",
    remaining_tool_calls: int = 4,
) -> dict:
    return {
        "phase": "start",
        "requestId": request_id,
        "conversationId": str(uuid4()),
        "turnId": str(uuid4()),
        "message": message,
        "history": [],
        "allowedTools": allowed_tools,
        "context": {
            "locale": "vi-VN",
            "timeZone": "Asia/Ho_Chi_Minh",
            "today": "2026-11-25",
            "currency": "VND",
        },
        "budget": {
            "remainingToolCalls": remaining_tool_calls,
            "remainingBrokerBatches": 2,
            "remainingMs": 20000,
            "remainingInputTokens": 8000,
            "remainingOutputTokens": 2000,
        },
    }


class _D4FakeProvider:
    def __init__(self, plans: list[TurnPlan]):
        self._plans = list(plans)
        self.calls: list[tuple[type, dict]] = []

    async def probe(self, _budget):
        return None

    async def generate(self, _instruction, content, schema, budget):
        self.calls.append((schema, content))
        budget.reserve(40)
        budget.record(40, 20)
        if schema is TurnPlan:
            assert self._plans, "Unexpected extra TurnPlan call"
            return self._plans.pop(0)
        return CandidateDraft.model_validate_json(
            json.dumps(proposal(content["evidence"][0]["citationId"], supported=True))
        )


@pytest.fixture
def d4_index(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", date(2026, 11, 25), tmp_path)
    return KnowledgeIndex(path, "demo_synthetic", date(2026, 11, 25), tmp_path)


def _build_app(d4_index, plans: list[TurnPlan]):
    gate = gate_for(d4_index)
    provider = _D4FakeProvider(plans)
    faq = Faq(provider, d4_index, "demo_synthetic", verification_gate=gate)
    return create_app(_settings(), faq=faq), provider


def test_guest_combined_booking_policy_requires_login_without_retrieval(d4_index):
    plan = TurnPlan(
        intent="booking_with_policy",
        query="hủy đơn BK-CUSTOMER1-DEMO",
        policyQuery="wifi",
        bookingCode="BK-CUSTOMER1-DEMO",
        includeFinancials=True,
    )
    app, provider = _build_app(d4_index, [plan])
    with TestClient(app) as client:
        resp = client.post(
            "/internal/assistant/turn",
            json=_start_payload(
                "Wi-Fi ở đâu?",
                GUEST_TOOLS,
                request_id="d4-guest-1",
            ),
            headers=_headers("d4-guest-1"),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["kind"] == "final"
        assert body["final"]["status"] == "requires_login"
        assert body["final"]["citations"] == []
        assert body["final"]["actions"][0]["type"] == "open_login"
        assert len(provider.calls) == 1


def test_customer_combined_get_my_booking_and_verified_policy_round_trip(d4_index):
    plan = TurnPlan(
        intent="booking_with_policy",
        query="đơn BK-CUSTOMER1-DEMO wifi",
        policyQuery="wifi",
        bookingCode="BK-CUSTOMER1-DEMO",
        includeFinancials=True,
    )
    app, provider = _build_app(d4_index, [plan])
    with TestClient(app) as client:
        start = _start_payload(
            "Wi-Fi ở đâu?",
            CUSTOMER_TOOLS,
            request_id="d4-comb-1",
        )
        first = client.post("/internal/assistant/turn", json=start, headers=_headers("d4-comb-1"))
        assert first.status_code == 200
        first_body = first.json()
        assert first_body["kind"] == "tool_calls"
        assert first_body["continuationId"] is not None
        call = first_body["toolCalls"][0]
        assert call["name"] == "get_my_booking"
        assert call["arguments"] == {
            "bookingCode": "BK-CUSTOMER1-DEMO",
            "includeFinancials": True,
        }

        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": first_body["continuationId"],
            "toolResults": [
                {
                    "callId": call["callId"],
                    "name": "get_my_booking",
                    "status": "ok",
                    "data": {
                        "bookingCode": "BK-CUSTOMER1-DEMO",
                        "bookingStatus": "CHECKED_IN",
                        "roomTypeName": "Phòng Standard",
                        "checkInDate": "2026-11-24",
                        "checkOutDate": "2026-11-27",
                        "nights": 3,
                        "guestCount": 2,
                        "depositRequired": "450000",
                        "depositPaid": "450000",
                        "totalAmount": "1650000",
                        "remainingBalance": "1200000",
                        "currency": "VND",
                    },
                    "error": None,
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7900,
                "remainingOutputTokens": 1900,
            },
        }
        second = client.post("/internal/assistant/turn", json=resume, headers=_headers("d4-comb-1"))
        assert second.status_code == 200
        final_body = second.json()
        assert final_body["kind"] == "final"
        assert final_body["final"]["status"] == "answered"
        assert final_body["final"]["cards"] == []
        assert len(final_body["final"]["citations"]) == 1
        assert len(final_body["evidence"]) >= 1
        assert final_body["usage"]["toolCallsUsed"] == 1
        assert final_body["usage"]["brokerBatchesUsed"] == 0

        answer = final_body["final"]["answer"]
        assert "BK-CUSTOMER1-DEMO" in answer
        assert "Đang lưu trú" in answer
        assert "CHECKED_IN" not in answer
        assert "450.000 VND" in answer
        assert "1.200.000 VND" in answer
        assert "Chính sách áp dụng từ nguồn đã duyệt:" in answer
        assert "không tự tính khoản hoàn tiền" in answer.lower()
        assert len(provider.calls) == 2

        # Single-use continuation replay MUST return 409.
        replay = client.post("/internal/assistant/turn", json=resume, headers=_headers("d4-comb-1"))
        assert replay.status_code == 409
        assert replay.json()["error"]["code"] == "CONTINUATION_NOT_FOUND"


def test_customer_combined_list_my_bookings_and_verified_policy_round_trip(d4_index):
    plan = TurnPlan(
        intent="booking_with_policy",
        query="đơn của tôi wifi",
        policyQuery="wifi",
    )
    app, provider = _build_app(d4_index, [plan])
    with TestClient(app) as client:
        start = _start_payload(
            "Wi-Fi ở đâu?",
            CUSTOMER_TOOLS,
            request_id="d4-list-1",
        )
        first = client.post("/internal/assistant/turn", json=start, headers=_headers("d4-list-1"))
        body = first.json()
        call = body["toolCalls"][0]
        assert call["name"] == "list_my_bookings"
        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": body["continuationId"],
            "toolResults": [
                {
                    "callId": call["callId"],
                    "name": "list_my_bookings",
                    "status": "ok",
                    "data": {
                        "items": [
                            {
                                "bookingCode": "BK-CUSTOMER1-DEMO",
                                "bookingStatus": "CONFIRMED",
                                "roomTypeName": "Deluxe",
                                "checkInDate": "2026-12-10",
                                "checkOutDate": "2026-12-12",
                                "nights": 2,
                                "guestCount": 2,
                            }
                        ],
                        "hasMore": False,
                    },
                    "error": None,
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7900,
                "remainingOutputTokens": 1900,
            },
        }
        second = client.post("/internal/assistant/turn", json=resume, headers=_headers("d4-list-1"))
        assert second.status_code == 200
        final_body = second.json()
        assert final_body["final"]["status"] == "answered"
        assert len(final_body["final"]["citations"]) == 1
        assert "BK-CUSTOMER1-DEMO" in final_body["final"]["answer"]
        assert "không tự tính khoản hoàn tiền" in final_body["final"]["answer"].lower()
        assert len(provider.calls) == 2


def test_combined_foreign_booking_not_found_skips_policy_retrieval(d4_index):
    plan = TurnPlan(
        intent="booking_with_policy",
        query="đơn BK-FOREIGN wifi",
        policyQuery="wifi",
        bookingCode="BK-FOREIGN",
    )
    app, provider = _build_app(d4_index, [plan])
    with TestClient(app) as client:
        start = _start_payload(
            "Wi-Fi ở đâu?",
            CUSTOMER_TOOLS,
            request_id="d4-foreign-1",
        )
        first = client.post(
            "/internal/assistant/turn", json=start, headers=_headers("d4-foreign-1")
        )
        body = first.json()
        call = body["toolCalls"][0]
        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": body["continuationId"],
            "toolResults": [
                {
                    "callId": call["callId"],
                    "name": "get_my_booking",
                    "status": "error",
                    "data": None,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Không tìm thấy đơn đặt phòng phù hợp trong tài khoản của bạn.",
                    },
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7900,
                "remainingOutputTokens": 1900,
            },
        }
        second = client.post(
            "/internal/assistant/turn", json=resume, headers=_headers("d4-foreign-1")
        )
        assert second.status_code == 200
        final_body = second.json()
        assert final_body["final"]["status"] == "no_results"
        assert final_body["final"]["citations"] == []
        assert final_body["evidence"] == []
        assert final_body["usage"]["toolCallsUsed"] == 0
        # Provider was only called once (start planner), never for policy generation.
        assert len(provider.calls) == 1


def test_combined_unbound_policy_fails_closed_to_insufficient_evidence(d4_index):
    plan = TurnPlan(
        intent="booking_with_policy",
        query="đơn BK-CUSTOMER1-DEMO vé máy bay",
        policyQuery="miễn phí vé máy bay",
        bookingCode="BK-CUSTOMER1-DEMO",
    )
    app, provider = _build_app(d4_index, [plan])
    with TestClient(app) as client:
        start = _start_payload(
            "Đơn BK-CUSTOMER1-DEMO có được miễn phí vé máy bay không?",
            CUSTOMER_TOOLS,
            request_id="d4-unbound-1",
        )
        first = client.post(
            "/internal/assistant/turn", json=start, headers=_headers("d4-unbound-1")
        )
        body = first.json()
        call = body["toolCalls"][0]
        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": body["continuationId"],
            "toolResults": [
                {
                    "callId": call["callId"],
                    "name": "get_my_booking",
                    "status": "ok",
                    "data": {
                        "bookingCode": "BK-CUSTOMER1-DEMO",
                        "bookingStatus": "CONFIRMED",
                        "roomTypeName": "Deluxe",
                        "checkInDate": "2026-12-10",
                        "checkOutDate": "2026-12-12",
                        "nights": 2,
                        "guestCount": 2,
                    },
                    "error": None,
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7900,
                "remainingOutputTokens": 1900,
            },
        }
        second = client.post(
            "/internal/assistant/turn", json=resume, headers=_headers("d4-unbound-1")
        )
        assert second.status_code == 200
        final_body = second.json()
        assert final_body["final"]["status"] == "insufficient_evidence"
        assert final_body["final"]["citations"] == []
        assert final_body["evidence"] == []
        assert "BK-CUSTOMER1-DEMO" in final_body["final"]["answer"]
        assert "Chưa có đủ nguồn chính sách đã duyệt" in final_body["final"]["answer"]
        assert len(provider.calls) == 1


def test_combined_list_my_bookings_empty_budget_and_malformed_code(d4_index):
    plans = [
        TurnPlan(intent="booking_with_policy", query="đơn của tôi wifi", policyQuery="wifi"),
        TurnPlan(intent="booking_with_policy", query="đơn của tôi wifi", policyQuery="wifi"),
        TurnPlan(
            intent="booking_with_policy",
            query="đơn xấu",
            policyQuery="wifi",
            bookingCode="BK BAD!@#",
        ),
    ]
    app, provider = _build_app(d4_index, plans)
    with TestClient(app) as client:
        # 1. Empty booking list skips policy retrieval -> no_results
        start1 = _start_payload("Wi-Fi ở đâu?", CUSTOMER_TOOLS, request_id="d4-empty-1")
        first1 = client.post(
            "/internal/assistant/turn", json=start1, headers=_headers("d4-empty-1")
        )
        body1 = first1.json()
        call1 = body1["toolCalls"][0]
        assert call1["name"] == "list_my_bookings"
        resume1 = {
            "phase": "resume",
            "requestId": start1["requestId"],
            "conversationId": start1["conversationId"],
            "turnId": start1["turnId"],
            "continuationId": body1["continuationId"],
            "toolResults": [
                {
                    "callId": call1["callId"],
                    "name": "list_my_bookings",
                    "status": "ok",
                    "data": {"items": [], "hasMore": False},
                    "error": None,
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7900,
                "remainingOutputTokens": 1900,
            },
        }
        second1 = client.post(
            "/internal/assistant/turn", json=resume1, headers=_headers("d4-empty-1")
        )
        assert second1.status_code == 200
        assert second1.json()["final"]["status"] == "no_results"
        assert second1.json()["usage"]["toolCallsUsed"] == 0

        # 2. remainingToolCalls=1 is insufficient for booking + search_knowledge -> 503 BUDGET_EXCEEDED
        start2 = _start_payload(
            "Wi-Fi ở đâu?",
            CUSTOMER_TOOLS,
            request_id="d4-budget-1",
            remaining_tool_calls=1,
        )
        resp2 = client.post(
            "/internal/assistant/turn", json=start2, headers=_headers("d4-budget-1")
        )
        assert resp2.status_code == 503
        assert resp2.json()["error"]["code"] == "BUDGET_EXCEEDED"

        # 3. Malformed booking code -> needs_clarification
        start3 = _start_payload("Đơn BK BAD!@#", CUSTOMER_TOOLS, request_id="d4-badcode-1")
        resp3 = client.post(
            "/internal/assistant/turn", json=start3, headers=_headers("d4-badcode-1")
        )
        assert resp3.status_code == 200
        assert resp3.json()["final"]["status"] == "needs_clarification"
        assert resp3.json()["final"]["missingFields"] == ["bookingCode"]
        assert len(provider.calls) == 3
