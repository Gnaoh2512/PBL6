"""Verify the release graph and reproduce current Gold/Packet reports without writing."""

import json
import os
import subprocess
import sys
from pathlib import Path

from provenance import digest, history_report, read_json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[5]


def verify():
    release = read_json(HERE / "release.json")
    failures = []
    for name, expected in release["files"].items():
        if digest((HERE / name).read_bytes()) != expected:
            failures.append("release file: " + name)
    manifest = read_json(HERE / "manifest.json")
    for name, expected in manifest["artifactSha256"].items():
        if digest((HERE / name).read_bytes()) != expected:
            failures.append("Gold artifact: " + name)
    for script, report in (
        ("validate.py", "validation-0.1.3.json"),
        ("human-review/validate.py", "packet-validation-0.1.3.json"),
    ):
        run = subprocess.run(
            [sys.executable, "-X", "utf8", "-B", str(HERE / script)],
            cwd=ROOT,
            env=os.environ | {"GIT_OPTIONAL_LOCKS": "0"},
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        if run.returncode != 0:
            failures.append("validator failed: " + script)
        elif json.loads(run.stdout) != read_json(HERE / report):
            failures.append("current report not reproducible: " + report)
    history = history_report(ROOT, HERE, manifest)
    if history != read_json(HERE / "history-validation-0.1.3.json"):
        failures.append("history integrity report not reproducible")
    packet = read_json(HERE / "human-review/packet-manifest.json")
    reviewed = read_json(HERE / "packet-validation-0.1.3.json")
    return {
        "result": "RELEASE_INTEGRITY_PASS" if not failures else "RELEASE_INTEGRITY_FAIL",
        "revision": release["revision"],
        "failures": failures,
        "recordHashesUnchanged": len(packet["recordHashes"]),
        "reviewState": reviewed["reviewLog"]["workflowCounts"],
        "historicalIntegrity": history["result"],
        "historicalBaselineReplay": history["originalBaselineReplay"],
        "missingHistoricalInputs": history["missingOriginalReferenceBytes"],
        "approved": False,
        "blind": False,
        "frozen": False,
    }


if __name__ == "__main__":
    try:
        report = verify()
    except (OSError, ValueError, KeyError, TypeError) as error:
        report = {"result": "RELEASE_INTEGRITY_FAIL", "reason": str(error)}
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["result"] == "RELEASE_INTEGRITY_PASS" else 1)
