# Independent evaluation strategy — F5

Status: **PROPOSED — HUMAN DECISIONS REQUIRED**. No new questions, expected answers, dataset,
access grants, API run or freeze are created by this document.

The current 80 Gold cases and 20 public controls are **known regression data**. Their legacy
dev/held_out fields are partitions for regression analysis only. They cannot become blind by
renaming, moving records, hiding the folder later or deleting the exposure history.

## Roles and separation of duties

| Role | Responsibility | Conflict/access boundary |
| --- | --- | --- |
| Source content approver | Confirm approved synthetic scope, versions, validity and publication authority | Existing user approval is a source decision, not approval of future Gold |
| Independent question author | Write genuinely new source-supported questions and scenarios | Not a system tuner or current regression author; receives whole approved sources and public scope, not model outputs/retrieval ranks as truth |
| Two independent semantic reviewers | Separately verify labels, every required meaning, support alternatives, qualifiers and calculations | Neither approves their own authored cases; each records judgement before seeing the other review |
| Disagreement resolver | Adjudicate unresolved source/label/support/scope disputes with reasons | Independent of the disputed case author; consult content approver rather than inventing a policy |
| Evaluation custodian | Hold private artifacts, enforce access, run the authorized evaluation and retain evidence | No tuning role; raw queries/answers/logs are not shared with tuners |
| Tuning team | Build against public source contracts, mechanics fixtures and known regression data | Cannot read new questions, expected answers, private scenario inputs, labels or case-level evaluation traces |

Names, authority and conflict disclosures remain **unassigned**. Multiple roles may only be
combined after a human explicitly confirms no authorship/review/tuning conflict.

## Information barrier before authorship

1. A human chooses a private location outside this shared repository, worktree, chat and CI
   artifacts visible to the tuning team. An authorized private project/drive or custodian-held
   offline files may suffice for Academic Demo; no new infrastructure is required here.
2. The custodian records an access matrix. Authors, reviewers, resolver and runner have only
   the access they need. Tuners and assistants carrying the exposed regression context have
   no access to the new query/answer payloads.
3. Test allowed and denied access using the actual identities before storing cases. Record
   the result. A folder name, .gitignore, separate Git branch or a request not to look is
   not an access control. Do not claim isolation until that check is evidenced.
4. Private runner output, stdout, diagnostics, provider payload captures, dashboards and CI
   downloads must follow the same boundary. Publish only agreed aggregates and artifact
   identity commitments; do not leak cases through screenshots, error excerpts or debugging.

If the barrier or independent roles are unavailable, evaluation remains blocked. Do not put
a supposedly blind dataset in this repository as a shortcut.

## Source baseline and independent oracle

- Review the whole approved, effective synthetic policy corpus. Retain document/policy
  versions, source identity, checksums, dates, scope and approval records. Do not add facts
  merely because the current runtime can render them or a seed/database contains them.
- Pin the system/catalog/rules/templates and evaluation configuration before private question
  authoring for the final run, under a separately authorized future task. This document does
  not freeze anything. Question authors use source meaning, not offered facts, alias lists,
  model answers or retrieval top-k as an answer oracle.
- Record asOfDate/timezone and hypothetical inputs explicitly. Monetary examples must not
  become live quotes; source policy applicability, actual receipt evidence and bank completion
  cannot be invented. No real personal, booking or transaction records.
- Each record needs required meanings, mandatory qualifiers, forbidden inferences, A/U/O,
  proposed minimal support alternatives, source/version/paragraph/hash and a reasoned
  expected outcome. Local source anchors remain distinct from actual runtime citation IDs.
- Missing runtime vocabulary/facts does not change an answerable A into U. U requires a
  genuinely unresolved target; O requests an unavailable business action/live/private lookup.
  Errors/deadlines are separate from semantic abstention.

## Novelty and semantic-family sampling

The author creates no cases in this task. Future authors must not copy exposed queries or
controls, their direct paraphrases, cosmetic translations, number/date substitutions, or the
same scenario with a renamed guest. All 100 current records and all earlier exposed revisions
form the exclusion registry, not a pool to recycle.

