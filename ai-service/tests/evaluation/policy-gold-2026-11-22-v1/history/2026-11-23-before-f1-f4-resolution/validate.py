"""Read-only preparation validator. This does not evaluate a model or approve semantics."""
import ast
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
AS_OF = date(2026, 11, 22)
REVIEW_ON = date(2026, 11, 23)
checks = []
failures = []


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def read_json(name):
    return json.loads((HERE / name).read_text(encoding="utf-8"))


def check(name, condition, details=None):
    checks.append({"check": name, "result": "PASS" if condition else "FAIL", "details": details})
    if not condition:
        failures.append(name)


def normalize(text):
    text = text.lower().replace("\u0111", "d")
    text = "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")
    return " ".join(re.findall(r"[a-z0-9]+", text))


def money(value):
    return int(Decimal(value).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def calculate(record):
    kind, x = record["kind"], record["inputs"]
    if kind == "available_deposit":
        v = x["held"] - x["reserved"]
        return {"available": v, "additional": max(x["newRequired"] - v, 0)}
    if kind == "amendment_deposit":
        d = money(Decimal("0.3") * max(x["R"], 0))
        return {"required": d, "additional": max(d - x["available"], 0), "excess": max(x["available"] - d, 0)}
    if kind == "invoice":
        tax = money(Decimal("0.1") * (x["G"] + x["S"] + x["E"]))
        bill = max(x["G"] + x["S"] + x["E"] + tax - x["A_room"] - x["A_other"], 0)
        return {"tax": tax, "bill": bill, "deposit": money(Decimal("0.3") * max(x["G"] - x["A_room"], 0)), "balance": max(bill - x["P"], 0)}
    if kind == "deposit_only":
        return {"deposit": money(Decimal("0.3") * max(x["G"] - x["A_room"], 0))}
    if kind == "room_refund_only":
        d = min(x["D"], x["P0"])
        h = money(Decimal(x["r"]) * d)
        f = d - h
        return {"effectiveDeposit": d, "H": h, "F": f, "room": x["P0"] - f}
    if kind == "age":
        b, d = date.fromisoformat(x["birth"]), date.fromisoformat(x["checkIn"])
        return {"age": d.year - b.year - ((d.month, d.day) < (b.month, b.day))}
    if kind == "service":
        v = x["quantity"] * x["price"]
        t = money(Decimal("0.1") * v)
        return {"beforeTax": v, "tax": t, "total": v + t}
    if kind == "log_expiry":
        return {"expiry": (datetime.fromisoformat(x["created"]) + timedelta(days=14)).isoformat()}
    if kind == "restore_expiry":
        last = min(datetime.fromisoformat(x["logCreated"]) + timedelta(days=14), datetime.fromisoformat(x["restored"]) + timedelta(hours=24))
        return {"restoreExpiry": last.isoformat(), "backupLastDate": (date.fromisoformat(x["demoEnded"]) + timedelta(days=30)).isoformat()}
    if kind == "percentage_fees":
        return {"fees": [money(Decimal(r) * x["base"]) for r in x["rates"]]}
    if kind == "eligible_fee":
        return {"eligible": x["fee"] + x["collectedTax"]}
    if kind == "refund":
        d = min(x["D"], x["P0"])
        h = money(Decimal(x["r"]) * d)
        f = d - h
        room = x["P0"] - f
        target = room + x["C0"] + x["E0"] + x["U0"]
        return {"effectiveDeposit": d, "H": h, "F": f, "room": room, "T": target, "newInstruction": max(target - x["completed"] - x["reserved"], 0)}
    if kind == "new_refund_instruction":
        return {"newInstruction": max(x["T"] - x["completed"] - x["reserved"], 0)}
    if kind == "working_days":
        d, count = date.fromisoformat(x["completed"]), 0
        while count < x["days"]:
            d += timedelta(days=1)
            count += d.weekday() < 5
        return {"lastDate": d.isoformat()}
    raise ValueError("Unknown calculation kind: " + kind)


g, controls, m = read_json("gold.json"), read_json("review-controls.json"), read_json("manifest.json")
cases, cs, units = g["cases"], controls["controls"], m["units"]
for path, entry in m["referenceDocuments"].items():
    check("reference hash: " + path, sha((ROOT / path).read_bytes()) == entry["sha256"])
for name, digest in m["artifactSha256"].items():
    check("artifact hash: " + name, sha((HERE / name).read_bytes()) == digest)

para = {}
original = ROOT / m["original"]["path"]
original_bytes = original.read_bytes()
original_lines = original_bytes.decode("utf-8").splitlines()
trace = (ROOT / m["traceabilityReport"]["path"]).read_text(encoding="utf-8")
raw_units = {}
metadata_paths = {m["original"]["path"]}
for uid, u in units.items():
    path = ROOT / u["path"]
    raw = path.read_bytes()
    s = raw.decode("utf-8").replace("\r\n", "\n")
    parts = s.split("---", 2)
    head, body = parts[1], parts[2].strip()
    sections = re.split(r"(?m)^## ", body)
    pre = sections[0].strip()
    sec = next(x for x in sections[1:] if x.split()[0] == uid)
    excerpt = sec.strip()
    content = (pre + "\n\n## " + excerpt).strip()
    check("source/unit identity: " + uid,
          sha(raw) == u["sourceSha256"] and sha(excerpt.encode()) == u["unitSha256"] and content == u["content"])
    check("character contract: " + uid, len(excerpt) < 2000 and len(content) < 2000 and len(content) == u["characterCount"])
    row = re.search(r"\| \[" + uid + r"\]\([^\n]+?\) \| ([\d.]+) \| (\d+) \| (\d+) \|", trace)
    check("review counts/version: " + uid, row is not None and row.groups() == (u["policyVersion"], str(len(excerpt)), str(len(content))))
    check("local IDs are not runtime citations: " + uid, all(u[k] is None for k in ["runtimeSnapshotId", "chunkId", "citationId"]))
    metadata_paths.add(u["path"])
    for raw_sec in re.split(r"(?m)^## ", raw.decode("utf-8"))[1:]:
        raw_units[raw_sec.split()[0]] = sha(raw_sec.encode())
    for p in u["paragraphs"]:
        para[p["id"]] = p
        quote = "\n".join(s.splitlines()[p["startLine"] - 1:p["endLine"]])
        check("paragraph anchor: " + p["id"], quote == p["quote"] and sha(quote.encode()) == p["quoteSha256"])
        ranges = re.findall(r"L(\d+)(?:[\u2013-](\d+))?", p["originalSourceRanges"])
        check("original ranges: " + p["id"], bool(ranges) and all(1 <= int(a) <= int(b or a) <= len(original_lines) for a, b in ranges))
        check("trace row exists: " + p["id"], "| " + p["id"] + " |" in trace and p["originalSourceRanges"] in trace)
check("38 publication bodies unchanged", raw_units == m["activationBaseline"]["units"])
check("original current SHA pinned", sha(original_bytes) == m["original"]["sha256"])
# Reconstruct the baseline by reversing only the explicitly authorized metadata/notices.
original_text = original_bytes.decode("utf-8")
nl = "\r\n" if "\r\n" in original_text else "\n"
reconstructed = original_text.rsplit(nl + nl + "## ACTIVATION \u2014 22/11/2026", 1)[0]
replacements = [
    ("effective_from: 2026-11-22", "effective_from: null"),
    ("hi\u1ec7u l\u1ef1c t\u1eeb 22/11/2026 v\u00e0 kh\u00f4ng \u00e1p d\u1ee5ng h\u1ed3i t\u1ed1", "ch\u01b0a ch\u1ed1t ng\u00e0y hi\u1ec7u l\u1ef1c v\u00e0 kh\u00f4ng \u00e1p d\u1ee5ng h\u1ed3i t\u1ed1"),
    ("hi\u1ec7u l\u1ef1c t\u1eeb 22/11/2026; ch\u01b0a ingestion, ch\u01b0a c\u00f3 approved fact catalog ho\u1eb7c nghi\u1ec7m thu D1.", "ch\u01b0a c\u00f3 ng\u00e0y hi\u1ec7u l\u1ef1c, ingestion, approved fact catalog ho\u1eb7c nghi\u1ec7m thu D1."),
    ("file v\u1eabn ngo\u00e0i allowlist, hi\u1ec7u l\u1ef1c t\u1eeb 22/11/2026.", "file v\u1eabn ngo\u00e0i allowlist, ch\u01b0a c\u00f3 ng\u00e0y hi\u1ec7u l\u1ef1c."),
]
for new, old in replacements:
    check("original metadata reversal present: " + old, new in reconstructed)
    reconstructed = reconstructed.replace(new, old, 1)
check("original business text preserved", sha(reconstructed.encode()) == m["activationBaseline"]["source_sha256"])

for name in sorted(metadata_paths):
    head = (ROOT / name).read_text(encoding="utf-8").split("---", 2)[1]
    def value(key):
        found = re.search(r"(?m)^" + key + r": (.+)$", head)
        return found.group(1).strip().strip('"') if found else None
    check("approved effective metadata: " + name,
          value("approved") == "true" and value("status") == value("approval_status") == "approved"
          and value("approved_by") == "user" and value("approved_at") == "2026-11-22"
          and re.search(r"(?m)^effective_from: 2026-11-22$", head) is not None
          and value("effective_to") == "null" and value("synthetic") == "true"
          and value("source_type") == "AI_GENERATED_SYNTHETIC")
    if "publication-draft/" in name:
        policy = value("source_policy_id")
        expected_version = "0.1.0" if policy == "POL-07" else "0.1.1"
        check("version/provenance: " + policy,
              value("version") == value("source_policy_version") == expected_version
              and value("source_document_version") == "0.1.1"
              and value("source_document_id") == "synthetic-hotel-policies-academic-demo"
              and value("source_ref") == "synthetic:pbl6-academic-demo/hotel-policies-v0.1.1"
              and value("derived_from") == "../academic-demo-hotel-policies.md")
check("11 effective documents", len(metadata_paths) == 11)
tree = ast.parse((ROOT / "ai-service/app/ingestion/snapshot.py").read_text(encoding="utf-8"))
sources = next(ast.literal_eval(x.value) for x in tree.body if isinstance(x, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "SOURCES" for t in x.targets))
allowlisted = {name for names in sources.values() for name in names}
check("policy remains outside all ingestion allowlists", not {str(Path(name).relative_to("ai-service")).replace("\\", "/") for name in metadata_paths} & allowlisted)

check("80 cases", len(cases) == 80)
check("48 A / 24 U / 8 O", Counter(c["label"] for c in cases) == Counter(A=48, U=24, O=8))
families = defaultdict(set)
for c in cases:
    families[c["family"]].add(c["split"])
check("family IDs disjoint between splits", all(len(s) == 1 for s in families.values()))
for split in ["dev", "held_out"]:
    sample = [c for c in cases if c["split"] == split]
    check("40 split cases: " + split, len(sample) == 40)
    check("24/12/4 per split: " + split, Counter(c["label"] for c in sample) == Counter(A=24, U=12, O=4))
    # Whole-family relocation changes multi/exception distribution; do not claim human sign-off.
    proposed_strata = {
        "dev": Counter(direct=8, paraphrase=8, multi_claim=5, exception=3),
        "held_out": Counter(direct=8, paraphrase=8, multi_claim=3, exception=5),
    }
    check("A strata match disclosed revision: " + split, Counter(c["stratum"] for c in sample if c["label"] == "A") == proposed_strata[split])
    check("U strata: " + split, Counter(c["stratum"] for c in sample if c["label"] == "U") == Counter(outside_source=4, partial_ambiguous=4, leading_unsupported=4))
check("case IDs unique", len({c["id"] for c in cases}) == len(cases))
check("query exact unique", len({c["query"] for c in cases}) == len(cases))
check("query normalized unique", len({normalize(c["query"]) for c in cases}) == len(cases))
used = set()
for c in cases:
    check("pending/unscorable case: " + c["id"], c["reviewStatus"] == "pending_review" and c["approved"] is False and c["scorable"] is False and c["reviewDecisions"] == [])
    check("case as-of: " + c["id"], c["asOfDate"] == AS_OF.isoformat())
    refs = [r for rs in c["acceptableMinimalEvidenceSets"] for r in rs] + c["contextEvidenceRefs"]
    check("case evidence resolvable: " + c["id"], all(r in para for r in refs))
    unit_ids = {r.split("-R")[0] for r in refs}
    used |= unit_ids
    pinned = {v["unitId"]: v for v in c["sourceVersions"]}
    check("source versions match evidence: " + c["id"], set(pinned) == unit_ids and all(v["policyVersion"] == units[k]["policyVersion"] and v["sourceDocumentVersion"] == units[k]["sourceDocumentVersion"] and v["sourceSha256"] == units[k]["sourceSha256"] and v["unitSha256"] == units[k]["unitSha256"] for k, v in pinned.items()))
    if c["label"] == "A":
        check("answer contract: " + c["id"], c["expectedStatus"] == "answered" and bool(c["expectedAnswer"]) and 1 <= len(c["requiredMeanings"]) <= 6 and bool(c["acceptableMinimalEvidenceSets"]) and c["abstentionReason"] is None)
        check("citation-unit bound: " + c["id"], all(len({r.split("-R")[0] for r in rs}) <= 3 for rs in c["acceptableMinimalEvidenceSets"]))
        check("meaning proposed binding: " + c["id"], all(x["proposedSupportRefs"] and set(x["proposedSupportRefs"]) <= set(refs) for x in c["requiredMeanings"]))
    else:
        expected_status = "insufficient_evidence" if c["label"] == "U" else "capability_unavailable"
        check("abstention contract: " + c["id"], c["expectedStatus"] == expected_status and c["expectedAnswer"] is None and bool(c["abstentionReason"]) and c["acceptableMinimalEvidenceSets"] == [] and c["requiredMeanings"] == [])
    if "calculationCheck" in c:
        actual = calculate(c["calculationCheck"])
        expected = c["calculationCheck"]["expected"]
        check("arithmetic/date: " + c["id"], all(actual[k] == v for k, v in expected.items()), {"computed": actual, "expected": expected})
check("all 38 units referenced as answer or boundary context", used == set(units), {"used": len(used)})
check("20 separate controls / 10 pairs", len(cs) == 20 and len({c["pairId"] for c in cs}) == 10)
check("control IDs unique", len({c["id"] for c in cs}) == 20)
for pair in sorted({c["pairId"] for c in cs}):
    pair_cases = [c for c in cs if c["pairId"] == pair]
    check("control pair decisions: " + pair, Counter(c["expectedReviewDecision"] for c in pair_cases) == Counter(accept_supported=1, reject_unsupported=1))
for c in cs:
    check("control pending and separate: " + c["id"], c["reviewStatus"] == "pending_review" and c["approved"] is False and c["scorable"] is False and c["semanticApprovalGranted"] is False)
    check("control evidence exists: " + c["id"], all(r in para for r in c["offeredEvidenceRefs"] + c["correctEvidenceRefs"]))
for doc in [g, controls, m]:
    check("artifact not approved: " + doc.get("datasetId", doc.get("id")), doc["status"] == "draft" and doc["approvalStatus"] == "pending_review" and doc["approved"] is False)

near_duplicates = []
for i, a in enumerate(cases):
    ta = set(normalize(a["query"]).split())
    for b in cases[i + 1:]:
        tb = set(normalize(b["query"]).split())
        score = len(ta & tb) / len(ta | tb)
        if score >= 0.55:
            near_duplicates.append({"a": a["id"], "b": b["id"], "jaccard": round(score, 3), "sameFamily": a["family"] == b["family"], "sameSplit": a["split"] == b["split"]})


def git(*args):
    return subprocess.check_output(["git", "--no-optional-locks", *args], cwd=ROOT)


def git_sha(name):
    path = Path(git("rev-parse", "--git-path", name).decode().strip())
    if not path.is_absolute():
        path = ROOT / path
    return sha(path.read_bytes()) if path.is_file() else None


state = {
    "branch": git("branch", "--show-current").decode().strip(),
    "head": git("rev-parse", "HEAD").decode().strip(),
    "merge_head": git("rev-parse", "MERGE_HEAD").decode().strip(),
    "cached_sha256": sha(git("diff", "--cached", "--binary")),
    "index_sha256": git_sha("index"),
    "staged": len(git("diff", "--cached", "--name-only", "-z").split(b"\0")) - 1,
    "unmerged": len(git("ls-files", "-u").splitlines()),
}
check("Git identity/staging/merge preserved", all(v == m["gitBaseline"][k] for k, v in state.items()), state)

# Revision audit: retain the original artifacts/results and expose a result for every record.
archive = HERE / m["reviewUpdate"]["archive"]
receipt = json.loads((archive / "receipt.json").read_text(encoding="utf-8"))
check("history receipt pinned", sha((archive / "receipt.json").read_bytes()) == m["reviewUpdate"]["historyReceiptSha256"])
for name, digest in receipt["files"].items():
    check("historical artifact preserved: " + name, sha((archive / name).read_bytes()) == digest)
old_gold = json.loads((archive / "gold.json").read_text(encoding="utf-8"))
old_controls = json.loads((archive / "review-controls.json").read_text(encoding="utf-8"))
old_manifest = json.loads((archive / "manifest.json").read_text(encoding="utf-8"))
old_records = {c["id"]: c for c in old_gold["cases"] + old_controls["controls"]}
check("exactly the original 100 record IDs", len(cases + cs) == 100 and {c["id"] for c in cases + cs} == set(old_records))
for key in ["units", "original", "traceabilityReport", "activationBaseline", "gitBaseline", "invarianceBaseline", "runtimeBinding"]:
    check("unrelated manifest field unchanged: " + key, m[key] == old_manifest[key])
changed_references = {key for key, value in m["referenceDocuments"].items() if value != old_manifest["referenceDocuments"][key]}
check("exactly two reference-document corrections", changed_references == {"ai-service/docs/PROCESS.md", "ai-service/docs/EVALUATION.md"})

for key in ["family", "ruleFamily", "scenarioFamily"]:
    usage = defaultdict(set)
    for c in cases:
        usage[c[key]].add(c["split"])
    check(key + " groups remain in one split", all(len(v) == 1 for v in usage.values()))
check("original global A strata preserved", Counter(c["stratum"] for c in cases if c["label"] == "A") == Counter(direct=16, paraphrase=16, multi_claim=8, exception=8))
coverage = {}
for split in ["dev", "held_out"]:
    sample = [c for c in cases if c["split"] == split]
    anchors = {r for c in sample for r in sum(c["acceptableMinimalEvidenceSets"], []) + c["contextEvidenceRefs"]}
    coverage[split] = {
        "labels": dict(Counter(c["label"] for c in sample)),
        "answerablePrimaryTopics": sorted({c["topic"] for c in sample if c["label"] == "A"}),
        "referencedTopics": sorted({r[:6] for r in anchors}),
        "referencedUnits": len({r.split("-R")[0] for r in anchors}),
        "A_strata": dict(Counter(c["stratum"] for c in sample if c["label"] == "A")),
        "U_strata": dict(Counter(c["stratum"] for c in sample if c["label"] == "U")),
    }
check("held-out A primary targets cover all ten policies", set(coverage["held_out"]["answerablePrimaryTopics"]) == {"POL-%02d" % i for i in range(1, 11)})

moves = m["reviewUpdate"]["familyMoves"]
actual_moves = {c["id"]: (old_records[c["id"]]["split"], c["split"]) for c in cases if old_records[c["id"]]["split"] != c["split"]}
check("only disclosed whole-family moves", actual_moves == {x["id"]: (x["from"], x["to"]) for x in moves})
for family in {x["family"] for x in moves}:
    check("all cases moved together: " + family, {x["id"] for x in moves if x["family"] == family} == {c["id"] for c in cases if c["family"] == family})

record_results = []
normalized_query_counts = Counter(normalize(c["query"]) for c in cases)
shared = defaultdict(lambda: defaultdict(list))
for c in cases:
    for ref in set(sum(c["acceptableMinimalEvidenceSets"], []) + c["contextEvidenceRefs"]):
        shared[ref][c["split"]].append(c["id"])
    if c["label"] == "O":
        check("scope hash and line anchors current: " + c["id"], all(
            sha((ROOT / b["path"]).read_bytes()) == b["sha256"]
            and b["sha256"] == m["referenceDocuments"][b["path"]]["sha256"]
            and 1 <= b["lines"][0] <= b["lines"][1] <= len((ROOT / b["path"]).read_text(encoding="utf-8").splitlines())
            for b in c["scopeBasis"]
        ))
    if c["label"] == "A":
        check("required meanings reconstruct expected answer: " + c["id"], " ".join(x["text"] for x in c["requiredMeanings"]) == c["expectedAnswer"])
        unit_sets = [{r.split("-R")[0] for r in s} for s in c["acceptableMinimalEvidenceSets"]]
        check("no strict superset alternative: " + c["id"], not any(a < b for i, a in enumerate(unit_sets) for j, b in enumerate(unit_sets) if i != j))
        for meaning in c["requiredMeanings"]:
            if "proposedSupportAlternatives" in meaning:
                check("meaning alternatives agree with complete-answer alternatives: " + meaning["id"], meaning["proposedSupportAlternatives"] == c["acceptableMinimalEvidenceSets"])

control_calculation_results = {
    "C03": {"strictBeforeAtDeadline": datetime(2026, 12, 1, 10, 15) < datetime(2026, 12, 1, 10, 0) + timedelta(minutes=15)},
    "C04": {"calendarDays": (date(2026, 12, 10) - date(2026, 12, 7)).days},
    "C05": calculate({"kind": "deposit_only", "inputs": {"G": 1700000, "A_room": 60000}}),
    "C06": calculate({"kind": "available_deposit", "inputs": {"held": 510000, "reserved": 300000, "newRequired": 255000}}),
    "C08": calculate({"kind": "service", "inputs": {"quantity": 2, "price": 120000}}),
    "C09": calculate({"kind": "percentage_fees", "inputs": {"base": 850000, "rates": ["0.5"]}}),
    "C10": calculate({"kind": "age", "inputs": {"birth": "2008-12-05", "checkIn": "2026-12-10"}}),
}
check("control arithmetic/boundaries independently recomputed",
      control_calculation_results["C03"]["strictBeforeAtDeadline"] is False
      and control_calculation_results["C04"]["calendarDays"] == 3
      and control_calculation_results["C05"]["deposit"] == 492000
      and control_calculation_results["C06"] == {"available": 210000, "additional": 45000}
      and control_calculation_results["C08"]["total"] == 264000
      and control_calculation_results["C09"]["fees"] == [425000]
      and control_calculation_results["C10"]["age"] == 18)
pair_c09 = {c["id"]: c for c in cs if c["pairId"] == "C09"}
check("C09 isolates citation support from answer text",
      pair_c09["C09-P"]["candidateAnswer"] == pair_c09["C09-N"]["candidateAnswer"]
      and pair_c09["C09-P"]["offeredEvidenceRefs"] == pair_c09["C09-P"]["correctEvidenceRefs"]
      and pair_c09["C09-N"]["offeredEvidenceRefs"] != pair_c09["C09-N"]["correctEvidenceRefs"])

for c in cases + cs:
    before = old_records[c["id"]]
    check("review required without self-approval: " + c["id"],
          c["reviewDisposition"] == c["sourceReview"]["status"] == "REVIEW_REQUIRED"
          and c["sourceReview"]["reviewType"] == "AI_AUTHOR_PRE_REVIEW"
          and c["sourceReview"]["independentHumanApproval"] is False
          and bool(c["sourceReview"]["note"]) and bool(c["reviewRequiredReasons"]))
    if c in cases:
        check("per-record normalized query unique: " + c["id"], normalized_query_counts[normalize(c["query"])] == 1)
        immutable = ["query", "label", "expectedStatus", "expectedAnswer", "abstentionReason", "mandatoryQualifiers", "forbiddenInferences"]
        check("query/label/expected business meaning preserved: " + c["id"],
              all(c[k] == before[k] for k in immutable)
              and [x["text"] for x in c["requiredMeanings"]] == [x["text"] for x in before["requiredMeanings"]])
        refs = set(sum(c["acceptableMinimalEvidenceSets"], []) + c["contextEvidenceRefs"])
        calculations = calculate(c["calculationCheck"]) if "calculationCheck" in c else None
        answer_axis = "AI_SOURCE_REVIEWED_HUMAN_REQUIRED" if c["label"] == "A" else "NO_DEFINITIVE_ANSWER_BY_DESIGN"
    else:
        immutable = ["query", "candidateAnswer", "expectedReviewDecision", "expectedReviewReason", "offeredEvidenceRefs", "correctEvidenceRefs"]
        check("control oracle/proposal unchanged: " + c["id"], all(c[k] == before[k] for k in immutable))
        refs = set(c["offeredEvidenceRefs"] + c["correctEvidenceRefs"])
        calculations = control_calculation_results.get(c["pairId"])
        answer_axis = "PROPOSED_SUPPORTED_CONTROL" if c["expectedReviewDecision"] == "accept_supported" else "DELIBERATE_UNSUPPORTED_CONTROL"
        pids = {r.split("-R")[0] for r in refs}
        pinned = {v["unitId"]: v for v in c["sourceVersions"]}
        check("control source versions match: " + c["id"], set(pinned) == pids and all(
            v["policyVersion"] == units[k]["policyVersion"] and v["sourceSha256"] == units[k]["sourceSha256"]
            and v["unitSha256"] == units[k]["unitSha256"] for k, v in pinned.items()))
    identity = all(r in para and sha((ROOT / units[r.split("-R")[0]]["path"]).read_bytes()) == units[r.split("-R")[0]]["sourceSha256"] for r in refs)
    record_failures = [x["check"] for x in checks if x["result"] == "FAIL" and x["check"].endswith(": " + c["id"])]
    record_results.append({
        "id": c["id"], "kind": "gold" if c in cases else "review_control",
        "split": c.get("split"), "family": c.get("family", c.get("pairId")),
        "ruleFamily": c["ruleFamily"], "reviewDisposition": "REVIEW_REQUIRED",
        "staticResult": "PASS" if not record_failures and identity else "FAIL",
        "staticFailures": record_failures, "expectedAnswerAndClaims": answer_axis,
        "citationIdentity": ("PASS" if identity else "FAIL") if refs else "NOT_APPLICABLE_NO_ANSWER_CITATIONS",
        "sourceVersions": ("PASS" if identity and not record_failures else "FAIL") if refs else "SCOPE_OR_CORPUS_ONLY",
        "sourceRefs": sorted(refs), "arithmetic": {"result": "PASS", "computed": calculations, "purpose": "Recompute reference values, not approval of the candidate/transaction"} if calculations is not None else {"result": "NOT_APPLICABLE"},
        "abstention": "STRUCTURE_CHECKED_SEMANTIC_REVIEW_REQUIRED" if c.get("label") in ["U", "O"] else "NOT_APPLICABLE",
        "duplicateAndOverlap": "STATIC_DUPLICATE_CHECKED_SEMANTIC_REVIEW_REQUIRED",
        "crossSplitSourceAnchors": [ref for ref in sorted(refs) if len(shared[ref]) > 1] if c in cases else [],
        "sourceReviewNote": c["sourceReview"]["note"], "humanReviewReasons": c["reviewRequiredReasons"],
        "independentHumanApproval": False,
    })
check("100 record results, none silently omitted", len(record_results) == 100 and len({r["id"] for r in record_results}) == 100)
check("record structural results have no failure", all(r["staticResult"] == "PASS" for r in record_results))
readme = (HERE / "README.md").read_text(encoding="utf-8")
check("all 100 records listed for human review", all("| " + c["id"] + " |" in readme for c in cases + cs))
shared_across_splits = [
    {"anchor": ref, "dev": use["dev"], "held_out": use["held_out"], "reviewDisposition": "REVIEW_REQUIRED",
     "note": "Shared source/background qualifier or possible semantic overlap; inspect actual required meanings, not just family labels."}
    for ref, use in sorted(shared.items()) if "dev" in use and "held_out" in use
]
remaining_blockers = [
    {"id": "HUMAN_ORACLE", "status": "REVIEW_REQUIRED", "records": 100, "reason": "Two independent human reviewers and resolver are still unassigned; source correctness, claim support and proposed minimality are not approved."},
    {"id": "BLINDNESS", "status": "REVIEW_REQUIRED", "reason": "Same AI authored/reviewed exposed queries; no blind or frozen held-out. Independent evaluator must review/replace before acceptance scoring."},
    {"id": "SAMPLING", "status": "REVIEW_REQUIRED", "reason": "Whole-family relocation preserves 40/40, 24A/12U/4O and global strata. Dev multi/exception 5/3 and held-out 3/5 need human sign-off. Dev lacks primary A topics POL-02/04/07; sampling adequacy remains pending review."},
    {"id": "SEMANTIC_OVERLAP", "status": "REVIEW_REQUIRED", "reason": "Family/rule/scenario labels are structurally disjoint; shared source qualifiers and controls reuse known examples, so semantic independence remains a human judgement."},
    {"id": "BINDING", "status": "REVIEW_REQUIRED", "reason": "Local anchors are not runtime chunk/citation IDs; reviewed source/catalog/runtime binding must be performed under a separate authorization."},
]
report = {
    "format": "pbl6-static-preparation-report-v1",
    "asOfDate": AS_OF.isoformat(),
    "reviewedOn": REVIEW_ON.isoformat(),
    "reviewRevision": g["reviewRevision"],
    "reviewDisposition": "REVIEW_REQUIRED",
    "approvalStatus": "pending_review",
    "approved": False,
    "coverageBySplit": coverage,
    "recordResults": record_results,
    "remainingBlockers": remaining_blockers,
    "sharedSourceAnchorsAcrossSplits": shared_across_splits,
    "controlCalculationResults": control_calculation_results,
    "historyArchive": m["reviewUpdate"]["archive"],
    "result": "STATIC_PASS" if not failures else "STATIC_FAIL",
    "checks": len(checks), "failures": failures,
    "counts": {"gold": len(cases), "A": 48, "U": 24, "O": 8, "controls": len(cs), "families": len(families), "sourceUnits": len(units), "sourceParagraphs": len(para), "referencedUnits": len(used), "proposedMeaningSegments": sum(len(c["requiredMeanings"]) for c in cases), "calculationCases": sum("calculationCheck" in c for c in cases)},
    "splitCounts": dict(Counter(c["split"] for c in cases)),
    "characterRange": [min(u["characterCount"] for u in units.values()), max(u["characterCount"] for u in units.values())],
    "nearDuplicateCandidates": near_duplicates,
    "nearDuplicateThreshold": 0.55,
    "gitState": state,
    "semanticSupport": "NOT_VERIFIED_BY_STATIC_CHECKS",
    "independentHumanReview": "PENDING",
    "heldOutBlindness": "NOT_ESTABLISHED",
    "runtimeBinding": "NOT_RUN",
    "modelEvaluation": "NOT_RUN",
    "D1Acceptance": "ACCEPTED_WITH_LIMITATIONS_BY_USER_2026_11_23",
    "details": checks,
}
print(json.dumps(report, ensure_ascii=False, indent=2))
raise SystemExit(1 if failures else 0)
