"""Synthetic, offline-only test doubles; never imported by app/."""

import copy
import math
import shutil
from datetime import date

from app.indexing import EmbeddingProfile, IndexingError
from app.ingestion.snapshot import ROOT
from app.providers.qdrant import point_id

TODAY = date(2026, 11, 21)


def corpus(root):
    p = root / "tests/fixtures/d1/faq.md"
    p.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", p)
    return p


class FakeEmbedding:
    def __init__(self, profile=None):
        self.profile = profile or EmbeddingProfile()
        self.calls = []
        self.failure = None

    def document(self, text, title):
        self.calls.append((text, title))
        if self.failure:
            raise IndexingError("EMBEDDING_UNAVAILABLE")
        axis = 0 if "FAQ-WIFI" in text else 1 if "FAQ-LUGGAGE" in text else 2
        return [float(i == axis) for i in range(self.profile.dimension)]


class MemoryQdrant:
    def __init__(self):
        self.collections = {}
        self.fail_upsert = False
        self.fail_cleanup = False

    def create(self, name, dimension):
        assert name not in self.collections
        self.collections[name] = (dimension, {})

    def upsert(self, name, chunks, vectors, snapshot_id, dimension):
        if self.fail_upsert:
            raise IndexingError("QDRANT_UNAVAILABLE")
        self.collections[name][1].update(
            {
                c.chunk_id: ({**c.payload(), "snapshot_id": snapshot_id}, v)
                for c, v in zip(chunks, vectors, strict=True)
            }
        )

    def inventory(self, name, dimension):
        actual, points = self.collections[name]
        if actual != dimension:
            raise IndexingError("DIMENSION_MISMATCH")
        return copy.deepcopy(points)

    def delete(self, name):
        if self.fail_cleanup:
            raise IndexingError("QDRANT_UNAVAILABLE")
        del self.collections[name]

    def search(self, name, vector, dimension, *, mode, category=None, source_id=None, limit=3):
        hits = []
        for cid, (payload, v) in self.collections[name][1].items():
            if (
                payload["corpus_mode"] != mode
                or (category is not None and category != payload["document_type"])
                or (source_id is not None and source_id != payload["source_id"])
            ):
                continue
            score = sum(a * b for a, b in zip(vector, v, strict=True)) / math.hypot(*vector)
            hits.append({"id": point_id(cid), "payload": copy.deepcopy(payload), "score": score})
        return sorted(hits, key=lambda p: -p["score"])[:limit]
