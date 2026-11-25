"""Local-only Academic Demo inspection. No Settings(), runtime, provider or writer calls."""

import argparse
import json
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from pydantic import ValidationError

from app.academic_demo_contract import read_contract
from app.indexing import IndexingError
from app.ingestion.documents import load_chunks
from app.ingestion.snapshot import ROOT, normalize
from app.ingestion.vector_pipeline import PairedIndex
from app.orchestration.verification.artifacts import (
    SourceReceipts,
    _reader,
    load_verification_gate,
    source_view,
)
from app.orchestration.verification.catalog import (
    VerifiedCatalog,
    _pairs,
    active,
    digest,
    review_hash,
)
from app.providers.contracts import DependencyError


def require(ok, code):
    if not ok:
        raise ValueError(code)


def confined(root, path):
    require(path.resolve().is_relative_to(root.resolve()), "PATH_OUTSIDE_ROOT")
    require(not any(p.is_symlink() for p in (path, *path.parents) if p != root), "SYMLINK_PATH")


class ReadOnlyPairedIndex(PairedIndex):
    """Reuse runtime manifest validation with an immutable, non-writing SQLite reader."""

    def local_active(self, today):
        pointer = self.directory / "active.json"
        confined(self.root, pointer)
        if pointer.is_file():
            raw = pointer.read_bytes()
            require(len(raw) <= 4096, "POINTER_TOO_LARGE")
            data = json.loads(raw, object_pairs_hook=_pairs)
            run = data.get("run_id")
            require(isinstance(run, str) and re.fullmatch(r"[a-f0-9]{32}", run), "INVALID_RUN_ID")
            for name in ("manifest.json", "index.sqlite"):
                confined(self.root, self.directory / run / name)
        return super().local_active(today)

    @staticmethod
    def _audit_fts(path, expected):
        # immutable=1 never creates WAL/SHM files. Refuse unfinished/WAL snapshots rather
        # than ignoring a sidecar that could contain newer committed content.
        require(
            not any(Path(str(path) + suffix).exists() for suffix in ("-wal", "-shm", "-journal")),
            "SNAPSHOT_NOT_IMMUTABLE",
        )
        with closing(sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)) as db:
            rows = [
                (search, json.loads(raw, object_pairs_hook=_pairs))
                for search, raw in db.execute("SELECT search,metadata FROM chunks ORDER BY rowid")
            ]
        require(rows == [(normalize(c["content"]), c) for c in expected], "INDEX_OUT_OF_SYNC")


def _publication(config, name, root):
    label = "source_receipts" if name == "sources" else name
    path = getattr(config, name + "_path")
    pin = getattr(config, name + "_sha256")
    missing = [field for field, value in (("path", path), ("sha256", pin)) if value is None]
    if missing:
        return None, {
            "name": label,
            "status": "MISSING",
            "code": "PUBLICATION_NOT_CONFIGURED",
            "fields": missing,
        }
    try:
        candidate = path if path.is_absolute() else root / path
        confined(root / ".local/grounding/demo_synthetic", candidate)
        if not candidate.is_file():
            return None, {"name": label, "status": "MISSING", "code": "PUBLICATION_FILE_MISSING"}
        raw = _reader(path, pin, root, "demo_synthetic")()
        return raw, {"name": label, "status": "PASS", "sha256": pin}
    except (OSError, ValueError, DependencyError):
        return None, {
            "name": label,
            "status": "INVALID",
            "code": "PUBLICATION_PATH_OR_HASH_INVALID",
        }


def _approval(record, authorities, today=None):
    require(record.approval.status == "approved", "APPROVAL_NOT_GRANTED")
    require(record.approval.authorityRef in authorities, "AUTHORITY_NOT_ALLOWLISTED")
    require(record.approval.reviewedContentSha256 == review_hash(record), "REVIEW_HASH_MISMATCH")
    if today is not None:
        require(active(record.validity, today), "SOURCE_OUTSIDE_VALIDITY")


