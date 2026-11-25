"""Offline retrieval benchmark. Fixed synthetic gold; hashing encoder is NOT Gemini."""

import argparse
import asyncio
import hashlib
import json
import math
import shutil
import tempfile
import unicodedata
from datetime import date
from pathlib import Path
from time import perf_counter

from app.indexing import EmbeddingProfile, HybridConfig
from app.ingestion.snapshot import ROOT, digest
from app.ingestion.vector_pipeline import PairedIndex
from app.providers.contracts import TurnBudget
from app.providers.embeddings import validate_vector
from app.providers.qdrant import Qdrant
from app.providers.retrieval_http import AsyncVectorSearch
from app.retrieval.hybrid import HybridRetriever

FIXTURES = ROOT / "tests/fixtures/hybrid"


class OfflineHashEmbedding:
    """Label-independent character trigram baseline; never usable through app settings."""

    profile = EmbeddingProfile()

    @staticmethod
    def encode(text):
        normalized = " ".join(unicodedata.normalize("NFC", text).casefold().split())
        values = [0.0] * 768
        for i in range(max(1, len(normalized) - 2)):
            raw = hashlib.sha256(normalized[i : i + 3].encode()).digest()
            values[int.from_bytes(raw[:4], "big") % 768] += 1 if raw[4] & 1 else -1
        return validate_vector(values, 768)

    def document(self, text, title):
        return self.encode(text)

    async def query(self, text, budget):
        return self.encode(text)

    async def close(self):
        pass


def metrics(sections, gold, k):
    selected = sections[:k]
    relevant = set(gold)
    found = relevant & set(selected)
    return {
        "recall": len(found) / len(relevant) if relevant else None,
        "mrr": next((1 / r for r, s in enumerate(selected, 1) if s in relevant), 0.0)
        if relevant
        else None,
        "precision": sum(s in relevant for s in selected) / len(selected) if selected else 0.0,
        "empty": not selected,
    }


def summarize(rows, k):
    result = {}
    for name in ("bm25", "vector", "hybrid"):
        measurements = [r[name] for r in rows]
        answerable = [m for m in measurements if m["metrics"]["recall"] is not None]
        latencies = sorted(m["latency_ms"] for m in measurements)
        result[name] = {
            "recall_at_k": sum(m["metrics"]["recall"] for m in answerable) / len(answerable),
            "mrr_at_k": sum(m["metrics"]["mrr"] for m in answerable) / len(answerable),
            "precision_at_k": sum(m["metrics"]["precision"] for m in answerable) / len(answerable),
            "latency_p50_ms": latencies[math.ceil(len(latencies) * 0.5) - 1],
            "latency_p95_ms": latencies[math.ceil(len(latencies) * 0.95) - 1],
            "unanswerable_nonempty": sum(
                bool(m["sections"])
                for r, m in zip(rows, measurements, strict=True)
                if not r["gold_sections"]
            ),
        }
    return result


async def benchmark(url, *, output=None, k=3):
    gold_bytes = (FIXTURES / "gold.json").read_bytes()
    gold = json.loads(gold_bytes)
    corpus_bytes = (FIXTURES / "corpus.md").read_bytes()
    rows = []
    encoder = OfflineHashEmbedding()
    store = Qdrant(url)
    vector = AsyncVectorSearch(url)
    manifest = None
    try:
        with tempfile.TemporaryDirectory(prefix="pbl6-hybrid-benchmark-") as temporary:
            root = Path(temporary)
            source = root / "tests/fixtures/d1/faq.md"
            source.parent.mkdir(parents=True)
            shutil.copyfile(FIXTURES / "corpus.md", source)
            index = PairedIndex("demo_synthetic", encoder, store, root=root)
            today = date(2026, 11, 21)
            manifest = index.rebuild(today)
            known = {c["section_id"] for c in manifest["chunks"]}
            assert all(set(c["gold_sections"]) <= known for c in gold["cases"])
            retriever = HybridRetriever(index, encoder, vector, config=HybridConfig(final_top_k=k))
            for case in gold["cases"]:
                row = {**case}
                for mode in ("bm25", "vector", "hybrid"):
                    tick = perf_counter()
                    budget = TurnBudget()
                    if mode == "hybrid":
                        result = await retriever.retrieve(case["query"], today, budget=budget)
                        assert result.status in {"hybrid", "empty"}
                        sections = [r.chunk.section_id for r in result.ranked]
                        details = result.debug()
                    else:
                        pinned = retriever.pin(today)
                        candidates = (
                            retriever.bm25(case["query"], pinned, today)
                            if mode == "bm25"
                            else await retriever.vector_candidates(
                                case["query"], pinned, today, budget
                            )
                        )
                        assert retriever.pin(today)["snapshot_id"] == pinned["snapshot_id"]
                        sections = [c.chunk.section_id for c in candidates[:k]]
                        details = [
                            {"section_id": c.chunk.section_id, "rank": c.rank, "score": c.score}
                            for c in candidates
                        ]
                    row[mode] = {
                        "sections": sections,
                        "metrics": metrics(sections, case["gold_sections"], k),
                        "latency_ms": (perf_counter() - tick) * 1000,
                        "details": details,
                    }
                rows.append(row)
            report = {
                "format": 1,
                "dataset": gold["version"],
                "dataset_sha256": digest(gold_bytes),
                "corpus_sha256": digest(corpus_bytes),
                "snapshot_id": manifest["snapshot_id"],
                "scope": "synthetic gold + label-independent fake trigram embeddings + real Docker Qdrant; NOT Gemini semantic quality or production evidence",
                "encoder": {
                    "name": "offline-character-trigram-sha256-v1",
                    "dimension": 768,
                    "gemini_vectors": False,
                    "profile_is_test_compatibility_only": True,
                },
                "config": retriever.config.model_dump(),
                "k": k,
                "answerable": sum(bool(r["gold_sections"]) for r in rows),
                "unanswerable": sum(not r["gold_sections"] for r in rows),
                "latency_scope": "One sequential pass; each mode includes source/manifest/SQLite validation before and after retrieval. Excludes indexing/container startup; query embedding is local hashing, not Gemini latency.",
                "summary": summarize(rows, k),
                "cases": rows,
                "bm25_only_hits": [
                    r["id"]
                    for r in rows
                    if r["bm25"]["metrics"]["recall"] and not r["vector"]["metrics"]["recall"]
                ],
                "vector_only_hits": [
                    r["id"]
                    for r in rows
                    if r["vector"]["metrics"]["recall"] and not r["bm25"]["metrics"]["recall"]
                ],
            }
            if output:
                Path(output).parent.mkdir(parents=True, exist_ok=True)
                Path(output).write_text(
                    json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
                )
            return report
    finally:
        if manifest:
            store.delete(manifest["collection"])
        store.close()
        await vector.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qdrant-url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = asyncio.run(benchmark(args.qdrant_url, output=args.output))
    print(
        json.dumps(
            {
                "scope": report["scope"],
                "summary": report["summary"],
                "bm25_only_hits": report["bm25_only_hits"],
                "vector_only_hits": report["vector_only_hits"],
            },
            ensure_ascii=False,
        )
    )
