"""EXPLICIT TEST SERVER: synthetic fixture + labeled fake, never a runtime fallback.

Run from ai-service: .venv/Scripts/python.exe tests/integration/serve_d1_fake.py
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "unit"))

import uvicorn  # noqa: E402
from grounding_support import gate_for, proposal  # noqa: E402

from app.ingestion.snapshot import build, normalize  # noqa: E402
from app.main import create_app  # noqa: E402
from app.orchestration.faq import Faq  # noqa: E402
from app.retrieval.index import KnowledgeIndex  # noqa: E402
from app.schemas.faq import Intent  # noqa: E402
from app.schemas.verification import CandidateDraft  # noqa: E402
from app.settings import Settings  # noqa: E402


class LabeledE2EFake:
    """Only this test entrypoint constructs the fake."""

    async def generate(self, system, data, schema, budget):
        budget.reserve(20)
        budget.record(20, 20)
        if schema is Intent:
            text = normalize(data["message"])
            unavailable = any(
                word in text for word in ("booking", "gia phong", "con phong", "thanh toan")
            )
            return Intent(intent="unavailable" if unavailable else "faq", query=data["message"])
        first = data["evidence"][0]
        import json

        return CandidateDraft.model_validate_json(json.dumps(proposal(first["citationId"])))


def application():
    today = date.today()
    index = KnowledgeIndex(build("demo_synthetic", today), "demo_synthetic", today)
    settings = Settings(
        _env_file=None,
        service_token="d1-e2e-test-only",
        gemini_key=None,
        corpus_mode="demo_synthetic",
    )
    return create_app(
        settings,
        faq=Faq(LabeledE2EFake(), index, "demo_synthetic", verification_gate=gate_for(index)),
    )


if __name__ == "__main__":
    print("D1 TEST SERVER: LABELED FAKE PROVIDER, NOT GEMINI", flush=True)
    uvicorn.run(application(), host="127.0.0.1", port=18006, access_log=False)
