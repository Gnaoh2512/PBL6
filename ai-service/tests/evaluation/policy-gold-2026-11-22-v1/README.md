# Hotel policy Gold — known regression dataset

Revision: **0.1.2-draft**, 23/11/2026. Usage: **known_regression**.
Status: **pending_review / approved:false / scorable:false**.
Both legacy partitions are exposed; neither is blind or frozen.

The current 80 Gold cases and 20 controls are retained for regression and human review.
They are not the separate independent evaluation proposed for F5. No new blind question,
expected answer, approval, freeze, ingestion or live result is created by this revision.

## Current artifacts

- [gold.json](gold.json): 80 unchanged queries, answers and A/U/O labels; updated family/split metadata and two minimal support sets.
- [review-controls.json](review-controls.json): 20 known calibration controls, **byte-for-byte unchanged**.
- [manifest.json](manifest.json): approved source identity, version/hash, history and exact F1–F4 change scope.
- [validate.py](validate.py): read-only integrity/regression validation, not a semantic approval oracle.
- [validation.json](validation.json): current checks and results for all 100 records.
- [independent-evaluation-strategy.md](independent-evaluation-strategy.md): separate proposed workflow for F5; contains no new evaluation questions or answers.

Approved policy sources remain synthetic. Versions stay 0.1.1, except POL-07 0.1.0;
the aggregate source document is 0.1.1, effective from 22/11/2026. All policy content,
approval/provenance, source hashes and actual runtime bindings are unchanged.
Local paragraph anchors are not actual retrieved snapshot/chunk/citation IDs.

D1 milestone acceptance is **ACCEPTED_WITH_LIMITATIONS**, as recorded by user on 23/11:
[PROCESS](../../../docs/PROCESS.md), [EVALUATION](../../../docs/EVALUATION.md).
This decision is separate from human approval of Gold, independent evaluation and quality gates.
Those documents and their existing reference hashes are unchanged in this task.

## F1–F4 resolution and scope

Source: the complete preceding conversation report **GOLD_SEMANTIC_AUDIT_NEEDS_REVISION**:
93 PASS, 7 NEEDS_REVISION, 0 INVALID. The report was delivered read-only, not as a repository
file. Its judgments are not human approval.

| Finding | Resolution | Source evidence |
| --- | --- | --- |
| F1 | Merge complete refund-workflow and refund-ledger families as refund-evidence-workflow-ledger, all in legacy held_out | POL-05-U02-R1/R4: actual collected money and receipt readiness |
| F2 | Merge complete complaint-evidence and complaint-clock families as complaint-completeness-sla, all in legacy held_out | POL-09-U02-R2/R3: first-complete definition, staff responsibility and SLA clock |
| F3 | H-A13 needs only POL-08-U02-R3/R4/R5; POL-05-U03 is no longer mandatory | Prepaid tax, verified unprovided portion, no inferred ratio/double refund or excess payment |
| F4 | H-A22 needs only POL-09-U03-R4/R5; POL-09-U01 is no longer mandatory | Separately agreed benefits, no total/bank guarantee, overdue escalation and no automatic approval |

F1 family (10 records): H-A09, H-A10, H-A11, H-A14, H-A15, H-A16,
H-U03, H-U06, H-U11, H-U12.
F2 family (5 records): H-A20, H-A21, H-A22, H-A23, H-U08.

Seven records move dev → held_out: H-A11, H-A14, H-A15, H-A16, H-A23, H-U03, H-U12.
The ledger family stays beside its cancellation-rate context. The prior broad ruleFamily
annotations are refined only for members of these two audited families; scenario provenance
remains intact. H-A24 and other unrelated PASS records are not moved to force a ratio.

Exactly **16 records are affected**: 15 complete family members, plus H-A13.
Nine previously PASS records are related family members whose metadata changes; their query,
answer, required-meaning text, label, arithmetic and source evidence are preserved.
The remaining **84 unrelated PASS records are identical as complete records**, including all
20 controls; the controls file itself is byte-identical. The validator checks an explicit
field allowlist and canonical record hashes against the pre-resolution copy.

No query, answer, required-meaning text, label, abstention reason or calculation input/result
is changed in any of the 100 records. Only H-A13/H-A22 change evidence bindings and sourceVersions.
All records remain REVIEW_REQUIRED and unscorable until independent human review.

## Exposed regression partitions

D/H prefixes in case IDs retain their original identity; the split field is authoritative.
These are legacy regression partitions, not a new independent-evaluation sampling protocol.

| Partition | A | U | O | Total |
| --- | ---: | ---: | ---: | ---: |
| dev | 19 | 10 | 4 | 33 |
| held_out (legacy name) | 29 | 14 | 4 | 47 |
| Total | 48 | 24 | 8 | 80 |

