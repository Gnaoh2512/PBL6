"""Phase 3 Academic Policy Demo retrieval diagnostic & bounded live harness.

Default mode (`--retrieval-only`) is 100% offline, builds/validates a local FTS5 snapshot for
the 10 user-approved Academic Demo policies (`source_pack='academic_policies'`), and measures
unit-level retrieval metrics against `policy-gold-2026-11-22-v1/gold.json`.

Important boundaries:
- Gold status remains `pending_review / approved:false / scorable:false` until human review.
- Offline BM25 retrieval metrics are diagnostic baselines, NOT semantic or live acceptance.
- `--live` requires explicit `--allow-live-api`, `GEMINI_API_KEY`, and pinned `AI_GROUNDING`.
"""

import argparse
import json
import math
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.ingestion.snapshot import ROOT, build  # noqa: E402
from app.retrieval.index import KnowledgeIndex  # noqa: E402

GOLD_PATH = ROOT / "tests/evaluation/policy-gold-2026-11-22-v1/gold.json"


def _unit_id(ref: str) -> str:
    """Extract POL-xx-Uyy from paragraph anchor POL-xx-Uyy-Rzz."""
    parts = ref.split("-")
    return "-".join(parts[:3]) if len(parts) >= 3 else ref


def _acceptable_unit_sets(case: dict) -> list[set[str]]:
    sets = case.get("acceptableMinimalEvidenceSets") or []
    return [{_unit_id(ref) for ref in alt} for alt in sets if alt]


def _score_case(retrieved_units: list[str], acceptable_sets: list[set[str]]) -> dict:
    if not acceptable_sets:
        return {
            "hit_any": None,
            "complete_set": None,
            "mrr": None,
            "precision": None,
            "nonempty": bool(retrieved_units),
        }
    retrieved_set = set(retrieved_units)
    union_relevant = set().union(*acceptable_sets)
    complete = any(alt <= retrieved_set for alt in acceptable_sets)
    hit_any = bool(union_relevant & retrieved_set)
    mrr = next(
        (1.0 / rank for rank, unit in enumerate(retrieved_units, 1) if unit in union_relevant),
        0.0,
    )
    precision = (
        sum(unit in union_relevant for unit in retrieved_units) / len(retrieved_units)
        if retrieved_units
        else 0.0
    )
    return {
        "hit_any": hit_any,
        "complete_set": complete,
        "mrr": mrr,
        "precision": precision,
        "nonempty": bool(retrieved_units),
    }


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = max(0, min(len(ordered) - 1, math.ceil(len(ordered) * pct) - 1))
    return round(ordered[index], 3)


def evaluate_retrieval_offline(
    gold_path: Path = GOLD_PATH,
    *,
    today: date = date(2026, 11, 23),
    top_k: int = 3,
    root: Path = ROOT,
    snapshot_root: Path | None = None,
) -> dict:
    """Measure offline BM25 unit-level retrieval on the 10 approved Academic Demo policies."""
    gold = json.loads(gold_path.read_text(encoding="utf-8"))
    cases = gold["cases"]
    build_root = snapshot_root or root
    snapshot_dir = build("demo_synthetic", today, build_root, source_pack="academic_policies")
    index = KnowledgeIndex(
        snapshot_dir, "demo_synthetic", today, build_root, source_pack="academic_policies"
    )

    rows = []
    latencies = []
    for case in cases:
        t0 = perf_counter()
        evidence = index.search(case["query"], today, top_k=top_k)
        elapsed_ms = round((perf_counter() - t0) * 1000, 3)
        latencies.append(elapsed_ms)
        units = [item.sectionId for item in evidence]
        acceptable = _acceptable_unit_sets(case)
        scored = _score_case(units, acceptable)
        rows.append(
            {
                "id": case["id"],
                "split": case["split"],
                "label": case["label"],
                "stratum": case.get("stratum"),
                "topic": case.get("topic") or case.get("primaryTopic"),
                "retrieved_units": units,
                "acceptable_unit_sets": [sorted(s) for s in acceptable],
                "latency_ms": elapsed_ms,
                **scored,
            }
        )

    def summarize(subset: list[dict]) -> dict:
        answerable = [r for r in subset if r["label"] == "A"]
        unanswerable = [r for r in subset if r["label"] == "U"]
        out_of_scope = [r for r in subset if r["label"] == "O"]
        n_a = len(answerable)
        return {
            "total": len(subset),
            "answerable_count": n_a,
            "unanswerable_count": len(unanswerable),
            "out_of_scope_count": len(out_of_scope),
            "unit_hit_any_at_k": (
                round(sum(bool(r["hit_any"]) for r in answerable) / n_a, 4) if n_a else None
            ),
            "complete_evidence_set_at_k": (
                round(sum(bool(r["complete_set"]) for r in answerable) / n_a, 4) if n_a else None
            ),
            "mrr_at_k": round(sum(r["mrr"] for r in answerable) / n_a, 4) if n_a else None,
            "precision_at_k": (
                round(sum(r["precision"] for r in answerable) / n_a, 4) if n_a else None
            ),
            "unanswerable_nonempty_count": sum(bool(r["nonempty"]) for r in unanswerable),
            "out_of_scope_nonempty_count": sum(bool(r["nonempty"]) for r in out_of_scope),
        }

    by_split = {
        split: summarize([r for r in rows if r["split"] == split])
        for split in sorted({r["split"] for r in rows})
    }
    by_stratum = {
        stratum: summarize([r for r in rows if r["label"] == "A" and r["stratum"] == stratum])
        for stratum in sorted({r["stratum"] for r in rows if r["label"] == "A" and r["stratum"]})
    }
    by_topic = defaultdict(list)
    for row in rows:
        if row["label"] == "A" and row["topic"]:
            by_topic[row["topic"]].append(row)

    missed_answerable = [
        {
            "id": r["id"],
            "split": r["split"],
            "stratum": r["stratum"],
            "topic": r["topic"],
            "retrieved_units": r["retrieved_units"],
            "acceptable_unit_sets": r["acceptable_unit_sets"],
        }
        for r in rows
        if r["label"] == "A" and not r["complete_set"]
    ]

    return {
        "schema_version": 1,
        "mode": "offline_bm25_diagnostic",
        "source_pack": "academic_policies",
        "corpus_mode": "demo_synthetic",
        "snapshot_id": index.snapshot_id,
        "as_of_date": today.isoformat(),
        "top_k": top_k,
        "gold_dataset_id": gold.get("datasetId"),
        "gold_approval_status": gold.get("approvalStatus"),
        "scorable_for_acceptance": False,
        "overall": summarize(rows),
        "by_split": by_split,
        "by_answerable_stratum": by_stratum,
        "by_answerable_topic": {k: summarize(v) for k, v in sorted(by_topic.items())},
        "latency_p50_ms": _percentile(latencies, 0.50),
        "latency_p95_ms": _percentile(latencies, 0.95),
        "missed_answerable_count": len(missed_answerable),
        "missed_answerable": missed_answerable,
    }


