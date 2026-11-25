"""Negative integrity checks use temporary files, never the published dataset."""

import copy
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

import pytest
from provenance import allowlist_checks, read_json, revision_checks, scope_checks

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
LEGACY = HERE.parents[1]


@pytest.fixture
def manifest():
    return read_json(HERE / "manifest.json")


@pytest.fixture
def routing_root(tmp_path):
    path = tmp_path / "ai-service/app/ingestion/snapshot.py"
    path.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "ai-service/app/ingestion/snapshot.py", path)
    return tmp_path


def test_actual_production_and_demo_routes_are_distinct(manifest):
    assert all(ok for _, ok in allowlist_checks(ROOT, manifest))


@pytest.mark.parametrize(
    "old,new,failed_check",
    [
        (
            'if source_pack != "d1_fixture":',
            'if source_pack not in ("d1_fixture", "academic_policies"):',
            "source routing rejects production/academic_policies",
        ),
        (
            '"knowledge/policies/publication-draft/pol-10-privacy.md",',
            '"knowledge/policies/publication-draft/missing-policy.md",',
            "Academic Demo includes exactly ten approved publication files",
        ),
        (
            '"tests/fixtures/d1/faq.md"',
            '"knowledge/policies/publication-draft/pol-01-booking.md"',
            "default demo fixture remains isolated",
        ),
    ],
)
def test_routing_drift_is_detected(routing_root, manifest, old, new, failed_check):
    path = routing_root / "ai-service/app/ingestion/snapshot.py"
    source = path.read_text(encoding="utf-8")
    assert source.count(old) == 1
    path.write_text(source.replace(old, new), encoding="utf-8")
    assert dict(allowlist_checks(routing_root, manifest))[failed_check] is False


@pytest.mark.parametrize("fault", ["quote", "hash", "lines", "missing_record"])
def test_o_scope_corruption_is_detected(manifest, fault):
    records = read_json(HERE / "gold.json")["cases"]
    historical = read_json(LEGACY / "manifest.json")
    baseline = copy.deepcopy(manifest)
    assert all(ok for _, ok in scope_checks(ROOT, baseline, records, historical))
    bindings = baseline["provenanceRevision"]["currentScopeBindings"]
    if fault == "missing_record":
        del bindings["D-O01"]
    elif fault == "quote":
        bindings["D-O01"][1]["quote"] = "Different scope despite an in-bounds line range"
    elif fault == "hash":
        bindings["D-O01"][1]["sha256"] = "0" * 64
    else:
        bindings["D-O01"][1]["lines"] = [1, 2]
    assert not all(ok for _, ok in scope_checks(ROOT, baseline, records, historical))


@pytest.fixture
def isolated_revision(tmp_path):
    old = tmp_path / LEGACY.relative_to(ROOT)
    shutil.copytree(LEGACY, old, ignore=shutil.ignore_patterns("revisions"))
    current = tmp_path / HERE.relative_to(ROOT)
    current.mkdir(parents=True)
    for name in ("gold.json", "review-controls.json"):
        shutil.copyfile(HERE / name, current / name)
    for name in (
        "ai-service/docs/PROCESS.md",
        "ai-service/docs/EVALUATION.md",
        "ai-service/app/ingestion/snapshot.py",
    ):
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    return tmp_path, old, current


def test_full_record_and_history_guards_are_live(isolated_revision, manifest):
    root, old, current = isolated_revision
    assert all(ok for _, ok in revision_checks(root, current, manifest))
    gold_path = current / "gold.json"
    original = gold_path.read_bytes()
    gold_path.write_bytes(original.replace(b'"label": "A"', b'"label": "U"', 1))
    failed = dict(revision_checks(root, current, manifest))
    assert failed["all 100 complete records unchanged from 0.1.2"] is False
    assert failed["record hashes identical to historical packet"] is False
    gold_path.write_bytes(original)
    historic_report = old / "validation.json"
    historic_report.write_bytes(historic_report.read_bytes() + b"\n")
    failed = dict(revision_checks(root, current, manifest))
    assert failed["previous revision bytes preserved: validation.json"] is False


def test_gold_report_reproduces_across_hash_seeds():
    reports = []
    for seed in ("1", "2"):
        result = subprocess.run(
            [sys.executable, "-X", "utf8", "-B", str(HERE / "validate.py")],
            cwd=ROOT,
            env=os.environ | {"PYTHONHASHSEED": seed, "GIT_OPTIONAL_LOCKS": "0"},
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        assert result.returncode == 0, result.stderr or result.stdout
        reports.append(json.loads(result.stdout))
    assert reports[0] == reports[1] == read_json(HERE / "validation-0.1.3.json")
