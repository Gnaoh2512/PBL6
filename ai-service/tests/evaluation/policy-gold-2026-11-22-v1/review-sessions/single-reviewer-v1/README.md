# Single Reviewer — Gold Dataset

Decision: **SINGLE_REVIEWER_ACCEPTED**, reviewer **hieu**, review_mode **single_reviewer**.
Scope: all **80 Gold cases + 20 controls**. Independent review: **NOT_PERFORMED**.

This session records the user's actual bulk acceptance. It does not create 100 rubric PASS
events, an R2, an adjudicator, an appointment, or independent approval. For negative controls,
acceptance concerns the record and its expected review decision, not the intentionally wrong
candidate. Original Gold flags remain pending_review / approved:false / scorable:false.

## Evidence and time

The user stated: “Tôi đã đọc và đồng ý nội dung cả 100 trường hợp.” In the implementation
request the user confirmed reviewer_id `hieu`, mode, decision, scope and lack of independent
review. Identity is self-declared in this conversation; no legal/display name or appointment
has been inferred. Detailed nine-axis results, per-case reasons and F1–F4/CTX judgments were
not supplied and are not fabricated.

`reviewedAt` is null because the completion time was not supplied. `recordedAt` is the actual
time Codex wrote the attestation, including UTC+07:00; it is not a claimed review time.
`recordedBy=codex` identifies the recording assistant, not another reviewer.

## Separate versioned contract

[session-manifest.json](session-manifest.json) uses `single-reviewer-session-v1`.
[review-events.jsonl](review-events.jsonl) contains exactly one
`single-reviewer-attestation-v1` event. Its scope checksum binds the complete 100-record hash
inventory in the manifest. These schemas belong only to this sidecar session. They do not
extend, replace, or relax the existing `human-review-event-v1` R1/R2/adjudication schema.

The manifest pins all pre-existing dataset/history/packet files, knowledge files and baseline
references except the explicitly appended PROCESS update. It also pins the new session files.
Hashes detect drift against a retained manifest; they are not signatures or identity proof.
No existing cards, registers, ledgers, Gold, controls, policy, manifests or reports are edited.

## PROCESS and provenance

[PROCESS.before.md](provenance/PROCESS.before.md) preserves the original PROCESS bytes and
matches the checksum in the 0.1.3 packet. The new PROCESS must retain those bytes as an exact
prefix; the manifest separately pins the appended current file.
[release-before.json](provenance/release-before.json) records the successful 0.1.3 check before
the update. [release-after-process.json](provenance/release-after-process.json) records its
actual failure after the update. The 0.1.3 validators continue to reject the changed PROCESS
reference. That expected drift is exposed, not re-pinned away or called a current PASS.
The session manifest and [validation.json](validation.json) are the new provenance/report;
this is not a replacement Gold release. Missing inputs for earlier historical replay remain
missing. Previous reports and every original packet stay unchanged.

## Validation

From the repository root:

```powershell
.\ai-service\.venv\Scripts\python.exe -X utf8 -B ai-service/tests/evaluation/policy-gold-2026-11-22-v1/review-sessions/single-reviewer-v1/validate.py --check-report
.\ai-service\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider ai-service/tests/evaluation/policy-gold-2026-11-22-v1/review-sessions/single-reviewer-v1/test_integrity.py
```

The validator only reads local files, uses the standard library and writes its result to
stdout. SESSION_INTEGRITY_PASS means the recorded decision, scope, hashes and limits agree;
it is not semantic scoring, live evaluation or independent approval. To retain a new report,
capture stdout explicitly outside the validator; never overwrite historical reports.

Independent/paired review, detailed rubric/focus evidence, Gold release approval, blind
evaluation, runtime binding and live reliability gates remain open. Controls are not merged
into FAQ accuracy denominators. This session does not authorize APIs, indexing or deployment.
