"""Offline unit tests for the bounded A/B generation diagnostic harness."""

import asyncio
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "evaluation"))

import diagnose_generation as diag  # noqa: E402

from app.providers.gemini import Gemini  # noqa: E402


def _gemini_json_response(payload: dict) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "modelVersion": "gemini-3.5-flash-lite",
            "usageMetadata": {"promptTokenCount": 50, "candidatesTokenCount": 20},
            "candidates": [
                {
                    "finishReason": "STOP",
                    "content": {"parts": [{"text": json.dumps(payload, ensure_ascii=False)}]},
                }
            ],
        },
    )


def test_validate_only_plan_is_offline_and_has_reproducibility_hashes(capsys):
    exit_code = diag.main(["--validate-only", "--trials", "3"])
    assert exit_code == 0
    out = json.loads(capsys.readouterr().out)
    assert out["mode"] == "validate_only"
    assert out["trials_per_arm"] == 3
    assert out["total_planned_trials"] == 6
    assert out["interleaved_order"] == ["minimal", "candidate_v2"] * 3
    assert out["arms"]["minimal"]["schema_bytes"] < out["arms"]["candidate_v2"]["schema_bytes"]
    assert out["arms"]["minimal"]["prompt_sha256"] == out["arms"]["candidate_v2"]["prompt_sha256"]
    repro = out["reproducibility"]
    assert repro["query"] == diag.FIXED_QUERY
    assert repro["classify_prompt_version"] == "d1-faq-3"
    for key in (
        "input_sha256",
        "classify_prompt_sha256",
        "answer_prompt_sha256",
        "catalog_sha256",
        "sources_sha256",
    ):
        assert len(repro[key]) == 64


def test_live_requires_explicit_allow_flag(capsys):
    assert diag.main(["--live", "--trials", "2"]) == 1
    out = json.loads(capsys.readouterr().out)
    assert out == {"status": "not_run", "reason": "LIVE_API_NOT_AUTHORIZED"}


def test_interleaved_ab_diagnostic_classifies_success_503_and_timeout_with_mock_transport():
    plan = diag.build_plan(trials=2, delay_s=0.0, budget_ms=20000)
    gen_calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 40})
        body = json.loads(request.content)
        title = body["generationConfig"]["responseJsonSchema"]["title"]
        gen_calls.append(title)
        idx = len(gen_calls)
        if idx == 1:  # trial 1: minimal -> success
            return _gemini_json_response(
                {"decision": "propose_answer", "factId": "pol03-deposit-rate-v1"}
            )
        if idx == 2:  # trial 2: candidate_v2 -> upstream 503
            return httpx.Response(503, text="upstream overloaded")
        if idx == 3:  # trial 3: minimal -> read timeout (deadline)
            raise httpx.ReadTimeout("simulated timeout")
        # trial 4: candidate_v2 -> success
        return _gemini_json_response(
            {
                "schemaVersion": "d1-claim-proposal-2",
                "decision": "propose_answer",
                "claims": [
                    {
                        "claimId": "c1",
                        "factId": "pol03-deposit-rate-v1",
                        "subjectId": "demo-hotel",
                        "predicate": "required_deposit_percentage",
                        "value": {"kind": "decimal", "data": "30"},
                        "unit": "percent",
                        "qualifierIds": ["academic-demo-only"],
                        "timeScope": {"kind": "none"},
                        "supportRefs": [
                            {
                                "bindingId": "bind-pol03-deposit-rate-v1",
                                "citationId": (
                                    "15ec2cd2345f4a33ca6708cc5c507fa2"
                                    "40133fa0e89c15269d78b746bb63ca3c"
                                ),
                            }
                        ],
                    }
                ],
            }
        )

    async def execute():
        client = Gemini("synthetic-key", "gemini-3.5-flash-lite", httpx.MockTransport(handler))
        try:
            return await diag.run_diagnostic(plan, client=client)
        finally:
            await client.close()

    report = asyncio.run(execute())
    assert gen_calls == ["MinimalProposal", "CandidateDraft", "MinimalProposal", "CandidateDraft"]
    assert report["mode"] == "executed"
    assert [t["bucket"] for t in report["trials"]] == [
        "success",
        "upstream_http_5xx",
        "client_deadline_exceeded",
        "success",
    ]
    assert report["trials"][1]["generate_http_status"] == 503
    assert report["summary_by_arm"]["minimal"]["buckets"] == {
        "success": 1,
        "client_deadline_exceeded": 1,
    }
    assert report["summary_by_arm"]["candidate_v2"]["buckets"] == {
        "upstream_http_5xx": 1,
        "success": 1,
    }
    assert all(len(t["attempts"]) == 2 for t in report["trials"])
