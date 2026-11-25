"""Synthetic D1.19 inputs only; never imported by production code."""

import copy
import json
from dataclasses import dataclass

from app.orchestration.verification.catalog import VerifiedCatalog, digest, review_hash
from app.providers.contracts import Evidence
from app.schemas.verification import Source, VerificationContext

TODAY = "2026-11-13"
VALIDITY = {"validFrom": "2026-01-01", "validThrough": "2026-12-31", "timeZone": "Asia/Ho_Chi_Minh"}
NO_TIME = {"kind": "none"}
SAME_DAY = {"kind": "same_local_day", "timeZone": "Asia/Ho_Chi_Minh"}
AUTHORITY = "test-reviewer"
TL = "Trong demo, không nhận hành lý chứa vật dễ cháy."
TW = "Trong demo, Wi-Fi có tại sảnh."
TT = "Trong demo, hành lý được giữ tối đa 60 phút trong cùng ngày địa phương."


def approve(record, **kwargs):
    status = record.get("approval", {}).get("status", "approved")
    record["approval"] = {
        "status": status,
        "decisionId": None if status == "pending_review" else "test-decision",
        "authorityRef": None if status == "pending_review" else AUTHORITY,
        "reviewedContentSha256": None
        if status == "pending_review"
        else review_hash(record, **kwargs),
    }


def segment(kind, text=None, qualifier=None):
    return {"kind": kind, "text": text, "qualifierId": qualifier}


@dataclass
class Fixture:
    data: dict
    evidence: list
    source_state: list
    raw: bytes = b""

    def publish(self):
        for source in self.data["sources"]:
            approve(source)
        for fact, template in zip(self.data["facts"], self.data["templates"]):
            fact["renderer"]["hash"] = digest(template)
            approve(fact, vocabulary=self.data["vocabulary"], template=template)
        approve(self.data)
        self.raw = json.dumps(self.data, ensure_ascii=False).encode()
        self.source_state = copy.deepcopy(self.data["sources"])
        return self

    def load(self, **kwargs):
        return VerifiedCatalog(
            lambda: self.raw,
            expected_hash=digest(self.raw),
            authorities=frozenset({AUTHORITY}),
            source_reader=lambda: tuple(
                Source.model_validate_json(json.dumps(s)) for s in self.source_state
            ),
            **kwargs,
        )

    def context(self, **changes):
        data = {
            "requestId": "req-d120",
            "conversationId": "conversation",
            "turnId": "turn",
            "diagnosticId": "diagnostic",
            "registryTurnId": "turn",
            "asOfDate": TODAY,
            "mode": "demo_synthetic",
            "snapshotId": "SX",
            "registryHash": digest(self.evidence),
            "catalogHash": digest(self.raw),
            "vocabularyHash": digest(self.data["vocabulary"]),
            "questionRulesHash": digest(
                {"version": self.data["questionRulesVersion"], "rules": self.data["questionRules"]}
            ),
            "rendererHash": digest(
                {"version": self.data["rendererVersion"], "templates": self.data["templates"]}
            ),
        }
        data.update(changes)
        return VerificationContext.model_validate_json(json.dumps(data))

    def proposal(self, *names):
        claims = []
        for n, name in enumerate(names):
            fact = next(f for f in self.data["facts"] if f["factId"] == name)
            claim = {
                k: copy.deepcopy(fact[k])
                for k in (
                    "factId",
                    "subjectId",
                    "predicate",
                    "value",
                    "unit",
                    "qualifierIds",
                    "timeScope",
                )
            }
            claim["claimId"] = f"c{n}"
            claim["supportRefs"] = [
                {"citationId": b["citationId"], "bindingId": b["bindingId"]}
                for b in fact["provenance"]["bindings"]
            ]
            claims.append(claim)
        return {
            "schemaVersion": "d1-claim-proposal-2",
            "decision": "propose_answer" if names else "abstain",
            "claims": claims,
        }


