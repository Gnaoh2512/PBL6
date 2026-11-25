"""Integration tests for D3 personal booking tools (requires_login, list_my_bookings, get_my_booking)."""

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

TOKEN = "test-service-d3"


class D3FakeProvider:
    def __init__(self, plan: TurnPlan):
        self.plan = plan
        self.calls: list[tuple[type, dict]] = []

    async def generate(self, system, data, schema, budget):
        self.calls.append((schema, data))
        budget.reserve(25)
        budget.record(25, 15)
        if schema is TurnPlan:
            return self.plan
        return CandidateDraft.model_validate_json(
            json.dumps(proposal(data["evidence"][0]["citationId"], supported=True))
        )


@pytest.fixture
def d3_index(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", date(2026, 11, 25), tmp_path)
    return KnowledgeIndex(path, "demo_synthetic", date(2026, 11, 25), tmp_path)


def _start_payload(message: str, allowed_tools: list[str], request_id: str = "d3-req-1"):
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
            "remainingToolCalls": 4,
            "remainingBrokerBatches": 2,
            "remainingMs": 20000,
            "remainingInputTokens": 8000,
            "remainingOutputTokens": 2000,
        },
    }


def _headers(request_id: str = "d3-req-1"):
    return {"Authorization": f"Bearer {TOKEN}", "X-Request-ID": request_id}


def _client(d3_index, plan: TurnPlan):
    provider = D3FakeProvider(plan)
    settings = Settings(_env_file=None, service_token=TOKEN, corpus_mode="demo_synthetic")
    app = create_app(
        settings,
        faq=Faq(provider, d3_index, "demo_synthetic", verification_gate=gate_for(d3_index)),
    )
    return TestClient(app), provider


@pytest.mark.parametrize(
    "plan",
    [
        TurnPlan(intent="list_my_bookings", query="Xem booking của tôi"),
        TurnPlan(
            intent="get_my_booking", query="Đơn BK-CUSTOMER1-DEMO", bookingCode="BK-CUSTOMER1-DEMO"
        ),
    ],
)
def test_guest_asking_personal_booking_returns_requires_login_with_open_login(d3_index, plan):
    client, provider = _client(d3_index, plan)
    guest_tools = ["search_knowledge", "search_rooms", "list_services"]
    with client:
        res = client.post(
            "/internal/assistant/turn",
            json=_start_payload("Booking của tôi?", guest_tools),
            headers=_headers(),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["kind"] == "final"
        assert body["final"]["status"] == "requires_login"
        assert body["final"]["actions"][0]["type"] == "open_login"
        assert "điện thoại" not in body["final"]["answer"].lower()
        assert len(provider.calls) == 1


def test_list_my_bookings_start_resume_and_empty_state(d3_index):
    plan = TurnPlan(
        intent="list_my_bookings",
        query="Đơn đang lưu trú của tôi",
        bookingStatus="CHECKED_IN",
        limit=5,
    )
    client, provider = _client(d3_index, plan)
    customer_tools = [
        "search_knowledge",
        "search_rooms",
        "list_services",
        "list_my_bookings",
        "get_my_booking",
    ]
    start = _start_payload("Tôi có đơn nào đang check-in?", customer_tools)
    with client:
        first = client.post("/internal/assistant/turn", json=start, headers=_headers())
        assert first.status_code == 200
        body = first.json()
        assert body["kind"] == "tool_calls"
        call = body["toolCalls"][0]
        assert call["name"] == "list_my_bookings"
        assert call["arguments"] == {"status": "CHECKED_IN", "limit": 5}

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
                                "bookingStatus": "CHECKED_IN",
                                "roomTypeName": "Phòng Standard",
                                "checkInDate": "2026-11-24",
                                "checkOutDate": "2026-11-27",
                                "nights": 3,
                                "guestCount": 2,
                            }
                        ],
                        "hasMore": True,
                    },
                    "error": None,
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 7975,
                "remainingOutputTokens": 1985,
            },
        }
        second = client.post("/internal/assistant/turn", json=resume, headers=_headers())
        assert second.status_code == 200
        final = second.json()["final"]
        assert final["status"] == "answered"
        assert "BK-CUSTOMER1-DEMO" in final["answer"]
        assert "Đang lưu trú" in final["answer"]
        assert "Phòng Standard" in final["answer"]
        assert "cũ hơn" in final["answer"].lower()
        assert len(provider.calls) == 1


def test_get_my_booking_financials_not_found_and_validation(d3_index):
    customer_tools = [
        "search_knowledge",
        "search_rooms",
        "list_services",
        "list_my_bookings",
        "get_my_booking",
    ]
    plan = TurnPlan(
        intent="get_my_booking",
        query="Đơn BK-CUSTOMER1-DEMO còn phải trả bao nhiêu?",
        bookingCode="BK-CUSTOMER1-DEMO",
        includeFinancials=True,
    )
    client, _ = _client(d3_index, plan)
    start = _start_payload("Đơn BK-CUSTOMER1-DEMO còn nợ bao nhiêu?", customer_tools)
    with client:
        first = client.post("/internal/assistant/turn", json=start, headers=_headers())
        body = first.json()
        call = body["toolCalls"][0]
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
            "continuationId": body["continuationId"],
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
                "remainingInputTokens": 7975,
                "remainingOutputTokens": 1985,
            },
        }
        second = client.post("/internal/assistant/turn", json=resume, headers=_headers())
        assert second.status_code == 200
        answer = second.json()["final"]["answer"]
        assert "450.000 VND" in answer
        assert "1.650.000 VND" in answer
        assert "1.200.000 VND" in answer

        # Foreign or missing booking returns unified no_results
        start2 = _start_payload("Đơn BK-OTHER", customer_tools, request_id="d3-req-2")
        first2 = client.post("/internal/assistant/turn", json=start2, headers=_headers("d3-req-2"))
        body2 = first2.json()
        resume2 = {
            "phase": "resume",
            "requestId": start2["requestId"],
            "conversationId": start2["conversationId"],
            "turnId": start2["turnId"],
            "continuationId": body2["continuationId"],
            "toolResults": [
                {
                    "callId": body2["toolCalls"][0]["callId"],
                    "name": "get_my_booking",
                    "status": "error",
                    "data": None,
                    "error": {
                        "code": "NOT_FOUND",
                        "message": "Không tìm thấy đơn đặt phòng phù hợp trong tài khoản của bạn.",
                    },
                }
            ],
            "budget": resume["budget"],
        }
        second2 = client.post(
            "/internal/assistant/turn", json=resume2, headers=_headers("d3-req-2")
        )
        assert second2.status_code == 200
        assert second2.json()["final"]["status"] == "no_results"

    # Invalid bookingCode triggers needs_clarification without mutating or calling broker
    bad_client, _ = _client(
        d3_index,
        TurnPlan(intent="get_my_booking", query="Đơn sai", bookingCode="BK 123; DROP TABLE"),
    )
    with bad_client:
        res = bad_client.post(
            "/internal/assistant/turn",
            json=_start_payload("Xem đơn BK 123; DROP TABLE", customer_tools),
            headers=_headers(),
        )
        assert res.status_code == 200
        assert res.json()["final"]["status"] == "needs_clarification"
        assert res.json()["final"]["missingFields"] == ["bookingCode"]
