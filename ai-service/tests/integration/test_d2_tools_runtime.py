"""Integration tests for D2 start/tool_calls/resume boundary and deterministic rendering."""

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

TOKEN = "test-service-d2"


class D2FakeProvider:
    """Labeled test-only provider supporting TurnPlan + D1 CandidateDraft."""

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
def d2_index(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", date(2026, 11, 25), tmp_path)
    return KnowledgeIndex(path, "demo_synthetic", date(2026, 11, 25), tmp_path)


def _start_payload(message: str, **overrides):
    data = {
        "phase": "start",
        "requestId": "d2-req-1",
        "conversationId": str(uuid4()),
        "turnId": str(uuid4()),
        "message": message,
        "history": [],
        "allowedTools": ["search_knowledge", "search_rooms", "list_services"],
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
    data.update(overrides)
    return data


def _headers(request_id="d2-req-1"):
    return {"Authorization": f"Bearer {TOKEN}", "X-Request-ID": request_id}


def _client(d2_index, plan: TurnPlan):
    provider = D2FakeProvider(plan)
    settings = Settings(_env_file=None, service_token=TOKEN, corpus_mode="demo_synthetic")
    app = create_app(
        settings,
        faq=Faq(provider, d2_index, "demo_synthetic", verification_gate=gate_for(d2_index)),
    )
    return TestClient(app), provider


def test_search_rooms_start_resume_and_replay_protection(d2_index):
    plan = TurnPlan(
        intent="search_rooms",
        query="Tìm phòng 2 khách từ 2026-12-01 đến 2026-12-03",
        checkInDate="2026-12-01",
        checkOutDate="2026-12-03",
        guestCount=2,
        sortBy="PRICE_ASC",
    )
    client, provider = _client(d2_index, plan)
    start = _start_payload("Còn phòng 2 người từ 1/12 đến 3/12 không?")

    with client:
        first = client.post("/internal/assistant/turn", json=start, headers=_headers())
        assert first.status_code == 200
        body = first.json()
        assert body["kind"] == "tool_calls"
        assert "final" not in body
        assert body["continuationId"] is not None
        assert len(body["toolCalls"]) == 1
        call = body["toolCalls"][0]
        assert call["name"] == "search_rooms"
        assert call["arguments"] == {
            "checkInDate": "2026-12-01",
            "checkOutDate": "2026-12-03",
            "guestCount": 2,
            "sortBy": "PRICE_ASC",
            "limit": 5,
        }
        assert body["usage"] == {
            "toolCallsUsed": 0,
            "brokerBatchesUsed": 0,
            "inputTokensUsed": 25,
            "outputTokensUsed": 15,
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
                    "name": "search_rooms",
                    "status": "ok",
                    "data": {
                        "items": [
                            {
                                "roomId": 101,
                                "roomTypeId": 1,
                                "typeName": "Deluxe Sea View",
                                "capacity": 2,
                                "amenities": "Wi-Fi, Ban công",
                                "description": "Hướng biển",
                                "checkInDate": "2026-12-01",
                                "checkOutDate": "2026-12-03",
                                "nights": 2,
                                "pricePerNight": "1500000",
                                "totalRoomCharge": "3000000",
                                "depositPercentage": 30,
                                "estimatedDeposit": "900000",
                                "currency": "VND",
                                "priceScope": "room_charge_estimate",
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
        final_body = second.json()
        assert final_body["kind"] == "final"
        assert final_body["continuationId"] is None
        assert final_body["toolCalls"] == []
        assert final_body["final"]["status"] == "answered"
        assert final_body["final"]["citations"] == []
        assert final_body["final"]["cards"] == []
        assert final_body["final"]["actions"][0]["type"] == "open_room_search"
        answer = final_body["final"]["answer"]
        assert "Deluxe Sea View" in answer
        assert "1.500.000 VND" in answer
        assert "3.000.000 VND" in answer
        assert "900.000 VND" in answer
        assert "room_charge_estimate" in answer
        assert "còn thêm phòng trống" in answer.lower()
        # Deterministic resume uses 0 additional LLM calls.
        assert len(provider.calls) == 1
        assert final_body["usage"] == {
            "toolCallsUsed": 0,
            "brokerBatchesUsed": 0,
            "inputTokensUsed": 0,
            "outputTokensUsed": 0,
        }

        # Replay of the same continuationId MUST return 409.
        replay = client.post("/internal/assistant/turn", json=resume, headers=_headers())
        assert replay.status_code == 409
        assert replay.json()["error"]["code"] == "CONTINUATION_NOT_FOUND"


def test_search_rooms_missing_dates_asks_clarification_without_tool_call(d2_index):
    plan = TurnPlan(intent="search_rooms", query="Giá phòng bao nhiêu?")
    client, provider = _client(d2_index, plan)
    with client:
        res = client.post(
            "/internal/assistant/turn",
            json=_start_payload("Giá phòng bao nhiêu?"),
            headers=_headers(),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["kind"] == "final"
        assert body["final"]["status"] == "needs_clarification"
        assert body["final"]["missingFields"] == ["checkInDate", "checkOutDate", "guestCount"]
        assert body["final"]["actions"][0]["type"] == "open_room_search"
        assert len(provider.calls) == 1


def test_list_services_answered_and_no_results(d2_index):
    plan = TurnPlan(intent="list_services", query="Khách sạn có những dịch vụ gì?", limit=5)
    client, _ = _client(d2_index, plan)
    start = _start_payload("Khách sạn có dịch vụ gì?")

    with client:
        first = client.post("/internal/assistant/turn", json=start, headers=_headers())
        assert first.status_code == 200
        body = first.json()
        call = body["toolCalls"][0]
        assert call["name"] == "list_services"

        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": body["continuationId"],
            "toolResults": [
                {
                    "callId": call["callId"],
                    "name": "list_services",
                    "status": "ok",
                    "data": {
                        "items": [
                            {
                                "serviceId": 1,
                                "categoryName": "Spa",
                                "serviceName": "Massage thư giãn",
                                "unitPrice": "450000",
                                "unit": "Lần",
                                "isActive": True,
                                "currency": "VND",
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
                "remainingInputTokens": 7975,
                "remainingOutputTokens": 1985,
            },
        }
        second = client.post("/internal/assistant/turn", json=resume, headers=_headers())
        assert second.status_code == 200
        final = second.json()["final"]
        assert final["status"] == "answered"
        assert "Massage thư giãn" in final["answer"]
        assert "450.000 VND" in final["answer"]
        assert final["actions"][0]["type"] == "open_services"

        # Empty items -> no_results
        start2 = _start_payload("Dịch vụ khác?", requestId="d2-req-2")
        first2 = client.post("/internal/assistant/turn", json=start2, headers=_headers("d2-req-2"))
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
                    "name": "list_services",
                    "status": "ok",
                    "data": {"items": [], "hasMore": False},
                    "error": None,
                }
            ],
            "budget": resume["budget"],
        }
        second2 = client.post(
            "/internal/assistant/turn", json=resume2, headers=_headers("d2-req-2")
        )
        assert second2.status_code == 200
        assert second2.json()["final"]["status"] == "no_results"


def test_resume_data_unavailable_returns_503_without_latching_readiness(d2_index):
    plan = TurnPlan(intent="list_services", query="Dịch vụ")
    client, _ = _client(d2_index, plan)
    start = _start_payload("Dịch vụ")
    with client:
        first = client.post("/internal/assistant/turn", json=start, headers=_headers())
        body = first.json()
        resume = {
            "phase": "resume",
            "requestId": start["requestId"],
            "conversationId": start["conversationId"],
            "turnId": start["turnId"],
            "continuationId": body["continuationId"],
            "toolResults": [
                {
                    "callId": body["toolCalls"][0]["callId"],
                    "name": "list_services",
                    "status": "error",
                    "data": None,
                    "error": {
                        "code": "DATA_UNAVAILABLE",
                        "message": "Thiếu dữ liệu giá dịch vụ.",
                    },
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
        res = client.post("/internal/assistant/turn", json=resume, headers=_headers())
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "DATA_UNAVAILABLE"
        # Business data failure must NOT poison AI readiness.
        assert client.get("/ready").status_code == 200


def test_d2_faq_still_uses_d1_verification_gate(d2_index):
    plan = TurnPlan(intent="faq", query="wifi")
    client, provider = _client(d2_index, plan)
    with client:
        res = client.post(
            "/internal/assistant/turn",
            json=_start_payload("Wi-Fi ở đâu?"),
            headers=_headers(),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["kind"] == "final"
        assert body["final"]["status"] == "answered"
        assert body["final"]["answer"] == "Trong demo, Wi-Fi có tại sảnh."
        assert len(body["final"]["citations"]) == 1
        assert len(provider.calls) == 2


def test_d2_budget_exceeded_when_no_broker_batches_left(d2_index):
    plan = TurnPlan(intent="list_services", query="Dịch vụ")
    client, _ = _client(d2_index, plan)
    start = _start_payload(
        "Dịch vụ",
        budget={
            "remainingToolCalls": 4,
            "remainingBrokerBatches": 0,
            "remainingMs": 20000,
            "remainingInputTokens": 8000,
            "remainingOutputTokens": 2000,
        },
    )
    with client:
        res = client.post("/internal/assistant/turn", json=start, headers=_headers())
        assert res.status_code == 503
        assert res.json()["error"]["code"] == "BUDGET_EXCEEDED"
