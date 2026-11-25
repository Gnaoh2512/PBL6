"""Small bounded Qdrant REST client; immutable physical collections, no active aliases."""

import json
import math
import re
from uuid import NAMESPACE_URL, uuid5

import httpx
from pydantic import SecretStr

from app.indexing import IndexingError
from app.providers.embeddings import validate_vector


def point_id(chunk_id):
    return str(uuid5(NAMESPACE_URL, "pbl6:chunk:" + chunk_id))


class Qdrant:
    def __init__(
        self,
        url="http://127.0.0.1:6333",
        *,
        key: SecretStr | None = None,
        timeout=30.0,
        transport=None,
    ):
        parsed = httpx.URL(url)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.host
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or parsed.path not in {"", "/"}
            or (parsed.scheme == "http" and parsed.host not in {"127.0.0.1", "localhost", "::1"})
        ):
            raise IndexingError("QDRANT_CONFIGURATION_INVALID")
        self._client = httpx.Client(
            base_url=url.rstrip("/") + "/",
            timeout=timeout,
            transport=transport,
            headers={"api-key": key.get_secret_value()} if key else {},
            trust_env=False,
            follow_redirects=False,
            limits=httpx.Limits(max_connections=2),
        )

    def close(self):
        self._client.close()

    @staticmethod
    def _name(name):
        if not re.fullmatch(r"pbl6_(production|demo_synthetic)_[a-f0-9]{16}_[a-f0-9]{32}", name):
            raise IndexingError("QDRANT_COLLECTION_INVALID")
        return f"collections/{name}"

    def _request(self, method, path, body=None, *, missing_ok=False):
        try:
            with self._client.stream(method, path, json=body) as response:
                if missing_ok and response.status_code == 404:
                    return None
                if response.status_code != 200:
                    raise IndexingError("QDRANT_UNAVAILABLE")
                raw = bytearray()
                for part in response.iter_bytes():
                    raw.extend(part)
                    if len(raw) > 8 * 1024 * 1024:
                        raise IndexingError("QDRANT_PROTOCOL_ERROR")
                data = json.loads(raw)
                if not isinstance(data, dict) or data.get("status") != "ok":
                    raise ValueError()
                return data["result"]
        except httpx.TimeoutException:
            raise IndexingError("QDRANT_TIMEOUT") from None
        except httpx.HTTPError:
            raise IndexingError("QDRANT_UNAVAILABLE") from None
        except (ValueError, KeyError, TypeError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None

    def create(self, name, dimension):
        result = self._request(
            "PUT", self._name(name), {"vectors": {"size": dimension, "distance": "Cosine"}}
        )
        if result is not True:
            raise IndexingError("QDRANT_PROTOCOL_ERROR")

    def delete(self, name):
        result = self._request("DELETE", self._name(name), missing_ok=True)
        # Qdrant can return 200/false when already absent. Confirm absence explicitly.
        if result is False:
            if self._request("GET", self._name(name), missing_ok=True) is not None:
                raise IndexingError("QDRANT_PROTOCOL_ERROR")
        elif result is not None and result is not True:
            raise IndexingError("QDRANT_PROTOCOL_ERROR")

    def upsert(self, name, chunks, vectors, snapshot_id, dimension):
        if len(chunks) != len(vectors):
            raise IndexingError("VECTOR_COUNT_MISMATCH")
        points = [
            {
                "id": point_id(c.chunk_id),
                "vector": validate_vector(v, dimension),
                "payload": {**c.payload(), "snapshot_id": snapshot_id},
            }
            for c, v in zip(chunks, vectors, strict=True)
        ]
        for start in range(0, len(points), 32):
            result = self._request(
                "PUT",
                self._name(name) + "/points?wait=true",
                {"points": points[start : start + 32]},
            )
            if not isinstance(result, dict) or result.get("status") != "completed":
                raise IndexingError("QDRANT_PROTOCOL_ERROR")

    def inventory(self, name, dimension):
        """Full offline audit, bounded to 4096 points; no network on online D1 path."""
        info = self._request("GET", self._name(name))
        try:
            config = info["config"]["params"]["vectors"]
            if config["size"] != dimension or config["distance"] != "Cosine":
                raise IndexingError("DIMENSION_MISMATCH")
            found, offset, offsets = {}, None, set()
            while True:
                body = {"limit": 32, "with_payload": True, "with_vector": True}
                if offset is not None:
                    body["offset"] = offset
                result = self._request("POST", self._name(name) + "/points/scroll", body)
                for point in result["points"]:
                    payload, vector = point["payload"], point["vector"]
                    cid = payload["chunk_id"]
                    if cid in found or point["id"] != point_id(cid):
                        raise ValueError()
                    validate_vector(vector, dimension)
                    found[cid] = (payload, vector)
                    if len(found) > 4096:
                        raise ValueError()
                offset = result["next_page_offset"]
                if offset is None:
                    return found
                if not result["points"]:
                    raise ValueError()
                if str(offset) in offsets:
                    raise ValueError()
                offsets.add(str(offset))
        except (ValueError, TypeError, KeyError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None

    def search(self, name, vector, dimension, *, mode, category=None, source_id=None, limit=3):
        if (
            mode not in {"production", "demo_synthetic"}
            or type(limit) is not int
            or not 1 <= limit <= 20
        ):
            raise IndexingError("SEARCH_INVALID")
        must = [
            {"key": "corpus_mode", "match": {"value": mode}},
            {"key": "approved", "match": {"value": True}},
        ]
        for key, value in [("document_type", category), ("source_id", source_id)]:
            if value is not None:
                must.append({"key": key, "match": {"value": value}})
        result = self._request(
            "POST",
            self._name(name) + "/points/query",
            {
                "query": validate_vector(vector, dimension),
                "limit": limit,
                "with_payload": True,
                "filter": {"must": must},
            },
        )
        try:
            points = result["points"]
            if not isinstance(points, list) or len(points) > limit:
                raise ValueError()
            for point in points:
                if type(point["score"]) not in (float, int) or not math.isfinite(point["score"]):
                    raise ValueError()
                if point["id"] != point_id(point["payload"]["chunk_id"]):
                    raise ValueError()
            return points
        except (ValueError, TypeError, KeyError):
            raise IndexingError("QDRANT_PROTOCOL_ERROR") from None
