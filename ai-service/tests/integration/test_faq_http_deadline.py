"""FAQ deadline regressions with real HTTPX/httpcore and synthetic network I/O."""

import asyncio
import json
import shutil
from collections import deque
from datetime import date
from time import monotonic
from uuid import UUID

import pytest
from grounding_support import gate_for, proposal
from http_timing_support import Clock, PublicCoreTransport, ScriptedBackend, frames, synthetic_pool
from test_foundation_contract import start_payload

import app.diagnostics as diagnostics
import app.orchestration.faq as faq_module
import app.providers.contracts as contracts
import app.providers.gemini as gemini_module
from app.ingestion.snapshot import ROOT, build
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.providers.http_timing import HttpTiming, get_emitter
from app.retrieval.index import KnowledgeIndex
from app.schemas.turn import TurnRequest

TODAY = date(2026, 11, 13)


class DeadlineClock(Clock):
    """Advance asyncio and budget clocks together without waiting twenty real seconds."""

    def __call__(self):
        return monotonic() + self.value


class GenerationBackend(ScriptedBackend):
    def __init__(self, responses, *, clock, attempt, phase, slow_classify, classify_seconds=19):
        super().__init__(responses, clock=clock)
        self.attempt, self.phase, self.slow_classify = attempt, phase, slow_classify
        self.classify_seconds = classify_seconds
        self.attempts = 0

    async def stage(self, name):
        if name == "write_headers":
            self.attempts += 1
        if self.slow_classify and self.attempts == 2 and name == "body":
            self.clock.value += self.classify_seconds
        if self.attempts == self.attempt and name == self.phase:
            self.block = name
        await super().stage(name)


