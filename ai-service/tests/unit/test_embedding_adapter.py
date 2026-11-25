import json
import math

import httpx
import pytest
from pydantic import SecretStr, ValidationError

from app.indexing import EmbeddingProfile, IndexingError, IndexingSettings
from app.providers.embeddings import GeminiEmbedding, validate_vector


def test_embedding_rest_model_tasks_dimension_and_normalization():
    requests = []

    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={"embedding": {"values": [2.0] + [0.0] * 767}})

    provider = GeminiEmbedding(
        SecretStr("offline-placeholder"), EmbeddingProfile(), transport=httpx.MockTransport(handle)
    )
    try:
        assert provider.document("Không nhận vật dễ cháy.", "Hành lý") == [1.0] + [0.0] * 767
        provider.query("Gửi hành lý?")
        a, b = [json.loads(r.content) for r in requests]
        assert (
            str(requests[0].url)
            == "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent"
        )
        assert a["taskType"] == "RETRIEVAL_DOCUMENT" and b["taskType"] == "RETRIEVAL_QUERY"
        assert a["title"] == "Hành lý" and "title" not in b
        assert (
            a["outputDimensionality"] == 768
            and a["content"]["parts"][0]["text"] == "Không nhận vật dễ cháy."
        )
    finally:
        provider.close()


@pytest.mark.parametrize(
    "response,code",
    [
        (httpx.Response(503, text="private-upstream-body"), "EMBEDDING_UNAVAILABLE"),
        (httpx.Response(429), "EMBEDDING_UNAVAILABLE"),
        (httpx.Response(200, text="bad"), "EMBEDDING_PROTOCOL_ERROR"),
        (httpx.Response(200, json={}), "EMBEDDING_PROTOCOL_ERROR"),
        (httpx.Response(200, json={"embedding": {"values": [1.0]}}), "DIMENSION_MISMATCH"),
        (httpx.Response(200, json={"embedding": {"values": [0.0] * 768}}), "VECTOR_INVALID"),
        (httpx.Response(200, content=b"x" * (256 * 1024 + 1)), "EMBEDDING_PROTOCOL_ERROR"),
    ],
)
def test_provider_failures_have_sanitized_codes_and_no_retries(response, code):
    calls = []

    def handle(request):
        calls.append(request)
        return response

    provider = GeminiEmbedding(
        SecretStr("offline-placeholder"), EmbeddingProfile(), transport=httpx.MockTransport(handle)
    )
    try:
        with pytest.raises(IndexingError, match=code) as error:
            provider.query("wifi")
        assert str(error.value) == code and len(calls) == 1
    finally:
        provider.close()


@pytest.mark.parametrize(
    "error,code",
    [
        (httpx.ReadTimeout("private"), "EMBEDDING_TIMEOUT"),
        (httpx.ConnectError("private"), "EMBEDDING_UNAVAILABLE"),
    ],
)
def test_transport_failures(error, code):
    def handle(request):
        raise error

    p = GeminiEmbedding(
        SecretStr("offline-placeholder"), EmbeddingProfile(), transport=httpx.MockTransport(handle)
    )
    try:
        with pytest.raises(IndexingError, match=code):
            p.query("wifi")
    finally:
        p.close()


@pytest.mark.parametrize(
    "values", [[True, 0], [float("nan"), 0], [float("inf"), 0], [0, 0], ["1", 0]]
)
def test_invalid_vectors(values):
    with pytest.raises(IndexingError):
        validate_vector(values, 2)


def test_empty_input_and_central_configuration(monkeypatch):
    monkeypatch.setenv("AI_EMBEDDING", '{"dimension":1536}')
    assert IndexingSettings(_env_file=None).embedding.dimension == 1536
    with pytest.raises(ValidationError):
        EmbeddingProfile(dimension=12)
    p = GeminiEmbedding(
        SecretStr("offline-placeholder"),
        EmbeddingProfile(),
        transport=httpx.MockTransport(lambda _: pytest.fail("Must not dispatch")),
    )
    try:
        with pytest.raises(IndexingError):
            p.query(" ")
        with pytest.raises(IndexingError):
            p.document("x" * 2001, "test")
    finally:
        p.close()
    assert math.isclose(math.hypot(*validate_vector([3, 4], 2)), 1)


def test_embedding_2_uses_documented_prefixes_instead_of_unsupported_task_field():
    requests = []

    def handle(request):
        requests.append(request)
        return httpx.Response(200, json={"embedding": {"values": [1.0] + [0.0] * 1535}})

    profile = EmbeddingProfile(model="gemini-embedding-2", dimension=1536)
    provider = GeminiEmbedding(
        SecretStr("offline-placeholder"), profile, transport=httpx.MockTransport(handle)
    )
    try:
        assert len(provider.document("Full content", "Title")) == 1536
        provider.query("Question")
        document, query = [json.loads(r.content) for r in requests]
        assert requests[0].url.path.endswith("/gemini-embedding-2:embedContent")
        assert "taskType" not in document and "title" not in document
        assert document["content"]["parts"][0]["text"] == "title: Title | text: Full content"
        assert query["content"]["parts"][0]["text"] == "task: search result | query: Question"
        assert document["outputDimensionality"] == 1536
    finally:
        provider.close()
