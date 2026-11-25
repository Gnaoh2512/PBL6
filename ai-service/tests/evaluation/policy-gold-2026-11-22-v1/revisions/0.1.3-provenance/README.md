# Gold/Packet 0.1.3-provenance ? current checkout

Published 2026-11-24 for checkout provenance only. Known regression; exposed, not blind or frozen; pending_review, approved:false, scorable:false. All 80 Gold records and 20 controls are identical to 0.1.2, including historical scopeBasis and canonical record hashes. No question, answer, label, evidence, split, ID or review decision changes.

[Previous revision](../../README.md) and both history archives remain byte-for-byte unchanged. [manifest.json](manifest.json) pins current PROCESS/source bytes and separate currentScopeBindings for eight O records. Current bindings retain the same paths/ranges and add exact quote hashes; they are scope provenance, not hotel-answer evidence. Historical record pins are retained and checked against the previous manifest.

## Validation

Run from repository root with ai-service/.venv/Scripts/python.exe -X utf8 -B:

- [Gold validator](validate.py): all inherited source/paragraph/arithmetic/record/F1-F4 checks plus current provenance, unchanged complete records and production/demo routing.
- [Packet validator](human-review/validate.py): baseline pins, all 100 cards/hashes, register and empty ledger; current provenance checks are mandatory.
- [New Gold report](validation-0.1.3.json), [Packet report](packet-validation-0.1.3.json) and [history report](history-validation-0.1.3.json) are new artifacts, never replacements for validation.json from 23/11.

## Allowlist and runtime limits

Production excludes synthetic policies and rejects the Academic Demo pack. Default demo remains the D1 fixture. Only explicit demo_synthetic/academic_policies selects the ten approved synthetic publications. Validation reads literal tables and evaluates only the pure sources_for router in a restricted namespace; it does not import application, build an index, read .env or call any API/DB. Eligibility does not establish runtime snapshot/catalog binding or model quality.

## Historical reproducibility

All prior artifacts, checksums, cards and saved reports remain intact and are pinned in previousRevision.files. Current-checkout drift is recorded separately. The exact old snapshot.py bytes were recovered from Git (checksum matched). Two historical inputs, PROCESS.md and documents.py, are unavailable after a read-only Git history/archive search; original historical STATIC_PASS is not claimed rerunnable. The history report names the missing inputs. No past report is forged or reclassified.

## Human review remains required

100 NOT_REVIEWED records; no reviewers/resolver/custodian appointed, no approval/freeze/independent evaluation. F1-F4 and shared qualifier contexts still require human judgment. No ingestion, indexing, API/live evaluation or production release is performed.

## Complete review inventory

