import asyncio
import importlib.util
import json
import os

import httpx
import pytest
import test_qdrant_indexing as docker_fixtures
from indexing_support import TODAY, FakeEmbedding, corpus
from pydantic import SecretStr

from app.ingestion.snapshot import ROOT
from app.ingestion.vector_pipeline import PairedIndex
from app.providers.embeddings import embedding_body
from app.providers.qdrant import Qdrant
from app.providers.retrieval_http import AsyncQueryEmbedding, AsyncVectorSearch
from app.retrieval.hybrid import HybridRetriever

pytestmark = pytest.mark.skipif(
    os.getenv("PBL6_QDRANT_DOCKER") != "1", reason="Explicit Docker opt-in required"
)


docker_url = docker_fixtures.docker_url
no_network = docker_fixtures.no_network


def test_real_hybrid_query_embeds_once_and_queries_active_collection(tmp_path, docker_url):
    corpus(tmp_path)
    encoder = FakeEmbedding()
    store = Qdrant(docker_url)
    manifest = None
    calls = []

    async def handle(request):
        calls.append(json.loads(request.content))
        return httpx.Response(200, json={"embedding": {"values": [1.0] + [0.0] * 767}})

    async def scenario():
        embedder = AsyncQueryEmbedding(
            SecretStr("offline-placeholder"), encoder.profile, transport=httpx.MockTransport(handle)
        )
        vector = AsyncVectorSearch(docker_url)
        try:
            retriever = HybridRetriever(paired, embedder, vector)
            result = await retriever.retrieve("wifi", TODAY)
            assert result.status == "hybrid" and result.ranked[0].chunk.section_id == "FAQ-WIFI"
            assert result.snapshot_id == manifest["snapshot_id"]
            assert {s.backend for s in result.ranked[0].sources} == {"bm25", "vector"}
            assert (await retriever.retrieve("wifi", TODAY, category="policy")).status == "empty"
            assert len(calls) == 2 and all(
                c == embedding_body(encoder.profile, "wifi", encoder.profile.query_task)
                for c in calls
            )
            store.delete(manifest["collection"])
            failed = await retriever.retrieve("wifi", TODAY)
            assert failed.status == "failed" and failed.vector.error == "QDRANT_COLLECTION_MISSING"
        finally:
            await embedder.close()
            await vector.close()

    try:
        paired = PairedIndex("demo_synthetic", encoder, store, root=tmp_path)
        manifest = paired.rebuild(TODAY)
        asyncio.run(scenario())
    finally:
        if manifest:
            store.delete(manifest["collection"])
        store.close()


def test_retrieval_benchmark_real_qdrant_fixed_gold_and_no_gemini(docker_url):
    path = ROOT / "tests/evaluation/benchmark_hybrid.py"
    spec = importlib.util.spec_from_file_location("phase2_benchmark", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    output = os.getenv("PBL6_HYBRID_BENCHMARK_REPORT")
    report = asyncio.run(module.benchmark(docker_url, output=output))
    assert report["answerable"] == 16 and report["unanswerable"] == 2
    assert set(report["summary"]) == {"bm25", "vector", "hybrid"}
    assert "NOT Gemini" in report["scope"]
    for metrics in report["summary"].values():
        assert 0 <= metrics["recall_at_k"] <= 1 and 0 <= metrics["mrr_at_k"] <= 1
        assert metrics["latency_p95_ms"] >= metrics["latency_p50_ms"] > 0
    assert all(
        len(row[method]["sections"]) <= 3 for row in report["cases"] for method in report["summary"]
    )


def test_real_factory_hybrid_faq_with_native_retrieval_http_and_existing_api(
    tmp_path, docker_url, monkeypatch
):
    from fastapi.testclient import TestClient
    from test_faq_runtime import LabeledFakeProvider, payload

    import app.indexing as config_module
    import app.ingestion.vector_pipeline as paired_module
    import app.main as main
    import app.providers.retrieval_http as transport_module
    from app.indexing import IndexingSettings
    from app.schemas.faq import Probe
    from app.settings import Settings

    corpus(tmp_path)
    encoder = FakeEmbedding()
    store = Qdrant(docker_url)
    paired = PairedIndex("demo_synthetic", encoder, store, root=tmp_path)
    manifest = paired.rebuild(TODAY)
    config = IndexingSettings(_env_file=None, qdrant_url=docker_url)
    from grounding_support import write_artifacts

    grounding = write_artifacts(paired)[1]
    requests = []
    closed = []

    async def handle(request):
        requests.append(json.loads(request.content))
        return httpx.Response(200, json={"embedding": {"values": [1.0] + [0.0] * 767}})

    real_encoder = AsyncQueryEmbedding

    def query_encoder(key, profile, **kwargs):
        return real_encoder(key, profile, transport=httpx.MockTransport(handle), **kwargs)

    real_paired = PairedIndex

    def pinned(*args, **kwargs):
        return real_paired(*args, root=tmp_path, **kwargs)

    class FakeGeneration(LabeledFakeProvider):
        def __init__(self, *_):
            super().__init__()

        async def generate(self, system, data, schema, budget):
            if schema is Probe:
                return Probe(ok=True)
            return await super().generate(system, data, schema, budget)

        async def close(self):
            closed.append(True)

    monkeypatch.setattr(config_module, "IndexingSettings", lambda: config)
    monkeypatch.setattr(paired_module, "PairedIndex", pinned)
    monkeypatch.setattr(transport_module, "AsyncQueryEmbedding", query_encoder)
    monkeypatch.setattr(main, "Gemini", FakeGeneration)
    settings = Settings(
        _env_file=None,
        gemini_key="offline-placeholder",
        service_token="test-service",
        retrieval_mode="hybrid",
        grounding=grounding,
        corpus_mode="demo_synthetic",
    )
    try:
        with TestClient(main.create_app(settings)) as client:
            assert client.get("/ready").status_code == 200
            data = payload()
            response = client.post(
                "/internal/assistant/turn",
                json=data,
                headers={"Authorization": "Bearer test-service", "X-Request-ID": data["requestId"]},
            )
            assert response.status_code == 200 and response.json()["final"]["status"] == "answered"
            assert (
                response.json()["final"]["citations"][0]["chunkId"]
                == manifest["chunks"][0]["chunk_id"]
            )
            assert len(requests) == 1 and requests[0]["taskType"] == "RETRIEVAL_QUERY"
        assert closed == [True]
    finally:
        store.delete(manifest["collection"])
        store.close()
