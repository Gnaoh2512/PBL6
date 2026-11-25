"""Native async retrieval HTTP, sharing Phase 1 embedding wire format and validators."""

import json
import math

import httpx

from app.indexing import IndexingError
from app.providers.embeddings import embedding_body, embedding_response, validate_vector
from app.providers.qdrant import Qdrant, point_id


class AsyncHTTP:
    def __init__(self, url, *, headers=None, timeout=30.0, transport=None):
        self.timeout = timeout
        self.client = httpx.AsyncClient(
            base_url=url,
            headers=headers,
            timeout=timeout,
            transport=transport,
            trust_env=False,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=8),
        )

    async def close(self):
        await self.client.aclose()

    async def post(self, method, path, body, budget, prefix, cap):
        try:
            async with self.client.stream(
                method, path, json=body, timeout=min(self.timeout, budget.seconds())
            ) as response:
                if response.status_code != 200:
                    code = (
                        "QDRANT_COLLECTION_MISSING"
                        if prefix == "QDRANT" and response.status_code == 404
                        else prefix + "_UNAVAILABLE"
                    )
                    raise IndexingError(code)
                raw = bytearray()
                async for part in response.aiter_bytes():
                    raw.extend(part)
                    if len(raw) > cap:
                        raise IndexingError(prefix + "_PROTOCOL_ERROR")
                budget.seconds()
                return bytes(raw)
        except httpx.TimeoutException:
            raise IndexingError(prefix + "_TIMEOUT") from None
        except httpx.HTTPError:
            raise IndexingError(prefix + "_UNAVAILABLE") from None


class AsyncQueryEmbedding:
    def __init__(self, key, profile, *, timeout=30.0, transport=None):
        if not key.get_secret_value().strip():
            raise IndexingError("EMBEDDING_NOT_CONFIGURED")
        self.profile = profile
        self.http = AsyncHTTP(
            f"https://generativelanguage.googleapis.com/{profile.api_version}/",
            headers={"x-goog-api-key": key.get_secret_value()},
            timeout=timeout,
            transport=transport,
        )

    async def close(self):
        await self.http.close()

    async def query(self, text, budget):
        body = embedding_body(self.profile, text, self.profile.query_task)
        raw = await self.http.post(
            "POST",
            f"models/{self.profile.model}:embedContent",
            body,
            budget,
            "EMBEDDING",
            256 * 1024,
        )
        return embedding_response(raw, self.profile.dimension)


class AsyncVectorSearch:
    def __init__(self, url="http://127.0.0.1:6333", *, key=None, timeout=30.0, transport=None):
        # Reuse Phase 1 URL/key boundary validation; this client performs query-only I/O.
        try:
            checked = Qdrant(url, key=key, timeout=timeout)
        except httpx.InvalidURL:
            raise IndexingError("QDRANT_CONFIGURATION_INVALID") from None
        self.http = AsyncHTTP(
            str(checked._client.base_url),
            headers=checked._client.headers,
            timeout=timeout,
            transport=transport,
        )
        checked.close()

    async def close(self):
        await self.http.close()

    async def _request(self, method, path, body, budget):
        raw = await self.http.post(method, path, body, budget, "QDRANT", 8 * 1024 * 1024)
        try:
            data = json.loads(raw)
            if data["status"] != "ok":
                raise ValueError()
            return data["result"]
        except (ValueError, KeyError, TypeError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None

    async def ready(self, manifest, dimension, budget):
        info = await self._request("GET", Qdrant._name(manifest["collection"]), None, budget)
        try:
            config = info["config"]["params"]["vectors"]
            if (
                config["size"] != dimension
                or config["distance"] != "Cosine"
                or info["points_count"] != len(manifest["chunks"])
            ):
                raise IndexingError("INDEX_OUT_OF_SYNC")
        except (ValueError, KeyError, TypeError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None

    async def search(
        self, manifest, vector, dimension, budget, *, category=None, source_id=None, limit=10
    ):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise IndexingError("SEARCH_INVALID")
        await self.ready(manifest, dimension, budget)
        must = [
            {"key": "corpus_mode", "match": {"value": manifest["corpus_mode"]}},
            {"key": "approved", "match": {"value": True}},
            {"key": "snapshot_id", "match": {"value": manifest["snapshot_id"]}},
        ]
        for key, value in [("document_type", category), ("source_id", source_id)]:
            if value is not None:
                must.append({"key": key, "match": {"value": value}})
        result = await self._request(
            "POST",
            Qdrant._name(manifest["collection"]) + "/points/query",
            {
                "query": validate_vector(vector, dimension),
                "limit": limit,
                "with_payload": True,
                "filter": {"must": must},
            },
            budget,
        )
        try:
            points = result["points"]
            if not isinstance(points, list) or len(points) > limit:
                raise ValueError()
            seen = set()
            for p in points:
                cid = p["payload"]["chunk_id"]
                if (
                    cid in seen
                    or p["id"] != point_id(cid)
                    or type(p["score"]) not in (int, float)
                    or not math.isfinite(p["score"])
                ):
                    raise ValueError()
                seen.add(cid)
            return sorted(points, key=lambda p: (-p["score"], p["payload"]["chunk_id"]))
        except (ValueError, KeyError, TypeError, OverflowError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None
