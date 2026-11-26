"""Turn orchestration: D1 verified FAQ + D2/D3 business/booking tools + D4 combined policy."""

import asyncio
import re
from types import SimpleNamespace

from app.diagnostics import Category, Operation, Phase, bind_budget, context, deadline, step
from app.orchestration.continuations import ContinuationStore
from app.orchestration.tools import (
    compose_combined_booking_policy,
    plan_business_turn,
    render_resume,
)
from app.orchestration.verification.settings import GroundingConfig
from app.prompts.faq import CLASSIFY
from app.prompts.tools import PLAN_TURN
from app.providers.contracts import DependencyError, TurnBudget
from app.schemas.faq import Intent
from app.schemas.turn import BookingList, ResumeTurn
from app.tools.schemas import TurnPlan

_BUSINESS_TOOLS = frozenset({"search_rooms", "list_services", "list_my_bookings", "get_my_booking"})
_PHONE_RE = re.compile(
    r"(?<!\w)(?!\d{4}-\d{2}-\d{2}(?!\w))(?!\d{2}-\d{2}-\d{4}(?!\w))\+?\d[\d ()-]{8,}\d(?!\w)"
)


def public_text(text: str) -> str:
    text = re.sub(r"(?i)bearer\s+\S+|[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}", "[credential]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[contact]", text)
    return _PHONE_RE.sub("[contact]", text)


_FORMULA_TOKEN_RE = re.compile(
    r"(?i)\b(?:a_room|a_other|a_bill|d_held|d_new|pol-\d{2}(?:-u\d{2})?)\b"
)


def _merge_retrieval_query(rewritten: str, original_redacted: str) -> str:
    """Preserve policy/formula identifiers from the redacted message if classifier dropped them."""
    if not rewritten.strip() or len(rewritten) > 1900:
        return rewritten
    rewritten_lower = rewritten.casefold()
    missing = [
        tok
        for tok in dict.fromkeys(_FORMULA_TOKEN_RE.findall(original_redacted))
        if tok.casefold() not in rewritten_lower
    ]
    if not missing:
        return rewritten
    return f"{rewritten} {' '.join(missing)}"


