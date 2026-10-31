# Recommendation evaluation (synthetic, provisional v1)

This directory evaluates three separate questions. It does not contain production rooms,
personal data, booking records, or a claim that either scorer is better in production.

| Track | Runner | What it measures | Dependency |
|---|---|---|---|
| A. Vietnamese extraction | `gemini_live.py` | Field SET/CLEAR, values, ambiguities, unsupported intent, latency, provider usage and errors | Gemini API; explicit opt-in only |
| B. Conversation | `offline.py` | Reference patch replay, state retention, status, backend call count, hard constraints, NO_MATCH vs technical errors | Synthetic fake extractor/backend |
| C. Ranking | `offline.py` | Baseline versus multi-criteria order on the exact same candidates and hard filters; nDCG@5 only for labeled cases | Synthetic room fixture |

## Files and schema

- `scenarios.jsonl`: 63 **synthetic** scenarios, each with `id`, `split`, `group`, `source`,
  `labelStatus`, `initialState`, `backend`, and a nonempty `turns` array. Each turn has
  `message`, `referencePatch` (`changes`, `ambiguities`, `unsupportedIntent`, optional
  `relaxationDecision`), `expectedStatus`, `expectedState` (explicit subset of caller state),
  and cumulative `expectedBackendCalls`. All labels are **provisional author proposals**.
- `rooms.json`: eight synthetic availability DTO candidates with varied price, capacity,
  amenity evidence and one missing amenity field. Room numbers use the `EVAL-` prefix.
  They are never combined with live Spring results. The fixture date is 10–12 November 2026.
- `ranking.json`: ten ranking requests, explicitly proposed eligible room IDs, optional
  relevance grades `0..3` for **every** eligible candidate, and a short rationale.
  Five cases have grades; five have `relevance: null`, so no nDCG is calculated there.

The two scenario splits are complete scenario units, including all turns. `dev-*` and
`test-*` contain different authored intents and combinations, not paired paraphrases.
The loader rejects duplicate IDs and invalid schema. Similarity between different
Vietnamese phrasings still needs manual review; the split is not a statistical guarantee.
No weights or prompts are adjusted using `heldout` results.

## Run offline

From `ai-service` after `pip install -e ".[dev]"`:

```powershell
.\.venv\Scripts\python.exe -m ai_service.evaluation.offline --split all --output evaluation/reports/offline.json
.\.venv\Scripts\python.exe -m ai_service.evaluation.offline --split heldout --output evaluation/reports/heldout.json
```

The report includes the current commit, scoring version and weights, dataset versions,
split and counts, per-group pass counts, failed turn IDs, hard-constraint violations,
NO_MATCH/technical-error confusions, and the complete ranking order for both scorers.
`nDCG@5` uses the manually proposed grades only; it is null when labels are absent.
`evaluation/reports/` is ignored so generated run artifacts are not accidentally committed.
An offline pass means the orchestrator handles *reference patches* correctly. It says
nothing about Gemini's extraction accuracy or live Spring/MySQL behavior.

## Review provisional labels

Before using metrics to choose a scorer, ask at least two reviewers who did not write
the scoring formula to inspect every held-out `referencePatch`, expected state/status,
eligible ID, and ranking relevance grade. Give them the Vietnamese utterance and the
synthetic room facts, but hide scorer orders. Record disagreement and adjudication in
a new version of the dataset; preserve this version for comparison. Check especially
dates without years, monetary basis, room area versus guest capacity, amenity evidence,
NO_MATCH relaxations, and cases where a relevance grade depends on unstated taste.
Do not claim superiority from these provisional labels or tune weights on held-out data.

## Opt in to real Gemini extraction

Set `GEMINI_API_KEY` in the process environment without putting it in a command line,
file, or report. The script never prints or stores the key. The following **makes paid
or quota-consuming API requests** and was not run when this evaluation package was built:

```powershell
.\.venv\Scripts\python.exe -m ai_service.evaluation.gemini_live --confirm-live-gemini --split dev --max-requests 10 --timeout-seconds 10 --min-interval-seconds 1 --output evaluation/reports/gemini-dev.json
```

The explicit flag and positive request cap are both mandatory. The cap counts attempts,
including failed calls, and cannot exceed 100. A 429 stops the run; timeouts and other
provider errors are recorded without being mistaken for wrong extraction. `usageMetadata`
is recorded only when the provider returns nonnegative integer counts. Latency is measured
per call. The script reports SET-field and CLEAR-field exact match separately,
combined field/action exact match, SET-value exact match,
ambiguity-set exact match and unsupported-intent exact match separately. Prior-turn state
is replayed from reference patches to isolate extraction, so this run is **not** an
end-to-end Gemini conversation accuracy estimate.

Spring/MySQL integration must be evaluated separately against an isolated backend
environment. No Spring or MySQL service is called by either evaluation script.
