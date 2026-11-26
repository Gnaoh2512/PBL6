"""One pinned release, two retrieval branches, strict rank fusion and explicit failures."""

import asyncio
import json
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from time import perf_counter

from app.diagnostics import Operation, Phase, step
from app.indexing import HybridConfig, IndexingError
from app.ingestion.documents import Chunk
from app.ingestion.snapshot import normalize
from app.providers.contracts import DependencyError, Evidence, TurnBudget
from app.providers.embeddings import validate_vector
from app.retrieval.fusion import Candidate, eligible, rrf


@dataclass(frozen=True)
class BackendResult:
    status: str
    candidates: tuple[Candidate, ...] = ()
    error: str | None = None
    stage: str | None = None
    latency_ms: float = 0.0


@dataclass(frozen=True)
class HybridResult:
    status: str
    snapshot_id: str | None
    ranked: tuple
    bm25: BackendResult
    vector: BackendResult
    latency_ms: float
    snapshot_error: str | None = None

    def debug(self):
        def backend(result):
            return {
                "status": result.status,
                "error": result.error,
                "stage": result.stage,
                "latency_ms": result.latency_ms,
                "candidates": [
                    {
                        "chunk_id": c.chunk.chunk_id,
                        "source_id": c.chunk.source_id,
                        "section_id": c.chunk.section_id,
                        "rank": c.rank,
                        "score": c.score,
                    }
                    for c in result.candidates
                ],
            }

        return {
            "status": self.status,
            "snapshot_id": self.snapshot_id,
            "latency_ms": self.latency_ms,
            "snapshot_error": self.snapshot_error,
            "bm25": backend(self.bm25),
            "vector": backend(self.vector),
            "evidence": [r.debug() for r in self.ranked],
        }


_BM25_STOPWORDS = frozenset(
    {
        "co",
        "khong",
        "la",
        "gi",
        "toi",
        "cho",
        "hoi",
        "cua",
        "va",
        "the",
        "nao",
        "o",
        "may",
        "bao",
        "nhieu",
        "thi",
        "phai",
        "luc",
    }
)


def _bm25_expression(query: str) -> str | None:
    """Build an FTS5 OR query combining filtered unigrams and adjacent compound bigrams."""
    ordered = [
        token
        for token in re.findall(r"[a-z0-9]+", normalize(query))
        if token not in _BM25_STOPWORDS
    ][:64]
    if not ordered:
        return None
    unigrams = list(dict.fromkeys(ordered))
    bigrams = list(
        dict.fromkeys(
            f"{ordered[i]} {ordered[i + 1]}"
            for i in range(len(ordered) - 1)
            if ordered[i] != ordered[i + 1]
        )
    )[:48]
    return " OR ".join([*(f'"{t}"' for t in unigrams), *(f'"{p}"' for p in bigrams)])


