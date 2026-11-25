"""Read-only provenance checks; no application imports, ingestion or provider calls."""

import ast
import hashlib
import json
from pathlib import Path


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode(
        "utf-8"
    )


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def allowlist_checks(root, manifest):
    """Evaluate only literal tables and the pure routing function, never the module."""
    tree = ast.parse((root / "ai-service/app/ingestion/snapshot.py").read_text(encoding="utf-8"))
    tables = {
        target.id: ast.literal_eval(node.value)
        for node in tree.body
        if isinstance(node, ast.Assign)
        for target in node.targets
        if isinstance(target, ast.Name) and target.id in {"SOURCES", "DEMO_SOURCE_PACKS"}
    }
    function = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "sources_for"
    )
    namespace = {
        **tables,
        "__builtins__": {"ValueError": ValueError, "str": str, "tuple": tuple},
    }
    exec(
        compile(ast.Module(body=[function], type_ignores=[]), "<source-pack-router>", "exec"),
        namespace,
    )
    route = namespace["sources_for"]
    policies = {
        Path(unit["path"]).relative_to("ai-service").as_posix()
        for unit in manifest["units"].values()
    }
    expected = manifest["provenanceRevision"]["allowlistContract"]
    checks = [
        ("production allowlist unchanged", list(route("production")) == expected["production"]),
        ("production excludes synthetic policies", not policies & set(route("production"))),
        (
            "default demo fixture remains isolated",
            list(route("demo_synthetic")) == expected["d1_fixture"],
        ),
        (
            "Academic Demo includes exactly ten approved publication files",
            set(route("demo_synthetic", "academic_policies")) == policies and len(policies) == 10,
        ),
        (
            "explicit demo source pack inventory",
            set(tables["DEMO_SOURCE_PACKS"]) == {"academic_policies"},
        ),
    ]
    for mode, pack in (
        ("production", "academic_policies"),
        ("production", "unknown_pack"),
        ("demo_synthetic", "unknown_pack"),
        ("unknown_mode", "d1_fixture"),
    ):
        rejected = False
        try:
            route(mode, pack)
        except ValueError:
            rejected = True
        checks.append((f"source routing rejects {mode}/{pack}", rejected))
    return checks


def scope_checks(root, manifest, records, historical_manifest):
    bindings = manifest["provenanceRevision"]["currentScopeBindings"]
    out_of_scope = {record["id"]: record for record in records if record.get("label") == "O"}
    checks = [
        (
            "current scope binding inventory covers exactly eight O records",
            set(bindings) == set(out_of_scope),
        )
    ]
    for cid, record in out_of_scope.items():
        historic = record["scopeBasis"]
        checks.append(
            (
                "historical record scope pins retained: " + cid,
                all(
                    basis["sha256"]
                    == historical_manifest["referenceDocuments"][basis["path"]]["sha256"]
                    for basis in historic
                ),
            )
        )
        current = bindings.get(cid, [])
        valid = len(current) == len(historic) == 2
        for old, basis in zip(historic, current):
            raw = (root / basis["path"]).read_bytes()
            lines = raw.decode("utf-8").splitlines()
            start, end = basis["lines"]
            excerpt = "\n".join(lines[start - 1 : end])
            valid = valid and (
                basis["path"] == old["path"]
                and basis["lines"] == old["lines"]
                and digest(raw)
                == basis["sha256"]
                == manifest["referenceDocuments"][basis["path"]]["sha256"]
                and 1 <= start <= end <= len(lines)
                and excerpt == basis["quote"]
                and digest(excerpt.encode("utf-8")) == basis["quoteSha256"]
            )
        checks.append(("current scope hash, exact lines and quote: " + cid, valid))
    return checks


def revision_checks(root, here, manifest):
    revision = manifest["provenanceRevision"]
    previous = root / revision["previousRevision"]["path"]
    checks = []
    for name, expected in revision["previousRevision"]["files"].items():
        checks.append(
            (
                "previous revision bytes preserved: " + name,
                digest((previous / name).read_bytes()) == expected,
            )
        )
    old_manifest = read_json(previous / "manifest.json")
    old_gold = read_json(previous / "gold.json")
    old_controls = read_json(previous / "review-controls.json")
    gold = read_json(here / "gold.json")
    controls = read_json(here / "review-controls.json")
    records = gold["cases"] + controls["controls"]
    historic_records = old_gold["cases"] + old_controls["controls"]
    checks.extend(
        [
            (
                "all 100 complete records unchanged from 0.1.2",
                records == historic_records and len(records) == 100,
            ),
            (
                "record hashes identical to historical packet",
                {record["id"]: digest(canonical(record)) for record in records}
                == read_json(previous / "human-review/packet-manifest.json")["recordHashes"],
            ),
            (
                "control artifact byte identical",
                (here / "review-controls.json").read_bytes()
                == (previous / "review-controls.json").read_bytes(),
            ),
            (
                "review revision identity",
                gold["reviewRevision"] == manifest["reviewRevision"] == "0.1.3-provenance",
            ),
            (
                "provenance publication grants no review or evaluation approval",
                gold["approved"] is False
                and gold["blind"] is False
                and gold["frozen"] is False
                and gold["usage"] == "known_regression"
                and manifest["approved"] is False
                and manifest["eligibleForIndependentEvaluation"] is False,
            ),
            (
                "runtime binding remains unexecuted for this revision",
                manifest["runtimeBinding"] == revision["runtimeBindingContract"]
                and manifest["runtimeBinding"]["snapshotId"] is None
                and manifest["runtimeBinding"]["catalogPublicationId"] is None
                and manifest["runtimeBinding"]["chunkIds"] is None,
            ),
        ]
    )
    checks.extend(scope_checks(root, manifest, records, old_manifest))
    checks.extend(allowlist_checks(root, manifest))
    return checks


def history_report(root, here, manifest):
    previous = manifest["provenanceRevision"]["previousRevision"]
    legacy = root / previous["path"]
    failures = [
        name
        for name, expected in previous["files"].items()
        if digest((legacy / name).read_bytes()) != expected
    ]
    versions = []
    for path in [legacy, *sorted((legacy / "history").iterdir())]:
        saved = read_json(path / "validation.json")
        versions.append(
            {
                "path": path.relative_to(root).as_posix(),
                "savedReportSha256": digest((path / "validation.json").read_bytes()),
                "savedResult": saved["result"],
                "originalValidatorRerun": "NOT_RUN_MISSING_HISTORICAL_INPUTS",
            }
        )
    search = read_json(here / "historical-source-search.json")
    recovered = search["recovered"]
    for name, entry in recovered.items():
        if digest((here / entry["path"]).read_bytes()) != entry["sha256"]:
            failures.append("recovered historical source: " + name)
    return {
        "result": "HISTORY_INTEGRITY_PASS" if not failures else "HISTORY_INTEGRITY_FAIL",
        "historicalFiles": len(previous["files"]),
        "failures": failures,
        "versions": versions,
        "exactHistoricalSourcesRecovered": recovered,
        "missingOriginalReferenceBytes": search["missing"],
        "originalBaselineReplay": "UNAVAILABLE_MISSING_HISTORICAL_INPUTS",
        "note": "Saved results and checksum integrity are not a rerun of historical STATIC_PASS.",
    }