A strata: dev 6 direct/6 paraphrase/4 multi/3 exception;
legacy held_out 10/10/4/5. Global A strata remain 16/16/8/8.
U strata: dev 3 outside-source/4 partial/3 leading; legacy held_out 5/4/5.
There is no quota-driven movement of unrelated records and no change to historical metric
values or acceptance thresholds. Future private evaluation has its own prospectively
reviewed sampling plan; do not use these counts as its approved denominator.

## Remaining shared context and human decisions

F1 and F2 target rules are co-located. The remaining three shared anchors are the existing
qualifiers/context classified in the audit, not newly introduced pairs:

| Anchor | dev | Legacy held_out | Interpretation |
| --- | --- | --- | --- |
| POL-08-U01-R4 | D-U01 | H-U01, H-U10 | Different missing targets: fabric list, operating/SLA information, delivery evidence |
| POL-09-U03-R4 | H-A24 | H-A22 | Common no-automatic-benefit qualifier; different early-departure versus overdue trigger |
| POL-09-U03-R5 | H-A24 | H-A22 | Context annotation in H-A24; escalation deadline is not its required answer target |

Shared anchors alone do not establish leakage or independence. The validator checks that no
new cross-partition anchor or case pair appears, and that original families/scenarios remain
co-located. Semantic support and the audit's qualifier classifications still need human review.

Two independent human reviewers and a disagreement resolver remain unassigned. They must
confirm F1/F2 grouping, the two reduced evidence sets, all remaining claim/qualifier bindings,
U/O intent and the known-regression scope. Negative controls are deliberately unsupported:
a static PASS for their record does not approve the candidate claim.
No current data is promoted to blind evaluation by these fixes.

F5 remains a future independent-evaluator task. The separate strategy requires new questions
that do not recycle exposed queries/controls, whole-family sampling, verified private access
outside the tuning team's workspace, independent source review and documented adjudication.
The proposal contains no private test payload and grants no access, approval, freeze or API budget.

## History and verification

- [Pre-F1–F4 copy](history/2026-11-23-before-f1-f4-resolution/receipt.json): all six current artifacts before this revision, with checksums and a record of preexisting history hashes.
- [Earlier pre-review copy](history/2026-11-23-before-review-update/receipt.json): preserved unchanged.
- Historical validation reports remain in those copies byte-for-byte. Archived validators
  are provenance only; their relative paths are not runnable from the archive directory.
  A preservation copy is not a benchmark freeze.

Run from repository root:

```powershell
python -B -X utf8 ai-service/tests/evaluation/policy-gold-2026-11-22-v1/validate.py
```

The validator reads sources/JSON/Git only. It checks all 100 records, exact source/version/hash,
17 scenario calculations, control reference calculations, unchanged business meanings, history,
explicit allowed fields, all 84 unrelated PASS hashes, control-file bytes, whole original
families/scenarios, F1/F2 co-location, F3/F4 source units and absence of new shared anchor pairs.
Static checks do not establish human approval, generalization, live reliability or actual citation binding.

No application/policy/SQL/database, dependencies, model, timeout, allowlist or runtime behavior
is changed. No ingestion/indexing/Gemini/live evaluation or Git write operation is performed.

## Current human review list

Every record below remains **REVIEW_REQUIRED / pending_review / approved:false / scorable:false**.
The source-review notes in JSON are AI pre-review, not independent human decisions.
Reviewers must record identity/role, decision, reason, timestamp and source/dataset hashes.

