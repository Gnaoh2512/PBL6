"""Offline unit tests for the explicit Academic Demo contract and local preflight."""

import copy
import json
import shutil
from datetime import date

import pytest
from indexing_support import FakeEmbedding, MemoryQdrant
from pydantic import ValidationError
from verification_support import Fixture, fixture

from app.academic_demo_contract import read_contract
from app.academic_demo_preflight import main as preflight_main
from app.academic_demo_preflight import preflight
from app.ingestion.snapshot import DEMO_SOURCE_PACKS, ROOT
from app.ingestion.vector_pipeline import PairedIndex
from app.orchestration.verification.artifacts import source_view
from app.orchestration.verification.catalog import digest

POLICY_TODAY = date(2026, 11, 24)
CONTRACT_PATH = ROOT / "academic-demo.contract.json"


def _contract_dict():
    return json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))


def _setup_demo_workspace(tmp_path):
    for rel in DEMO_SOURCE_PACKS["academic_policies"]:
        dst = tmp_path / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / rel, dst)

    index = PairedIndex(
        "demo_synthetic",
        FakeEmbedding(),
        MemoryQdrant(),
        root=tmp_path,
        source_pack="academic_policies",
    )
    manifest = index.rebuild(POLICY_TODAY)
    _, mode, snapshot, sources, evidence = source_view(index, POLICY_TODAY)
    first = evidence[0]
    source = next(s for s in sources if s["documentId"] == first.documentId)

    template = fixture()
    data = copy.deepcopy(template.data)
    fact = copy.deepcopy(data["facts"][1])
    binding = fact["provenance"]["bindings"][0]
    binding.update(
        {
            k: source[k]
            for k in ("documentId", "sourceVersion", "sourceRef", "sourceSha256", "snapshotId")
        }
    )
    binding.update(
        citationId=first.citationId,
        chunkId=first.chunkId,
        sectionId=first.sectionId,
        excerptSha256=digest(first.excerpt.encode()),
        spans=[[0, min(40, len(first.excerpt))]],
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
    data["questionRules"] = [data["questionRules"][1]]
    published = Fixture(data, [e.model_dump() for e in evidence], []).publish()

    grounding_dir = tmp_path / ".local/grounding/demo_synthetic/test-release-v1"
    grounding_dir.mkdir(parents=True, exist_ok=True)
    catalog_rel = ".local/grounding/demo_synthetic/test-release-v1/catalog.json"
    sources_rel = ".local/grounding/demo_synthetic/test-release-v1/sources.json"
    (tmp_path / catalog_rel).write_bytes(published.raw)
    receipts_raw = json.dumps(
        {
            "schemaVersion": "grounding-sources-1",
            "mode": mode,
            "snapshotId": snapshot,
            "sources": published.source_state,
        },
        ensure_ascii=False,
    ).encode()
    (tmp_path / sources_rel).write_bytes(receipts_raw)

    raw_contract = _contract_dict()
    raw_contract["environment"]["AI_GROUNDING"].update(
        {
            "catalog_path": catalog_rel,
            "catalog_sha256": digest(published.raw),
            "sources_path": sources_rel,
            "sources_sha256": digest(receipts_raw),
            "authorities": ["test-reviewer"],
        }
    )
    contract_file = tmp_path / "academic-demo.contract.json"
    contract_file.write_text(json.dumps(raw_contract, ensure_ascii=False), encoding="utf-8")
    return tmp_path, contract_file, manifest


def test_repo_academic_demo_contract_matches_strict_schema():
    contract = read_contract(CONTRACT_PATH)
    assert contract.schema_version == "academic-demo-configuration-1"
    assert contract.environment.AI_CORPUS_MODE == "demo_synthetic"
    assert contract.environment.AI_DEMO_SOURCE_PACK == "academic_policies"
    assert contract.environment.AI_RETRIEVAL_MODE == "hybrid"
    assert contract.environment.GEMINI_MODEL == "gemini-3.6-flash"
    assert contract.environment.GEMINI_THINKING_LEVEL == "MINIMAL"
    assert contract.environment.AI_DEPENDENCY_LATCH_COOLDOWN_S == 5.0
    assert contract.secret_environment == ("GEMINI_API_KEY", "AI_SERVICE_AUTH_TOKEN")


def test_read_contract_rejects_incomplete_nested_profile_duplicate_keys_and_oversize(tmp_path):
    incomplete = _contract_dict()
    del incomplete["environment"]["AI_HYBRID"]["rrf_constant"]
    p_inc = tmp_path / "incomplete.json"
    p_inc.write_text(json.dumps(incomplete), encoding="utf-8")
    with pytest.raises(ValidationError):
        read_contract(p_inc)

    dup = tmp_path / "duplicate.json"
    dup.write_text('{"schema_version":"a","schema_version":"b"}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate"):
        read_contract(dup)

    huge = tmp_path / "huge.json"
    huge.write_bytes(b" " * (64 * 1024 + 1))
    with pytest.raises(ValueError, match="Oversized"):
        read_contract(huge)


def test_read_contract_rejects_production_mode_and_wrong_entrypoint_or_secrets(tmp_path):
    for mutate in (
        lambda d: d["environment"].__setitem__("AI_CORPUS_MODE", "production"),
        lambda d: d.__setitem__("entrypoint", ["python", "-m", "uvicorn", "app.main:app"]),
        lambda d: d.__setitem__("secret_environment", ["AI_SERVICE_AUTH_TOKEN", "GEMINI_API_KEY"]),
    ):
        data = _contract_dict()
        mutate(data)
        path = tmp_path / "bad.json"
        path.write_text(json.dumps(data), encoding="utf-8")
        with pytest.raises(ValidationError):
            read_contract(path)


def test_preflight_passes_valid_local_demo_workspace_without_external_calls(tmp_path):
    root, contract_file, manifest = _setup_demo_workspace(tmp_path)
    report = preflight(read_contract(contract_file), root=root, today=POLICY_TODAY)
    assert report["status"] == "LOCAL_ARTIFACTS_VALID"
    assert report["environment_applied"] is False
    assert report["runtime_readiness"] == "NOT_CHECKED"
    assert report["external_gates"] == {
        "qdrant_inventory": "NOT_CHECKED",
        "gemini": "NOT_CALLED",
        "credentials": "NOT_CHECKED",
        "semantic_correctness": "NOT_VERIFIED",
        "independent_approval": "NOT_VERIFIED",
        "runtime": "NOT_STARTED",
    }
    by_name = {c["name"]: c for c in report["checks"]}
    assert set(by_name) == {
        "contract",
        "sources",
        "snapshot",
        "authority",
        "catalog",
        "source_receipts",
        "binding",
    }
    assert all(c["status"] == "PASS" for c in report["checks"])
    assert by_name["sources"]["source_count"] == 10
    assert by_name["sources"]["chunk_count"] == 38
    assert by_name["snapshot"]["snapshot_id"] == manifest["snapshot_id"]
    assert by_name["binding"]["chunk_count"] == 38


def test_preflight_reports_missing_snapshot_and_wal_sidecar_as_not_ready(tmp_path):
    root, contract_file, manifest = _setup_demo_workspace(tmp_path)
    contract = read_contract(contract_file)

    wal = (
        root
        / ".local/paired-index/demo_synthetic/academic_policies"
        / manifest["run_id"]
        / "index.sqlite-wal"
    )
    wal.write_bytes(b"pending-wal")
    wal_report = preflight(contract, root=root, today=POLICY_TODAY)
    by_name = {c["name"]: c for c in wal_report["checks"]}
    assert wal_report["status"] == "NOT_READY"
    assert by_name["snapshot"]["status"] == "INVALID"
    assert by_name["snapshot"]["code"] == "INDEX_OUT_OF_SYNC"
    assert by_name["binding"]["status"] == "BLOCKED"
    wal.unlink()

    (root / ".local/paired-index/demo_synthetic/academic_policies/active.json").unlink()
    missing_report = preflight(contract, root=root, today=POLICY_TODAY)
    by_name = {c["name"]: c for c in missing_report["checks"]}
    assert missing_report["status"] == "NOT_READY"
    assert by_name["snapshot"]["status"] == "MISSING"
    assert by_name["snapshot"]["code"] == "INDEX_NOT_AVAILABLE"
    assert by_name["binding"]["status"] == "BLOCKED"


def test_preflight_rejects_catalog_hash_mismatch_path_escape_and_empty_authorities(tmp_path):
    root, contract_file, _ = _setup_demo_workspace(tmp_path)

    bad_hash = json.loads(contract_file.read_text(encoding="utf-8"))
    bad_hash["environment"]["AI_GROUNDING"]["catalog_sha256"] = "0" * 64
    p_hash = tmp_path / "bad-hash.json"
    p_hash.write_text(json.dumps(bad_hash), encoding="utf-8")
    r_hash = preflight(read_contract(p_hash), root=root, today=POLICY_TODAY)
    by_name = {c["name"]: c for c in r_hash["checks"]}
    assert r_hash["status"] == "NOT_READY"
    assert by_name["catalog"]["code"] == "PUBLICATION_PATH_OR_HASH_INVALID"
    assert by_name["binding"]["status"] == "BLOCKED"

    escape = json.loads(contract_file.read_text(encoding="utf-8"))
    escape["environment"]["AI_GROUNDING"]["catalog_path"] = "../outside.json"
    p_esc = tmp_path / "escape.json"
    p_esc.write_text(json.dumps(escape), encoding="utf-8")
    r_esc = preflight(read_contract(p_esc), root=root, today=POLICY_TODAY)
    by_name = {c["name"]: c for c in r_esc["checks"]}
    assert r_esc["status"] == "NOT_READY"
    assert by_name["catalog"]["code"] == "PUBLICATION_PATH_OR_HASH_INVALID"

    no_auth = json.loads(contract_file.read_text(encoding="utf-8"))
    no_auth["environment"]["AI_GROUNDING"]["authorities"] = []
    p_auth = tmp_path / "no-auth.json"
    p_auth.write_text(json.dumps(no_auth), encoding="utf-8")
    r_auth = preflight(read_contract(p_auth), root=root, today=POLICY_TODAY)
    by_name = {c["name"]: c for c in r_auth["checks"]}
    assert r_auth["status"] == "NOT_READY"
    assert by_name["authority"]["status"] == "MISSING"
    assert by_name["catalog"]["status"] == "INVALID"
    assert by_name["source_receipts"]["status"] == "INVALID"


def test_preflight_cli_exit_codes(tmp_path, capsys):
    bad = tmp_path / "broken.json"
    bad.write_text("{not-json", encoding="utf-8")
    assert preflight_main(["--contract", str(bad)]) == 2
    assert json.loads(capsys.readouterr().out)["status"] == "CONTRACT_INVALID"

    _, contract_file, _ = _setup_demo_workspace(tmp_path)
    assert preflight_main(["--contract", str(contract_file)]) == 1
    assert json.loads(capsys.readouterr().out)["status"] == "NOT_READY"