def run_live_via_factory(
    gold_path: Path = GOLD_PATH,
    *,
    split: str = "dev",
    limit: int = 5,
    retrieval_mode: str = "hybrid",
) -> dict:
    """Run a bounded live slice through the real Phase 3 create_app() ASGI path."""
    from fastapi.testclient import TestClient

    from app.main import create_app
    from app.settings import Settings

    settings = Settings()
    if not settings.gemini_key:
        return {"status": "not_run", "reason": "GEMINI_API_KEY is not configured"}
    if not settings.grounding.catalog_path or not settings.grounding.sources_path:
        return {
            "status": "not_run",
            "reason": "AI_GROUNDING catalog_path/sources_path pins are required for Phase 3",
        }
    today = datetime.now(timezone(timedelta(hours=7))).date()
    updates = {
        "corpus_mode": "demo_synthetic",
        "retrieval_mode": retrieval_mode,
        "demo_source_pack": "academic_policies",
    }
    if not settings.service_token:
        from pydantic import SecretStr

        updates["service_token"] = SecretStr("policy-demo-live-runner")
    if retrieval_mode == "bm25":
        updates["index_path"] = build("demo_synthetic", today, source_pack="academic_policies")
    settings = settings.model_copy(update=updates)

    gold = json.loads(gold_path.read_text(encoding="utf-8"))
    selected = [c for c in gold["cases"] if c["split"] == split][:limit]
    results = []
    status_counts = Counter()

    with TestClient(create_app(settings)) as client:
        ready = client.get("/ready")
        if ready.status_code != 200:
            return {
                "status": "not_run",
                "reason": "service_not_ready",
                "ready_response": ready.json(),
            }
        token = settings.service_token.get_secret_value()
        for case in selected:
            req_id = f"policy-live-{case['id'].lower()}-{uuid4().hex[:8]}"
            body = {
                "phase": "start",
                "requestId": req_id,
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
                    "remainingToolCalls": 4,
                    "remainingBrokerBatches": 0,
                    "remainingMs": 20000,
                    "remainingInputTokens": 8000,
                    "remainingOutputTokens": 2000,
                },
            }
            t0 = perf_counter()
            resp = client.post(
                "/internal/assistant/turn",
                json=body,
                headers={"Authorization": f"Bearer {token}", "X-Request-ID": req_id},
            )
            elapsed_ms = round((perf_counter() - t0) * 1000, 3)
            data = resp.json()
            outcome = (
                data["final"]["status"]
                if resp.status_code == 200 and "final" in data
                else data.get("error", {}).get("code", f"HTTP_{resp.status_code}")
            )
            status_counts[outcome] += 1
            results.append(
                {
                    "id": case["id"],
                    "label": case["label"],
                    "http_status": resp.status_code,
                    "outcome": outcome,
                    "latency_ms": elapsed_ms,
                    "evidence_sections": [e["sectionId"] for e in data.get("evidence", [])],
                    "citation_count": len(data.get("final", {}).get("citations", [])),
                    "usage": data.get("usage"),
                }
            )
    return {
        "schema_version": 1,
        "mode": f"live_{retrieval_mode}",
        "source_pack": "academic_policies",
        "split": split,
        "attempted": len(results),
        "outcomes": dict(status_counts),
        "cases": results,
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retrieval-only", action="store_true", default=False)
    parser.add_argument("--live", action="store_true", default=False)
    parser.add_argument("--allow-live-api", action="store_true", default=False)
    parser.add_argument("--retrieval-mode", choices=["hybrid", "bm25"], default="hybrid")
    parser.add_argument("--split", choices=["dev", "held_out"], default="dev")
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args(argv)

    if args.live:
        if not args.allow_live_api:
            print(json.dumps({"status": "not_run", "reason": "LIVE_API_NOT_AUTHORIZED"}))
            return 1
        report = run_live_via_factory(
            split=args.split, limit=args.limit, retrieval_mode=args.retrieval_mode
        )
    else:
        with tempfile.TemporaryDirectory(prefix="policy-diag-"):
            report = evaluate_retrieval_offline(top_k=args.top_k)

    encoded = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
    print(encoded)
    return 0 if report.get("status") != "not_run" else 1


if __name__ == "__main__":
    raise SystemExit(main())
