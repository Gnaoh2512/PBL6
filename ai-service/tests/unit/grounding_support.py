"""Reviewed synthetic test catalog for existing D1 source. Never imported by app/."""

import copy
import json
from datetime import date

from verification_support import Fixture, fixture

from app.orchestration.verification import VerificationGate
from app.orchestration.verification.artifacts import source_view
from app.orchestration.verification.catalog import digest
from app.orchestration.verification.settings import GroundingConfig

ALIASES = [
    "Wi-Fi o dau?",
    "Wi-Fi ở đâu?",
    "Trong demo Wi-Fi ở đâu?",
    "wifi",
    "wifi?",
    "Wi-Fi?",
    "Wi-Fi ở sảnh?",
    "Wi-Fi có không?",
    "FAQ",
    "test",
]


def catalog_fixture(index, *, aliases=()):
    root, mode, snapshot, sources, evidence = source_view(index, date(2026, 11, 21))
    wifi = next(e for e in evidence if e.sectionId in {"FAQ-WIFI", "WIFI"})
    template = fixture()
    data = copy.deepcopy(template.data)
    fact = copy.deepcopy(data["facts"][1])
    binding = fact["provenance"]["bindings"][0]
    source = next(s for s in sources if s["documentId"] == wifi.documentId)
    binding.update(
        {
            k: source[k]
            for k in ("documentId", "sourceVersion", "sourceRef", "sourceSha256", "snapshotId")
        }
    )
    binding.update(
        citationId=wifi.citationId,
        chunkId=wifi.chunkId,
        sectionId=wifi.sectionId,
        excerptSha256=digest(wifi.excerpt.encode()),
        spans=[[0, len(wifi.excerpt)]],
    )
    fact["validity"] = dict(source["validity"])
    data.update(
        mode=mode,
        snapshotId=snapshot,
        sources=sources,
        facts=[fact],
        templates=[data["templates"][1]],
        reviewedChunkHashes={e.citationId: digest(e.excerpt.encode()) for e in evidence},
        reviewDeclarations={e.citationId: "complete" for e in evidence},
    )
    data["vocabulary"]["predicates"] = [data["vocabulary"]["predicates"][1]]
    data["vocabulary"]["qualifiers"] = [data["vocabulary"]["qualifiers"][0]]
    data["vocabulary"]["qualifiers"][0]["supportBindingIds"] = [binding["bindingId"]]
    rule = data["questionRules"][1]
    rule["aliases"] = list(dict.fromkeys([*ALIASES, *aliases]))
    data["questionRules"] = [rule]
    return Fixture(data, [e.model_dump() for e in evidence], []).publish()


def gate_for(index, *, aliases=()):
    return VerificationGate(catalog_fixture(index, aliases=aliases).load())


def proposal(cid, *, supported=True):
    if not supported:
        return {"schemaVersion": "d1-claim-proposal-2", "decision": "abstain", "claims": []}
    return {
        "schemaVersion": "d1-claim-proposal-2",
        "decision": "propose_answer",
        "claims": [
            {
                "claimId": "wifi",
                "factId": "F_W",
                "subjectId": "demo-hotel",
                "predicate": "W",
                "value": {"kind": "enum", "data": "LOBBY"},
                "unit": None,
                "qualifierIds": ["demo-only"],
                "timeScope": {"kind": "none"},
                "supportRefs": [{"citationId": cid, "bindingId": "BW"}],
            }
        ],
    }


def write_artifacts(index, *, aliases=()):
    f = catalog_fixture(index, aliases=aliases)
    root, mode, _, _, _ = source_view(index, date(2026, 11, 21))
    directory = root / ".local/grounding" / mode
    directory.mkdir(parents=True, exist_ok=True)
    catalog = directory / "catalog.json"
    catalog.write_bytes(f.raw)
    raw = json.dumps(
        {
            "schemaVersion": "grounding-sources-1",
            "mode": mode,
            "snapshotId": f.data["snapshotId"],
            "sources": f.source_state,
        },
        ensure_ascii=False,
    ).encode()
    sources = directory / "sources.json"
    sources.write_bytes(raw)
    config = GroundingConfig(
        catalog_path=catalog,
        catalog_sha256=digest(f.raw),
        sources_path=sources,
        sources_sha256=digest(raw),
        authorities={"test-reviewer"},
    )
    return f, config
