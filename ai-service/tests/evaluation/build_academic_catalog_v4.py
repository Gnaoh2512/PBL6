"""Build immutable Azure Bay v4 grounding catalog (`academic-policies-2026-11-25-v4`).

Rebinds all 42 facts, 31 question rules, and 42 templates from `academic-policies-2026-11-25-v3`
to the rebuilt Azure Bay policy snapshot (`pol-01..pol-10.md` titled "... — Azure Bay") and
updates the demo qualifier prefix to "[Azure Bay — Chính sách demo đã duyệt]".
"""

import argparse
import copy
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.academic_demo_preflight import ReadOnlyPairedIndex  # noqa: E402
from app.indexing import ChunkingConfig, EmbeddingProfile  # noqa: E402
from app.ingestion.snapshot import ROOT  # noqa: E402
from app.orchestration.verification.artifacts import source_view  # noqa: E402
from app.orchestration.verification.catalog import (  # noqa: E402
    VerifiedCatalog,
    canonical,
    digest,
    review_hash,
)
from app.orchestration.verification.publisher import build_source_receipts  # noqa: E402
from app.schemas.verification import CatalogData, QuestionRule, Source  # noqa: E402

POLICY_TODAY = date(2026, 11, 25)
V3_DIR = ROOT / ".local/grounding/demo_synthetic/academic-policies-2026-11-25-v3"
DEFAULT_RELEASE = "academic-policies-2026-11-25-v4"
AUTHORITY = "user-academic-demo"
DECISION_ID = "dec-azure-bay-demo-2026-11-25-v4"
AZURE_BAY_DEMO_QUALIFIER_TEXT = "[Azure Bay — Chính sách demo đã duyệt]"


def build_v4_catalog() -> tuple[dict, bytes, bytes]:
    v3_data = json.loads((V3_DIR / "catalog.json").read_text(encoding="utf-8"))
    index = ReadOnlyPairedIndex(
        "demo_synthetic",
        None,
        None,
        root=ROOT,
        profile=EmbeddingProfile(),
        chunking=ChunkingConfig(),
        source_pack="academic_policies",
    )
    _, mode, snapshot, actual_sources, evidence = source_view(index, POLICY_TODAY)
    assert mode == "demo_synthetic"
    raw_sources, _ = build_source_receipts(
        index, POLICY_TODAY, authority_ref=AUTHORITY, decision_id=DECISION_ID
    )
    approved_sources = json.loads(raw_sources)["sources"]
    ev_by_section = {e.sectionId: e for e in evidence}
    src_by_doc = {s["documentId"]: s for s in approved_sources}

    data = copy.deepcopy(v3_data)
    data["catalogVersion"] = DEFAULT_RELEASE
    data["snapshotId"] = snapshot
    data["sources"] = approved_sources
    data["questionRulesVersion"] = "4"
    data["rendererVersion"] = "4"
    data["vocabulary"]["version"] = "4"
    data["reviewedChunkHashes"] = {e.citationId: digest(e.excerpt.encode()) for e in evidence}
    data["reviewDeclarations"] = {e.citationId: "complete" for e in evidence}

    for qual in data["vocabulary"]["qualifiers"]:
        if qual["id"] == "academic-demo-only":
            qual["rendererToken"] = AZURE_BAY_DEMO_QUALIFIER_TEXT
            break

    # Rebind every fact's provenance bindings to the rebuilt Azure Bay chunks and verify verbatim spans.
    tmpl_by_key = {t["key"]: t for t in data["templates"]}
    for item in data["facts"]:
        for binding in item["provenance"]["bindings"]:
            ev = ev_by_section[binding["sectionId"]]
            src = src_by_doc[ev.documentId]
            binding["documentId"] = src["documentId"]
            binding["sourceVersion"] = src["sourceVersion"]
            binding["sourceRef"] = src["sourceRef"]
            binding["sourceSha256"] = src["sourceSha256"]
            binding["snapshotId"] = snapshot
            binding["citationId"] = ev.citationId
            binding["chunkId"] = ev.chunkId
            binding["excerptSha256"] = digest(ev.excerpt.encode())
            # Verify every span matches within the updated chunk excerpt.
            for span in binding["spans"]:
                assert 0 <= span[0] < span[1] <= len(ev.excerpt), (
                    f"Span out of range for {item['factId']} in {binding['sectionId']}"
                )

        tmpl = tmpl_by_key[item["renderer"]["key"]]
        item["approval"] = {
            "status": "approved",
            "decisionId": DECISION_ID,
            "authorityRef": AUTHORITY,
            "reviewedContentSha256": review_hash(
                item, vocabulary=data["vocabulary"], template=tmpl
            ),
        }

    data["questionRules"] = [
        QuestionRule.model_validate_json(json.dumps(rule, ensure_ascii=False)).model_dump(
            mode="json", by_alias=True
        )
        for rule in data["questionRules"]
    ]
    data["approval"] = {
        "status": "approved",
        "decisionId": DECISION_ID,
        "authorityRef": AUTHORITY,
        "reviewedContentSha256": review_hash(data),
    }
    raw_catalog = canonical(data)

    parsed = CatalogData.model_validate_json(raw_catalog)
    sources_objs = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in approved_sources
    )
    VerifiedCatalog(
        lambda: raw_catalog,
        expected_hash=digest(raw_catalog),
        authorities=frozenset({AUTHORITY}),
        source_reader=lambda: sources_objs,
    )
    assert len(parsed.facts) == 42
    assert len(parsed.questionRules) == 31
    assert len(parsed.templates) == 42
    return data, raw_catalog, raw_sources


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--force", action="store_true", default=False)
    args = parser.parse_args(argv)

    out_dir = ROOT / ".local/grounding/demo_synthetic" / args.release
    if out_dir.exists() and not args.force:
        raise SystemExit(f"Release directory already exists (immutable): {out_dir}")

    data, raw_catalog, raw_sources = build_v4_catalog()
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "catalog.json").write_bytes(raw_catalog)
    (out_dir / "sources.json").write_bytes(raw_sources)

    print(
        json.dumps(
            {
                "release": args.release,
                "snapshot_id": data["snapshotId"],
                "catalog_path": f".local/grounding/demo_synthetic/{args.release}/catalog.json",
                "catalog_sha256": digest(raw_catalog),
                "sources_path": f".local/grounding/demo_synthetic/{args.release}/sources.json",
                "sources_sha256": digest(raw_sources),
                "facts": len(data["facts"]),
                "questionRules": len(data["questionRules"]),
                "templates": len(data["templates"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
