"""Offline tests for multi-intent compound turns: rooms_and_services & policy_and_rooms."""

import asyncio
from datetime import date
from uuid import uuid4

from verification_support import fixture

from app.orchestration.continuations import ContinuationStore
from app.orchestration.faq import Faq
from app.orchestration.tools import plan_business_turn, render_resume
from app.orchestration.verification import VerificationGate
from app.providers.contracts import TurnBudget
from app.schemas.turn import ResumeTurn, StartTurn
from app.tools.schemas import TurnPlan


def _start_payload(message: str, allowed=None):
    return StartTurn.model_validate(
        {
            "phase": "start",
            "requestId": "req-multi-1",
            "conversationId": str(uuid4()),
            "turnId": str(uuid4()),
            "message": message,
            "history": [],
            "allowedTools": allowed or ["search_knowledge", "search_rooms", "list_services"],
            "context": {
                "locale": "vi-VN",
                "timeZone": "Asia/Ho_Chi_Minh",
                "today": "2026-11-26",
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
    )


def test_rooms_and_services_with_dates_emits_two_tools_and_renders_both():
    store = ContinuationStore()
    payload = _start_payload("Tìm phòng trống 2 khách từ 2026-12-10 đến 2026-12-12 và giá dịch vụ")
    plan = TurnPlan(
        intent="rooms_and_services",
        query="phòng trống 2 khách 2026-12-10 đến 2026-12-12 và dịch vụ",
        checkInDate="2026-12-10",
        checkOutDate="2026-12-12",
        guestCount=2,
    )
    step1 = plan_business_turn(plan, payload, TurnBudget(), store, "demo_synthetic")
    assert step1["kind"] == "tool_calls"
    assert [c["name"] for c in step1["toolCalls"]] == ["search_rooms", "list_services"]

    resume_payload = ResumeTurn.model_validate(
        {
            "phase": "resume",
            "requestId": "req-multi-1",
            "conversationId": str(payload.conversationId),
            "turnId": str(payload.turnId),
            "continuationId": step1["continuationId"],
            "toolResults": [
                {
                    "callId": step1["toolCalls"][0]["callId"],
                    "name": "search_rooms",
                    "status": "ok",
                    "error": None,
                    "data": {
                        "hasMore": False,
                        "items": [
                            {
                                "roomId": 3,
                                "roomTypeId": 2,
                                "typeName": "Phòng Deluxe Hướng Biển",
                                "capacity": 2,
                                "amenities": "Wi-Fi, Ban công",
                                "description": "Hướng biển",
                                "checkInDate": "2026-12-10",
                                "checkOutDate": "2026-12-12",
                                "nights": 2,
                                "pricePerNight": "850000",
                                "totalRoomCharge": "1700000",
                                "depositPercentage": 30,
                                "estimatedDeposit": "510000",
                                "currency": "VND",
                                "priceScope": "room_charge_estimate",
                            }
                        ],
                    },
                },
                {
                    "callId": step1["toolCalls"][1]["callId"],
                    "name": "list_services",
                    "status": "ok",
                    "error": None,
                    "data": {
                        "hasMore": False,
                        "items": [
                            {
                                "serviceId": 2,
                                "serviceName": "Bữa sáng Buffet",
                                "categoryName": "Ăn uống",
                                "unit": "Suất",
                                "unitPrice": "120000",
                                "currency": "VND",
                                "isActive": True,
                            }
                        ],
                    },
                },
            ],
            "budget": {
                "remainingToolCalls": 2,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 6000,
                "remainingOutputTokens": 1500,
            },
        }
    )
    entry = store.consume(
        continuation_id=resume_payload.continuationId,
        conversation_id=resume_payload.conversationId,
        turn_id=resume_payload.turnId,
        tool_results=resume_payload.toolResults,
    )
    final = render_resume(resume_payload, "demo_synthetic", followup=entry.followup)
    assert final["final"]["status"] == "answered"
    assert "Phòng Deluxe Hướng Biển" in final["final"]["answer"]
    assert "Bữa sáng Buffet" in final["final"]["answer"]
    assert {a["type"] for a in final["final"]["actions"]} == {
        "open_room_search",
        "open_services",
    }


def test_rooms_and_services_without_dates_returns_live_services_plus_room_clarification():
    store = ContinuationStore()
    payload = _start_payload("giá dịch vụ và giá phòng")
    plan = TurnPlan(intent="rooms_and_services", query="giá dịch vụ và giá phòng")
    step1 = plan_business_turn(plan, payload, TurnBudget(), store, "demo_synthetic")
    assert step1["kind"] == "tool_calls"
    assert [c["name"] for c in step1["toolCalls"]] == ["list_services"]

    resume_payload = ResumeTurn.model_validate(
        {
            "phase": "resume",
            "requestId": "req-multi-1",
            "conversationId": str(payload.conversationId),
            "turnId": str(payload.turnId),
            "continuationId": step1["continuationId"],
            "toolResults": [
                {
                    "callId": step1["toolCalls"][0]["callId"],
                    "name": "list_services",
                    "status": "ok",
                    "error": None,
                    "data": {
                        "hasMore": False,
                        "items": [
                            {
                                "serviceId": 1,
                                "serviceName": "Nước khoáng Lavie 500ml",
                                "categoryName": "Đồ uống",
                                "unit": "Chai",
                                "unitPrice": "15000",
                                "currency": "VND",
                                "isActive": True,
                            }
                        ],
                    },
                }
            ],
            "budget": {
                "remainingToolCalls": 3,
                "remainingBrokerBatches": 1,
                "remainingMs": 15000,
                "remainingInputTokens": 6000,
                "remainingOutputTokens": 1500,
            },
        }
    )
    entry = store.consume(
        continuation_id=resume_payload.continuationId,
        conversation_id=resume_payload.conversationId,
        turn_id=resume_payload.turnId,
        tool_results=resume_payload.toolResults,
    )
    final = render_resume(resume_payload, "demo_synthetic", followup=entry.followup)
    assert final["final"]["status"] == "answered"
    assert "Nước khoáng Lavie 500ml" in final["final"]["answer"]
    assert "Về giá phòng trống" in final["final"]["answer"]
    assert set(final["final"]["missingFields"]) == {"checkInDate", "checkOutDate", "guestCount"}
    assert {a["type"] for a in final["final"]["actions"]} == {
        "open_services",
        "open_room_search",
    }


def test_policy_and_rooms_without_dates_returns_actionable_guidance():
    gate = VerificationGate(fixture().load())

    class FakeIndex:
        snapshot_id = gate.catalog.data.snapshotId

        def validate(self, _today: date):
            return None

        def search(self, _query: str, _today: date):
            return []

    class FakeProvider:
        async def generate(self, _system, _data, _schema, _budget):
            return TurnPlan(
                intent="policy_and_rooms",
                query="chính sách đặt phòng và giá phòng",
                policyQuery="chính sách đặt phòng",
            )

    faq = Faq(FakeProvider(), FakeIndex(), "demo_synthetic", verification_gate=gate)
    payload = _start_payload("chính sách đặt phòng và giá phòng")
    out = asyncio.run(faq.run(payload))
    assert out["kind"] == "final"
    assert out["final"]["status"] == "needs_clarification"
    assert "Về giá phòng trống" in out["final"]["answer"]
    assert "chính sách khách sạn" in out["final"]["answer"]
    assert out["final"]["actions"][0]["type"] == "open_room_search"