class HybridRetriever:
    def __init__(self, paired, embedder, vector, *, config=None):
        self.paired, self.embedder, self.vector = paired, embedder, vector
        self.config = config or HybridConfig()

    def pin(self, today):
        if self.embedder.profile != self.paired.profile:
            raise IndexingError("INDEX_CONFIGURATION_CHANGED")
        return self.paired.local_active(today)

    def bm25(self, query, manifest, today, *, category=None, source_id=None):
        expression = _bm25_expression(query)
        if not expression:
            return ()
        path = self.paired.directory / manifest["run_id"] / "index.sqlite"
        try:
            with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
                rows = db.execute(
                    "SELECT metadata,bm25(chunks) FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks),rowid",
                    (expression,),
                ).fetchall()
            expected = {c["chunk_id"]: c for c in manifest["chunks"]}
            result = []
            for raw, score in rows:
                chunk = Chunk.model_validate_json(raw)
                if chunk.payload() != expected.get(chunk.chunk_id):
                    raise IndexingError("INDEX_OUT_OF_SYNC")
                if eligible(
                    chunk,
                    mode=self.paired.mode,
                    today=today,
                    category=category,
                    source_id=source_id,
                ):
                    result.append(Candidate(chunk, "bm25", len(result) + 1, score))
                    if len(result) >= self.config.bm25_top_k:
                        break
            return tuple(result)
        except (sqlite3.Error, ValueError, KeyError, TypeError):
            raise IndexingError("BM25_UNAVAILABLE") from None

    async def vector_candidates(
        self, query, manifest, today, budget, *, category=None, source_id=None
    ):
        vector = validate_vector(
            await self.embedder.query(query, budget), self.paired.profile.dimension
        )  # Exactly one encode per user query, never one per candidate.
        points = await self.vector.search(
            manifest,
            vector,
            self.paired.profile.dimension,
            budget,
            category=category,
            source_id=source_id,
            limit=self.config.vector_top_k,
        )
        expected = {
            c["chunk_id"]: {**c, "snapshot_id": manifest["snapshot_id"]} for c in manifest["chunks"]
        }
        result = []
        for p in points:
            payload = p["payload"]
            if payload != expected.get(payload.get("chunk_id")):
                raise IndexingError("INDEX_OUT_OF_SYNC")
            try:
                chunk = Chunk.model_validate_json(
                    json.dumps({k: v for k, v in payload.items() if k != "snapshot_id"})
                )
            except (ValueError, TypeError):
                raise IndexingError("QDRANT_PROTOCOL_ERROR") from None
            if eligible(
                chunk, mode=self.paired.mode, today=today, category=category, source_id=source_id
            ):
                result.append(Candidate(chunk, "vector", len(result) + 1, p["score"]))
        return tuple(result)

    async def retrieve(self, query, today, *, budget=None, category=None, source_id=None):
        budget = budget or TurnBudget()
        async with asyncio.timeout(budget.seconds()):
            return await self._retrieve(
                query, today, budget=budget, category=category, source_id=source_id
            )

    async def _retrieve(self, query, today, *, budget, category=None, source_id=None):
        started = perf_counter()
        budget = budget or TurnBudget()
        if not isinstance(query, str) or len(query) > 2000:
            raise IndexingError("SEARCH_INVALID")
        if not query.strip():
            empty = BackendResult("not_run", stage="empty_query")
            return HybridResult("empty", None, (), empty, empty, (perf_counter() - started) * 1000)
        try:
            budget.seconds()
            manifest = self.pin(today)
            budget.seconds()
        except IndexingError as error:
            skipped = BackendResult("not_run", stage="snapshot")
            return HybridResult(
                "failed", None, (), skipped, skipped, (perf_counter() - started) * 1000, error.code
            )

        async def bm25():
            tick = perf_counter()
            try:
                candidates = await asyncio.to_thread(
                    self.bm25, query, manifest, today, category=category, source_id=source_id
                )
                budget.seconds()
                return BackendResult(
                    "ok" if candidates else "empty",
                    candidates,
                    latency_ms=(perf_counter() - tick) * 1000,
                )
            except IndexingError as error:
                return BackendResult(
                    "error",
                    error=error.code,
                    stage="bm25",
                    latency_ms=(perf_counter() - tick) * 1000,
                )

        async def vector():
            tick = perf_counter()
            try:
                candidates = await self.vector_candidates(
                    query, manifest, today, budget, category=category, source_id=source_id
                )
                return BackendResult(
                    "ok" if candidates else "empty",
                    candidates,
                    latency_ms=(perf_counter() - tick) * 1000,
                )
            except IndexingError as error:
                stage = (
                    "embedding"
                    if error.code.startswith(("EMBEDDING_", "VECTOR_INVALID"))
                    or error.code == "DIMENSION_MISMATCH"
                    else "vector"
                )
                return BackendResult(
                    "error",
                    error=error.code,
                    stage=stage,
                    latency_ms=(perf_counter() - tick) * 1000,
                )

        tasks = [asyncio.create_task(bm25()), asyncio.create_task(vector())]
        try:
            a, b = await asyncio.gather(*tasks)
        except BaseException:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            raise
        if a.status == "error" or b.status == "error":
            return HybridResult(
                "failed", manifest["snapshot_id"], (), a, b, (perf_counter() - started) * 1000
            )
        try:
            if (await asyncio.to_thread(self.pin, today))["snapshot_id"] != manifest["snapshot_id"]:
                raise IndexingError("INDEX_CHANGED_DURING_QUERY")
        except IndexingError as error:
            return HybridResult(
                "failed",
                manifest["snapshot_id"],
                (),
                a,
                b,
                (perf_counter() - started) * 1000,
                error.code,
            )
        budget.seconds()
        ranked = rrf(
            a.candidates,
            b.candidates,
            constant=self.config.rrf_constant,
            top_k=self.config.final_top_k,
            mode=self.paired.mode,
            today=today,
            category=category,
            source_id=source_id,
        )
        return HybridResult(
            "hybrid" if ranked else "empty",
            manifest["snapshot_id"],
            ranked,
            a,
            b,
            (perf_counter() - started) * 1000,
        )


