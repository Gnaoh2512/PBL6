"""Offline source-receipts publication helper for reviewed releases.

Never imported on the online request path, never invents hotel facts, and never auto-approves
unapproved Markdown sources. Every source must already be approved in its Markdown front matter
and explicitly signed with operator-supplied authorityRef and decisionId.
"""

import argparse
import json
from datetime import datetime, timedelta, timezone

from app.indexing import IndexingError, IndexingSettings
from app.ingestion.snapshot import DEMO_SOURCE_PACKS
from app.ingestion.vector_pipeline import PairedIndex
from app.orchestration.verification.artifacts import SourceReceipts, source_view
from app.orchestration.verification.catalog import canonical, digest, review_hash
from app.providers.contracts import DependencyError
from app.retrieval.index import KnowledgeIndex
from app.settings import Settings


def build_source_receipts(
    index,
    today,
    *,
    authority_ref: str,
    decision_id: str,
) -> tuple[bytes, dict]:
    """Create deterministic grounding-sources-1 bytes from actual validated allowlisted sources."""
    if not authority_ref.strip() or not decision_id.strip():
        raise ValueError("authority_ref and decision_id are required")
    _, mode, snapshot, actual, _ = source_view(index, today)
    signed = []
    for record in actual:
        entry = {
            **record,
            "approval": {
                "status": "approved",
                "decisionId": decision_id,
                "authorityRef": authority_ref,
                "reviewedContentSha256": review_hash(record),
            },
        }
        signed.append(entry)
    payload = {
        "schemaVersion": "grounding-sources-1",
        "mode": mode,
        "snapshotId": snapshot,
        "sources": signed,
    }
    validated = SourceReceipts.model_validate_json(canonical(payload))
    raw = canonical(validated)
    return raw, {
        "mode": mode,
        "snapshotId": snapshot,
        "sourceCount": len(signed),
        "sources_sha256": digest(raw),
    }


def write_source_receipts(
    index,
    today,
    *,
    release_name: str,
    authority_ref: str,
    decision_id: str,
) -> dict:
    """Write an immutable sources.json receipt under .local/grounding/<mode>/<release_name>/."""
    if not release_name or "/" in release_name or "\\" in release_name or ".." in release_name:
        raise ValueError("Invalid release name")
    root, mode, _, _, _ = source_view(index, today)
    raw, meta = build_source_receipts(
        index, today, authority_ref=authority_ref, decision_id=decision_id
    )
    target_dir = (root / ".local/grounding" / mode / release_name).resolve()
    allowed = (root / ".local/grounding" / mode).resolve()
    if not target_dir.is_relative_to(allowed):
        raise ValueError("Release path escapes grounding root")
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / "sources.json"
    if target.exists():
        raise FileExistsError("Release receipts already exist; create a new immutable release name")
    target.write_bytes(raw)
    return {
        **meta,
        "sources_path": str(target.relative_to(root).as_posix()),
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", required=True)
    parser.add_argument("--authority", required=True)
    parser.add_argument("--decision-id", required=True)
    parser.add_argument("--retrieval-mode", choices=["hybrid", "bm25"], default=None)
    parser.add_argument("--source-pack", choices=["d1_fixture", *DEMO_SOURCE_PACKS], default=None)
    args = parser.parse_args(argv)
    try:
        settings = Settings()
        retrieval_mode = args.retrieval_mode or settings.retrieval_mode
        source_pack = args.source_pack or settings.demo_source_pack
        today = datetime.now(timezone(timedelta(hours=7))).date()
        if retrieval_mode == "hybrid":
            config = IndexingSettings()
            index = PairedIndex(
                settings.corpus_mode,
                None,
                None,
                profile=config.embedding,
                chunking=config.chunking,
                source_pack=source_pack,
            )
        else:
            if settings.index_path is None:
                raise ValueError("AI_INDEX_PATH is required for bm25 mode")
            index = KnowledgeIndex(
                settings.index_path, settings.corpus_mode, today, source_pack=source_pack
            )
        result = write_source_receipts(
            index,
            today,
            release_name=args.release,
            authority_ref=args.authority,
            decision_id=args.decision_id,
        )
        print(json.dumps({"status": "published", **result}, ensure_ascii=False))
        return 0
    except (DependencyError, IndexingError, FileExistsError, OSError, ValueError) as error:
        print(json.dumps({"error": str(error) or "PUBLISH_FAILED"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
