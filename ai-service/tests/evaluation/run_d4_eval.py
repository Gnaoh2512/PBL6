"""Offline D1-D4 evaluation runner over the 80-case synthetic suite (real FastAPI + gate)."""

from __future__ import annotations

import argparse
import json
import math
import shutil
import tempfile
from collections import defaultdict
from datetime import date
from pathlib import Path
from time import perf_counter
from uuid import uuid4

from fastapi.testclient import TestClient

from app.ingestion.snapshot import ROOT, build
from app.main import create_app
from app.orchestration.faq import Faq
from app.retrieval.index import KnowledgeIndex
from app.schemas.verification import CandidateDraft
from app.settings import Settings
from app.tools.schemas import TurnPlan

SUITE_PATH = Path(__file__).resolve().parent / "d4_suite.json"
TOKEN = "d4-eval-service-token"
CORE_GROUPS = ("faq", "rooms", "pricing", "services", "personal_bookings", "policies")
SUPPLEMENTARY_GROUPS = (
    "combined_booking_policy",
    "unanswerable_and_out_of_scope",
    "security_and_faults",
)
CUSTOMER_TOOLS = [
    "search_knowledge",
    "search_rooms",
    "list_services",
    "list_my_bookings",
    "get_my_booking",
]
PUBLIC_TOOLS = ["search_knowledge", "search_rooms", "list_services"]


class _EvalSyntheticProvider:
    """Labeled synthetic provider for deterministic offline orchestration & gate evaluation."""

    def __init__(self, plan: TurnPlan, proposal_fn):
        self._plan = plan
        self._proposal_fn = proposal_fn
        self.calls = 0

    async def probe(self, _budget):
        return None

    async def generate(self, _instruction, content, schema, budget):
        self.calls += 1
        budget.reserve(40)
        budget.record(40, 20)
        if schema is TurnPlan:
            return self._plan
        return CandidateDraft.model_validate_json(
            json.dumps(self._proposal_fn(content["evidence"][0]["citationId"], supported=True))
        )


def _percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    rank = max(1, math.ceil((pct / 100.0) * len(ordered)))
    return round(ordered[min(rank - 1, len(ordered) - 1)], 2)


def validate_suite_structure(suite: dict) -> dict:
    cases = suite.get("cases", [])
    if len(cases) < 80:
        raise ValueError(f"Expected >= 80 cases, found {len(cases)}")
    ids = [c["id"] for c in cases]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate case IDs found in D4 suite")

    group_counts: dict[str, int] = defaultdict(int)
    dev_pgroups: set[str] = set()
    held_pgroups: set[str] = set()
    for case in cases:
        group_counts[case["group"]] += 1
        if case["split"] == "dev":
            dev_pgroups.add(case["paraphraseGroup"])
        elif case["split"] == "held_out":
            held_pgroups.add(case["paraphraseGroup"])
        else:
            raise ValueError(f"Unknown split {case['split']!r} in {case['id']}")

    for group in CORE_GROUPS:
        if group_counts[group] != 10:
            raise ValueError(f"Core group {group!r} must have 10 cases, got {group_counts[group]}")
    supp_total = sum(group_counts[g] for g in SUPPLEMENTARY_GROUPS)
    if supp_total < 20:
        raise ValueError(f"Supplementary groups must have >= 20 cases, got {supp_total}")
    overlap = dev_pgroups & held_pgroups
    if overlap:
        raise ValueError(f"Paraphrase group leakage between dev and held_out: {sorted(overlap)}")
    return {
        "totalCases": len(cases),
        "coreCases": sum(group_counts[g] for g in CORE_GROUPS),
        "supplementaryCases": supp_total,
        "groupCounts": dict(group_counts),
        "devCount": sum(1 for c in cases if c["split"] == "dev"),
        "heldOutCount": sum(1 for c in cases if c["split"] == "held_out"),
        "paraphraseLeakage": 0,
    }