def fixture():
    facts, sources, evidence, templates = [], [], [], []
    qualifiers = [
        {
            "id": "demo-only",
            "kind": "scope",
            "value": {"kind": "boolean", "data": True},
            "rendererToken": "Trong demo, ",
            "supportBindingIds": ["BL", "BW", "BT"],
        },
        {
            "id": "same-day-only",
            "kind": "condition",
            "value": {"kind": "boolean", "data": True},
            "rendererToken": " trong cùng ngày",
            "supportBindingIds": ["BT"],
        },
    ]
    for name, text, kind, value, unit, scope in (
        ("L", TL, "boolean", False, None, NO_TIME),
        ("W", TW, "enum", "LOBBY", None, NO_TIME),
        ("T", TT, "decimal", "60", "minute", SAME_DAY),
    ):
        cid, bid, fid = "C" + name, "B" + name, "F_" + name
        qids = ["demo-only"] + (["same-day-only"] if name == "T" else [])
        source = {
            "documentId": name,
            "sourceVersion": "1.0.0",
            "sourceRef": "synthetic:d120",
            "sourceSha256": digest(text.encode()),
            "snapshotId": "SX",
            "validity": dict(VALIDITY),
        }
        sources.append(source)
        evidence.append(
            Evidence(
                citationId=cid,
                chunkId=cid,
                documentId=name,
                version="1.0.0",
                sectionId=name,
                title="Synthetic test",
                sourceRef="synthetic:d120",
                excerpt=text,
                corpusMode="demo_synthetic",
            ).model_dump()
        )
        binding = {
            "bindingId": bid,
            "factId": fid,
            "citationId": cid,
            "chunkId": cid,
            "sectionId": name,
            "excerptSha256": digest(text.encode()),
            "spans": [[0, len(text)]],
            **{
                k: source[k]
                for k in ("documentId", "sourceVersion", "sourceRef", "sourceSha256", "snapshotId")
            },
        }
        segments = [segment("qualifier", qualifier="demo-only")]
        if name == "T":
            segments += [
                segment("literal", "hành lý được giữ tối đa "),
                segment("value"),
                segment("literal", " "),
                segment("unit"),
                segment("qualifier", qualifier="same-day-only"),
                segment("scope"),
            ]
        else:
            segments += [segment("value")]
        segments += [segment("literal", ".")]
        template = {
            "key": name,
            "version": "1",
            "segments": segments,
            "valueLabels": [
                {
                    "value": {"kind": kind, "data": value},
                    "text": {
                        "L": "không nhận hành lý chứa vật dễ cháy",
                        "W": "Wi-Fi có tại sảnh",
                        "T": "60",
                    }[name],
                }
            ],
            "unitText": "phút" if unit else None,
            "scopeText": " địa phương" if name == "T" else None,
        }
        templates.append(template)
        facts.append(
            {
                "schemaVersion": "d1-fact-1",
                "factId": fid,
                "factVersion": "1",
                "factKey": name,
                "subjectId": "demo-hotel",
                "predicate": name,
                "value": {"kind": kind, "data": value},
                "unit": unit,
                "qualifierIds": qids,
                "timeScope": dict(scope),
                "validity": dict(VALIDITY),
                "provenance": {"bindings": [binding]},
                "renderer": {
                    "key": name,
                    "version": "1",
                    "hash": digest(template),
                    "ordinal": len(facts),
                },
            }
        )
    rules = []
    for key, aliases, names in (
        ("L", ["Trong demo có nhận hành lý chứa vật dễ cháy không?"], ["L"]),
        ("W", ["Trong demo Wi-Fi ở đâu?"], ["W"]),
        ("T", ["Trong demo thời gian giữ hành lý tối đa là bao lâu?"], ["T"]),
        ("LT", ["Hỏi hành lý và thời gian trong demo?"], ["L", "T"]),
    ):
        required = [
            {
                k: copy.deepcopy(next(f for f in facts if f["factKey"] == name)[k])
                for k in ("factKey", "subjectId", "qualifierIds", "unit", "timeScope")
            }
            for name in names
        ]
        rules.append(
            {
                "bindingKey": key,
                "aliases": aliases,
                "requirements": required,
                "permittedFactKeys": names,
            }
        )
    data = {
        "schemaVersion": "d1-catalog-1",
        "catalogVersion": "1",
        "mode": "demo_synthetic",
        "snapshotId": "SX",
        "vocabulary": {
            "version": "1",
            "subjects": ["demo-hotel"],
            "qualifiers": qualifiers,
            "predicates": [
                {
                    "id": f["predicate"],
                    "valueKind": f["value"]["kind"],
                    "enumValues": ["LOBBY", "ROOM"] if f["value"]["kind"] == "enum" else [],
                    "units": ["minute", "hour"] if f["unit"] else [],
                    "cardinality": "single",
                }
                for f in facts
            ],
        },
        "questionRulesVersion": "1",
        "questionRules": rules,
        "rendererVersion": "1",
        "templates": templates,
        "sources": sources,
        "facts": facts,
        "reviewedChunkHashes": {e["citationId"]: digest(e["excerpt"].encode()) for e in evidence},
        "reviewDeclarations": {e["citationId"]: "complete" for e in evidence},
    }
    return Fixture(data, evidence, []).publish()