@pytest.fixture
def faq_index(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", TODAY, tmp_path)
    return KnowledgeIndex(path, "demo_synthetic", TODAY, tmp_path)


def faq_frames(citation_id):
    responses = []
    for value in (
        {"intent": "faq", "query": "wifi"},
        proposal(citation_id),
    ):
        responses += frames(b'{"totalTokens":10}')
        responses += frames(
            json.dumps(
                {
                    "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
                    "candidates": [
                        {
                            "finishReason": "STOP",
                            "content": {"parts": [{"text": json.dumps(value)}]},
                        }
                    ],
                }
            ).encode()
        )
    return responses


@pytest.mark.parametrize("phase", ["headers", "body"])
@pytest.mark.parametrize(
    "where,slow_classify,classify_seconds",
    [("classify", False, 0), ("answer", False, 0), ("answer", True, 19), ("answer", True, 7.15)],
    ids=["classify", "answer", "refund-shaped", "d115-shaped"],
)
def test_faq_generation_cancelled_by_shared_deadline(
    faq_index,
    monkeypatch,
    diagnostic_records,
    timing_records,
    where,
    slow_classify,
    classify_seconds,
    phase,
):
    citation_id = faq_index.search("wifi", TODAY)[0].citationId
    data = start_payload()
    data.update(message="Synthetic Wi-Fi question", allowedTools=["search_knowledge"])
    data["budget"].update(remainingToolCalls=1, remainingBrokerBatches=0)
    payload = TurnRequest.validate_python(data)
    diagnostic_records.clear()
    budgets, budget_starts, observers, timeouts, retrieval_budgets = [], [], [], [], []

    async def run():
        clock = DeadlineClock()
        attempt_count = 2 if where == "classify" else 4
        backend = GenerationBackend(
            faq_frames(citation_id),
            clock=clock,
            attempt=attempt_count,
            phase=phase,
            slow_classify=slow_classify,
            classify_seconds=classify_seconds,
        )
        # CA preparation precedes both the virtual clock and all request deadlines.
        transport = PublicCoreTransport(synthetic_pool(network_backend=backend))
        client = Gemini("synthetic-test-key", "gemini-3.1-flash-lite", transport)
        loop = asyncio.get_running_loop()
        original_timeout, original_search = asyncio.timeout, faq_index.search

        def budget_factory(**limits):
            budget = TurnBudget(**limits, started=clock())
            budgets.append(budget)
            budget_starts.append(budget.started)
            return budget

        def observer_factory(method, budget):
            observer = HttpTiming(method, budget, clock=clock)
            observers.append(observer)
            return observer

        def timeout(seconds):
            timeouts.append(seconds)
            return original_timeout(seconds)

        def search(*args, **kwargs):
            retrieval_budgets.append(budgets[-1].seconds())
            return original_search(*args, **kwargs)

        task = None
        with monkeypatch.context() as patch:
            patch.setattr(loop, "time", clock)
            patch.setattr(contracts, "monotonic", clock)
            patch.setattr(diagnostics, "monotonic", clock)
            patch.setattr(faq_module, "TurnBudget", budget_factory)
            patch.setattr(gemini_module, "HttpTiming", observer_factory)
            patch.setattr(gemini_module.asyncio, "timeout", timeout)
            patch.setattr(faq_index, "search", search)
            try:
                task = asyncio.create_task(
                    faq_module.Faq(
                        client,
                        faq_index,
                        "demo_synthetic",
                        verification_gate=gate_for(faq_index, aliases=["Synthetic Wi-Fi question"]),
                    ).run(payload)
                )
                # This watchdog must cover the refund scenario's 19-second virtual advance.
                await asyncio.wait_for(
                    backend.entered.wait(), payload.budget.remainingMs / 1000 + 1
                )
                assert len(budgets) == 1
                budget = budgets[0]
                assert budget.remaining_ms == payload.budget.remainingMs == 20000
                assert budget.started == budget_starts[0]
                assert (
                    len(observers) == len(transport.extensions) == backend.attempts == attempt_count
                )
                assert all(observer.budget is budget for observer in observers)
                assert all(
                    extension["trace"].__self__ is observer
                    for extension, observer in zip(transport.extensions, observers)
                )
                assert all(
                    extension["timeout"] == {"connect": 20, "read": 20, "write": 20, "pool": 20}
                    for extension in transport.extensions
                )
                assert all(0 < seconds <= 20 for seconds in timeouts)
                assert all(a >= b for a, b in zip(timeouts, timeouts[1:]))
                assert budget.calls == int(where == "answer")
                if slow_classify:
                    expected_remaining = 20 - classify_seconds
                    assert 0 < budget.seconds() < expected_remaining
                    assert len(retrieval_budgets) == 1
                    assert 0 < retrieval_budgets[0] < expected_remaining
                    assert 0 < timeouts[-1] < expected_remaining
                else:
                    assert budget.seconds() > 0

                # Expire the actual asyncio deadlines using the same test-only clock;
                # do not cancel the task ourselves or alter the 20-second configuration.
                clock.value += budget.seconds() + 0.05
                with pytest.raises((TimeoutError, DependencyError)) as caught:
                    await asyncio.wait_for(task, 1)
                assert (
                    diagnostics.category(caught.value) == diagnostics.Category.APPLICATION_DEADLINE
                )
                if isinstance(caught.value, DependencyError):
                    assert caught.value.code == "DEADLINE_EXCEEDED"
                assert backend.attempts == len(transport.extensions) == attempt_count
                assert budget.started == budget_starts[0]
                assert all(stream.closed == 1 for stream in backend.streams)
                assert not backend.release.is_set()
                assert await asyncio.to_thread(get_emitter().drain)

                # A fresh turn reuses the same client/transport after cancellation.
                backend.block = None
                backend.responses = deque(faq_frames(citation_id))
                response = await faq_module.Faq(
                    client,
                    faq_index,
                    "demo_synthetic",
                    verification_gate=gate_for(faq_index, aliases=["Synthetic Wi-Fi question"]),
                ).run(payload)
                assert response["final"]["status"] == "answered"
                assert response["final"]["citations"][0]["citationId"] == citation_id
                assert len(budgets) == 2 and budgets[1] is not budget
                assert budgets[1].started == budget_starts[1] > budget_starts[0]
                assert budgets[1].calls == 2
                assert all(observer.budget is budgets[1] for observer in observers[attempt_count:])
                assert backend.attempts == len(transport.extensions) == attempt_count + 4
            finally:
                if task is not None and not task.done():
                    task.cancel()
                    await asyncio.gather(task, return_exceptions=True)
                await client.close()
            assert transport.closed == 1 and all(stream.closed == 1 for stream in backend.streams)

    asyncio.run(run())
    assert get_emitter().drain()
    events = [json.loads(record.getMessage()) for record in diagnostic_records]
    turns = [event for event in events if event["operation"] == "turn"]
    assert len(turns) == 2
    failed_id, successor_id = [event["diagnostic_id"] for event in turns]
    assert failed_id != successor_id
    assert turns[0]["error_category"] == "application_deadline"
    assert turns[0]["remaining_budget_ms"] == 0 and turns[0]["outcome"] == "error"
    assert turns[1]["outcome"] == "success"
    attempts = 2 if where == "classify" else 4
    assert len(timing_records) == attempts + 4
    assert {row["http_attempt_id"] for row in timing_records} == {o.attempt_id for o in observers}
    assert len({row["http_attempt_id"] for row in timing_records}) == attempts + 4
    assert all(UUID(row["http_attempt_id"]).version == 4 for row in timing_records)
    methods = [event for event in events if event["phase"] in ("countTokens", "generateContent")]
    assert len(methods) == len(timing_records)
    for row in timing_records:
        matches = [
            event
            for event in methods
            if (event["diagnostic_id"], event["operation"], event["provider_method"])
            == (row["diagnostic_id"], row["operation"], row["provider_method"])
        ]
        assert len(matches) == 1
        assert matches[0]["outcome"] == row["outcome"]
        assert matches[0]["error_category"] == row["error_category"]
    failed = [row for row in timing_records if row["diagnostic_id"] == failed_id]
    assert len(failed) == attempts
    assert [row["provider_method"] for row in failed] == ["countTokens", "generateContent"] * (
        attempts // 2
    )
    cancelled = failed[-1]
    assert cancelled["operation"] == where and cancelled["provider_method"] == "generateContent"
    assert cancelled["outcome"] in ("cancelled", "error")
    assert cancelled["error_category"] in ("cancelled", "application_deadline")
    assert cancelled["remaining_budget_ms"] == 0
    assert cancelled["http_status"] == (200 if phase == "body" else None)
    expected_phase = "read_body" if phase == "body" else "wait_headers"
    assert any(
        s["phase"] == expected_phase
        and s["outcome"] == "failed"
        and s["duration_kind"] == "elapsed_until_abort"
        for s in cancelled["samples"]
    )
    if phase == "headers":
        assert cancelled["protocol"] == "unknown"
        assert not any(s["phase"] == "read_body" for s in cancelled["samples"])
    assert all(row["outcome"] == "success" for row in failed[:-1])
    assert all(
        row["outcome"] == "success"
        for row in timing_records
        if row["diagnostic_id"] == successor_id
    )
    if where == "answer":
        assert any(
            e["operation"] == "retrieval" and e["outcome"] == "success"
            for e in events
            if e["diagnostic_id"] == failed_id
        )
    if slow_classify:
        assert failed[1]["operation"] == "classify"
        assert failed[1]["duration_ms"] >= classify_seconds * 1000
        assert failed[2]["provider_method"] == "countTokens" and failed[2]["http_status"] == 200
        assert 0 < failed[2]["remaining_budget_ms"] < (20 - classify_seconds) * 1000
