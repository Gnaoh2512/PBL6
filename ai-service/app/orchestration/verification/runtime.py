"""Mandatory FAQ verification; publication pins and source readers remain host-owned."""

import json

from app.diagnostics import Operation, context, diagnostic_identity
from app.prompts.verified_faq import ANSWER, ANSWER_FACT_SELECTION
from app.schemas.verification import CandidateDraft, FactSelectionProposal, VerificationContext

from .assembly import assemble
from .catalog import component_hashes, digest


async def verified_faq_answer(
    gate, provider, payload, evidence, query, budget, index, mode, config=None
):
    # These IDs and hashes are bound by the host; none is accepted from model output.
    from app.orchestration.faq import public_text

    from .settings import GroundingConfig

    config = config or GroundingConfig()
    snapshot_id = index.snapshot_id
    if not evidence and snapshot_id is None:
        # An empty query has no retrieval snapshot. No fact can be released here;
        # validate the current catalog/source release before the empty abstention.
        snapshot_id = gate.catalog.data.snapshotId
    evidence = assemble(
        gate,
        evidence,
        mode=mode,
        snapshot_id=snapshot_id,
        today=payload.context.today,
        max_evidence=config.max_evidence,
    )

    vocabulary_hash, rules_hash, renderer_hash = component_hashes(gate.catalog.data)
    host_context = VerificationContext.model_validate_json(
        json.dumps(
            {
                "requestId": payload.requestId,
                "conversationId": str(payload.conversationId),
                "turnId": str(payload.turnId),
                "diagnosticId": diagnostic_identity()[0],
                "registryTurnId": str(payload.turnId),
                "asOfDate": payload.context.today.isoformat(),
                "mode": mode,
                "snapshotId": snapshot_id,
                "registryHash": digest([e.model_dump(mode="json") for e in evidence]),
                "catalogHash": gate.catalog.expected_hash,
                "vocabularyHash": vocabulary_hash,
                "questionRulesHash": rules_hash,
                "rendererHash": renderer_hash,
            }
        )
    )
    turn = gate.prepare(host_context, public_text(payload.message), evidence, budget)
    candidate = None
    if turn.needs_candidate:
        use_selection = config.proposal_mode == "fact_selection"
        facts = []
        for fid in turn.offered_fact_ids:
            fact = gate.catalog.facts[fid]
            if fact.factKey not in turn.binding.permitted_keys:
                continue
            proposal = fact.model_dump(
                mode="json",
                by_alias=True,
                include={
                    "factId",
                    "factKey",
                    "subjectId",
                    "predicate",
                    "value",
                    "unit",
                    "qualifierIds",
                    "timeScope",
                },
            )
            if not use_selection:
                proposal["supportRefs"] = [
                    {"bindingId": b.bindingId, "citationId": b.citationId}
                    for b in fact.provenance.bindings
                ]
            facts.append(proposal)
        instruction = ANSWER_FACT_SELECTION if use_selection else ANSWER
        proposal_schema = FactSelectionProposal if use_selection else CandidateDraft
        with context(operation=Operation.ANSWER):
            previous = budget.per_call_input_limit
            budget.per_call_input_limit = min(
                config.context_input_tokens, budget.input_limit - budget.input_used
            )
            try:
                candidate = await provider.generate(
                    instruction,
                    {
                        "message": public_text(payload.message),
                        "query": query,
                        "evidence": [e.model_dump() for e in evidence],
                        "offeredFacts": facts,
                        "requiredFactKeys": [r.factKey for r in turn.binding.requirements],
                    },
                    proposal_schema,
                    budget,
                )
            finally:
                budget.per_call_input_limit = previous
    return turn.final_payload(candidate)
