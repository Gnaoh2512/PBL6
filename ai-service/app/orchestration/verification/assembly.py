"""Whole-section context assembly, independent of model output and retrieval scores."""

import json

from app.providers.contracts import Evidence

from .catalog import active, dependency, digest
from .gate import protocol


def assemble(gate, evidence, *, mode, snapshot_id, today, max_evidence=3):
    """Keep complete evidence objects, dedup exact duplicates, and verify source receipts."""
    if (
        gate is None
        or gate.catalog.data.mode != mode
        or gate.catalog.data.snapshotId != snapshot_id
    ):
        raise dependency()
    state = gate.catalog.check_current()
    chosen = []
    by_id = {}
    for raw in evidence:
        try:
            item = Evidence.model_validate_json(
                json.dumps(raw.model_dump(mode="json") if isinstance(raw, Evidence) else raw)
            )
        except (ValueError, TypeError):
            raise protocol() from None
        if item.corpusMode != mode:
            raise dependency()
        source = state.get((item.documentId, item.version))
        if (
            source is None
            or source.approval.status != "approved"
            or not active(source.validity, today)
        ):
            raise dependency()
        if (source.sourceRef, source.snapshotId) != (item.sourceRef, snapshot_id):
            raise dependency()
        previous = by_id.get(item.citationId)
        if previous is not None:
            if previous != item:
                raise protocol()
            continue
        by_id[item.citationId] = item
        sha = gate.catalog.data.reviewedChunkHashes.get(item.citationId)
        if sha is not None and sha != digest(item.excerpt.encode()):
            raise dependency()
        chosen.append(item)
    # Do not silently truncate required sections or rewrite excerpts to fit a limit.
    return chosen[:max_evidence]
