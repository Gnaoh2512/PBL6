"""Read-only validation of a single user's bulk attestation, never Gold approval."""

import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]
DATA = "ai-service/tests/evaluation/policy-gold-2026-11-22-v1"
REVISION = DATA + "/revisions/0.1.3-provenance"
PROCESS = "ai-service/docs/PROCESS.md"
GATES = {
    "independentReview": "NOT_PERFORMED",
    "pairedReview": "NOT_MET",
    "adjudication": "NOT_PERFORMED",
    "perRecordRubric": "NOT_PROVIDED",
    "findingsFocusReview": "NOT_DOCUMENTED",
    "goldReleaseApproval": "NOT_GRANTED",
    "blindEvaluation": "NOT_MET",
    "runtimeBinding": "NOT_COMPLETED",
    "liveReliability": "NOT_VERIFIED",
}
LIMITS = {"approved": False, "scorable": False, "blind": False, "frozen": False}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, "Duplicate JSON key: " + key)
            result[key] = value
        return result

    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique)


def local_file(root, name):
    require(isinstance(name, str) and "\\" not in name, "Invalid relative file path")
    path = root / name
    require(
        not Path(name).is_absolute()
        and ".." not in Path(name).parts
        and path.resolve().is_relative_to(root.resolve())
        and path.is_file(),
        "Missing or unsafe file: " + name,
    )
    return path