def _evaluate_case(client: TestClient, case: dict, today_str: str) -> dict:
    t0 = perf_counter()
    allowed = CUSTOMER_TOOLS if case["role"] == "customer" else PUBLIC_TOOLS
    req_id = f"eval-{case['id'].lower()}"
    conv_id = str(uuid4())
    turn_id = str(uuid4())
    headers = {"Authorization": f"Bearer {TOKEN}", "X-Request-ID": req_id}
    start_payload = {
        "phase": "start",
        "requestId": req_id,
        "conversationId": conv_id,
        "turnId": turn_id,
        "message": case["message"],
        "history": [],
        "allowedTools": allowed,
        "context": {
            "locale": "vi-VN",
            "timeZone": "Asia/Ho_Chi_Minh",
            "today": today_str,
            "currency": "VND",
        },
        "budget": {
            "remainingToolCalls": case["remainingToolCalls"],
            "remainingBrokerBatches": 2,
            "remainingMs": 20000,
            "remainingInputTokens": 8000,
            "remainingOutputTokens": 2000,
        },
    }

    first = client.post("/internal/assistant/turn", json=start_payload, headers=headers)
    first_body = first.json()
    observed_tool: str | None = None
    final_http = first.status_code
    final_body = first_body
    total_input = 0
    total_output = 0
    total_tool_calls = 0

    if first.status_code == 200:
        usage = first_body.get("usage") or {}
        total_input += int(usage.get("inputTokensUsed", 0))
        total_output += int(usage.get("outputTokensUsed", 0))
        total_tool_calls += int(usage.get("toolCallsUsed", 0))

        if first_body.get("kind") == "tool_calls":
            call = first_body["toolCalls"][0]
            observed_tool = call["name"]
            total_tool_calls += 1
            sim_res = case.get("simulatedToolResult") or {}
            tool_res = {
                "callId": call["callId"],
                "name": observed_tool,
                "status": sim_res.get("status", "ok"),
                "data": sim_res.get("data"),
                "error": sim_res.get("error"),
            }
            resume_payload = {
                "phase": "resume",
                "requestId": req_id,
                "conversationId": conv_id,
                "turnId": turn_id,
                "continuationId": first_body["continuationId"],
                "toolResults": [tool_res],
                "budget": {
                    "remainingToolCalls": max(0, case["remainingToolCalls"] - 1),
                    "remainingBrokerBatches": 1,
                    "remainingMs": 15000,
                    "remainingInputTokens": 7900,
                    "remainingOutputTokens": 1900,
                },
            }
            second = client.post("/internal/assistant/turn", json=resume_payload, headers=headers)
            if case.get("faultMode") == "replay_continuation":
                replay = client.post(
                    "/internal/assistant/turn", json=resume_payload, headers=headers
                )
                final_http = replay.status_code
                final_body = replay.json()
            else:
                final_http = second.status_code
                final_body = second.json()
                if second.status_code == 200:
                    u2 = final_body.get("usage") or {}
                    total_input += int(u2.get("inputTokensUsed", 0))
                    total_output += int(u2.get("outputTokensUsed", 0))
                    total_tool_calls += int(u2.get("toolCallsUsed", 0))

    elapsed_ms = (perf_counter() - t0) * 1000.0
    exp = case["expected"]
    failures: list[str] = []

    if final_http != exp["httpStatus"]:
        failures.append(f"httpStatus={final_http} != {exp['httpStatus']}")
    if observed_tool != exp["tool"]:
        failures.append(f"tool={observed_tool!r} != {exp['tool']!r}")

    if final_http == 200:
        final_obj = final_body.get("final") or {}
        obs_status = final_obj.get("status")
        if obs_status != exp["status"]:
            failures.append(f"status={obs_status!r} != {exp['status']!r}")
        citations = final_obj.get("citations") or []
        if len(citations) < exp["citationsMin"]:
            failures.append(f"citations={len(citations)} < {exp['citationsMin']}")
        if exp["citationsMin"] == 0 and obs_status == "insufficient_evidence" and citations:
            failures.append("insufficient_evidence must have empty citations")
        evidence_ids = {e["citationId"] for e in (final_body.get("evidence") or [])}
        for cit in citations:
            if cit["citationId"] not in evidence_ids:
                failures.append(f"citation {cit['citationId']} not in evidence registry")
        actions = [a["type"] for a in (final_obj.get("actions") or [])]
        if actions != exp["actions"]:
            failures.append(f"actions={actions} != {exp['actions']}")
        missing = final_obj.get("missingFields") or []
        if exp["missingFields"] and missing != exp["missingFields"]:
            failures.append(f"missingFields={missing} != {exp['missingFields']}")
        answer = final_obj.get("answer") or ""
        for needle in exp["mustContain"]:
            if needle.lower() not in answer.lower():
                failures.append(f"missing text {needle!r}")
        for forbidden in exp["mustNotContain"]:
            if forbidden in answer:
                failures.append(f"leaked forbidden text {forbidden!r}")
    else:
        obs_code = (final_body.get("error") or {}).get("code")
        if obs_code != exp["status"]:
            failures.append(f"error.code={obs_code!r} != {exp['status']!r}")

    return {
        "id": case["id"],
        "group": case["group"],
        "split": case["split"],
        "passed": not failures,
        "failures": failures,
        "elapsedMs": round(elapsed_ms, 2),
        "toolCalls": total_tool_calls,
        "inputTokens": total_input,
        "outputTokens": total_output,
    }


