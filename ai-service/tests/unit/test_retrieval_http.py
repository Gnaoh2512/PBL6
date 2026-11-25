import asyncio
import json

import httpx
import pytest
from pydantic import SecretStr

from app.indexing import EmbeddingProfile, IndexingError
from app.providers.contracts import TurnBudget
from app.providers.retrieval_http import AsyncQueryEmbedding, AsyncVectorSearch


@pytest.mark.parametrize("model", ["gemini-embedding-001", "gemini-embedding-2"])
def test_async_query_reuses_phase1_model_task_recipe_and_dimensions(model):
    requests = []

    async def handle(request):
        requests.append(request)
        return httpx.Response(200, json={"embedding": {"values": [2.0] + [0.0] * 767}})

    async def scenario():
        profile = EmbeddingProfile(model=model)
        provider = AsyncQueryEmbedding(
            SecretStr("offline-placeholder"), profile, transport=httpx.MockTransport(handle)
        )
        try:
            assert await provider.query("hành lý", TurnBudget()) == [1.0] + [0.0] * 767
        finally:
            await provider.close()

    asyncio.run(scenario())
    body = json.loads(requests[0].content)
    assert body["model"] == "models/" + model and body["outputDimensionality"] == 768
    if model.endswith("001"):
        assert body["taskType"] == "RETRIEVAL_QUERY" and "title" not in body
    else:
        assert (
            "taskType" not in body
            and body["content"]["parts"][0]["text"] == "task: search result | query: hành lý"
        )


@pytest.mark.parametrize(
    "mode,code",
    [
        ("503", "EMBEDDING_UNAVAILABLE"),
        ("timeout", "EMBEDDING_TIMEOUT"),
        ("connection", "EMBEDDING_UNAVAILABLE"),
        ("bad", "EMBEDDING_PROTOCOL_ERROR"),
        ("dimension", "DIMENSION_MISMATCH"),
        ("oversize", "EMBEDDING_PROTOCOL_ERROR"),
    ],
)
def test_async_embedding_errors_are_sanitized_without_retry(mode, code):
    calls = []

    async def handle(request):
        calls.append(request)
        if mode == "timeout":
            raise httpx.ReadTimeout("private")
        if mode == "connection":
            raise httpx.ConnectError("private")
        if mode == "503":
            return httpx.Response(503, text="private-body")
        if mode == "oversize":
            return httpx.Response(200, content=b"x" * (256 * 1024 + 1))
        if mode == "dimension":
            return httpx.Response(200, json={"embedding": {"values": [1]}})
        return httpx.Response(200, text="bad-json")

    async def scenario():
        p = AsyncQueryEmbedding(
            SecretStr("offline-placeholder"),
            EmbeddingProfile(),
            transport=httpx.MockTransport(handle),
        )
        try:
            with pytest.raises(IndexingError, match=code):
                await p.query("wifi", TurnBudget())
        finally:
            await p.close()

    asyncio.run(scenario())
    assert len(calls) == 1


@pytest.mark.parametrize(
    "mode,code",
    [
        ("missing", "QDRANT_COLLECTION_MISSING"),
        ("dimension", "INDEX_OUT_OF_SYNC"),
        ("count", "INDEX_OUT_OF_SYNC"),
        ("timeout", "QDRANT_TIMEOUT"),
        ("bad", "QDRANT_PROTOCOL_ERROR"),
    ],
)
def test_async_vector_dependency_failures(mode, code):
    manifest = {
        "collection": "pbl6_demo_synthetic_" + "a" * 16 + "_" + "b" * 32,
        "chunks": [{}],
        "corpus_mode": "demo_synthetic",
        "snapshot_id": "s",
    }

    async def handle(request):
        if mode == "missing":
            return httpx.Response(404)
        if mode == "timeout":
            raise httpx.ReadTimeout("private")
        if mode == "bad":
            return httpx.Response(200, json={})
        return httpx.Response(
            200,
            json={
                "status": "ok",
                "result": {
                    "points_count": 2 if mode == "count" else 1,
                    "config": {
                        "params": {
                            "vectors": {
                                "size": 1536 if mode == "dimension" else 768,
                                "distance": "Cosine",
                            }
                        }
                    },
                },
            },
        )

    async def scenario():
        p = AsyncVectorSearch(transport=httpx.MockTransport(handle))
        try:
            with pytest.raises(IndexingError, match=code):
                await p.search(manifest, [1] * 768, 768, TurnBudget())
        finally:
            await p.close()

    asyncio.run(scenario())


@pytest.mark.parametrize("url", ["http://[invalid", "http://127.0.0.1:invalid-port"])
def test_invalid_vector_url_has_typed_sanitized_error(url):
    with pytest.raises(IndexingError, match="QDRANT_CONFIGURATION_INVALID"):
        AsyncVectorSearch(url)


def test_native_async_embedding_http_response_closes_on_cancellation():
    closed = []

    class Blocked(httpx.AsyncByteStream):
        async def __aiter__(self):
            await asyncio.Event().wait()
            yield b"not reached"

        async def aclose(self):
            closed.append(True)

    async def handle(request):
        return httpx.Response(200, stream=Blocked())

    async def scenario():
        provider = AsyncQueryEmbedding(
            SecretStr("offline-placeholder"),
            EmbeddingProfile(),
            transport=httpx.MockTransport(handle),
        )
        try:
            with pytest.raises(TimeoutError):
                async with asyncio.timeout(0.02):
                    await provider.query("wifi", TurnBudget())
        finally:
            await provider.close()

    asyncio.run(scenario())
    assert closed == [True]


def test_qdrant_huge_integer_score_is_protocol_error_not_overflow():
    from app.providers.qdrant import point_id

    cid = "a" * 64
    manifest = {
        "collection": "pbl6_demo_synthetic_" + "a" * 16 + "_" + "b" * 32,
        "chunks": [{}],
        "corpus_mode": "demo_synthetic",
        "snapshot_id": "s",
    }

    async def handle(request):
        result = (
            {
                "config": {"params": {"vectors": {"size": 768, "distance": "Cosine"}}},
                "points_count": 1,
            }
            if request.method == "GET"
            else {"points": [{"id": point_id(cid), "payload": {"chunk_id": cid}, "score": 10**400}]}
        )
        return httpx.Response(200, json={"status": "ok", "result": result})

    async def scenario():
        provider = AsyncVectorSearch(transport=httpx.MockTransport(handle))
        try:
            with pytest.raises(IndexingError, match="QDRANT_PROTOCOL_ERROR"):
                await provider.search(manifest, [1.0] * 768, 768, TurnBudget())
        finally:
            await provider.close()

    asyncio.run(scenario())
