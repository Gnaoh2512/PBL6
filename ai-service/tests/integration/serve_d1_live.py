"""Explicit Gemini live acceptance server, restricted to the synthetic D1 corpus.

Loads the private Gemini key through Settings; never prints credentials or provider bodies.
"""

import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from app.ingestion.snapshot import build  # noqa: E402
from app.main import create_app  # noqa: E402
from app.settings import Settings  # noqa: E402

if __name__ == "__main__":
    settings = Settings()
    if not settings.gemini_key:
        raise SystemExit("GEMINI_API_KEY is not configured")
    settings = settings.model_copy(
        update={
            "service_token": SecretStr("d1-e2e-test-only"),
            "corpus_mode": "demo_synthetic",
            "index_path": build("demo_synthetic", date.today()),
        }
    )
    print("D1 LIVE ACCEPTANCE: GEMINI + SYNTHETIC CORPUS", flush=True)
    uvicorn.run(create_app(settings), host="127.0.0.1", port=18006, access_log=False)
