"""Exercise rejected changes only in isolated copies; never fabricate real review events."""

import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
SPEC = importlib.util.spec_from_file_location("single_reviewer_validation", HERE / "validate.py")
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


@pytest.fixture
def isolated(tmp_path):
    manifest = validator.read_json(HERE / "session-manifest.json")
    for name in [*manifest["protectedFiles"], validator.PROCESS]:
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / name, target)
    session = tmp_path / HERE.relative_to(ROOT)
    shutil.copytree(HERE, session, ignore=shutil.ignore_patterns("__pycache__"))
    return tmp_path, session


def test_published_session_and_saved_report_agree():
    report = validator.validate()
    assert report == validator.read_json(HERE / "validation.json")
    assert (report["events"], report["records"], report["reviewerCount"]) == (1, 100, 1)
    assert report["reviewedAt"] is None
    assert report["gates"]["independentReview"] == "NOT_PERFORMED"


@pytest.mark.parametrize(
    "fault,reason",
    [
        ("reviewer_count", "Exactly one reviewer"),
        ("independent", "Independent review was not performed"),
        ("approve", "Session cannot approve"),
        ("gate", "Unmet gates cannot be promoted"),
        ("review_time", "Review completion time was not supplied"),
        ("extra_reviewer", "Bulk event fields differ"),
        ("missing_record", "Attestation scope differs"),
        ("missing_pin", "Protected artifact inventory differs"),
        ("event_count", "Exactly one complete bulk event"),
        ("original_artifact", "Protected artifact changed"),
        ("process_rewrite", "PROCESS must preserve"),
    ],
)
def test_invalid_claims_and_artifact_drift_are_rejected(isolated, fault, reason):
    root, here = isolated
    manifest = validator.read_json(here / "session-manifest.json")
    event = validator.read_json(here / "review-events.jsonl")
    if fault == "reviewer_count":
        manifest["reviewerCount"] = 2
    elif fault == "independent":
        manifest["independentReview"] = "PERFORMED"
    elif fault == "approve":
        manifest["goldFlags"]["approved"] = True
    elif fault == "gate":
        manifest["gates"]["pairedReview"] = "MET"
    elif fault == "review_time":
        # Deliberately misuse the real recording time as review time in this temp copy.
        event["reviewedAt"] = event["recordedAt"]
    elif fault == "extra_reviewer":
        event["R2"] = None
    elif fault == "missing_record":
        manifest["scope"]["recordHashes"].pop("D-A01")
        event["scopeSha256"] = validator.digest(validator.canonical(manifest["scope"]))
    elif fault == "missing_pin":
        manifest["protectedFiles"].pop(next(iter(manifest["protectedFiles"])))
    elif fault == "original_artifact":
        path = root / validator.DATA / "gold.json"
        path.write_bytes(path.read_bytes() + b"\n")
    elif fault == "process_rewrite":
        path = root / validator.PROCESS
        raw = b"Changed historical prefix\n" + path.read_bytes()
        path.write_bytes(raw)
        manifest["processProvenance"]["afterSha256"] = validator.digest(raw)

    # Re-seal temp events so these cases exercise logical checks, not only checksums.
    event["eventHash"] = validator.digest(
        validator.canonical({k: v for k, v in event.items() if k != "eventHash"})
    )
    raw = validator.canonical(event) + b"\n"
    if fault == "event_count":
        raw += raw
    (here / "review-events.jsonl").write_bytes(raw)
    sha = validator.digest(raw)
    manifest["eventLogSha256"] = sha
    manifest["sessionFiles"]["review-events.jsonl"] = sha
    write_json(here / "session-manifest.json", manifest)
    with pytest.raises(ValueError, match=reason):
        validator.validate(root, here)


def test_cli_rejects_a_changed_saved_report_without_writing(isolated, tmp_path):
    _, here = isolated
    path = here / "validation.json"
    report = validator.read_json(path)
    report["events"] = 100
    write_json(path, report)
    before = path.read_bytes()
    result = subprocess.run(
        [sys.executable, "-X", "utf8", "-B", str(here / "validate.py"), "--check-report"],
        cwd=tmp_path,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )
    assert result.returncode == 1
    assert "Saved session report differs" in json.loads(result.stdout)["failures"]
    assert path.read_bytes() == before


def test_duplicate_keys_are_rejected(tmp_path):
    path = tmp_path / "duplicate.json"
    path.write_text('{"approved":false,"approved":true}', encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate JSON key"):
        validator.read_json(path)
