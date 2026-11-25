"""One retrieval, at most two generation calls; no broker, continuation or business tools."""

import re

from app.diagnostics import Category, Operation, Phase, bind_budget, context, deadline, step
from app.orchestration.verification.settings import GroundingConfig
from app.prompts.faq import CLASSIFY
from app.providers.contracts import DependencyError, TurnBudget
from app.schemas.faq import Intent


def public_text(text: str) -> str:
    text = re.sub(r"(?i)bearer\s+\S+|[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}", "[credential]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[contact]", text)
    return re.sub(r"(?<!\w)\+?\d[\d ()-]{8,}\d(?!\w)", "[contact]", text)


class Faq:
    def __init__(self, provider, index, mode, *, verification_gate=None, grounding_config=None):
        self.provider, self.index, self.mode = provider, index, mode
        self.verification_gate = verification_gate
        self.grounding_config = grounding_config or GroundingConfig()

    async def run(self, payload):
        with context(operation=Operation.TURN, new=True), step(Phase.APPLICATION):
            return await self._run(payload)

    async def _run(self, payload):
        if self.verification_gate is None:
            raise DependencyError()
        self.index.validate(payload.context.today)
        budget = TurnBudget(
            remaining_ms=payload.budget.remainingMs,
            input_limit=payload.budget.remainingInputTokens,
            output_limit=payload.budget.remainingOutputTokens,
        )
        bind_budget(budget)
        evidence, selected = [], []
        status, answer = "capability_unavailable", "Chức năng này chưa được hỗ trợ trong D1."
        async with deadline(budget.seconds()):
            with context(operation=Operation.CLASSIFY):
                intent = await self.provider.generate(
                    CLASSIFY,
                    {
                        "message": public_text(payload.message),
                        "history": [
                            {"role": m.role, "content": public_text(m.content)}
                            for m in payload.history
                        ],
                    },
                    Intent,
                    budget,
                )
            if intent.intent == "faq":
                if (
                    "search_knowledge" not in payload.allowedTools
                    or payload.budget.remainingToolCalls < 1
                ):
                    raise DependencyError(
                        "BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT
                    )
                retrieval_index = self.index
                if hasattr(self.index, "retrieve"):
                    batch = await self.index.retrieve(
                        public_text(intent.query), payload.context.today, budget
                    )
                    evidence = list(batch.evidence)
                    retrieval_index = batch
                else:
                    evidence = self.index.search(intent.query, payload.context.today)
                from app.orchestration.verification.runtime import verified_faq_answer

                return await verified_faq_answer(
                    self.verification_gate,
                    self.provider,
                    payload,
                    evidence,
                    intent.query,
                    budget,
                    retrieval_index,
                    self.mode,
                    self.grounding_config,
                )
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
                "toolCallsUsed": int(intent.intent == "faq"),
                "brokerBatchesUsed": 0,
                "inputTokensUsed": budget.input_used,
                "outputTokensUsed": budget.output_used,
            },
        }
