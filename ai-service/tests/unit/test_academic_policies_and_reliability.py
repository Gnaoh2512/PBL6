"""Tests for Academic Demo 10-policy allowlist, extended policy units, receipts & latch cooldown."""

import copy
import json
import shutil
from datetime import date

import pytest
from fastapi.testclient import TestClient
from grounding_support import gate_for
from pydantic import ValidationError
from verification_support import fixture

import app.main as main
from app.indexing import ChunkingConfig, IndexingError
from app.ingestion.documents import load_chunks
from app.ingestion.snapshot import DEMO_SOURCE_PACKS, ROOT, build, sources_for
from app.orchestration.faq import Faq
from app.orchestration.verification import VerificationGate
from app.orchestration.verification.catalog import digest
from app.orchestration.verification.publisher import build_source_receipts, write_source_receipts
from app.providers.contracts import DependencyError
from app.providers.gemini import Gemini
from app.retrieval.index import KnowledgeIndex
from app.schemas.faq import Intent
from app.schemas.verification import CandidateDraft
from app.settings import Settings

POLICY_TODAY = date(2026, 11, 23)


def _copy_policies(tmp_path):
    for rel in DEMO_SOURCE_PACKS["academic_policies"]:
        dst = tmp_path / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, dst)
    return tmp_path


def test_academic_policies_load_all_10_files_and_38_units_cleanly(tmp_path):
    root = _copy_policies(tmp_path)
    chunks, sources = load_chunks(
        root, "demo_synthetic", POLICY_TODAY, ChunkingConfig(), source_pack="academic_policies"
    )
    assert len(sources) == 10
    assert len(chunks) == 38
    assert all(c.approved and c.corpus_mode == "demo_synthetic" for c in chunks)
    assert all(len(c.content) <= 2000 for c in chunks)
    assert len({c.chunk_id for c in chunks}) == 38
    assert len({c.section_id for c in chunks}) == 38


def test_production_mode_rejects_academic_policies_source_pack(tmp_path):
    root = _copy_policies(tmp_path)
    with pytest.raises(ValueError, match="Production mode"):
        sources_for("production", "academic_policies")
    with pytest.raises(ValueError, match="Production mode"):
        build("production", POLICY_TODAY, root, source_pack="academic_policies")
    with pytest.raises(IndexingError, match="SOURCE_INVALID"):
        load_chunks(
            root, "production", POLICY_TODAY, ChunkingConfig(), source_pack="academic_policies"
        )


def test_academic_policies_snapshot_search_and_immutable_source_receipts(tmp_path):
    root = _copy_policies(tmp_path)
    snap = build("demo_synthetic", POLICY_TODAY, root, source_pack="academic_policies")
    index = KnowledgeIndex(
        snap, "demo_synthetic", POLICY_TODAY, root, source_pack="academic_policies"
    )
    hits = index.search("dat coc 30% giu cho 15 phut", POLICY_TODAY)
    assert hits and any(
        h.sectionId.startswith("POL-01") or h.sectionId.startswith("POL-03") for h in hits
    )

    raw, meta = build_source_receipts(
        index, POLICY_TODAY, authority_ref="academic-user", decision_id="dec-2026-11-23"
    )
    assert meta["sourceCount"] == 10
    assert meta["sources_sha256"] == digest(raw)

    published = write_source_receipts(
        index,
        POLICY_TODAY,
        release_name="rel-v1",
        authority_ref="academic-user",
        decision_id="dec-2026-11-23",
    )
    assert published["sources_path"] == ".local/grounding/demo_synthetic/rel-v1/sources.json"
    with pytest.raises(FileExistsError):
        write_source_receipts(
            index,
            POLICY_TODAY,
            release_name="rel-v1",
            authority_ref="academic-user",
            decision_id="dec-2026-11-23",
        )


