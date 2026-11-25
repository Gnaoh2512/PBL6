"""Offline semantic contract evaluation. Synthetic facts, fake retrieval/generation, no judge/API."""

import argparse
import asyncio
import copy
import json
import sys
from collections import Counter
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "unit"))
from verification_support import fixture  # noqa: E402

from app.ingestion.snapshot import ROOT  # noqa: E402
from app.orchestration.faq import Faq  # noqa: E402
from app.orchestration.verification import VerificationGate  # noqa: E402
from app.orchestration.verification.catalog import digest  # noqa: E402
from app.providers.contracts import DependencyError, Evidence  # noqa: E402
from app.schemas.faq import Intent  # noqa: E402
from app.schemas.turn import TurnRequest  # noqa: E402

GOLD = ROOT / "tests/fixtures/grounding/gold.json"
ABSTENTION = "Chưa có đủ nguồn để trả lời câu hỏi này."


def conflict(f):
    """An explicit second synthetic source, not a rank-based conflict oracle."""
    text = "Trong demo, có nhận hành lý chứa vật dễ cháy."
    source, fact, template = [
        copy.deepcopy(f.data[k][0]) for k in ("sources", "facts", "templates")
    ]
    source.update(documentId="X", sourceSha256=digest(text.encode()))
    fact.update(factId="F_X", value={"kind": "boolean", "data": True})
    fact["provenance"]["bindings"][0].update(
        bindingId="BX",
        factId="F_X",
        documentId="X",
        citationId="CX",
        chunkId="CX",
        sectionId="X",
        sourceSha256=source["sourceSha256"],
        excerptSha256=digest(text.encode()),
        spans=[[0, len(text)]],
    )
    template.update(
        key="X",
        valueLabels=[
            {"value": {"kind": "boolean", "data": True}, "text": "có nhận hành lý chứa vật dễ cháy"}
        ],
    )
    fact["renderer"]["key"] = "X"
    for key, record in (("sources", source), ("facts", fact), ("templates", template)):
        f.data[key].append(record)
    f.data["vocabulary"]["qualifiers"][0]["supportBindingIds"].append("BX")
    extra = {
        **f.evidence[0],
        "documentId": "X",
        "citationId": "CX",
        "chunkId": "CX",
        "sectionId": "X",
        "excerpt": text,
    }
    f.evidence = [f.evidence[0], extra, f.evidence[1]]
    f.data["reviewedChunkHashes"]["CX"] = digest(text.encode())
    f.data["reviewDeclarations"]["CX"] = "complete"


def prepare(case):
    f = fixture()
    variant = case["variant"]
    rule = next(r for r in f.data["questionRules"] if r["bindingKey"] == case["rule"])
    message = rule["aliases"][0]
    candidate = f.proposal(*("F_" + r["factKey"] for r in rule["requirements"]))
    if variant == "empty":
        f.evidence = []
    elif variant == "unknown_question":
        message = "Khách sạn có jacuzzi trên mái không?"
    elif variant == "unreviewed":
        f.data["reviewDeclarations"]["CL"] = "partial"
    elif variant == "partial_evidence":
        f.evidence = f.evidence[:2]
    elif variant == "source_conflict":
        conflict(f)
    elif variant == "source_revoked":
        f.data["sources"][0]["approval"]["status"] = "revoked"
    elif variant == "wrong_review":
        f.data["facts"][0]["value"]["data"] = True
        label = f.data["templates"][0]["valueLabels"][0]
        label.update(
            value={"kind": "boolean", "data": True}, text="có nhận hành lý chứa vật dễ cháy"
        )
        candidate["claims"][0]["value"]["data"] = True
    if variant == "model_abstains":
        candidate = f.proposal()
    elif variant == "partial_claim":
        candidate["claims"] = candidate["claims"][:1]
    elif variant in {"partial_binding", "wrong_binding"}:
        candidate["claims"][-1]["supportRefs"] = [{"citationId": "CW", "bindingId": "BW"}]
    elif variant == "qualifier":
        candidate["claims"][0]["qualifierIds"] = []
    elif variant == "contradicted":
        candidate["claims"][0]["value"]["data"] = True
    elif variant == "unit":
        candidate["claims"][0]["unit"] = "hour"
    elif variant == "time":
        candidate["claims"][0]["timeScope"] = {
            "kind": "rolling_duration",
            "amount": "24",
            "unit": "hour",
        }
    elif variant == "legacy":
        candidate = {"supported": True, "answer": "Jacuzzi available", "citationIds": ["CL"]}
    elif variant == "extra":
        candidate["answer"] = "Jacuzzi available"
    elif variant == "free_claim":
        candidate["claims"].append({"claimId": "extra", "text": "Jacuzzi available"})
    elif variant == "support_vote":
        candidate["supported"] = True
    elif variant == "citation":
        candidate["claims"][0]["supportRefs"][0]["citationId"] = "UNKNOWN"
    elif variant == "pair":
        candidate["claims"][0]["supportRefs"][0]["bindingId"] = "BW"
    elif variant == "missing":
        candidate["claims"][0]["supportRefs"] = []
    f.publish()
    return f, message, candidate


