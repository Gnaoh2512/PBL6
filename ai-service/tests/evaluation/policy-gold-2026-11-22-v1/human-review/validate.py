"""Read-only Human Review Packet checks and preparation of human-authored events.

Standard library only. Does not append events, approve Gold or call application code.
"""
import argparse
import hashlib
import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE.parent
ROOT = DATA.parents[3]
AXES = {"query", "answer", "label", "evidenceSufficiency", "citationMinimality",
        "citationIdentity", "policyConsistency", "qualifiers", "arithmetic"}
VERDICTS = {"PASS", "NEEDS_REVISION", "REJECTED", "NOT_REVIEWED"}
ISSUES = {"CONTENT", "EVIDENCE", "CLASSIFICATION", "FAMILY_OVERLAP", "SOURCE_IDENTITY"}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def require(ok, message):
    if not ok:
        raise ValueError(message)


def nonempty(value):
    return isinstance(value, str) and bool(value.strip())


def references(record):
    if "label" in record:
        return set(sum(record["acceptableMinimalEvidenceSets"], []) + record["contextEvidenceRefs"])
    return set(record["offeredEvidenceRefs"] + record["correctEvidenceRefs"])


def read_events(path):
    text = path.read_text(encoding="utf-8")
    require(not text or text.endswith("\n"), "Ledger must end with newline after a complete event")
    require(all(line.strip() for line in text.splitlines()), "Ledger contains a blank event line")
    return [json.loads(line) for line in text.splitlines()]


def validate_events(events, records, packet, packet_sha, valid_refs):
    """Check identity/schema/history; content of human reasons is never auto-approved."""
    seen, latest = {}, {}
    previous = None
    for event in events:
        required = {"schemaVersion", "eventId", "recordId", "stage", "reviewer", "verdict",
                    "rationale", "timestamp", "axes", "axisRationales", "evidenceReviewed",
                    "issueTypes", "focusNotes", "supersedes", "resolves", "packetManifestSha256",
                    "recordSha256", "previousEventHash", "eventHash"}
        require(set(event) == required, "Event schema fields do not match")
        eid, cid, stage = event["eventId"], event["recordId"], event["stage"]
        require(nonempty(eid) and eid not in seen, "Missing/duplicate eventId")
        require(cid in records and stage in {"R1", "R2", "ADJUDICATION"}, "Unknown record/stage")
        require(event["schemaVersion"] == "human-review-event-v1", "Unknown event schema")
        require(event["packetManifestSha256"] == packet_sha, "Event packet hash differs")
        require(event["recordSha256"] == packet["recordHashes"][cid], "Event record hash differs")
        require(event["previousEventHash"] == previous, "Broken previous-event chain")
        require(event["eventHash"] == digest(canonical({k: v for k, v in event.items() if k != "eventHash"})), "Event hash differs")
        reviewer = event["reviewer"]
        require(isinstance(reviewer, dict) and set(reviewer) == {"id", "displayName", "appointmentRef"}
                and all(nonempty(v) for v in reviewer.values()), "Actual reviewer identity and appointment reference required")
        require(event["verdict"] in VERDICTS and nonempty(event["rationale"]), "Verdict/rationale required")
        stamp = datetime.fromisoformat(event["timestamp"])
        require(stamp.utcoffset() is not None, "Timestamp must have timezone")
        require(isinstance(event["axes"], dict) and set(event["axes"]) == AXES, "All nine review axes required")
        require(set(event["axes"].values()) <= {"PASS", "FAIL", "NOT_REVIEWED", "NOT_APPLICABLE"}, "Invalid axis state")
        require(isinstance(event["axisRationales"], dict)
                and set(event["axisRationales"]) <= AXES
                and all(nonempty(v) for v in event["axisRationales"].values()), "Invalid axis rationales")
        na_axes = {k for k, v in event["axes"].items() if v == "NOT_APPLICABLE"}
        require(na_axes <= {"answer", "citationMinimality", "arithmetic"}, "Essential axis cannot be not applicable")
        require(na_axes <= set(event["axisRationales"]), "Not-applicable axes need reasons")
        record = records[cid]
        if "answer" in na_axes or "citationMinimality" in na_axes:
            require(record.get("label") in {"U", "O"}, "Answer/citation axis applies to A cases and controls")
        require(isinstance(event["evidenceReviewed"], list)
                and all(isinstance(x, str) and x in valid_refs for x in event["evidenceReviewed"])
                and len(set(event["evidenceReviewed"])) == len(event["evidenceReviewed"]), "Unknown/duplicate reviewed anchor")
        require(isinstance(event["issueTypes"], list) and set(event["issueTypes"]) <= ISSUES, "Unknown issue type")
        focus = set(packet["focusByRecord"][cid])
        require(isinstance(event["focusNotes"], dict) and set(event["focusNotes"]) <= focus
                and all(nonempty(v) for v in event["focusNotes"].values()), "Invalid focus notes")
        if event["verdict"] == "PASS":
            require(not {"FAIL", "NOT_REVIEWED"} & set(event["axes"].values()), "PASS has incomplete/failed axes")
            require(not event["issueTypes"], "Unresolved issues cannot receive PASS")
            require(focus <= set(event["focusNotes"]), "PASS requires every assigned F/CTX focus rationale")
            require(references(record) <= set(event["evidenceReviewed"]), "PASS must review all proposed support/context anchors")
        if event["verdict"] in {"NEEDS_REVISION", "REJECTED"}:
            require(bool(event["issueTypes"]), "Revision/rejection needs an issue type")
        slot = (cid, stage)
        prior = latest.get(slot)
        require(event["supersedes"] == (prior["eventId"] if prior else None), "Supersedes must identify the current event in this slot")
        if prior:
            require(prior["reviewer"]["id"] == reviewer["id"], "Silent reviewer replacement is not allowed")
        if stage == "ADJUDICATION":
            pair = [latest.get((cid, s)) for s in ("R1", "R2")]
            require(all(x and x["verdict"] != "NOT_REVIEWED" for x in pair), "Adjudication needs two completed reviews")
            require(isinstance(event["resolves"], list)
                    and len(event["resolves"]) == 2
                    and set(event["resolves"]) == {x["eventId"] for x in pair}, "Adjudication must cite the current R1/R2 events")
            require(reviewer["id"] not in {x["reviewer"]["id"] for x in pair}, "Resolver must differ from both reviewers")
        else:
            require(event["resolves"] == [], "Only adjudication resolves paired events")
            other = latest.get((cid, "R2" if stage == "R1" else "R1"))
            require(not other or other["reviewer"]["id"] != reviewer["id"], "R1 and R2 must be distinct people")
        latest[slot] = event
        seen[eid] = event
        previous = event["eventHash"]
    summary = Counter()
    for cid in records:
        one, two = latest.get((cid, "R1")), latest.get((cid, "R2"))
        adj = latest.get((cid, "ADJUDICATION"))
        if not one or not two or "NOT_REVIEWED" in {one["verdict"], two["verdict"]}:
            status = "NOT_REVIEWED"
        elif adj and set(adj["resolves"]) == {one["eventId"], two["eventId"]}:
            status = "ADJUDICATED_" + adj["verdict"]
        elif one["verdict"] == two["verdict"]:
            status = "PAIR_AGREES_" + one["verdict"]
        else:
            status = "DISAGREEMENT_PENDING"
        summary[status] += 1
    return {"events": len(events), "headHash": previous, "workflowCounts": dict(summary)}