def _bindings(gate, index, manifest, today):
    _, _, snapshot, actual, evidence = source_view(index, today)
    data = gate.catalog.data
    require(snapshot == data.snapshotId == manifest["snapshot_id"], "SNAPSHOT_BINDING_MISMATCH")
    registry = {e.citationId: e for e in evidence}
    source_records = {(s["documentId"], s["sourceVersion"]): s for s in actual}
    for source in data.sources:
        row = source.model_dump(mode="json")
        row.pop("approval")
        require(
            row == source_records.get((source.documentId, source.sourceVersion)),
            "CATALOG_SOURCE_MISMATCH",
        )
    for cid, sha in data.reviewedChunkHashes.items():
        require(
            cid in registry and digest(registry[cid].excerpt.encode()) == sha,
            "REVIEWED_CHUNK_MISMATCH",
        )
    for fact in data.facts:
        for binding in fact.provenance.bindings:
            item = registry.get(binding.citationId)
            require(item is not None, "FACT_CHUNK_MISSING")
            require(
                (
                    binding.documentId,
                    binding.sourceVersion,
                    binding.chunkId,
                    binding.sectionId,
                    binding.sourceRef,
                    binding.snapshotId,
                    binding.excerptSha256,
                )
                == (
                    item.documentId,
                    item.version,
                    item.chunkId,
                    item.sectionId,
                    item.sourceRef,
                    snapshot,
                    digest(item.excerpt.encode()),
                ),
                "FACT_BINDING_MISMATCH",
            )
            require(all(end <= len(item.excerpt) for _, end in binding.spans), "SPAN_OUT_OF_BOUNDS")
            require(
                data.reviewDeclarations.get(item.citationId) == "complete"
                and data.reviewedChunkHashes.get(item.citationId) == binding.excerptSha256,
                "FACT_CHUNK_NOT_REVIEWED",
            )
    keys = {fact.factKey for fact in data.facts}
    require(
        all(r.factKey in keys for rule in data.questionRules for r in rule.requirements),
        "QUESTION_REQUIREMENT_WITHOUT_FACT",
    )
    return {
        "snapshot_id": snapshot,
        "fact_count": len(data.facts),
        "verified_chunk_hash_count": len(data.reviewedChunkHashes),
        "complete_review_declaration_count": sum(
            v == "complete" for v in data.reviewDeclarations.values()
        ),
        "chunk_count": len(registry),
    }