| Record | State |
| --- | --- |
| D-A01 | NOT_REVIEWED |
| D-A02 | NOT_REVIEWED |
| D-A03 | NOT_REVIEWED |
| D-A04 | NOT_REVIEWED |
| D-A05 | NOT_REVIEWED |
| D-A06 | NOT_REVIEWED |
| D-A07 | NOT_REVIEWED |
| D-A08 | NOT_REVIEWED |
| D-A09 | NOT_REVIEWED |
| D-A10 | NOT_REVIEWED |
| D-A11 | NOT_REVIEWED |
| D-A12 | NOT_REVIEWED |
| D-A13 | NOT_REVIEWED |
| D-A14 | NOT_REVIEWED |
| D-A15 | NOT_REVIEWED |
| D-A16 | NOT_REVIEWED |
| D-A17 | NOT_REVIEWED |
| D-A18 | NOT_REVIEWED |
| D-A19 | NOT_REVIEWED |
| D-A20 | NOT_REVIEWED |
| D-A21 | NOT_REVIEWED |
| D-A22 | NOT_REVIEWED |
| D-A23 | NOT_REVIEWED |
| D-A24 | NOT_REVIEWED |
| D-O01 | NOT_REVIEWED |
| D-O02 | NOT_REVIEWED |
| D-O03 | NOT_REVIEWED |
| D-O04 | NOT_REVIEWED |
| D-U01 | NOT_REVIEWED |
| D-U02 | NOT_REVIEWED |
| D-U03 | NOT_REVIEWED |
| D-U04 | NOT_REVIEWED |
| D-U05 | NOT_REVIEWED |
| D-U06 | NOT_REVIEWED |
| D-U07 | NOT_REVIEWED |
| D-U08 | NOT_REVIEWED |
| D-U09 | NOT_REVIEWED |
| D-U10 | NOT_REVIEWED |
| D-U11 | NOT_REVIEWED |
| D-U12 | NOT_REVIEWED |
| H-A01 | NOT_REVIEWED |
| H-A02 | NOT_REVIEWED |
| H-A03 | NOT_REVIEWED |
| H-A04 | NOT_REVIEWED |
| H-A05 | NOT_REVIEWED |
| H-A06 | NOT_REVIEWED |
| H-A07 | NOT_REVIEWED |
| H-A08 | NOT_REVIEWED |
| H-A09 | NOT_REVIEWED |
| H-A10 | NOT_REVIEWED |
| H-A11 | NOT_REVIEWED |
| H-A12 | NOT_REVIEWED |
| H-A13 | NOT_REVIEWED |
| H-A14 | NOT_REVIEWED |
| H-A15 | NOT_REVIEWED |
| H-A16 | NOT_REVIEWED |
| H-A17 | NOT_REVIEWED |
| H-A18 | NOT_REVIEWED |
| H-A19 | NOT_REVIEWED |
| H-A20 | NOT_REVIEWED |
| H-A21 | NOT_REVIEWED |
| H-A22 | NOT_REVIEWED |
| H-A23 | NOT_REVIEWED |
| H-A24 | NOT_REVIEWED |
| H-O01 | NOT_REVIEWED |
| H-O02 | NOT_REVIEWED |
| H-O03 | NOT_REVIEWED |
| H-O04 | NOT_REVIEWED |
| H-U01 | NOT_REVIEWED |
| H-U02 | NOT_REVIEWED |
| H-U03 | NOT_REVIEWED |
| H-U04 | NOT_REVIEWED |
| H-U05 | NOT_REVIEWED |
| H-U06 | NOT_REVIEWED |
| H-U07 | NOT_REVIEWED |
| H-U08 | NOT_REVIEWED |
| H-U09 | NOT_REVIEWED |
| H-U10 | NOT_REVIEWED |
| H-U11 | NOT_REVIEWED |
| H-U12 | NOT_REVIEWED |
| C01-P | NOT_REVIEWED |
| C01-N | NOT_REVIEWED |
| C02-P | NOT_REVIEWED |
| C02-N | NOT_REVIEWED |
| C03-P | NOT_REVIEWED |
| C03-N | NOT_REVIEWED |
| C04-P | NOT_REVIEWED |
| C04-N | NOT_REVIEWED |
| C05-P | NOT_REVIEWED |
| C05-N | NOT_REVIEWED |
| C06-P | NOT_REVIEWED |
| C06-N | NOT_REVIEWED |
| C07-P | NOT_REVIEWED |
| C07-N | NOT_REVIEWED |
| C08-P | NOT_REVIEWED |
| C08-N | NOT_REVIEWED |
| C09-P | NOT_REVIEWED |
| C09-N | NOT_REVIEWED |
| C10-P | NOT_REVIEWED |
| C10-N | NOT_REVIEWED |

## Reproduce release integrity

From repository root:

```powershell
.\ai-service\.venv\Scripts\python.exe -X utf8 -B ai-service/tests/evaluation/policy-gold-2026-11-22-v1/revisions/0.1.3-provenance/check_release.py
.\ai-service\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider ai-service/tests/evaluation/policy-gold-2026-11-22-v1/revisions/0.1.3-provenance/test_integrity.py
```

The integrity checker re-runs current validators and compares their complete JSON output with the new reports. History integrity is checked separately; it never impersonates an unavailable historical validator rerun.
