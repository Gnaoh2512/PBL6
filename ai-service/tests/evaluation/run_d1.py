"""Explicit synthetic-only evaluation. --live requires a privately configured Gemini key.

Run from ai-service: .venv/Scripts/python.exe tests/evaluation/run_d1.py --retrieval-only
No raw provider bodies, prompts or credentials are written to reports.
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import monotonic
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.ingestion.snapshot import ROOT, build  # noqa: E402
from app.orchestration.faq import Faq  # noqa: E402
from app.prompts.faq import VERSION  # noqa: E402
from app.providers.contracts import DependencyError  # noqa: E402
from app.providers.gemini import Gemini  # noqa: E402
from app.retrieval.index import KnowledgeIndex  # noqa: E402
from app.schemas.turn import TurnRequest  # noqa: E402
from app.settings import Settings  # noqa: E402


async def evaluate(live: bool):
    settings = Settings()
    if live and not settings.gemini_key:
        print(json.dumps({"status": "not_run", "reason": "GEMINI_API_KEY missing", "live": True}))
        return 2
    today = datetime.now(timezone(timedelta(hours=7))).date()
    path = build("demo_synthetic", today)
    index = KnowledgeIndex(path, "demo_synthetic", today)
    provider = (
        Gemini(settings.gemini_key.get_secret_value(), settings.gemini_model) if live else None
    )
    report = {
        "live": live,
        "corpusMode": "demo_synthetic",
        "model": settings.gemini_model if live else None,
        "snapshotId": index.snapshot_id,
        "promptVersion": VERSION,
        "date": today.isoformat(),
        "rows": [],
        "groundingHumanReview": "not_measured",
    }
    dataset = json.loads((ROOT / "tests/evaluation/d1_queries.json").read_text(encoding="utf8"))
    try:
        for group in ("dev", "held_out"):
            for case in dataset[group]:
                row = {"id": case["id"], "split": group}
                started = monotonic()
                if not live:
                    matches = index.search(case["query"], today)
                    row["sections"] = [e.sectionId for e in matches]
                    row["goldRetrieved"] = (
                        case.get("section") in row["sections"] if "section" in case else None
                    )
                else:
                    payload = TurnRequest.validate_python(
                        {
                            "phase": "start",
                            "requestId": case["id"],
                            "conversationId": str(uuid4()),
                            "turnId": str(uuid4()),
                            "message": case["query"],
                            "history": [],
                            "allowedTools": ["search_knowledge"],
                            "context": {
                                "locale": "vi-VN",
                                "timeZone": "Asia/Ho_Chi_Minh",
                                "today": today.isoformat(),
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
                    try:
                        response = await Faq(provider, index, "demo_synthetic").run(payload)
                        row["status"] = response["final"]["status"]
                        row["statusMatches"] = row["status"] == case["status"]
                        row["usage"] = response["usage"]
                        row["answerForSyntheticReview"] = response["final"]["answer"]
                        row["sections"] = [c["sectionId"] for c in response["final"]["citations"]]
                    except (DependencyError, TimeoutError) as error:
                        row["error"] = (
                            error.code
                            if isinstance(error, DependencyError)
                            else "DEADLINE_EXCEEDED"
                        )
                row["elapsedMs"] = round((monotonic() - started) * 1000, 2)
                report["rows"].append(row)
        report["modelVersion"] = provider.model_version if provider else None
    finally:
        if provider:
            await provider.close()
    destination = ROOT / ".local/assistant-evaluation"
    destination.mkdir(parents=True, exist_ok=True)
    file = destination / ("live.json" if live else "retrieval.json")
    file.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(file)
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    flag = parser.add_mutually_exclusive_group(required=True)
    flag.add_argument("--live", action="store_true")
    flag.add_argument("--retrieval-only", action="store_true")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(evaluate(args.live)))
