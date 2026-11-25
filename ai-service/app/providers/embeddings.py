"""Gemini text embeddings REST adapter. No generation or live-test fallback."""

import json
import math
from typing import Protocol

import httpx
from pydantic import SecretStr

from app.indexing import EmbeddingProfile, IndexingError


def validate_vector(values, dimension):
    if not isinstance(values, (list, tuple)) or len(values) != dimension:
        raise IndexingError("DIMENSION_MISMATCH")
    try:
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
            raise IndexingError("VECTOR_INVALID")
        norm = math.hypot(*values)
    except OverflowError:
        raise IndexingError("VECTOR_INVALID") from None
    if not math.isfinite(norm) or norm == 0:
        raise IndexingError("VECTOR_INVALID")
    return [v / norm for v in values]


class EmbeddingProvider(Protocol):
    profile: EmbeddingProfile

    def document(self, text: str, title: str) -> list[float]: ...

    def query(self, text: str) -> list[float]: ...


def embedding_body(profile, text, task, title=None):
    if not isinstance(text, str) or not text.strip() or len(text) > 2000:
        raise IndexingError("EMBEDDING_INPUT_INVALID")
    if title is not None and (not isinstance(title, str) or not title.strip() or len(title) > 256):
        raise IndexingError("EMBEDDING_INPUT_INVALID")
    body = {
        "model": f"models/{profile.model}",
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": profile.dimension,
    }
    if profile.model == "gemini-embedding-001":
        body["taskType"] = task
        if title is not None:
            body["title"] = title
    else:
        content = (
            f"title: {title} | text: {text}"
            if title is not None
            else f"task: search result | query: {text}"
        )
        body["content"] = {"parts": [{"text": content}]}
    return body


def embedding_response(raw, dimension):
    try:
        return validate_vector(json.loads(raw)["embedding"]["values"], dimension)
    except (ValueError, TypeError, KeyError):
        raise IndexingError("EMBEDDING_PROTOCOL_ERROR") from None


class GeminiEmbedding:
    def __init__(self, key: SecretStr, profile: EmbeddingProfile, *, timeout=30.0, transport=None):
        if not key.get_secret_value().strip():
            raise IndexingError("EMBEDDING_NOT_CONFIGURED")
        self.profile = profile
        self._client = httpx.Client(
            base_url=f"https://generativelanguage.googleapis.com/{profile.api_version}/",
            headers={"x-goog-api-key": key.get_secret_value()},
            timeout=timeout,
            transport=transport,
            follow_redirects=False,
            trust_env=False,
            limits=httpx.Limits(max_connections=2),
        )

    def close(self):
        self._client.close()

    def document(self, text, title):
        return self._embed(text, self.profile.document_task, title)

    def query(self, text):
        return self._embed(text, self.profile.query_task)

    def _embed(self, text, task, title=None):
        body = embedding_body(self.profile, text, task, title)
        try:
            with self._client.stream(
                "POST", f"models/{self.profile.model}:embedContent", json=body
            ) as response:
                if response.status_code != 200:
                    raise IndexingError("EMBEDDING_UNAVAILABLE")
                raw = bytearray()
                for part in response.iter_bytes():
                    raw.extend(part)
                    if len(raw) > 256 * 1024:
                        raise IndexingError("EMBEDDING_PROTOCOL_ERROR")
                return embedding_response(raw, self.profile.dimension)
        except httpx.TimeoutException:
            raise IndexingError("EMBEDDING_TIMEOUT") from None
        except httpx.HTTPError:
            raise IndexingError("EMBEDDING_UNAVAILABLE") from None
        except (ValueError, TypeError, KeyError):
            raise IndexingError("EMBEDDING_PROTOCOL_ERROR") from None