The custodian or a separate overlap reviewer can see that registry and the private candidates;
the tuning team cannot see the private candidates. Check exact/normalized overlap first, then
human semantic overlap across intent, evaluated rule, scenario inputs, counterfactuals,
required meanings and expected decision. Lexical dissimilarity alone is insufficient.

Reusing an approved source rule is expected in closed-domain RAG. The intended measurement is
generalization to genuinely new questions/scenarios/compositions within that source scope,
not discovery of secret hotel facts. Declare any topic/semantic-family exclusion explicitly.
If the corpus cannot support enough novel cases, report the gap and seek a sampling/scope
decision; do not pad, manufacture facts or promise a quota.

Build families from the **evaluated decision rule and scenario**, including positive,
negative, missing-condition and paraphrase variants. Group receipt-readiness variants and
complaint first-complete/SLA variants together. Shared safety qualifiers alone do not prove
same-family membership, but every disputed boundary must be adjudicated.

Sample topic/risk/complexity and A/U/O before any measured results. Keep whole families in
one evaluator partition; do not split coupled rule variants to force equal counts. Review
actual conditions/claims, not just a multi-claim label. Record inclusion, exclusion and
sampling reasons. Existing 33/47 regression partitions are not a template or denominator
for the new independent evaluation.

## Review, adjudication and future freeze

1. Reviewers independently read source passages and the complete candidate. Check source
   correctness separately from technical identity; verify every claim-to-evidence binding.
2. Recalculate money, rounding, calendar days and business-day clocks independently. Check
   missing/contradictory inputs, service delivery, Reserved/Completed and citation subject.
3. Decide minimal support alternatives before retrieval is observed. Do not require duplicate
   units when one is sufficient, or add a support set after seeing rankings.
4. Each review record contains reviewer identity/role, decision, reasons, timestamp and
   source/dataset hashes. Disagreements remain unscorable until the resolver records a
   source-supported resolution. A model reviewing its own answer is not an independent oracle.
5. A human approves the source/Gold/sampling protocol and separately authorizes a future
   freeze. The custodian then records the private package identity, release/config pins and
   access attestations. No approval or freeze is granted by this proposal.
6. Only under separate ingestion/API authorization, bind reviewed source anchors to actual
   snapshot/chunk/citation IDs by source identity, not model output or retrieval rank. Check
   integrity again. No fake runtime IDs and no policy/catalog drift during the run.

## Execution, disclosure and retirement

Use the full agreed application path and unchanged evaluation definitions. Read the current
[PROCESS](../../../docs/PROCESS.md) and [EVALUATION](../../../docs/EVALUATION.md); do not
silently replace existing thresholds or denominators. Humans must sign the new sample size,
metrics, budget (including embeddings, generation, token counting and probes), stop policy
and run plan before any real call. This strategy authorizes no live operation.

The custodian runs the fixed system and keeps raw queries, outputs, citations, failures and
not-run records private for independent scoring. Review correctness, citation identity,
claim support, whole-question coverage, U/O behavior, false acceptance/abstention and
reliability separately. Report counts/denominators and predeclared aggregates; no selective
removal of hard or failed cases, retries or post-result Gold edits to improve a score.

Tuners receive no case-level feedback while a test remains active. If a case or scenario is
disclosed to fix a failure, it becomes exposed and can only be reused as regression evidence.
Retain the original run and decision history. A later blind evaluation needs independently
authored replacements and a new reviewed release; relabeling the old test is insufficient.

Before claiming independence, require evidence of: named nonconflicting roles, verified
access restrictions, reviewed source and Gold records, adjudicated family/novelty checks,
predeclared sampling/metrics, future package/config pins and an exposure log. Missing
evidence keeps that claim open.

## Deliverables deliberately absent from this task

No private questions or expected answers, no new blind dataset, no user/reviewer assignments,
no dataset approval/freeze, no access configuration, no API authorization and no live scores.