@dataclass(frozen=True)
class EvidenceBatch:
    snapshot_id: str | None
    evidence: tuple[Evidence, ...]


def faq_batch(result):
    if result.status not in {"hybrid", "empty", "failed"}:
        raise DependencyError("AI_PROTOCOL_ERROR")
    if result.status == "failed":
        failures = [b for b in (result.bm25, result.vector) if b.error]
        code = "DEPENDENCY_UNAVAILABLE"
        if any(b.error.endswith("_TIMEOUT") for b in failures):
            code = "DEADLINE_EXCEEDED"
        elif any(
            b.error
            in {
                "EMBEDDING_PROTOCOL_ERROR",
                "VECTOR_INVALID",
                "RETRIEVAL_PROTOCOL_ERROR",
                "RETRIEVAL_IDENTITY_MISMATCH",
            }
            or (b.stage == "embedding" and b.error == "DIMENSION_MISMATCH")
            for b in failures
        ):
            code = "AI_PROTOCOL_ERROR"
        raise DependencyError(code)
    evidence = []
    for ranked in result.ranked[:3]:  # Existing Spring/API citation cap, independent of CLI top-k.
        c = ranked.chunk
        evidence.append(
            Evidence(
                citationId=c.chunk_id,
                documentId=c.source_id,
                version=c.document_version,
                chunkId=c.chunk_id,
                sectionId=c.section_id,
                title=c.title,
                sourceRef=c.source_ref,
                excerpt=c.content,
                corpusMode=c.corpus_mode,
            )
        )
    return EvidenceBatch(result.snapshot_id, tuple(evidence))


class HybridFaqIndex:
    def __init__(self, retriever):
        self.retriever = retriever

    def validate(self, today):
        try:
            self.retriever.pin(today)
        except IndexingError:
            raise DependencyError() from None

    async def ready_async(self, today):
        try:
            manifest = await asyncio.to_thread(self.retriever.pin, today)
            await self.retriever.vector.ready(
                manifest, self.retriever.paired.profile.dimension, TurnBudget(remaining_ms=5000)
            )
        except IndexingError:
            raise DependencyError() from None

    async def retrieve(self, query, today, budget):
        with step(Phase.INDEX, operation=Operation.RETRIEVAL):
            try:
                result = await self.retriever.retrieve(query, today, budget=budget)
            except IndexingError as error:
                code = (
                    "AI_PROTOCOL_ERROR"
                    if error.code == "SEARCH_INVALID"
                    else "DEPENDENCY_UNAVAILABLE"
                )
                raise DependencyError(code) from None
            return faq_batch(result)

    async def close(self):
        try:
            await self.retriever.embedder.close()
        finally:
            await self.retriever.vector.close()


async def create_hybrid_index(settings):
    from app.indexing import IndexingSettings
    from app.ingestion.vector_pipeline import PairedIndex
    from app.providers.retrieval_http import AsyncQueryEmbedding, AsyncVectorSearch

    config = IndexingSettings()
    embedder = AsyncQueryEmbedding(
        settings.gemini_key, config.embedding, timeout=config.http_timeout
    )
    vector = None
    try:
        vector = AsyncVectorSearch(
            config.qdrant_url, key=config.qdrant_key, timeout=config.http_timeout
        )
        paired = PairedIndex(
            settings.corpus_mode,
            None,
            None,
            profile=config.embedding,
            chunking=config.chunking,
            source_pack=settings.demo_source_pack,
        )
    except (IndexingError, ValueError):
        await embedder.close()
        if vector is not None:
            await vector.close()
        raise
    return HybridFaqIndex(HybridRetriever(paired, embedder, vector, config=config.hybrid))