| ID | Partition | Label/control decision | Family | Revision scope | Review |
| --- | --- | --- | --- | --- | --- |
| D-A01 | dev | A | booking-admission | unchanged PASS record | REVIEW_REQUIRED |
| D-A02 | dev | A | booking-admission | unchanged PASS record | REVIEW_REQUIRED |
| D-A03 | dev | A | booking-admission | unchanged PASS record | REVIEW_REQUIRED |
| D-A04 | held_out | A | booking-hold-proof | unchanged PASS record | REVIEW_REQUIRED |
| D-A05 | held_out | A | booking-hold-proof | unchanged PASS record | REVIEW_REQUIRED |
| D-A06 | held_out | A | booking-hold-proof | unchanged PASS record | REVIEW_REQUIRED |
| D-A07 | held_out | A | booking-hold-proof | unchanged PASS record | REVIEW_REQUIRED |
| D-A08 | dev | A | amendment-lifecycle | unchanged PASS record | REVIEW_REQUIRED |
| D-A09 | dev | A | amendment-lifecycle | unchanged PASS record | REVIEW_REQUIRED |
| D-A10 | dev | A | amendment-lifecycle | unchanged PASS record | REVIEW_REQUIRED |
| D-A11 | dev | A | amendment-finance | unchanged PASS record | REVIEW_REQUIRED |
| D-A12 | dev | A | amendment-finance | unchanged PASS record | REVIEW_REQUIRED |
| D-A13 | dev | A | amendment-finance | unchanged PASS record | REVIEW_REQUIRED |
| D-A14 | dev | A | invoice-discount-scope | unchanged PASS record | REVIEW_REQUIRED |
| D-A15 | dev | A | invoice-discount-scope | unchanged PASS record | REVIEW_REQUIRED |
| D-A16 | dev | A | invoice-discount-scope | unchanged PASS record | REVIEW_REQUIRED |
| D-A17 | held_out | A | guest-capacity | unchanged PASS record | REVIEW_REQUIRED |
| D-A18 | dev | A | guest-age | unchanged PASS record | REVIEW_REQUIRED |
| D-A19 | dev | A | guest-age | unchanged PASS record | REVIEW_REQUIRED |
| D-A20 | dev | A | service-identity | unchanged PASS record | REVIEW_REQUIRED |
| D-A21 | dev | A | service-identity | unchanged PASS record | REVIEW_REQUIRED |
| D-A22 | dev | A | privacy-retention | unchanged PASS record | REVIEW_REQUIRED |
| D-A23 | dev | A | privacy-retention | unchanged PASS record | REVIEW_REQUIRED |
| D-A24 | held_out | A | privacy-boundary | unchanged PASS record | REVIEW_REQUIRED |
| D-O01 | dev | O | tool-live-price | unchanged PASS record | REVIEW_REQUIRED |
| D-O02 | dev | O | tool-live-availability | unchanged PASS record | REVIEW_REQUIRED |
| D-O03 | dev | O | tool-create-booking | unchanged PASS record | REVIEW_REQUIRED |
| D-O04 | dev | O | tool-pay-deposit | unchanged PASS record | REVIEW_REQUIRED |
| D-U01 | dev | U | service-identity | unchanged PASS record | REVIEW_REQUIRED |
| D-U02 | held_out | U | privacy-boundary | unchanged PASS record | REVIEW_REQUIRED |
| D-U03 | dev | U | amendment-lifecycle | unchanged PASS record | REVIEW_REQUIRED |
| D-U04 | dev | U | hotel-identity | unchanged PASS record | REVIEW_REQUIRED |
| D-U05 | dev | U | invoice-discount-scope | unchanged PASS record | REVIEW_REQUIRED |
| D-U06 | dev | U | amendment-finance | unchanged PASS record | REVIEW_REQUIRED |
| D-U07 | dev | U | booking-admission | unchanged PASS record | REVIEW_REQUIRED |
| D-U08 | dev | U | guest-age | unchanged PASS record | REVIEW_REQUIRED |
| D-U09 | dev | U | service-entitlements | unchanged PASS record | REVIEW_REQUIRED |
| D-U10 | dev | U | service-entitlements | unchanged PASS record | REVIEW_REQUIRED |
| D-U11 | dev | U | privacy-retention | unchanged PASS record | REVIEW_REQUIRED |
| D-U12 | held_out | U | guest-capacity | unchanged PASS record | REVIEW_REQUIRED |
| H-A01 | held_out | A | early-late-fees | unchanged PASS record | REVIEW_REQUIRED |
| H-A02 | held_out | A | early-late-fees | unchanged PASS record | REVIEW_REQUIRED |
| H-A03 | held_out | A | early-late-fees | unchanged PASS record | REVIEW_REQUIRED |
| H-A04 | held_out | A | early-late-fees | unchanged PASS record | REVIEW_REQUIRED |
| H-A05 | held_out | A | fee-refund-eligibility | unchanged PASS record | REVIEW_REQUIRED |
| H-A06 | held_out | A | cancellation-calendar | unchanged PASS record | REVIEW_REQUIRED |
| H-A07 | held_out | A | cancellation-valid-event | unchanged PASS record | REVIEW_REQUIRED |
| H-A08 | held_out | A | cancellation-valid-event | unchanged PASS record | REVIEW_REQUIRED |
| H-A09 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A10 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A11 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A12 | held_out | A | no-show | unchanged PASS record | REVIEW_REQUIRED |
| H-A13 | held_out | A | service-delivery-refund | F3 evidence | REVIEW_REQUIRED |
| H-A14 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A15 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A16 | held_out | A | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-A17 | held_out | A | pet-exceptions | unchanged PASS record | REVIEW_REQUIRED |
| H-A18 | held_out | A | pet-exceptions | unchanged PASS record | REVIEW_REQUIRED |
| H-A19 | held_out | A | pet-exceptions | unchanged PASS record | REVIEW_REQUIRED |
| H-A20 | held_out | A | complaint-completeness-sla | F2 family metadata | REVIEW_REQUIRED |
| H-A21 | held_out | A | complaint-completeness-sla | F2 family metadata | REVIEW_REQUIRED |
| H-A22 | held_out | A | complaint-completeness-sla | F2 family metadata + F4 evidence | REVIEW_REQUIRED |
| H-A23 | held_out | A | complaint-completeness-sla | F2 family metadata | REVIEW_REQUIRED |
| H-A24 | dev | A | early-departure | unchanged PASS record | REVIEW_REQUIRED |
| H-O01 | held_out | O | tool-private-booking | unchanged PASS record | REVIEW_REQUIRED |
| H-O02 | held_out | O | tool-cancel-booking | unchanged PASS record | REVIEW_REQUIRED |
| H-O03 | held_out | O | tool-execute-refund | unchanged PASS record | REVIEW_REQUIRED |
| H-O04 | held_out | O | tool-order-service | unchanged PASS record | REVIEW_REQUIRED |
| H-U01 | held_out | U | service-delivery-refund | unchanged PASS record | REVIEW_REQUIRED |
| H-U02 | held_out | U | hotel-house-rules | unchanged PASS record | REVIEW_REQUIRED |
| H-U03 | held_out | U | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-U04 | held_out | U | pet-exceptions | unchanged PASS record | REVIEW_REQUIRED |
| H-U05 | held_out | U | fee-refund-eligibility | unchanged PASS record | REVIEW_REQUIRED |
| H-U06 | held_out | U | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-U07 | held_out | U | cancellation-valid-event | unchanged PASS record | REVIEW_REQUIRED |
| H-U08 | held_out | U | complaint-completeness-sla | F2 family metadata | REVIEW_REQUIRED |
| H-U09 | held_out | U | pet-exceptions | unchanged PASS record | REVIEW_REQUIRED |
| H-U10 | held_out | U | service-delivery-refund | unchanged PASS record | REVIEW_REQUIRED |
| H-U11 | held_out | U | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| H-U12 | held_out | U | refund-evidence-workflow-ledger | F1 family metadata | REVIEW_REQUIRED |
| C01-P | calibration_only | accept_supported | C01 | unchanged PASS record | REVIEW_REQUIRED |
| C01-N | calibration_only | reject_unsupported | C01 | unchanged PASS record | REVIEW_REQUIRED |
| C02-P | calibration_only | accept_supported | C02 | unchanged PASS record | REVIEW_REQUIRED |
| C02-N | calibration_only | reject_unsupported | C02 | unchanged PASS record | REVIEW_REQUIRED |
| C03-P | calibration_only | accept_supported | C03 | unchanged PASS record | REVIEW_REQUIRED |
| C03-N | calibration_only | reject_unsupported | C03 | unchanged PASS record | REVIEW_REQUIRED |
| C04-P | calibration_only | accept_supported | C04 | unchanged PASS record | REVIEW_REQUIRED |
| C04-N | calibration_only | reject_unsupported | C04 | unchanged PASS record | REVIEW_REQUIRED |
| C05-P | calibration_only | accept_supported | C05 | unchanged PASS record | REVIEW_REQUIRED |
| C05-N | calibration_only | reject_unsupported | C05 | unchanged PASS record | REVIEW_REQUIRED |
| C06-P | calibration_only | accept_supported | C06 | unchanged PASS record | REVIEW_REQUIRED |
| C06-N | calibration_only | reject_unsupported | C06 | unchanged PASS record | REVIEW_REQUIRED |
| C07-P | calibration_only | accept_supported | C07 | unchanged PASS record | REVIEW_REQUIRED |
| C07-N | calibration_only | reject_unsupported | C07 | unchanged PASS record | REVIEW_REQUIRED |
| C08-P | calibration_only | accept_supported | C08 | unchanged PASS record | REVIEW_REQUIRED |
| C08-N | calibration_only | reject_unsupported | C08 | unchanged PASS record | REVIEW_REQUIRED |
| C09-P | calibration_only | accept_supported | C09 | unchanged PASS record | REVIEW_REQUIRED |
| C09-N | calibration_only | reject_unsupported | C09 | unchanged PASS record | REVIEW_REQUIRED |
| C10-P | calibration_only | accept_supported | C10 | unchanged PASS record | REVIEW_REQUIRED |
| C10-N | calibration_only | reject_unsupported | C10 | unchanged PASS record | REVIEW_REQUIRED |