def validate(root=ROOT, here=HERE):
    manifest = read_json(here / "session-manifest.json")
    require(
        set(manifest)
        == {
            "schemaVersion",
            "sessionId",
            "reviewMode",
            "reviewerId",
            "reviewerCount",
            "decision",
            "independentReview",
            "scope",
            "eventLogSha256",
            "protectedFiles",
            "sessionFiles",
            "processProvenance",
            "gates",
            "goldFlags",
        },
        "Session manifest fields differ",
    )
    require(manifest["schemaVersion"] == "single-reviewer-session-v1", "Unknown session schema")
    require(manifest["sessionId"] == "single-reviewer-v1", "Unknown session")
    require(manifest["reviewMode"] == "single_reviewer", "Only single reviewer mode is allowed")
    require(manifest["reviewerId"] == "hieu", "Reviewer differs from user confirmation")
    require(
        type(manifest["reviewerCount"]) is int and manifest["reviewerCount"] == 1,
        "Exactly one reviewer is required",
    )
    require(manifest["decision"] == "SINGLE_REVIEWER_ACCEPTED", "Unexpected user decision")
    require(
        manifest["independentReview"] == "NOT_PERFORMED", "Independent review was not performed"
    )
    require(manifest["gates"] == GATES, "Unmet gates cannot be promoted")
    require(manifest["goldFlags"] == LIMITS, "Session cannot approve, score, blind or freeze Gold")

    packet = read_json(local_file(root, REVISION + "/human-review/packet-manifest.json"))
    required = set(packet["baselineFiles"]) - {PROCESS}
    required.update(
        str(p.relative_to(root)).replace("\\", "/")
        for folder in (root / DATA, root / "ai-service/knowledge")
        for p in folder.rglob("*")
        if p.is_file()
        and "__pycache__" not in p.parts
        and not p.is_relative_to(root / DATA / "review-sessions")
    )
    require(set(manifest["protectedFiles"]) == required, "Protected artifact inventory differs")
    for name, sha in manifest["protectedFiles"].items():
        require(
            digest(local_file(root, name).read_bytes()) == sha,
            "Protected artifact changed: " + name,
        )
    expected_session = {
        "README.md",
        "validate.py",
        "test_integrity.py",
        "review-events.jsonl",
        "provenance/PROCESS.before.md",
        "provenance/release-before.json",
        "provenance/release-after-process.json",
    }
    require(set(manifest["sessionFiles"]) == expected_session, "Session file inventory differs")
    for name, sha in manifest["sessionFiles"].items():
        require(digest(local_file(here, name).read_bytes()) == sha, "Session file changed: " + name)

    gold = read_json(local_file(root, REVISION + "/gold.json"))
    controls = read_json(local_file(root, REVISION + "/review-controls.json"))
    records = gold["cases"] + controls["controls"]
    hashes = {record["id"]: digest(canonical(record)) for record in records}
    require(
        len(gold["cases"]) == 80 and len(controls["controls"]) == 20 and len(hashes) == 100,
        "Scope must contain 80 Gold cases and 20 controls",
    )
    require(hashes == packet["recordHashes"], "Record hashes differ from the published packet")
    scope = {
        "datasetId": "policy-gold-2026-11-22-v1",
        "datasetRevision": "0.1.3-provenance",
        "goldCases": 80,
        "controls": 20,
        "recordHashes": hashes,
    }
    require(manifest["scope"] == scope, "Attestation scope differs")
    require(
        gold["usage"] == "known_regression"
        and gold["blind"] is False
        and gold["frozen"] is False
        and gold["approved"] is False,
        "Gold release state changed",
    )
    require(
        all(
            record["reviewStatus"] == "pending_review"
            and record["approved"] is False
            and record["scorable"] is False
            and record["reviewDecisions"] == []
            for record in records
        ),
        "Original review state changed",
    )

    raw = (here / "review-events.jsonl").read_bytes()
    require(digest(raw) == manifest["eventLogSha256"], "Event log checksum differs")
    require(
        raw.endswith(b"\n") and len(raw.splitlines()) == 1,
        "Exactly one complete bulk event is required",
    )
    event = read_json(here / "review-events.jsonl")
    require(
        set(event)
        == {
            "schemaVersion",
            "eventId",
            "sessionId",
            "reviewer",
            "reviewMode",
            "decision",
            "scopeSha256",
            "recordCount",
            "independentReview",
            "reviewedAt",
            "recordedAt",
            "recordedBy",
            "source",
            "previousEventHash",
            "eventHash",
        },
        "Bulk event fields differ; no R2, resolver, axes or approval fields are supported",
    )
    require(
        event["schemaVersion"] == "single-reviewer-attestation-v1", "Unknown attestation schema"
    )
    require(
        event["eventId"] == "single-reviewer-v1-acceptance-1"
        and event["sessionId"] == manifest["sessionId"],
        "Event identity differs",
    )
    require(
        event["reviewer"]
        == {"id": "hieu", "identityBasis": "user_self_identified_in_conversation"},
        "No invented identity or appointment is allowed",
    )
    for key in ("reviewMode", "decision", "independentReview"):
        require(event[key] == manifest[key], "Event differs from session: " + key)
    require(
        event["recordCount"] == 100 and event["scopeSha256"] == digest(canonical(scope)),
        "Event does not bind all 100 records",
    )
    require(event["reviewedAt"] is None, "Review completion time was not supplied")
    require(event["recordedBy"] == "codex", "Recording actor differs")
    stamp = datetime.fromisoformat(event["recordedAt"])
    require(stamp.utcoffset() is not None, "Recording time must include timezone")
    require(
        event["source"]
        == {
            "kind": "user_confirmation_in_current_conversation",
            "reviewStatement": "Tôi đã đọc và đồng ý nội dung cả 100 trường hợp.",
            "reviewerIdConfirmed": "hieu",
            "scope": "Toàn bộ 100 trường hợp (80 Gold cases + 20 controls).",
            "perRecordRubricProvided": False,
        },
        "User statement or its limits differ",
    )
    require(event["previousEventHash"] is None, "This is the first and only event")
    require(
        event["eventHash"]
        == digest(canonical({k: v for k, v in event.items() if k != "eventHash"})),
        "Event hash differs",
    )

    provenance = manifest["processProvenance"]
    require(
        set(provenance) == {"path", "beforeSnapshot", "beforeSha256", "afterSha256", "change"},
        "Process provenance fields differ",
    )
    require(
        provenance["path"] == PROCESS
        and provenance["beforeSnapshot"] == "provenance/PROCESS.before.md"
        and provenance["change"] == "APPEND_ONLY",
        "Unexpected process transition",
    )
    before = local_file(here, provenance["beforeSnapshot"]).read_bytes()
    after = local_file(root, PROCESS).read_bytes()
    require(
        digest(before) == provenance["beforeSha256"] == packet["baselineFiles"][PROCESS],
        "Original PROCESS snapshot does not match the published baseline",
    )
    require(
        digest(after) == provenance["afterSha256"]
        and len(after) > len(before)
        and after.startswith(before),
        "PROCESS must preserve the original bytes as a prefix",
    )
    prior = read_json(here / "provenance/release-before.json")
    require(
        prior["result"] == "RELEASE_INTEGRITY_PASS" and prior["failures"] == [],
        "Pre-change release was not verified",
    )
    current = read_json(here / "provenance/release-after-process.json")
    require(
        current["result"] == "RELEASE_INTEGRITY_FAIL"
        and current["failures"]
        == [
            "validator failed: validate.py",
            "validator failed: human-review/validate.py",
        ],
        "Historical checker drift must stay exposed",
    )
    return {
        "result": "SESSION_INTEGRITY_PASS",
        "sessionId": manifest["sessionId"],
        "reviewerId": "hieu",
        "reviewerCount": 1,
        "decision": manifest["decision"],
        "events": 1,
        "goldCases": 80,
        "controls": 20,
        "records": 100,
        "reviewedAt": None,
        "recordedAt": event["recordedAt"],
        "protectedFilesChecked": len(required),
        "goldFlags": LIMITS,
        "gates": GATES,
        "processProvenance": provenance,
        "priorReleaseAtCapture": prior["result"],
        "priorReleaseOnCurrentCheckout": "EXPECTED_PROCESS_REFERENCE_DRIFT",
        "historicalBaselineReplay": prior["historicalBaselineReplay"],
        "semanticValidation": "NOT_PERFORMED_BY_THIS_VALIDATOR",
        "failures": [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check-report", action="store_true", help="Compare with the saved session report"
    )
    args = parser.parse_args()
    try:
        report = validate()
        if args.check_report:
            require(report == read_json(HERE / "validation.json"), "Saved session report differs")
    except (OSError, ValueError, KeyError, TypeError, AttributeError) as error:
        report = {"result": "SESSION_INTEGRITY_FAIL", "failures": [str(error)]}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "SESSION_INTEGRITY_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
