"""Offline query adapters over Phase 1 test doubles."""

from indexing_support import FakeEmbedding, MemoryQdrant, corpus

from app.indexing import IndexingError
from app.ingestion.vector_pipeline import PairedIndex
from app.retrieval.hybrid import HybridRetriever


class QueryEmbedding:
    def __init__(self, profile):
        self.profile = profile
        self.calls = []
        self.error = None

    async def query(self, text, budget):
        self.calls.append((text, budget))
        if self.error:
            raise IndexingError(self.error)
        return [1.0] + [0.0] * (self.profile.dimension - 1)

    async def close(self):
        pass


class VectorSearch:
    def __init__(self, store):
        self.store = store
        self.error = None
        self.calls = []

    async def ready(self, manifest, dimension, budget):
        if self.error:
            raise IndexingError(self.error)
        self.store.inventory(manifest["collection"], dimension)

    async def search(self, manifest, vector, dimension, budget, **filters):
        self.calls.append(manifest["collection"])
        await self.ready(manifest, dimension, budget)
        return self.store.search(
            manifest["collection"], vector, dimension, mode=manifest["corpus_mode"], **filters
        )

    async def close(self):
        pass


def hybrid(root, today, config=None):
    corpus(root)
    encoder, store = FakeEmbedding(), MemoryQdrant()
    paired = PairedIndex("demo_synthetic", encoder, store, root=root)
    paired.rebuild(today)
    query = QueryEmbedding(encoder.profile)
    vector = VectorSearch(store)
    return HybridRetriever(paired, query, vector, config=config)
