"""Build immutable Academic Demo v3 grounding catalog (`academic-policies-2026-11-25-v3`).

Extends `academic-policies-2026-11-25-v2` without modifying v1 or v2:
- Adds atomic fact `pol03-modify-increase-deadline-conditions-v1` (unit=minute, value=15) bound
  verbatim to `POL-03-U04` covering the 15-minute UTC+07:00 quote deadline, exact version
  acceptance, strictly-before-deadline rule, and no 0-VND transaction rule (D-A13 coverage).
- Updates `q-pol03-modify-increase-deposit` to require BOTH `pol03.modify_increase_topup_rule`
  and `pol03.modify_increase_deadline_conditions` so the gate enforces complete D-A13 coverage.
"""

import argparse
import copy
import json
import shutil
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
from app.schemas.verification import CatalogData, QuestionRule, Source  # noqa: E402

POLICY_TODAY = date(2026, 11, 25)
V2_DIR = ROOT / ".local/grounding/demo_synthetic/academic-policies-2026-11-25-v2"
DEFAULT_RELEASE = "academic-policies-2026-11-25-v3"
AUTHORITY = "user-academic-demo"
DECISION_ID = "dec-academic-demo-2026-11-25-v3"

DEADLINE_PREDICATE = {
    "id": "modify_increase_deadline_and_conditions",
    "valueKind": "decimal",
    "units": ["minute"],
    "enumValues": [],
    "cardinality": "single",
}

DEADLINE_QUOTE = (
    "Báo giá hiệu lực 15 phút từ lúc phát hành, UTC+07:00. Phải chấp nhận đúng phiên bản báo giá "
    "và đủ bổ sung theo thời điểm sự kiện có chứng cứ đáng tin trước hạn; bằng hạn là quá hạn. "
    "Không phải bổ sung thì không tạo giao dịch 0."
)


