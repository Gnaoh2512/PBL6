"""Read separately pinned review artifacts and bind them to actual allowlisted index sources."""

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from pydantic import Field

from app.indexing import IndexingError
from app.ingestion.snapshot import document
from app.providers.contracts import Evidence
from app.schemas.verification import Frozen, Source

from .catalog import MAX_CATALOG_BYTES, VerifiedCatalog, _pairs, dependency, digest
from .gate import VerificationGate


class SourceReceipts(Frozen):
    schemaVersion: Literal["grounding-sources-1"]
    mode: Literal["production", "demo_synthetic"]
    snapshotId: str
    sources: tuple[Source, ...] = Field(min_length=1, max_length=256)


def _source_view(index, today):
    """Independent live file/metadata view; never uses catalog declarations as source truth."""
    paired = getattr(getattr(index, "retriever", None), "paired", None)
    if paired is None and hasattr(index, "local_active"):
        paired = index
    if paired is not None:
        release = paired.local_active(today)
        root = paired.root
        mode = paired.mode
        source_pack = getattr(paired, "source_pack", "d1_fixture")
        snapshot = release["snapshot_id"]
        evidence = [
            Evidence(
                citationId=c["chunk_id"],
                documentId=c["source_id"],
                version=c["document_version"],
                chunkId=c["chunk_id"],
                sectionId=c["section_id"],
                title=c["title"],
                sourceRef=c["source_ref"],
                excerpt=c["content"],
                corpusMode=mode,
            )
            for c in release["chunks"]
        ]
    else:
        index.validate(today)
        root = index.root
        mode = index.mode
        source_pack = getattr(index, "source_pack", "d1_fixture")
        snapshot = index.snapshot_id
        release = json.loads((index.path / "manifest.json").read_text(encoding="utf-8"))
        with closing(
            sqlite3.connect((index.path / "index.sqlite").as_uri() + "?mode=ro", uri=True)
        ) as db:
            evidence = []
            for (raw,) in db.execute("SELECT metadata FROM chunks ORDER BY rowid"):
                row = json.loads(raw)
                row.pop("category", None)
                evidence.append(Evidence.model_validate_json(json.dumps(row)))
    sources = []
    for name, sha in release["sources"].items():
        meta, _, actual = document(root, name, mode, today, source_pack=source_pack)
        if actual != sha or (mode == "production" and meta["source_ref"].startswith("synthetic:")):
            raise dependency()
        sources.append(
            {
                "documentId": meta["document_id"],
                "sourceVersion": meta["version"],
                "sourceRef": meta["source_ref"],
                "sourceSha256": sha,
                "snapshotId": snapshot,
                "validity": {
                    "validFrom": meta["effective_from"].isoformat(),
                    "validThrough": meta["effective_to"].isoformat()
                    if meta.get("effective_to")
                    else None,
                    "timeZone": "Asia/Ho_Chi_Minh",
                },
            }
        )
    return root, mode, snapshot, sources, tuple(evidence)


def source_view(index, today):
    try:
        return _source_view(index, today)
    except (OSError, ValueError, TypeError, KeyError, sqlite3.Error, AttributeError, IndexingError):
        raise dependency() from None


def _reader(path, pin, root, mode):
    if path is None or pin is None:
        raise dependency()
    path = Path(path)
    if not path.is_absolute():
        path = root / path
    allowed = (root / ".local/grounding" / mode).resolve()
    if not path.resolve().is_relative_to(allowed) or any(
        p.is_symlink() for p in (path, *path.parents) if p != root
    ):
        raise dependency()

    def read():
        raw = path.read_bytes()
        if len(raw) > MAX_CATALOG_BYTES or digest(raw) != pin:
            raise dependency()
        json.loads(raw, object_pairs_hook=_pairs)
        return raw

    return read


def load_verification_gate(settings, index, today):
    """No auto-approval, fixtures, model judgments, fallback catalog or network calls."""
    try:
        config = settings.grounding
        root, mode, snapshot, _, _ = source_view(index, today)
        if mode != settings.corpus_mode or not config.authorities:
            raise dependency()
        catalog_reader = _reader(config.catalog_path, config.catalog_sha256, root, mode)
        receipts_reader = _reader(config.sources_path, config.sources_sha256, root, mode)

        def source_reader():
            _, current_mode, current_snapshot, actual, _ = source_view(
                index, datetime.now(timezone(timedelta(hours=7))).date()
            )
            receipts = SourceReceipts.model_validate_json(receipts_reader())
            if (receipts.mode, receipts.snapshotId) != (current_mode, current_snapshot):
                raise dependency()
            if len({(s.documentId, s.sourceVersion) for s in receipts.sources}) != len(
                receipts.sources
            ):
                raise dependency()
            expected = {(s["documentId"], s["sourceVersion"]): s for s in actual}
            if set(expected) != {(s.documentId, s.sourceVersion) for s in receipts.sources}:
                raise dependency()
            for source in receipts.sources:
                if source.approval.status != "approved":
                    raise dependency()
                raw = source.model_dump(mode="json")
                raw.pop("approval")
                if raw != expected[(source.documentId, source.sourceVersion)]:
                    raise dependency()
            return receipts.sources

        catalog = VerifiedCatalog(
            catalog_reader,
            expected_hash=config.catalog_sha256,
            authorities=config.authorities,
            source_reader=source_reader,
        )
        if (catalog.data.mode, catalog.data.snapshotId) != (mode, snapshot):
            raise dependency()
        catalog.check_current()
        return VerificationGate(catalog)
    except (OSError, ValueError, TypeError, KeyError, sqlite3.Error, AttributeError):
        raise dependency() from None


def main():
    """Validate an operator-published release without Gemini calls or auto-approval."""
    from app.indexing import IndexingSettings
    from app.ingestion.vector_pipeline import PairedIndex
    from app.providers.contracts import DependencyError
    from app.retrieval.index import KnowledgeIndex
    from app.settings import Settings

    try:
        settings = Settings()
        today = datetime.now(timezone(timedelta(hours=7))).date()
        if settings.retrieval_mode == "hybrid":
            config = IndexingSettings()
            index = PairedIndex(
                settings.corpus_mode,
                None,
                None,
                profile=config.embedding,
                chunking=config.chunking,
                source_pack=settings.demo_source_pack,
            )
        else:
            index = KnowledgeIndex(
                settings.index_path,
                settings.corpus_mode,
                today,
                source_pack=settings.demo_source_pack,
            )
        gate = load_verification_gate(settings, index, today)
        print(
            json.dumps(
                {
                    "status": "valid",
                    "mode": gate.catalog.data.mode,
                    "snapshotId": gate.catalog.data.snapshotId,
                    "catalogHash": gate.catalog.expected_hash,
                    "factCount": len(gate.catalog.facts),
                }
            )
        )
        return 0
    except (DependencyError, IndexingError, OSError, ValueError, AttributeError):
        print(json.dumps({"error": "DEPENDENCY_UNAVAILABLE"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