class Faq:
    def __init__(
        self,
        provider,
        index,
        mode,
        *,
        verification_gate=None,
        grounding_config=None,
        continuations: ContinuationStore | None = None,
    ):
        self.provider, self.index, self.mode = provider, index, mode
        self.verification_gate = verification_gate
        self.grounding_config = grounding_config or GroundingConfig()
        self.continuations = continuations or ContinuationStore()

    async def run(self, payload):
        with context(operation=Operation.TURN, new=True), step(Phase.APPLICATION):
            return await self._run(payload)

    async def resume(self, payload: ResumeTurn):
        with context(operation=Operation.TURN, new=True), step(Phase.APPLICATION):
            budget = TurnBudget(
                remaining_ms=payload.budget.remainingMs,
                input_limit=payload.budget.remainingInputTokens,
                output_limit=payload.budget.remainingOutputTokens,
            )
            bind_budget(budget)
            budget.seconds()
            entry = self.continuations.consume(
                continuation_id=payload.continuationId,
                conversation_id=payload.conversationId,
                turn_id=payload.turnId,
                tool_results=payload.toolResults,
            )
            if entry.policy_context is None:
                return render_resume(payload, self.mode)

            # Fail closed / short-circuit before policy retrieval if booking lookup failed or returned empty.
            if any(res.status == "error" for res in payload.toolResults):
                return render_resume(payload, self.mode)
            primary = payload.toolResults[0]
            if isinstance(primary.data, BookingList) and not primary.data.items:
                return render_resume(payload, self.mode)

            policy_ctx = entry.policy_context
            if self.verification_gate is None:
                raise DependencyError()
            if (
                "search_knowledge" not in policy_ctx.allowed_tools
                or payload.budget.remainingToolCalls < 1
            ):
                raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)

            await asyncio.to_thread(self.index.validate, policy_ctx.today)
            combined_policy_query = _merge_retrieval_query(
                public_text(policy_ctx.policy_query),
                public_text(policy_ctx.original_message),
            )
            async with deadline(budget.seconds()):
                retrieval_index = self.index
                if hasattr(self.index, "retrieve"):
                    batch = await self.index.retrieve(
                        combined_policy_query, policy_ctx.today, budget
                    )
                    evidence = list(batch.evidence)
                    retrieval_index = batch
                else:
                    evidence = await asyncio.to_thread(
                        self.index.search, combined_policy_query, policy_ctx.today
                    )
                from app.orchestration.verification.runtime import verified_faq_answer

                host_policy_payload = SimpleNamespace(
                    requestId=payload.requestId,
                    conversationId=payload.conversationId,
                    turnId=payload.turnId,
                    message=policy_ctx.original_message,
                    context=SimpleNamespace(today=policy_ctx.today),
                )
                policy_result = await verified_faq_answer(
                    self.verification_gate,
                    self.provider,
                    host_policy_payload,
                    evidence,
                    policy_ctx.policy_query,
                    budget,
                    retrieval_index,
                    self.mode,
                    self.grounding_config,
                )
            return compose_combined_booking_policy(primary, policy_result, payload, self.mode)

    async def _run(self, payload):
        if self.verification_gate is None:
            raise DependencyError()
        await asyncio.to_thread(self.index.validate, payload.context.today)
        budget = TurnBudget(
            remaining_ms=payload.budget.remainingMs,
            input_limit=payload.budget.remainingInputTokens,
            output_limit=payload.budget.remainingOutputTokens,
        )
        bind_budget(budget)
        evidence, selected = [], []
        status, answer = "capability_unavailable", "Chức năng này chưa được hỗ trợ trong D1."
        has_d2_tools = any(tool in _BUSINESS_TOOLS for tool in payload.allowedTools)
        redacted_history = [
            {"role": m.role, "content": public_text(m.content)} for m in payload.history
        ]
        async with deadline(budget.seconds()):
            with context(operation=Operation.CLASSIFY):
                if has_d2_tools:
                    plan = await self.provider.generate(
                        PLAN_TURN,
                        {
                            "message": public_text(payload.message),
                            "history": redacted_history,
                            "today": payload.context.today.isoformat(),
                            "allowedTools": list(payload.allowedTools),
                        },
                        TurnPlan,
                        budget,
                    )
                    intent_kind = plan.intent
                    query = plan.query
                else:
                    plan = None
                    intent = await self.provider.generate(
                        CLASSIFY,
                        {
                            "message": public_text(payload.message),
                            "history": redacted_history,
                        },
                        Intent,
                        budget,
                    )
                    intent_kind = intent.intent
                    query = intent.query

            if intent_kind == "faq":
                if (
                    "search_knowledge" not in payload.allowedTools
                    or payload.budget.remainingToolCalls < 1
                ):
                    raise DependencyError(
                        "BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT
                    )
                retrieval_index = self.index
                retrieval_query = _merge_retrieval_query(
                    public_text(query), public_text(payload.message)
                )
                if hasattr(self.index, "retrieve"):
                    batch = await self.index.retrieve(
                        retrieval_query, payload.context.today, budget
                    )
                    evidence = list(batch.evidence)
                    retrieval_index = batch
                else:
                    evidence = await asyncio.to_thread(
                        self.index.search, retrieval_query, payload.context.today
                    )
                from app.orchestration.verification.runtime import verified_faq_answer

                return await verified_faq_answer(
                    self.verification_gate,
                    self.provider,
                    payload,
                    evidence,
                    query,
                    budget,
                    retrieval_index,
                    self.mode,
                    self.grounding_config,
                )

            if plan is not None:
                return plan_business_turn(plan, payload, budget, self.continuations, self.mode)

        return {
            "requestId": payload.requestId,
            "conversationId": str(payload.conversationId),
            "turnId": str(payload.turnId),
            "kind": "final",
            "continuationId": None,
            "toolCalls": [],
            "final": {
                "status": status,
                "answer": answer,
                "missingFields": [],
                "citations": selected,
                "cards": [],
                "actions": [],
                "corpusMode": self.mode,
            },
            "evidence": [e.model_dump() for e in evidence],
            "usage": {
                "toolCallsUsed": int(intent_kind == "faq"),
                "brokerBatchesUsed": 0,
                "inputTokensUsed": budget.input_used,
                "outputTokensUsed": budget.output_used,
            },
        }
