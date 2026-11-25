import asyncio
import json
import re
import shutil
import sqlite3
from datetime import date
from unittest.mock import ANY, create_autospec

import httpx
import pytest
from fastapi.testclient import TestClient
from grounding_support import gate_for, proposal, write_artifacts

from app.diagnostics import Category
from app.ingestion.snapshot import ROOT, build
from app.main import create_app
from app.orchestration.faq import Faq
from app.providers.contracts import DependencyError, TurnBudget
from app.providers.gemini import Gemini
from app.retrieval.index import KnowledgeIndex
from app.schemas.turn import TurnRequest
from app.settings import Settings

TODAY = date(2026, 11, 13)
SECRET = "Bearer private.jwt.value customer@example.invalid +84901234567\nFORGED"


@pytest.fixture
def index(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", TODAY, tmp_path)
    result = KnowledgeIndex(path, "demo_synthetic", TODAY, tmp_path)
    result.test_gate = gate_for(result, aliases=["[credential] [contact] [contact]\nFORGED"])
    return result


def payload():
    examples = re.findall(
        r"```json\n(.*?)\n```", (ROOT / "docs/API.md").read_text(encoding="utf8"), re.S
    )
    data = next(json.loads(x) for x in examples if json.loads(x).get("phase") == "start")
    data.update(message=SECRET, allowedTools=["search_knowledge"], requestId="private.request.id")
    data["context"]["today"] = TODAY.isoformat()
    data["budget"]["remainingMs"] = 20000
    return data


def provider(index, hook=None):
    evidence = index.search("wifi", TODAY)
    cid = evidence[0].citationId

    async def handler(request):
        if hook:
            await hook(request)
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 10})
        content = json.loads(request.content)
        schema = content["generationConfig"]["responseJsonSchema"]["title"]
        answer = {"intent": "faq", "query": "wifi"} if schema == "Intent" else proposal(cid)
        return httpx.Response(
            200,
            json={
                "usageMetadata": {"promptTokenCount": 10, "candidatesTokenCount": 5},
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {
                            "parts": [{"text": json.dumps(answer), "thoughtSignature": SECRET}]
                        },
                    }
                ],
            },
        )

    return Gemini("synthetic-api-key", "gemini-3.1-flash-lite", httpx.MockTransport(handler))


@pytest.mark.parametrize(
    "failure,category",
    [
        ("missing", Category.INDEX_IO),
        ("checksum", Category.INDEX_VALIDATION),
        ("manifest", Category.INDEX_VALIDATION),
        ("query", Category.INDEX_QUERY),
        ("metadata", Category.INDEX_VALIDATION),
    ],
)
def test_index_failure_categories_and_no_content_logs(
    index, monkeypatch, diagnostic_records, failure, category
):
    diagnostic_records.clear()
    if failure == "missing":
        (index.path / "manifest.json").unlink()
    elif failure == "checksum":
        (index.path / "index.sqlite").write_bytes(b"private-index-corrupt")
    elif failure == "manifest":
        (index.path / "manifest.json").write_text(SECRET, encoding="utf8")
    else:

        def broken(*args, **kwargs):
            if failure == "query":
                raise sqlite3.OperationalError(SECRET)

            class BadDB:
                def execute(self, *args):
                    return self

                def fetchall(self):
                    return [(SECRET,)]

                def close(self):
                    pass

            return BadDB()

        monkeypatch.setattr("app.retrieval.index.sqlite3.connect", broken)
    with pytest.raises(DependencyError) as caught:
        index.search(SECRET, TODAY)
    assert caught.value.code == "DEPENDENCY_UNAVAILABLE"
    assert caught.value.diagnostic_category is category
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert events[-1]["operation"] == "retrieval"
    assert events[-1]["error_category"] == category
    wire = repr([r.__dict__ for r in diagnostic_records])
    for value in (
        SECRET,
        "private.jwt.value",
        "example.invalid",
        "84901234567",
        "FORGED",
        str(index.path),
        "manifest.json",
        "index.sqlite",
    ):
        assert value not in wire