def validate_packet():
    packet = read_json(HERE / "packet-manifest.json")
    require(packet["status"] == "PREPARED_NOT_REVIEWED" and packet["approved"] is False,
            "Packet cannot grant approval")
    for relative, expected in packet["baselineFiles"].items():
        require(digest((ROOT / relative).read_bytes()) == expected, "Baseline changed: " + relative)
    for name, expected in packet["packetFiles"].items():
        require(digest((HERE / name).read_bytes()) == expected, "Packet file changed: " + name)
    gold, controls, source = (read_json(DATA / f) for f in ("gold.json", "review-controls.json", "manifest.json"))
    records = {r["id"]: r for r in gold["cases"] + controls["controls"]}
    require(len(records) == 100 and len(gold["cases"]) == 80 and len(controls["controls"]) == 20, "Expected 80 Gold + 20 controls")
    require(gold["usage"] == "known_regression" and gold["blind"] is False and gold["frozen"] is False, "Regression scope changed")
    require(all(r["reviewStatus"] == "pending_review" and r["approved"] is False
                and r["scorable"] is False and r["reviewDecisions"] == [] for r in records.values()), "Gold review state changed")
    require(packet["recordHashes"] == {cid: digest(canonical(r)) for cid, r in records.items()}, "Record inventory/hash differs")
    require(set(packet["focusByRecord"]) == set(records), "Focus map must cover all 100 IDs")
    expected_focus = {cid: [] for cid in records}
    findings = source["findingsResolution"]
    for key in ("F1", "F2"):
        for cid in findings[key]["members"]:
            expected_focus[cid].append(key)
    for key in ("F3", "F4"):
        expected_focus[findings[key]["record"]].append(key)
    for i, anchor in enumerate(findings["remainingSharedAnchors"], 1):
        for cid in anchor["dev"] + anchor["held_out"]:
            expected_focus[cid].append("CTX" + str(i))
    require(packet["focusByRecord"] == expected_focus, "F1-F4/shared-context placement differs")
    require(packet["sharedContextAnchors"] == findings["remainingSharedAnchors"], "Shared anchor map differs")
    register = read_json(HERE / "review-register.json")
    require(len(register["records"]) == 100, "Register must have 100 placeholders")
    expected_register = [{"recordId": cid, "recordSha256": packet["recordHashes"][cid],
                          "card": "records.md#" + cid.lower(), "focus": expected_focus[cid],
                          "reviewer": None, "verdict": "NOT_REVIEWED", "rationale": None, "timestamp": None}
                         for cid in records]
    require(register["records"] == expected_register, "Register contains changed placeholders or a fabricated decision")
    cards_text = (HERE / "records.md").read_text(encoding="utf-8")
    cards = dict(re.findall(r"(?ms)^## ((?:[DH]-[AUO]\d{2}|C\d{2}-[PN]))\n(.*?)(?=^## |\Z)", cards_text))
    require(set(cards) == set(records) and len(re.findall(r"(?m)^## (?:[DH]-[AUO]\d{2}|C\d{2}-[PN])$", cards_text)) == 100,
            "Cards must contain each ID once")
    paragraphs = {p["id"]: (u, p) for u in source["units"].values() for p in u["paragraphs"]}
    used = set()
    for cid, card in cards.items():
        blocks = re.findall(r"```json\n(.*?)\n```", card, re.S)
        require(len(blocks) == 1 and json.loads(blocks[0]) == records[cid], "Card record copy differs: " + cid)
        record = records[cid]
        require("> " + record["query"].replace("\n", "\n> ") in card, "Visible query differs: " + cid)
        answer = record["expectedAnswer"] if "label" in record else record["candidateAnswer"]
        require("> " + (answer or "null").replace("\n", "\n> ") in card, "Visible answer differs: " + cid)
        for basis in record.get("scopeBasis", []):
            require(basis["path"] in card and str(basis["lines"]) in card,
                    "Missing direct scope basis: " + cid)
        require("Focus: `" + (", ".join(expected_focus[cid]) or "STANDARD") + "`" in card, "Card focus differs: " + cid)
        for axis in sorted(AXES):
            require("- [ ] `" + axis + "`" in card, "Missing checklist axis: " + cid + "/" + axis)
        quoted_refs = re.findall(r"<!-- evidence:([^ ]+) -->", card)
        require(len(quoted_refs) == len(set(quoted_refs)) and set(quoted_refs) == references(records[cid]), "Card evidence differs: " + cid)
        for ref in quoted_refs:
            unit, paragraph = paragraphs[ref]
            actual = (ROOT / unit["path"]).read_text(encoding="utf-8").splitlines()
            require("\n".join(actual[paragraph["startLine"] - 1:paragraph["endLine"]]) == paragraph["quote"], "Source paragraph changed: " + ref)
            section = card.split("<!-- evidence:" + ref + " -->", 1)[1]
            quote = re.search(r"```text\n(.*?)\n```", section, re.S)
            require(quote and quote.group(1) == paragraph["quote"], "Card quote differs: " + cid + "/" + ref)
            used.add(ref.split("-R")[0])
    require(len(source["units"]) == 38 and used == set(source["units"]), "All 38 units must be directly reviewable")
    require(len({u["path"] for u in source["units"].values()}) == 10, "Expected ten publication files")
    for name in ("README.md", "records.md"):
        text = (HERE / name).read_text(encoding="utf-8")
        for link in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            target, _, anchor = link.partition("#")
            require("://" not in target, "Packet must use local evidence links")
            require(not target or (HERE / target).is_file(), "Broken local link: " + link)
            if target == "records.md" and anchor:
                require(anchor.upper() in records, "Unknown record link: " + link)
    return packet, records, set(paragraphs)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prepare-event", type=Path, help="Read a human-authored draft; print a sealed event without writing")
    args = parser.parse_args()
    packet, records, refs = validate_packet()
    packet_sha = digest((HERE / "packet-manifest.json").read_bytes())
    events = read_events(HERE / "review-events.jsonl")
    summary = validate_events(events, records, packet, packet_sha, refs)
    if args.prepare_event:
        event = read_json(args.prepare_event)
        cid = event["recordId"]
        require(cid in records, "Unknown recordId")
        technical = {"schemaVersion": "human-review-event-v1", "packetManifestSha256": packet_sha,
                     "recordSha256": packet["recordHashes"][cid], "previousEventHash": summary["headHash"]}
        for key, value in technical.items():
            require(key not in event or event[key] == value, "Conflicting draft technical field: " + key)
            event[key] = value
        event.pop("eventHash", None)
        event["eventHash"] = digest(canonical(event))
        validate_events(events + [event], records, packet, packet_sha, refs)
        print(canonical(event).decode("utf-8"))
    else:
        print(json.dumps({"result": "PACKET_STRUCTURAL_PASS", "records": len(records),
                          "sourceUnits": 38, "publicationFiles": 10, "findingsRecords": 16,
                          "sharedContextAnchors": 3, "humanApproval": "NOT_GRANTED",
                          "GoldStatus": "pending_review", "knownRegression": True,
                          "reviewLog": summary}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError) as exc:
        print(json.dumps({"result": "PACKET_CHECK_FAILED", "reason": str(exc)}, ensure_ascii=False))
        raise SystemExit(1)