@pytest.mark.parametrize(
    "unit,amount,unit_text",
    [
        ("percent", "30", "%"),
        ("vnd", "1700000", "VND"),
        ("calendar_day", "3", "ngày lịch"),
        ("working_day", "5", "ngày làm việc"),
        ("night", "1", "đêm"),
        ("guest", "2", "khách"),
        ("room", "1", "phòng"),
    ],
)
def test_extended_policy_units_pass_verification_gate_and_renderer(unit, amount, unit_text):
    f = fixture()
    pred = copy.deepcopy(f.data["vocabulary"]["predicates"][2])
    pred["units"] = [unit]
    f.data["vocabulary"]["predicates"][2] = pred
    fact = f.data["facts"][2]
    fact["value"] = {"kind": "decimal", "data": amount}
    fact["unit"] = unit
    fact["timeScope"] = {"kind": "none"}
    tmpl = f.data["templates"][2]
    tmpl["segments"] = [s for s in tmpl["segments"] if s["kind"] != "scope"]
    tmpl["scopeText"] = None
    tmpl["unitText"] = unit_text
    tmpl["valueLabels"] = [{"value": {"kind": "decimal", "data": amount}, "text": amount}]
    rule = f.data["questionRules"][2]
    rule["requirements"][0]["unit"] = unit
    rule["requirements"][0]["timeScope"] = {"kind": "none"}
    f.publish()

    catalog = f.load()
    gate = VerificationGate(catalog)
    from app.providers.contracts import TurnBudget

    turn = gate.prepare(f.context(), rule["aliases"][0], f.evidence, TurnBudget())
    assert turn.needs_candidate
    payload = turn.final_payload(f.proposal("F_T"))
    assert payload["final"]["status"] == "answered"
    assert amount in payload["final"]["answer"] and unit_text in payload["final"]["answer"]


def test_unknown_unit_is_still_rejected_in_candidate_draft():
    data = fixture().proposal("F_T")
    data["claims"][0]["unit"] = "usd"
    with pytest.raises(ValidationError):
        CandidateDraft.model_validate_json(json.dumps(data))


def test_gemini_client_disables_trust_env():
    client = Gemini("synthetic-key", "gemini-3.1-flash-lite")
    assert client.client._trust_env is False


def test_dependency_latch_cooldown_recovers_only_when_configured(tmp_path, monkeypatch):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    today = date(2026, 11, 13)
    snap = build("demo_synthetic", today, tmp_path)
    index = KnowledgeIndex(snap, "demo_synthetic", today, tmp_path)

    clock = [100.0]
    monkeypatch.setattr(main, "monotonic", lambda: clock[0])

    class FlakyProvider:
        def __init__(self):
            self.fail = True

        async def generate(self, system, data, schema, budget):
            if self.fail:
                raise DependencyError("DEPENDENCY_UNAVAILABLE")
            budget.reserve(10)
            budget.record(10, 10)
            return Intent(intent="unavailable", query="test")

    req = {
        "phase": "start",
        "requestId": "req-cooldown-1",
        "conversationId": "00000000-0000-4000-8000-000000000002",
        "turnId": "00000000-0000-4000-8000-000000000003",
        "message": "Kiểm tra giá phòng?",
        "history": [],
        "allowedTools": ["search_knowledge"],
        "context": {
            "locale": "vi-VN",
            "timeZone": "Asia/Ho_Chi_Minh",
            "today": today.isoformat(),
            "currency": "VND",
        },
        "budget": {
            "remainingToolCalls": 4,
            "remainingBrokerBatches": 0,
            "remainingMs": 20000,
            "remainingInputTokens": 8000,
            "remainingOutputTokens": 2000,
        },
    }
    headers = {"Authorization": "Bearer test-service", "X-Request-ID": req["requestId"]}

    # Default cooldown=0 keeps permanent latch until restart.
    perm_provider = FlakyProvider()
    perm_settings = Settings(
        _env_file=None, service_token="test-service", corpus_mode="demo_synthetic"
    )
    with TestClient(
        main.create_app(
            perm_settings,
            faq=Faq(perm_provider, index, "demo_synthetic", verification_gate=gate_for(index)),
        )
    ) as client:
        assert client.post("/internal/assistant/turn", json=req, headers=headers).status_code == 503
        clock[0] += 9999.0
        assert client.get("/ready").status_code == 503

    # Explicit cooldown recovers once elapsed.
    cool_provider = FlakyProvider()
    cool_settings = Settings(
        _env_file=None,
        service_token="test-service",
        corpus_mode="demo_synthetic",
        dependency_latch_cooldown_s=30.0,
    )
    with TestClient(
        main.create_app(
            cool_settings,
            faq=Faq(cool_provider, index, "demo_synthetic", verification_gate=gate_for(index)),
        )
    ) as client:
        assert client.post("/internal/assistant/turn", json=req, headers=headers).status_code == 503
        assert client.get("/ready").status_code == 503
        clock[0] += 29.0
        assert client.get("/ready").status_code == 503
        cool_provider.fail = False
        clock[0] += 1.5
        assert client.get("/ready").status_code == 200
        recovered = client.post("/internal/assistant/turn", json=req, headers=headers)
        assert recovered.status_code == 200
        assert recovered.json()["final"]["status"] == "capability_unavailable"