def build_v3_catalog() -> tuple[dict, bytes]:
    v2_data = json.loads((V2_DIR / "catalog.json").read_text(encoding="utf-8"))
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
    assert mode == v2_data["mode"] == "demo_synthetic"
    assert snapshot == v2_data["snapshotId"]
    ev_by_section = {e.sectionId: e for e in evidence}
    src_by_doc = {s["documentId"]: s for s in actual_sources}

    data = copy.deepcopy(v2_data)
    data["catalogVersion"] = DEFAULT_RELEASE
    data["questionRulesVersion"] = "3"
    data["rendererVersion"] = "3"
    data["vocabulary"]["version"] = "3"
    data["vocabulary"]["predicates"].append(DEADLINE_PREDICATE)

    ev = ev_by_section["POL-03-U04"]
    src = src_by_doc[ev.documentId]
    start = ev.excerpt.find(DEADLINE_QUOTE)
    if start < 0:
        raise ValueError(f"Exact quote not found in POL-03-U04: {DEADLINE_QUOTE!r}")
    end = start + len(DEADLINE_QUOTE)

    template = {
        "key": "tmpl-pol03-modify-increase-deadline-conditions-v1",
        "version": "1",
        "segments": [
            {"kind": "qualifier", "text": None, "qualifierId": "academic-demo-only"},
            {
                "kind": "literal",
                "text": " Báo giá sửa tăng giá trị có hiệu lực ",
                "qualifierId": None,
            },
            {"kind": "value", "text": None, "qualifierId": None},
            {"kind": "literal", "text": " ", "qualifierId": None},
            {"kind": "unit", "text": None, "qualifierId": None},
            {
                "kind": "literal",
                "text": (
                    " từ lúc phát hành (UTC+07:00): phải chấp nhận đúng phiên bản báo giá và đủ "
                    "bổ sung theo thời điểm sự kiện có chứng cứ đáng tin trước hạn (bằng hạn là "
                    "quá hạn), và không tạo giao dịch 0 khi không cần bổ sung."
                ),
                "qualifierId": None,
            },
        ],
        "valueLabels": [{"value": {"kind": "decimal", "data": "15"}, "text": "15"}],
        "unitText": "phút",
        "scopeText": None,
    }
    data["templates"].append(template)

    fact_id = "pol03-modify-increase-deadline-conditions-v1"
    binding_id = f"bind-{fact_id}"
    fact = {
        "schemaVersion": "d1-fact-1",
        "factId": fact_id,
        "factVersion": "1",
        "factKey": "pol03.modify_increase_deadline_conditions",
        "subjectId": "demo-hotel",
        "predicate": DEADLINE_PREDICATE["id"],
        "value": {"kind": "decimal", "data": "15"},
        "unit": "minute",
        "qualifierIds": ["academic-demo-only"],
        "timeScope": {"kind": "none"},
        "validity": dict(src["validity"]),
        "provenance": {
            "bindings": [
                {
                    "bindingId": binding_id,
                    "factId": fact_id,
                    "documentId": ev.documentId,
                    "sourceVersion": ev.version,
                    "sourceRef": ev.sourceRef,
                    "sourceSha256": src["sourceSha256"],
                    "snapshotId": snapshot,
                    "citationId": ev.citationId,
                    "chunkId": ev.chunkId,
                    "sectionId": ev.sectionId,
                    "excerptSha256": digest(ev.excerpt.encode()),
                    "spans": [[start, end]],
                }
            ]
        },
        "renderer": {
            "key": template["key"],
            "version": template["version"],
            "hash": digest(template),
            "ordinal": 1,
        },
        "approval": {
            "status": "approved",
            "decisionId": DECISION_ID,
            "authorityRef": AUTHORITY,
            "reviewedContentSha256": "0" * 64,
        },
    }
    data["facts"].append(fact)

    for qual in data["vocabulary"]["qualifiers"]:
        if qual["id"] == "academic-demo-only":
            qual["supportBindingIds"] = list(qual["supportBindingIds"]) + [binding_id]
            break

    # Re-sign ALL facts because vocabulary.version and vocabulary.predicates changed.
    tmpl_by_key = {t["key"]: t for t in data["templates"]}
    for item in data["facts"]:
        tmpl = tmpl_by_key[item["renderer"]["key"]]
        item["approval"] = {
            "status": "approved",
            "decisionId": DECISION_ID,
            "authorityRef": AUTHORITY,
            "reviewedContentSha256": review_hash(
                item, vocabulary=data["vocabulary"], template=tmpl
            ),
        }

    # Update q-pol03-modify-increase-deposit to require BOTH top-up rule and 15-minute deadline conditions.
    updated_rule = False
    normalized_rules = []
    for rule in data["questionRules"]:
        if rule["bindingKey"] == "q-pol03-modify-increase-deposit":
            rule["requirements"].append(
                {
                    "factKey": "pol03.modify_increase_deadline_conditions",
                    "subjectId": "demo-hotel",
                    "qualifierIds": ["academic-demo-only"],
                    "unit": "minute",
                    "timeScope": {"kind": "none"},
                }
            )
            rule["permittedFactKeys"] = list(rule["permittedFactKeys"]) + [
                "pol03.modify_increase_deadline_conditions"
            ]
            updated_rule = True
        normalized_rules.append(
            QuestionRule.model_validate_json(json.dumps(rule, ensure_ascii=False)).model_dump(
                mode="json", by_alias=True
            )
        )
    assert updated_rule, "q-pol03-modify-increase-deposit rule not found"
    data["questionRules"] = normalized_rules

    data["approval"] = {
        "status": "approved",
        "decisionId": DECISION_ID,
        "authorityRef": AUTHORITY,
        "reviewedContentSha256": review_hash(data),
    }
    raw = canonical(data)

    parsed = CatalogData.model_validate_json(raw)
    sources_objs = tuple(
        Source.model_validate_json(json.dumps(s, ensure_ascii=False)) for s in data["sources"]
    )
    VerifiedCatalog(
        lambda: raw,
        expected_hash=digest(raw),
        authorities=frozenset({AUTHORITY}),
        source_reader=lambda: sources_objs,
    )
    assert len(parsed.facts) == 42
    assert len(parsed.questionRules) == 31
    assert len(parsed.templates) == 42
    return data, raw


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--force", action="store_true", default=False)
    args = parser.parse_args(argv)

    out_dir = ROOT / ".local/grounding/demo_synthetic" / args.release
    if out_dir.exists() and not args.force:
        raise SystemExit(f"Release directory already exists (immutable): {out_dir}")

    data, raw_catalog = build_v3_catalog()
    out_dir.mkdir(parents=True, exist_ok=True)
    catalog_file = out_dir / "catalog.json"
    sources_file = out_dir / "sources.json"
    catalog_file.write_bytes(raw_catalog)
    shutil.copyfile(V2_DIR / "sources.json", sources_file)
    raw_sources = sources_file.read_bytes()

    print(
        json.dumps(
            {
                "release": args.release,
                "catalog_path": f".local/grounding/demo_synthetic/{args.release}/catalog.json",
                "catalog_sha256": digest(raw_catalog),
                "catalog_bytes": len(raw_catalog),
                "sources_path": f".local/grounding/demo_synthetic/{args.release}/sources.json",
                "sources_sha256": digest(raw_sources),
                "facts": len(data["facts"]),
                "questionRules": len(data["questionRules"]),
                "patterns": sum(len(r.get("patterns", ())) for r in data["questionRules"]),
                "templates": len(data["templates"]),
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
