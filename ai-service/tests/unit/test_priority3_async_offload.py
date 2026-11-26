"""Tests proving blocking SQLite/validation/catalog I/O runs off the asyncio event loop."""

import asyncio
import threading
import time
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import httpx

from app.indexing import EmbeddingProfile, HybridConfig
from app.main import create_app
from app.orchestration.faq import Faq
from app.providers.contracts import TurnBudget
from app.retrieval.hybrid import HybridRetriever
from app.schemas.faq import Intent
from app.schemas.turn import StartTurn
from app.settings import Settings


def test_hybrid_retriever_runs_pin_and_bm25_off_event_loop_concurrently():
    main_tid = threading.get_ident()
    observed = {"pin_tid": None, "bm25_tid": None, "vector_started_during_bm25": False}
    bm25_entered = threading.Event()
    bm25_release = threading.Event()

    class FakePaired:
        mode = "demo_synthetic"
        profile = EmbeddingProfile()

        def local_active(self, _today):
            observed["pin_tid"] = threading.get_ident()
            return {"snapshot_id": "snap-1", "run_id": "run-1", "chunks": []}

    class FakeEmbedder:
        profile = EmbeddingProfile()

        async def query(self, _q, _budget):
            # Wait briefly for bm25 worker thread to enter, proving concurrency with event loop.
            deadline_t = time.monotonic() + 2.0
            while not bm25_entered.is_set() and time.monotonic() < deadline_t:
                await asyncio.sleep(0.005)
            observed["vector_started_during_bm25"] = bm25_entered.is_set()
            bm25_release.set()
            return [1.0] + [0.0] * (self.profile.dimension - 1)

    class FakeVector:
        async def search(self, *_args, **_kwargs):
            return []

    retriever = HybridRetriever(FakePaired(), FakeEmbedder(), FakeVector(), config=HybridConfig())

    def blocking_bm25(query, manifest, today, *, category=None, source_id=None):
        observed["bm25_tid"] = threading.get_ident()
        bm25_entered.set()
        # Block worker thread until async vector coroutine proves the event loop is unblocked.
        assert bm25_release.wait(timeout=2.0)
        return ()

    retriever.bm25 = blocking_bm25

    async def run():
        result = await retriever.retrieve(
            "gio nhan phong", date(2026, 11, 26), budget=TurnBudget(remaining_ms=5000)
        )
        assert result.status == "empty"

    asyncio.run(run())
    assert observed["pin_tid"] is not None and observed["pin_tid"] != main_tid
    assert observed["bm25_tid"] is not None and observed["bm25_tid"] != main_tid
    assert observed["vector_started_during_bm25"] is True


def test_ready_endpoint_offloads_index_validate_and_catalog_check_off_event_loop():
    main_tid = threading.get_ident()
    observed = {"validate_tid": None, "catalog_tid": None}

    class FakeIndex:
        def validate(self, _today):
            observed["validate_tid"] = threading.get_ident()

    class FakeCatalog:
        def check_current(self):
            observed["catalog_tid"] = threading.get_ident()

    fake_faq = SimpleNamespace(
        index=FakeIndex(),
        verification_gate=SimpleNamespace(catalog=FakeCatalog()),
    )
    settings = Settings(_env_file=None, AI_SERVICE_AUTH_TOKEN="test-token-123")
    app = create_app(settings, faq=fake_faq)

    async def run():
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            resp = await client.get("/ready")
            assert resp.status_code == 200
            assert resp.json()["status"] == "ready"

    asyncio.run(run())
    assert observed["validate_tid"] is not None and observed["validate_tid"] != main_tid
    assert observed["catalog_tid"] is not None and observed["catalog_tid"] != main_tid


def test_faq_run_offloads_validate_and_bm25_search_off_event_loop():
    main_tid = threading.get_ident()
    observed = {"validate_tid": None, "search_tid": None}

    class FakeIndex:
        snapshot_id = "snap-1"

        def validate(self, _today):
            observed["validate_tid"] = threading.get_ident()

        def search(self, _query, _today):
            observed["search_tid"] = threading.get_ident()
            return []

    class FakeProvider:
        async def generate(self, _system, _data, _schema, _budget):
            return Intent(intent="faq", query="gio nhan phong")

    from verification_support import fixture

    gate = SimpleNamespace(catalog=fixture().load())
    from app.orchestration.verification import VerificationGate

    real_gate = VerificationGate(gate.catalog)
    index = FakeIndex()
    index.snapshot_id = real_gate.catalog.data.snapshotId
    faq = Faq(FakeProvider(), index, "demo_synthetic", verification_gate=real_gate)
    payload = StartTurn.model_validate(
        {
            "phase": "start",
            "requestId": "req-async-1",
            "conversationId": str(uuid4()),
            "turnId": str(uuid4()),
            "message": "Giờ nhận phòng mấy giờ?",
            "history": [],
            "allowedTools": ["search_knowledge"],
            "context": {
                "locale": "vi-VN",
                "timeZone": "Asia/Ho_Chi_Minh",
                "today": "2026-11-26",
                "currency": "VND",
            },
            "budget": {
                "remainingToolCalls": 1,
                "remainingBrokerBatches": 0,
                "remainingMs": 20000,
                "remainingInputTokens": 8000,
                "remainingOutputTokens": 2000,
            },
        }
    )

    async def run():
        out = await faq.run(payload)
        assert out["kind"] == "final"
        assert out["final"]["status"] == "insufficient_evidence"

    asyncio.run(run())
    assert observed["validate_tid"] is not None and observed["validate_tid"] != main_tid
    assert observed["search_tid"] is not None and observed["search_tid"] != main_tid
