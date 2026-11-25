import httpx
import pytest

from app.indexing import IndexingError
from app.providers.qdrant import Qdrant

NAME = "pbl6_demo_synthetic_" + "a" * 16 + "_" + "b" * 32


@pytest.mark.parametrize(
    "response,code",
    [
        (httpx.Response(503, text="private-body"), "QDRANT_UNAVAILABLE"),
        (httpx.Response(401), "QDRANT_UNAVAILABLE"),
        (httpx.Response(302, headers={"location": "https://other.test"}), "QDRANT_UNAVAILABLE"),
        (httpx.Response(200, text="bad"), "QDRANT_PROTOCOL_ERROR"),
        (httpx.Response(200, json={"status": "error"}), "QDRANT_PROTOCOL_ERROR"),
        (httpx.Response(200, json={"status": "ok"}), "QDRANT_PROTOCOL_ERROR"),
        (httpx.Response(200, json={"status": "ok", "result": False}), "QDRANT_PROTOCOL_ERROR"),
    ],
)
def test_qdrant_http_failures_are_bounded_sanitized_and_not_retried(response, code):
    calls = []

    def handle(request):
        calls.append(request)
        return response

    store = Qdrant(transport=httpx.MockTransport(handle))
    try:
        with pytest.raises(IndexingError) as error:
            store.create(NAME, 768)
        assert str(error.value) == code and len(calls) == 1
    finally:
        store.close()


@pytest.mark.parametrize(
    "error,code",
    [
        (httpx.ReadTimeout("private"), "QDRANT_TIMEOUT"),
        (httpx.ConnectError("private"), "QDRANT_UNAVAILABLE"),
    ],
)
def test_qdrant_transport_failure(error, code):
    def handle(request):
        raise error

    store = Qdrant(transport=httpx.MockTransport(handle))
    try:
        with pytest.raises(IndexingError, match=code):
            store.create(NAME, 768)
    finally:
        store.close()


@pytest.mark.parametrize(
    "url",
    [
        "http://remote.test:6333",
        "http://user:password@127.0.0.1:6333",
        "http://127.0.0.1:6333/path",
        "http://127.0.0.1:6333?key=private",
    ],
)
def test_invalid_qdrant_configuration(url):
    with pytest.raises(IndexingError, match="QDRANT_CONFIGURATION_INVALID"):
        Qdrant(url)


def test_collection_names_invalid_query_vectors_and_dimensions_fail_closed():
    def handle(request):
        return httpx.Response(
            200,
            json={
                "status": "ok",
                "result": {"config": {"params": {"vectors": {"size": 1536, "distance": "Cosine"}}}},
            },
        )

    store = Qdrant(transport=httpx.MockTransport(handle))
    try:
        with pytest.raises(IndexingError, match="QDRANT_COLLECTION_INVALID"):
            store.create("../other", 768)
        with pytest.raises(IndexingError, match="DIMENSION_MISMATCH"):
            store.inventory(NAME, 768)
        with pytest.raises(IndexingError, match="DIMENSION_MISMATCH"):
            store.search(NAME, [1], 768, mode="demo_synthetic")
        with pytest.raises(IndexingError, match="SEARCH_INVALID"):
            store.search(NAME, [1] * 768, 768, mode="production", limit=0)
    finally:
        store.close()


def test_malformed_pagination_and_search_results_are_rejected():
    def handle(request):
        if request.method == "GET":
            result = {"config": {"params": {"vectors": {"size": 768, "distance": "Cosine"}}}}
        elif request.url.path.endswith("scroll"):
            result = {"points": [], "next_page_offset": "repeat"}
        else:
            result = {"points": [{"id": "bad", "payload": {}, "score": 1}]}
        return httpx.Response(200, json={"status": "ok", "result": result})

    store = Qdrant(transport=httpx.MockTransport(handle))
    try:
        with pytest.raises(IndexingError, match="QDRANT_PROTOCOL_ERROR"):
            store.inventory(NAME, 768)
        with pytest.raises(IndexingError, match="QDRANT_PROTOCOL_ERROR"):
            store.search(NAME, [1] * 768, 768, mode="demo_synthetic")
    finally:
        store.close()