def preflight(contract, *, root=ROOT, today=None):
    root = root.resolve()
    today = today or datetime.now(timezone(timedelta(hours=7))).date()
    env = contract.environment
    config = env.AI_GROUNDING
    checks = [{"name": "contract", "status": "PASS", "code": "EXPLICIT_ACADEMIC_DEMO_PROFILE"}]
    try:
        chunks, sources = load_chunks(
            root, env.AI_CORPUS_MODE, today, env.AI_CHUNKING, source_pack=env.AI_DEMO_SOURCE_PACK
        )
        checks.append(
            {
                "name": "sources",
                "status": "PASS",
                "source_count": len(sources),
                "chunk_count": len(chunks),
            }
        )
    except IndexingError as error:
        checks.append({"name": "sources", "status": "INVALID", "code": error.code})

    index = ReadOnlyPairedIndex(
        env.AI_CORPUS_MODE,
        None,
        None,
        root=root,
        profile=env.AI_EMBEDDING,
        chunking=env.AI_CHUNKING,
        source_pack=env.AI_DEMO_SOURCE_PACK,
    )
    manifest = None
    try:
        manifest = index.local_active(today)
        checks.append(
            {
                "name": "snapshot",
                "status": "PASS",
                "snapshot_id": manifest["snapshot_id"],
                "run_id": manifest["run_id"],
                "collection": manifest["collection"],
            }
        )
    except (IndexingError, OSError, ValueError, TypeError, KeyError, sqlite3.Error) as error:
        code = error.code if isinstance(error, IndexingError) else "LOCAL_SNAPSHOT_INVALID"
        checks.append(
            {
                "name": "snapshot",
                "status": "MISSING" if code == "INDEX_NOT_AVAILABLE" else "INVALID",
                "code": code,
                "pointer": ".local/paired-index/demo_synthetic/academic_policies/active.json",
            }
        )

    catalog_raw, catalog_check = _publication(config, "catalog", root)
    receipts_raw, receipts_check = _publication(config, "sources", root)
    authorities = config.authorities
    checks.append(
        {
            "name": "authority",
            "status": "PASS" if authorities else "MISSING",
            "code": "AUTHORITY_ALLOWLIST_CONFIGURED"
            if authorities
            else "AUTHORITY_ALLOWLIST_EMPTY",
        }
    )
    catalog = receipts = None
    if catalog_raw is not None:
        try:
            catalog = VerifiedCatalog(
                lambda: catalog_raw,
                expected_hash=config.catalog_sha256,
                authorities=authorities,
                source_reader=lambda: (),
            )
            data = catalog.data
            require(data.mode == "demo_synthetic", "CATALOG_MODE_MISMATCH")
            require(bool(data.facts) and bool(data.questionRules), "CATALOG_HAS_NO_FACTS_OR_RULES")
            for source in data.sources:
                _approval(source, authorities, today)
            for fact in data.facts:
                require(
                    fact.approval.status == "approved" and active(fact.validity, today),
                    "FACT_UNAPPROVED_OR_OUTSIDE_VALIDITY",
                )
            catalog_check["fact_count"] = len(data.facts)
        except (DependencyError, ValueError, TypeError, KeyError):
            catalog = None
            catalog_check = {
                "name": "catalog",
                "status": "INVALID",
                "code": "CATALOG_SCHEMA_APPROVAL_OR_VALIDITY_INVALID",
            }
    if receipts_raw is not None:
        try:
            receipts = SourceReceipts.model_validate_json(receipts_raw)
            require(receipts.mode == "demo_synthetic", "RECEIPTS_MODE_MISMATCH")
            require(
                len({(s.documentId, s.sourceVersion) for s in receipts.sources})
                == len(receipts.sources),
                "DUPLICATE_SOURCE_RECEIPT",
            )
            for source in receipts.sources:
                _approval(source, authorities, today)
            receipts_check["source_count"] = len(receipts.sources)
        except (ValueError, TypeError, KeyError):
            receipts = None
            receipts_check = {
                "name": "source_receipts",
                "status": "INVALID",
                "code": "RECEIPTS_SCHEMA_APPROVAL_OR_VALIDITY_INVALID",
            }
    checks.extend((catalog_check, receipts_check))
    if manifest is not None and catalog is not None and receipts is not None:
        try:
            settings = SimpleNamespace(corpus_mode="demo_synthetic", grounding=config)
            gate = load_verification_gate(settings, index, today)
            details = _bindings(gate, index, manifest, today)
            checks.append({"name": "binding", "status": "PASS", **details})
        except (
            DependencyError,
            IndexingError,
            OSError,
            ValueError,
            TypeError,
            KeyError,
            sqlite3.Error,
        ):
            checks.append(
                {"name": "binding", "status": "INVALID", "code": "RUNTIME_BINDING_INVALID"}
            )
    else:
        checks.append(
            {"name": "binding", "status": "BLOCKED", "code": "REQUIRED_ARTIFACTS_NOT_VALID"}
        )
    return {
        "schema_version": "academic-demo-preflight-1",
        "status": "LOCAL_ARTIFACTS_VALID"
        if all(c["status"] == "PASS" for c in checks)
        else "NOT_READY",
        "as_of_date": today.isoformat(),
        "corpus_mode": env.AI_CORPUS_MODE,
        "source_pack": env.AI_DEMO_SOURCE_PACK,
        "retrieval_mode": env.AI_RETRIEVAL_MODE,
        "snapshot_family": contract.snapshot_family,
        "checks": checks,
        "environment_applied": False,
        "runtime_readiness": "NOT_CHECKED",
        "external_gates": {
            "qdrant_inventory": "NOT_CHECKED",
            "gemini": "NOT_CALLED",
            "credentials": "NOT_CHECKED",
            "semantic_correctness": "NOT_VERIFIED",
            "independent_approval": "NOT_VERIFIED",
            "runtime": "NOT_STARTED",
        },
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--contract", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        contract = read_contract(args.contract)
    except (OSError, ValueError, TypeError, ValidationError):
        print(json.dumps({"status": "CONTRACT_INVALID", "code": "CONTRACT_READ_OR_SCHEMA_INVALID"}))
        return 2
    report = preflight(contract)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "LOCAL_ARTIFACTS_VALID" else 1


if __name__ == "__main__":
    raise SystemExit(main())