def evaluate_d4_suite(suite_path: Path = SUITE_PATH) -> dict:
    from tests.unit.grounding_support import gate_for, proposal

    suite = json.loads(suite_path.read_text(encoding="utf-8"))
    structure = validate_suite_structure(suite)
    today_str = suite["today"]
    eval_date = date.fromisoformat(today_str)
    bound_aliases = [c["message"] for c in suite["cases"] if c.get("policyBound")]

    results: list[dict] = []
    with tempfile.TemporaryDirectory(prefix="pbl6_d4_eval_") as tmp:
        tmp_path = Path(tmp)
        source = tmp_path / "tests/fixtures/d1/faq.md"
        source.parent.mkdir(parents=True)
        shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
        snap = build("demo_synthetic", eval_date, tmp_path)
        index = KnowledgeIndex(snap, "demo_synthetic", eval_date, tmp_path)
        gate = gate_for(index, aliases=bound_aliases)
        settings = Settings(
            AI_SERVICE_AUTH_TOKEN=TOKEN,
            AI_CORPUS_MODE="demo_synthetic",
            GEMINI_API_KEY="synthetic-eval-key",
        )

        for case in suite["cases"]:
            plan = TurnPlan.model_validate(case["simulatedPlan"])
            provider = _EvalSyntheticProvider(plan, proposal)
            faq = Faq(provider, index, "demo_synthetic", verification_gate=gate)
            app = create_app(settings, faq=faq)
            with TestClient(app) as client:
                results.append(_evaluate_case(client, case, today_str))

    by_group: dict[str, dict] = {}
    for group in (*CORE_GROUPS, *SUPPLEMENTARY_GROUPS):
        subset = [r for r in results if r["group"] == group]
        passed = sum(1 for r in subset if r["passed"])
        by_group[group] = {"passed": passed, "total": len(subset)}

    latencies = [r["elapsedMs"] for r in results]
    total_passed = sum(1 for r in results if r["passed"])
    dev_passed = sum(1 for r in results if r["split"] == "dev" and r["passed"])
    held_passed = sum(1 for r in results if r["split"] == "held_out" and r["passed"])
    return {
        "schemaVersion": "d4-evaluation-report-1",
        "harnessMode": "offline_synthetic_provider_real_orchestration_and_gate",
        "scopeDisclaimer": (
            "Offline deterministic harness measuring orchestration, tool/argument validation, "
            "ownership/security gating, continuation replay, citation registry integrity, and "
            "combined booking+policy flow. Does not replace live Gemini latency or human review."
        ),
        "structure": structure,
        "summary": {
            "passed": total_passed,
            "total": len(results),
            "passRate": round(total_passed / len(results), 4),
            "devPassed": dev_passed,
            "devTotal": structure["devCount"],
            "heldOutPassed": held_passed,
            "heldOutTotal": structure["heldOutCount"],
            "latencyMs": {
                "p50": _percentile(latencies, 50),
                "p95": _percentile(latencies, 95),
            },
            "usage": {
                "totalToolCalls": sum(r["toolCalls"] for r in results),
                "totalInputTokens": sum(r["inputTokens"] for r in results),
                "totalOutputTokens": sum(r["outputTokens"] for r in results),
            },
        },
        "byGroup": by_group,
        "failedCases": [r for r in results if not r["passed"]],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the 80-case D1-D4 offline evaluation suite.")
    parser.add_argument("--output", type=Path, default=None, help="Optional JSON report path.")
    args = parser.parse_args()
    report = evaluate_d4_suite()
    if args.output is not None:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", "utf-8")
    summary = report["summary"]
    print(
        f"D4 offline evaluation: {summary['passed']}/{summary['total']} passed "
        f"(dev={summary['devPassed']}/{summary['devTotal']}, "
        f"held_out={summary['heldOutPassed']}/{summary['heldOutTotal']}, "
        f"p50={summary['latencyMs']['p50']}ms, p95={summary['latencyMs']['p95']}ms)"
    )
    for group, counts in report["byGroup"].items():
        print(f"  - {group}: {counts['passed']}/{counts['total']}")
    return 0 if summary["passed"] == summary["total"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
