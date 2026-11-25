"""Rank-only reciprocal rank fusion; retrieval scores never certify semantic support."""

import math
from dataclasses import dataclass
from datetime import date

from app.indexing import IndexingError
from app.ingestion.documents import Chunk


@dataclass(frozen=True)
class Candidate:
    chunk: Chunk
    backend: str
    rank: int
    score: float

    def __post_init__(self):
        try:
            finite = math.isfinite(self.score) if type(self.score) in (int, float) else False
        except OverflowError:
            finite = False
        if (
            self.backend not in {"bm25", "vector"}
            or type(self.rank) is not int
            or self.rank < 1
            or type(self.score) not in (int, float)
            or not finite
        ):
            raise IndexingError("RETRIEVAL_PROTOCOL_ERROR")


@dataclass(frozen=True)
class RankedEvidence:
    chunk: Chunk
    rank: int
    rrf_score: float
    sources: tuple[Candidate, ...]

    def debug(self):
        return {
            "chunk": self.chunk.payload(),
            "rank": self.rank,
            "rrf_score": self.rrf_score,
            "retrieval_sources": [
                {"backend": s.backend, "rank": s.rank, "score": s.score} for s in self.sources
            ],
        }


def eligible(chunk, *, mode, today: date, category=None, source_id=None):
    return (
        chunk.approved is True
        and chunk.corpus_mode == mode
        and chunk.effective_from <= today
        and (chunk.effective_to is None or today <= chunk.effective_to)
        and (category is None or chunk.document_type == category)
        and (source_id is None or chunk.source_id == source_id)
    )


def rrf(bm25, vector, *, constant=60, top_k=3, mode, today, category=None, source_id=None):
    if type(constant) is not int or constant < 1 or type(top_k) is not int or not 1 <= top_k <= 100:
        raise IndexingError("SEARCH_INVALID")
    chunks, votes = {}, {}
    for backend, candidates in (("bm25", bm25), ("vector", vector)):
        for c in candidates:
            if c.backend != backend:
                raise IndexingError("RETRIEVAL_PROTOCOL_ERROR")
            if not eligible(
                c.chunk, mode=mode, today=today, category=category, source_id=source_id
            ):
                continue
            cid = c.chunk.chunk_id
            if cid in chunks and chunks[cid] != c.chunk:
                raise IndexingError("RETRIEVAL_IDENTITY_MISMATCH")
            chunks[cid] = c.chunk
            # A duplicated row contributes once per backend, using its best original rank.
            previous = votes.setdefault(cid, {}).get(backend)
            if previous is None or c.rank < previous.rank:
                votes[cid][backend] = c
    scored = []
    for cid, sources in votes.items():
        if not eligible(
            chunks[cid], mode=mode, today=today, category=category, source_id=source_id
        ):
            continue
        ordered = tuple(sources[b] for b in ("bm25", "vector") if b in sources)
        score = math.fsum(1 / (constant + s.rank) for s in ordered)
        scored.append((cid, score, min(s.rank for s in ordered), ordered))
    scored.sort(key=lambda row: (-row[1], row[2], row[0]))
    return tuple(
        RankedEvidence(chunks[cid], rank, score, sources)
        for rank, (cid, score, _, sources) in enumerate(scored[:top_k], 1)
    )
