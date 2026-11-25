"""Offline paired FTS5/Qdrant releases. A single atomic local pointer activates both."""

import json
import math
import os
import re
import sqlite3
import tempfile
from contextlib import closing, contextmanager
from pathlib import Path
from uuid import uuid4

from app.indexing import ChunkingConfig, IndexingError
from app.ingestion.documents import fingerprint, load_chunks
from app.ingestion.snapshot import ALGORITHM, ROOT, digest, normalize
from app.providers.embeddings import validate_vector


def _json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, allow_nan=False).encode()


def _read_json(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    raw = path.read_bytes()
    if len(raw) > 16 * 1024 * 1024:
        raise ValueError("Oversized manifest")
    return json.loads(raw, object_pairs_hook=pairs)


def _vector_checksum(inventory):
    return digest(_json({cid: vector for cid, (_, vector) in inventory.items()}))


class PairedIndex:
    def __init__(
        self,
        mode,
        embedding,
        store,
        *,
        root: Path = ROOT,
        chunking=None,
        profile=None,
        source_pack: str = "d1_fixture",
    ):
        if mode not in {"production", "demo_synthetic"}:
            raise IndexingError("MODE_INVALID")
        self.root, self.mode, self.source_pack = root.resolve(), mode, source_pack
        self.embedding, self.store = embedding, store
        self.profile = profile if profile is not None else embedding.profile
        self.chunking = chunking or ChunkingConfig()
        base = self.root / ".local/paired-index" / mode
        self.directory = base if source_pack == "d1_fixture" else base / source_pack
        if not self.directory.resolve().is_relative_to(self.root):
            raise IndexingError("INDEX_PATH_INVALID")

    @contextmanager
    def _writer(self):
        self.directory.mkdir(parents=True, exist_ok=True)
        lock = self.directory / ".build.lock"
        try:
            file = lock.open("x", encoding="ascii")
        except FileExistsError:
            raise IndexingError("INDEX_BUILD_IN_PROGRESS") from None
        try:
            with file:
                file.write(str(os.getpid()))
            yield
        finally:
            lock.unlink()

    def _activate(self, run_id, manifest_sha):
        fd, temporary = tempfile.mkstemp(prefix="active-", suffix=".tmp", dir=self.directory)
        try:
            with os.fdopen(fd, "wb") as file:
                file.write(_json({"run_id": run_id, "manifest_sha256": manifest_sha}))
                file.flush()
                os.fsync(file.fileno())
            os.replace(temporary, self.directory / "active.json")
        finally:
            Path(temporary).unlink(missing_ok=True)

    def _is_active(self, run_id):
        try:
            return _read_json(self.directory / "active.json")["run_id"] == run_id
        except (OSError, ValueError, TypeError, KeyError):
            return False

    @staticmethod
    def _write_fts(path, chunks):
        with closing(sqlite3.connect(path)) as db:
            db.execute("CREATE VIRTUAL TABLE chunks USING fts5(search, metadata UNINDEXED)")
            for chunk in chunks:
                db.execute(
                    "INSERT INTO chunks VALUES (?, ?)",
                    (normalize(chunk.content), _json(chunk.payload()).decode()),
                )
            db.commit()

    @staticmethod
    def _audit_fts(path, expected):
        try:
            with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
                rows = db.execute("SELECT metadata FROM chunks ORDER BY rowid").fetchall()
            if [json.loads(row[0]) for row in rows] != expected:
                raise IndexingError("INDEX_OUT_OF_SYNC")
        except (sqlite3.Error, ValueError, TypeError):
            raise IndexingError("INDEX_OUT_OF_SYNC") from None

    def _audit_vectors(self, manifest):
        inventory = self.store.inventory(manifest["collection"], self.profile.dimension)
        expected = {
            c["chunk_id"]: {**c, "snapshot_id": manifest["snapshot_id"]} for c in manifest["chunks"]
        }
        if {cid: payload for cid, (payload, _) in inventory.items()} != expected:
            raise IndexingError("INDEX_OUT_OF_SYNC")
        return inventory

    def rebuild(self, today):
        """Never alter old collections/snapshots. Failed candidates are cleaned best effort."""
        try:
            with self._writer():
                return self._build(today)
        except OSError as error:
            failure = IndexingError("INDEX_IO_ERROR")
            failure.cleanup_pending = getattr(error, "cleanup_pending", False)
            raise failure from None

    def _build(self, today):
        if self.embedding is None:
            raise IndexingError("EMBEDDING_NOT_CONFIGURED")
        if self.embedding.profile != self.profile:
            raise IndexingError("INDEX_CONFIGURATION_CHANGED")
        chunks, sources = load_chunks(
            self.root, self.mode, today, self.chunking, source_pack=self.source_pack
        )
        snapshot = fingerprint(chunks, sources, self.chunking, self.profile)
        run_id = uuid4().hex
        collection = f"pbl6_{self.mode}_{snapshot[:16]}_{run_id}"
        manifest = {
            "format": 1,
            "fts_algorithm": ALGORITHM,
            "run_id": run_id,
            "corpus_mode": self.mode,
            "snapshot_id": snapshot,
            "collection": collection,
            "sources": sources,
            "chunking": self.chunking.model_dump(),
            "embedding": self.profile.model_dump(),
            "chunks": [c.payload() for c in chunks],
        }
        created = False
        try:
            with tempfile.TemporaryDirectory(prefix="building-", dir=self.directory) as staging:
                staging = Path(staging)
                self._write_fts(staging / "index.sqlite", chunks)
                vectors = [
                    validate_vector(
                        self.embedding.document(c.content, c.title), self.profile.dimension
                    )
                    for c in chunks
                ]
                created = True
                self.store.create(collection, self.profile.dimension)
                self.store.upsert(collection, chunks, vectors, snapshot, self.profile.dimension)
                inventory = self._audit_vectors(manifest)
                for chunk, expected in zip(chunks, vectors, strict=True):
                    stored = inventory[chunk.chunk_id][1]
                    if any(
                        not math.isclose(a, b, rel_tol=1e-5, abs_tol=1e-6)
                        for a, b in zip(stored, expected, strict=True)
                    ):
                        raise IndexingError("INDEX_OUT_OF_SYNC")
                self._audit_fts(staging / "index.sqlite", manifest["chunks"])
                current_chunks, current_sources = load_chunks(
                    self.root, self.mode, today, self.chunking, source_pack=self.source_pack
                )
                if (
                    fingerprint(current_chunks, current_sources, self.chunking, self.profile)
                    != snapshot
                ):
                    raise IndexingError("SOURCE_CHANGED_DURING_BUILD")
                manifest["database_checksum"] = digest((staging / "index.sqlite").read_bytes())
                manifest["vectors_checksum"] = _vector_checksum(inventory)
                encoded = _json(manifest)
                with (staging / "manifest.json").open("wb") as file:
                    file.write(encoded)
                    file.flush()
                    os.fsync(file.fileno())
                target = self.directory / run_id
                staging.rename(target)
            # Commit point: readers resolve one pointer to the FTS file and physical collection.
            self._activate(run_id, digest(encoded))
            return manifest
        except BaseException as error:
            if created and not self._is_active(run_id):
                try:
                    self.store.delete(collection)
                except (IndexingError, OSError):
                    error.cleanup_pending = True
            raise

    def active(self, today):
        """Explicit offline health/audit: source, config, local data and all remote payloads."""
        manifest = self.local_active(today)
        inventory = self._audit_vectors(manifest)
        if _vector_checksum(inventory) != manifest["vectors_checksum"]:
            raise IndexingError("INDEX_OUT_OF_SYNC")
        return manifest

    def local_active(self, today):
        """Pin one locally verified release; online transport checks its remote collection."""
        try:
            pointer = _read_json(self.directory / "active.json")
            run_id = pointer["run_id"]
            if not isinstance(run_id, str) or not re.fullmatch(r"[a-f0-9]{32}", run_id):
                raise ValueError()
            path = self.directory / run_id
            manifest_file = path / "manifest.json"
            if digest(manifest_file.read_bytes()) != pointer["manifest_sha256"]:
                raise ValueError()
            manifest = _read_json(manifest_file)
            if (
                manifest["embedding"] != self.profile.model_dump()
                or manifest["chunking"] != self.chunking.model_dump()
            ):
                raise IndexingError("INDEX_CONFIGURATION_CHANGED")
            chunks, sources = load_chunks(
                self.root, self.mode, today, self.chunking, source_pack=self.source_pack
            )
            expected_id = fingerprint(chunks, sources, self.chunking, self.profile)
            if (
                manifest["format"] != 1
                or manifest["fts_algorithm"] != ALGORITHM
                or manifest["run_id"] != run_id
                or manifest["corpus_mode"] != self.mode
                or manifest["snapshot_id"] != expected_id
                or manifest["sources"] != sources
                or manifest["chunks"] != [c.payload() for c in chunks]
                or manifest["collection"] != f"pbl6_{self.mode}_{expected_id[:16]}_{run_id}"
            ):
                raise IndexingError("INDEX_OUT_OF_SYNC")
            if digest((path / "index.sqlite").read_bytes()) != manifest["database_checksum"]:
                raise ValueError()
            self._audit_fts(path / "index.sqlite", manifest["chunks"])
            return manifest
        except FileNotFoundError:
            raise IndexingError("INDEX_NOT_AVAILABLE") from None
        except (OSError, ValueError, KeyError, TypeError):
            raise IndexingError("INDEX_OUT_OF_SYNC") from None

    def lexical_search(self, query, today, *, category=None, limit=3):
        if (
            not isinstance(query, str)
            or len(query) > 2000
            or type(limit) is not int
            or not 1 <= limit <= 20
        ):
            raise IndexingError("SEARCH_INVALID")
        manifest = self.active(today)
        tokens = list(dict.fromkeys(re.findall(r"[a-z0-9]+", normalize(query))))[:64]
        if not tokens:
            return []
        expression = " OR ".join(f'"{token}"' for token in tokens)
        path = self.directory / manifest["run_id"] / "index.sqlite"
        try:
            with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
                rows = db.execute(
                    "SELECT metadata FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks), rowid",
                    (expression,),
                ).fetchall()
            result = [json.loads(row[0]) for row in rows]
            return [c for c in result if category is None or c["document_type"] == category][
                : max(1, min(limit, 20))
            ]
        except (sqlite3.Error, ValueError, TypeError):
            raise IndexingError("INDEX_OUT_OF_SYNC") from None

    def similarity_search(self, vector, today, *, category=None, source_id=None, limit=3):
        manifest = self.active(today)
        points = self.store.search(
            manifest["collection"],
            vector,
            self.profile.dimension,
            mode=self.mode,
            category=category,
            source_id=source_id,
            limit=limit,
        )
        expected = {
            c["chunk_id"]: {**c, "snapshot_id": manifest["snapshot_id"]} for c in manifest["chunks"]
        }
        seen, hits = set(), []
        for point in points:
            payload = point["payload"]
            cid = payload.get("chunk_id")
            if (
                cid in seen
                or payload != expected.get(cid)
                or (category is not None and payload["document_type"] != category)
                or (source_id is not None and payload["source_id"] != source_id)
            ):
                raise IndexingError("INDEX_OUT_OF_SYNC")
            seen.add(cid)
            hits.append({"score": point["score"], "chunk": payload})
        return hits