def test_gemini_schema_converts_const_literals_to_enum_without_mutating_pydantic_schema():
    from app.providers.gemini import _gemini_schema
    from app.schemas.verification import CandidateDraft

    raw = CandidateDraft.model_json_schema()
    assert raw["properties"]["schemaVersion"]["const"] == "d1-claim-proposal-2"
    converted = _gemini_schema(raw)
    assert converted["title"] == "CandidateDraft"
    assert converted["properties"]["schemaVersion"] == {
        "enum": ["d1-claim-proposal-2"],
        "type": "string",
    }
    encoded = json.dumps(converted)
    for forbidden in (
        '"const"',
        '"$defs"',
        '"$ref"',
        '"pattern"',
        '"minLength"',
        '"maxLength"',
        '"discriminator"',
        '"oneOf"',
        '"format"',
    ):
        assert forbidden not in encoded
    assert '"title"' not in json.dumps(converted["properties"])
    assert "anyOf" in encoded
    assert raw["properties"]["schemaVersion"]["const"] == "d1-claim-proposal-2"


def test_hybrid_bm25_filters_vietnamese_stopwords(tmp_path):
    from hybrid_support import hybrid
    from indexing_support import TODAY

    from app.retrieval.hybrid import _bm25_expression

    retriever = hybrid(tmp_path, TODAY)
    manifest = retriever.pin(TODAY)
    assert retriever.bm25("có không là gì của và thế nào ở", manifest, TODAY) == ()
    assert retriever.bm25("Wi-Fi là gì?", manifest, TODAY)
    expr = _bm25_expression("Chính sách hủy phòng trước check-in")
    assert expr is not None
    assert '"huy phong"' in expr and '"chinh sach"' in expr and '"check in"' in expr
    assert '"co"' not in expr


def test_classify_prompt_v3_separates_hypothetical_policy_examples_from_live_actions():
    from app.prompts.faq import CLASSIFY, VERSION

    assert VERSION == "d1-faq-3"
    assert "hypothetical policy examples" in CLASSIFY
    assert "ví dụ báo giá" in CLASSIFY and "giả sử" in CLASSIFY
    assert "live room prices" in CLASSIFY and "actual personal booking" in CLASSIFY


def test_gemini_optional_thinking_level_omitted_by_default_and_validated():
    import asyncio

    import httpx

    from app.providers.contracts import TurnBudget

    with pytest.raises(DependencyError) as exc:
        Gemini("key", "gemini-3.6-flash", thinking_level="invalid")
    assert exc.value.code == "AI_NOT_CONFIGURED"

    seen = []

    async def handle(request):
        body = json.loads(request.content)
        seen.append((request.url.path, body))
        if request.url.path.endswith(":countTokens"):
            return httpx.Response(200, json={"totalTokens": 5})
        return httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "finishReason": "STOP",
                        "content": {"parts": [{"text": '{"intent":"faq","query":"wifi"}'}]},
                    }
                ],
                "usageMetadata": {"promptTokenCount": 5, "candidatesTokenCount": 4},
            },
        )

    async def run():
        default_client = Gemini("key", "gemini-3.6-flash", httpx.MockTransport(handle))
        minimal_client = Gemini(
            "key", "gemini-3.6-flash", httpx.MockTransport(handle), thinking_level="minimal"
        )
        try:
            await default_client.generate("sys", {"m": "hi"}, Intent, TurnBudget())
            await minimal_client.generate("sys", {"m": "hi"}, Intent, TurnBudget())
        finally:
            await default_client.close()
            await minimal_client.close()

    asyncio.run(run())
    gen_bodies = [body for path, body in seen if path.endswith(":generateContent")]
    assert "thinkingConfig" not in gen_bodies[0]["generationConfig"]
    assert gen_bodies[1]["generationConfig"]["thinkingConfig"] == {"thinkingLevel": "MINIMAL"}
    assert (
        Settings(_env_file=None, gemini_thinking_level="minimal").gemini_thinking_level == "MINIMAL"
    )
    assert Settings(_env_file=None, gemini_thinking_level="").gemini_thinking_level is None