def test_successful_turn_correlates_phases_without_request_ids_or_sensitive_text(
    index, diagnostic_records
):
    client = provider(index)
    diagnostic_records.clear()

    async def run():
        try:
            answer = await Faq(
                client, index, "demo_synthetic", verification_gate=index.test_gate
            ).run(TurnRequest.validate_python(payload()))
            assert answer["final"]["status"] == "answered"
            assert answer["usage"]["inputTokensUsed"] == 20
        finally:
            await client.close()

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert len({e["diagnostic_id"] for e in events}) == 1
    for operation in ("classify", "answer"):
        methods = [e["phase"] for e in events if e["operation"] == operation]
        assert methods.count("countTokens") == methods.count("generateContent") == 1
    assert any(e["operation"] == "retrieval" for e in events)
    assert events[0]["remaining_budget_ms"] is None  # Initial validate remains outside budget.
    assert events[-1]["operation"] == "turn" and events[-1]["remaining_budget_ms"] <= 20000
    wire = repr([r.__dict__ for r in diagnostic_records])
    for value in (
        SECRET,
        "private.request.id",
        "private.jwt.value",
        "example.invalid",
        "84901234567",
        "synthetic-api-key",
        "FORGED",
        "thoughtSignature",
        "citationIds",
    ):
        assert value not in wire


@pytest.mark.parametrize("where", ["classify", "answer"])
def test_outer_deadline_cancels_active_http_and_preserves_source(
    index, monkeypatch, diagnostic_records, where
):
    original_timeout = asyncio.timeout

    async def run():
        gate, timeouts, generates = asyncio.Event(), [], [0]

        def timeout(delay):
            value = original_timeout(delay)
            timeouts.append(value)
            return value

        monkeypatch.setattr("app.diagnostics.asyncio.timeout", timeout)

        async def block(request):
            if request.url.path.endswith(":generateContent"):
                generates[0] += 1
                if generates[0] == (1 if where == "classify" else 2):
                    gate.set()
                    await asyncio.Event().wait()

        client = provider(index, block)
        diagnostic_records.clear()
        try:
            task = asyncio.create_task(
                Faq(client, index, "demo_synthetic", verification_gate=index.test_gate).run(
                    TurnRequest.validate_python(payload())
                )
            )
            await asyncio.wait_for(gate.wait(), 1)
            timeouts[0].reschedule(asyncio.get_running_loop().time())
            with pytest.raises(TimeoutError):
                await task
        finally:
            await client.close()

    asyncio.run(run())
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert len({e["diagnostic_id"] for e in events}) == 1
    assert any(
        e["operation"] == where
        and e["phase"] == "generateContent"
        and e["error_category"] == "cancelled"
        for e in events
    )
    assert events[-1]["error_category"] == "application_deadline"
    assert events[-1]["outcome"] == "error"
    assert not any(e["error_category"] in ("read_timeout", "connect_timeout") for e in events)


def test_turn_shares_budget_across_classify_retrieval_answer(
    index, monkeypatch, diagnostic_records
):
    import app.diagnostics as diagnostics
    import app.orchestration.faq as faq_module
    import app.providers.contracts as contracts

    clock, calls = [0.0], []
    monkeypatch.setattr(contracts, "monotonic", lambda: clock[0])
    monkeypatch.setattr(diagnostics, "monotonic", lambda: clock[0])
    monkeypatch.setattr(faq_module, "TurnBudget", lambda **kw: TurnBudget(**kw, started=clock[0]))
    original_search = index.search

    def search(*args, **kwargs):
        found = original_search(*args, **kwargs)
        clock[0] += 9
        return found

    async def hook(request):
        calls.append(request.url.path)
        clock[0] += 4

    client = provider(index, hook)
    monkeypatch.setattr(index, "search", search)

    async def run():
        try:
            with pytest.raises(DependencyError, match="DEADLINE_EXCEEDED"):
                await Faq(client, index, "demo_synthetic", verification_gate=index.test_gate).run(
                    TurnRequest.validate_python(payload())
                )
        finally:
            await client.close()

    asyncio.run(run())
    assert len(calls) == 3
    events = [json.loads(r.getMessage()) for r in diagnostic_records]
    assert events[-1]["remaining_budget_ms"] == 0
    assert events[-1]["error_category"] == "application_deadline"