async def evaluate_case(case):
    f, message, candidate = prepare(case)

    class Retrieved:
        snapshot_id = "SX"

        def validate(self, _):
            pass

        def search(self, *_):
            return [Evidence.model_validate_json(json.dumps(e)) for e in f.evidence]

    class LabeledFake:
        dispatch = 0

        async def generate(self, instruction, data, schema, budget):
            budget.reserve(10)
            budget.record(10, 5)
            if schema is Intent:
                return Intent(intent="faq", query="synthetic retrieval")
            self.dispatch += 1
            if case["variant"] == "catalog_drift":
                f.raw += b" "
            return candidate

    provider = LabeledFake()
    request = TurnRequest.validate_python(
        {
            "phase": "start",
            "requestId": "offline-phase3",
            "conversationId": str(uuid4()),
            "turnId": str(uuid4()),
            "message": message,
            "history": [],
            "allowedTools": ["search_knowledge"],
            "context": {
                "today": "2026-11-13",
                "locale": "vi-VN",
                "timeZone": "Asia/Ho_Chi_Minh",
                "currency": "VND",
            },
            "budget": {
                "remainingMs": 20000,
                "remainingInputTokens": 8000,
                "remainingOutputTokens": 2000,
                "remainingToolCalls": 1,
                "remainingBrokerBatches": 0,
            },
        }
    )
    body = None
    try:
        body = await Faq(
            provider, Retrieved(), "demo_synthetic", verification_gate=VerificationGate(f.load())
        ).run(request)
        decision = body["final"]["status"]
    except DependencyError as error:
        decision = error.code
    answer = body["final"]["answer"] if body else None
    answered = decision == "answered"
    semantic = answer == case.get("gold") if answered else None
    refs = body["final"]["citations"] if body else []
    expected_citations = ["C" + name for name in case["rule"]]
    identities = all(
        c == {k: v for k, v in e.items() if k not in {"excerpt", "corpusMode"}}
        for c in refs
        for e in [next((e for e in body["evidence"] if e["citationId"] == c["citationId"]), {})]
    )
    contract = decision == case["decision"] and provider.dispatch == case.get("dispatch", 1)
    if decision == "insufficient_evidence":
        contract = contract and answer == ABSTENTION and refs == []
    return {
        "id": case["id"],
        "group": case["group"],
        "decision": decision,
        "expected_decision": case["decision"],
        "contract_pass": contract,
        "semantic_correct": semantic,
        "citation_identity": identities if answered else None,
        "citation_support": bool(
            semantic and identities and [c["citationId"] for c in refs] == expected_citations
        )
        if answered
        else None,
        "answer_dispatches": provider.dispatch,
        "released_claims": case.get("claims", 0) if answered else 0,
        "unsupported_claims": case.get("claims", 0) if answered and not semantic else 0,
    }


async def evaluate():
    data = json.loads(GOLD.read_bytes())
    rows = [await evaluate_case(case) for case in data["cases"]]
    answered = [r for r in rows if r["decision"] == "answered"]
    abstentions = [r for r in rows if r["expected_decision"] == "insufficient_evidence"]
    claims = sum(r["released_claims"] for r in rows)
    unsupported = sum(r["unsupported_claims"] for r in rows)
    return {
        "dataset": data["dataset"],
        "gold_sha256": digest(GOLD.read_bytes()),
        "synthetic": True,
        "retrieval": "deterministic retrieved fixtures; factory/hybrid covered separately",
        "generation": "labeled fake, no model/judge",
        "cases": len(rows),
        "groups": dict(Counter(r["group"] for r in rows)),
        "contract_pass": sum(r["contract_pass"] for r in rows),
        "answer_correctness": {
            "correct": sum(r["semantic_correct"] for r in answered),
            "total": len(answered),
        },
        "groundedness": {"supported_claims": claims - unsupported, "total_claims": claims},
        "citation_identity": {
            "correct": sum(r["citation_identity"] for r in answered),
            "total": len(answered),
        },
        "citation_support": {
            "correct": sum(r["citation_support"] for r in answered),
            "total": len(answered),
        },
        "abstention_correctness": {
            "correct": sum(r["contract_pass"] for r in abstentions),
            "total": len(abstentions),
        },
        "unsupported_claim_rate": unsupported / claims if claims else None,
        "protocol_failure_rate": sum(r["decision"] == "AI_PROTOCOL_ERROR" for r in rows)
        / len(rows),
        "dependency_failure_rate": sum(r["decision"] == "DEPENDENCY_UNAVAILABLE" for r in rows)
        / len(rows),
        "semantic_acceptance": all(r["contract_pass"] for r in rows)
        and all(r["semantic_correct"] and r["citation_support"] for r in answered)
        and unsupported == 0,
        "limitation": "G20 deliberately exposes wrong human review; no general prose entailment or production gold proof.",
        "results": rows,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = asyncio.run(evaluate())
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf8")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, ensure_ascii=False))
    return 0 if report["contract_pass"] == report["cases"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
