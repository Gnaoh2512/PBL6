"""Explicit Gemini live acceptance server, restricted to demo_synthetic corpora.

Loads private credentials and AI_GROUNDING pins through Settings; never prints credentials
or provider bodies. Supports both Phase 3 default hybrid and explicit bm25 mode.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import uvicorn  # noqa: E402
from pydantic import SecretStr  # noqa: E402

from app.ingestion.snapshot import DEMO_SOURCE_PACKS, build  # noqa: E402
from app.main import create_app  # noqa: E402
from app.settings import Settings  # noqa: E402

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retrieval-mode", choices=["hybrid", "bm25"], default=None)
    parser.add_argument("--source-pack", choices=["d1_fixture", *DEMO_SOURCE_PACKS], default=None)
    parser.add_argument("--port", type=int, default=18006)
    args = parser.parse_args()

    settings = Settings()
    if not settings.gemini_key:
        raise SystemExit("GEMINI_API_KEY is not configured")
    if not settings.grounding.catalog_path or not settings.grounding.sources_path:
        raise SystemExit(
            "AI_GROUNDING catalog_path/sources_path pins are required in Phase 3; "
            "no free-form fallback exists."
        )
    retrieval_mode = args.retrieval_mode or settings.retrieval_mode
    source_pack = args.source_pack or settings.demo_source_pack
    today = datetime.now(timezone(timedelta(hours=7))).date()
    updates = {
        "service_token": SecretStr("d1-e2e-test-only"),
        "corpus_mode": "demo_synthetic",
        "retrieval_mode": retrieval_mode,
        "demo_source_pack": source_pack,
    }
    if retrieval_mode == "bm25":
        updates["index_path"] = build("demo_synthetic", today, source_pack=source_pack)
    settings = settings.model_copy(update=updates)
    print(
        f"D1 LIVE ACCEPTANCE: GEMINI + SYNTHETIC CORPUS "
        f"(mode={retrieval_mode}, pack={source_pack})",
        flush=True,
    )
    uvicorn.run(create_app(settings), host="127.0.0.1", port=args.port, access_log=False)