@pytest.mark.parametrize("failure", ["timeout", "dependency"])
def test_public_mapping_and_readiness_policy_unchanged(index, failure):
    class Fake:
        calls = 0

        async def generate(self, *args):
            self.calls += 1
            if self.calls == 1:
                raise DependencyError(
                    "DEADLINE_EXCEEDED" if failure == "timeout" else "DEPENDENCY_UNAVAILABLE",
                    diagnostic_category=(
                        Category.READ_TIMEOUT if failure == "timeout" else Category.HTTP_STATUS
                    ),
                )
            from app.schemas.faq import Intent

            return Intent(intent="unavailable", query="booking")

    fake = Fake()
    settings = Settings(
        _env_file=None, service_token="synthetic-token", corpus_mode="demo_synthetic"
    )
    with TestClient(
        create_app(
            settings, faq=Faq(fake, index, "demo_synthetic", verification_gate=gate_for(index))
        )
    ) as client:
        data = payload()
        headers = {"Authorization": "Bearer synthetic-token", "X-Request-ID": data["requestId"]}
        response = client.post("/internal/assistant/turn", json=data, headers=headers)
        assert response.status_code == (504 if failure == "timeout" else 503)
        assert response.json()["error"]["code"] == (
            "DEADLINE_EXCEEDED" if failure == "timeout" else "DEPENDENCY_UNAVAILABLE"
        )
        assert "diagnostic" not in response.text and "http_status" not in response.text
        assert client.get("/ready").status_code == (200 if failure == "timeout" else 503)
        response = client.post("/internal/assistant/turn", json=data, headers=headers)
        assert response.status_code == (200 if failure == "timeout" else 503)
        assert fake.calls == (2 if failure == "timeout" else 1)


@pytest.mark.parametrize("failure", [None, "failure", "cancel"])
def test_probe_client_closed_on_shutdown_failure_or_startup_cancel(
    index, monkeypatch, diagnostic_records, failure
):
    class Fake:
        closed = 0
        calls = 0

        async def generate(self, *args):
            self.calls += 1
            if failure == "cancel":
                raise asyncio.CancelledError()
            if failure == "failure":
                raise DependencyError(diagnostic_category=Category.HTTP_STATUS)
            from app.schemas.faq import Probe

            return Probe(ok=True)

        async def close(self):
            self.closed += 1

    fake = Fake()
    index_factory = create_autospec(KnowledgeIndex, return_value=index)
    monkeypatch.setattr("app.main.Gemini", lambda *args: fake)
    monkeypatch.setattr("app.main.KnowledgeIndex", index_factory)
    settings = Settings(
        _env_file=None,
        service_token="synthetic-token",
        gemini_key="synthetic-key",
        index_path=index.path,
        retrieval_mode="bm25",
        grounding=write_artifacts(index)[1],
        corpus_mode="demo_synthetic",
    )
    app = create_app(settings)
    entered_lifespan = []

    async def run():
        async with app.router.lifespan_context(app):
            entered_lifespan.append(True)
            assert fake.closed == 0

    if failure == "cancel":
        with pytest.raises(asyncio.CancelledError):
            asyncio.run(run())
    else:
        asyncio.run(run())
    index_factory.assert_called_once_with(
        settings.index_path,
        settings.corpus_mode,
        ANY,
        source_pack=settings.demo_source_pack,
    )
    assert fake.calls == 1
    assert entered_lifespan == ([] if failure == "cancel" else [True])
    assert fake.closed == 1
    assert any(json.loads(r.getMessage())["operation"] == "probe" for r in diagnostic_records)
