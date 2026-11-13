import asyncio
import json
import re
import shutil
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.ingestion.snapshot import ROOT, build
from app.main import create_app
from app.orchestration.faq import Faq
from app.providers.contracts import DependencyError
from app.retrieval.index import KnowledgeIndex
from app.schemas.faq import GroundedAnswer, Intent
from app.settings import Settings


class LabeledFakeProvider:
    """Test-only provider. Never selected by settings or runtime fallback."""

    def __init__(self, kind="answer"):
        self.kind, self.calls = kind, []

    async def generate(self, system, data, schema, budget):
        self.calls.append(data)
        budget.reserve(10)
        budget.record(10, 10)
        if self.kind == "timeout":
            raise DependencyError("DEADLINE_EXCEEDED")
        if self.kind == "dependency":
            raise DependencyError()
        if schema is Intent:
            return Intent(
                intent="unavailable" if self.kind == "booking" else "faq",
                query="rocket astronaut" if self.kind == "missing" else "wifi",
            )
        return GroundedAnswer(
            supported=self.kind != "unsupported",
            answer="Wi-Fi giả lập tại sảnh.",
            citationIds=[
                "invented" if self.kind == "citation" else data["evidence"][0]["citationId"]
            ],
        )


@pytest.fixture
def ready_runtime(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    path = build("demo_synthetic", date(2026, 11, 13), tmp_path)
    index = KnowledgeIndex(path, "demo_synthetic", date(2026, 11, 13), tmp_path)
    return index


def payload():
    examples = re.findall(
        r"```json\n(.*?)\n```", (ROOT / "docs/API.md").read_text(encoding="utf8"), re.S
    )
    data = next(json.loads(x) for x in examples if json.loads(x).get("phase") == "start")
    data["message"] = "Wi-Fi o dau?"
    data["allowedTools"] = ["search_knowledge"]
    return data


@pytest.mark.parametrize(
    "kind,status,code",
    [
        ("answer", 200, "answered"),
        ("missing", 200, "insufficient_evidence"),
        ("unsupported", 200, "insufficient_evidence"),
        ("booking", 200, "capability_unavailable"),
        ("citation", 502, "AI_PROTOCOL_ERROR"),
        ("timeout", 504, "DEADLINE_EXCEEDED"),
        ("dependency", 503, "DEPENDENCY_UNAVAILABLE"),
    ],
)
def test_full_faq_boundary_with_labeled_fake(ready_runtime, kind, status, code):
    provider = LabeledFakeProvider(kind)
    settings = Settings(_env_file=None, service_token="test-service", corpus_mode="demo_synthetic")
    data = payload()
    with TestClient(
        create_app(settings, faq=Faq(provider, ready_runtime, "demo_synthetic"))
    ) as client:
        assert client.get("/ready").status_code == 200
        response = client.post(
            "/internal/assistant/turn",
            json=data,
            headers={"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]},
        )
        if kind == "dependency":
            assert client.get("/ready").status_code == 503
    assert response.status_code == status
    body = response.json()
    if status != 200:
        assert body["error"]["code"] == code
    else:
        assert body["final"]["status"] == code
        assert body["final"]["corpusMode"] == "demo_synthetic"
        assert body["final"]["cards"] == body["toolCalls"] == []
        if code == "answered":
            assert body["final"]["citations"][0]["chunkId"] == body["evidence"][0]["chunkId"]
    assert len(provider.calls) <= 2
    if kind in {"missing", "booking"}:
        assert len(provider.calls) == 1


def test_prompt_credential_redaction_and_budget(ready_runtime):
    from app.schemas.turn import TurnRequest

    provider = LabeledFakeProvider()
    data = payload()
    data["message"] = "Bearer private-jwt customer@example.invalid +84901234567"
    faq = Faq(provider, ready_runtime, "demo_synthetic")
    asyncio.run(faq.run(TurnRequest.validate_python(data)))
    wire = json.dumps(provider.calls)
    assert "private-jwt" not in wire and "example.invalid" not in wire and "84901234567" not in wire
    data["budget"]["remainingToolCalls"] = 0
    with pytest.raises(DependencyError, match="BUDGET_EXCEEDED"):
        asyncio.run(faq.run(TurnRequest.validate_python(data)))
