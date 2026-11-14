"""One retrieval, at most two generation calls; no broker, continuation or business tools."""

import re

from app.diagnostics import Category, Operation, Phase, bind_budget, context, deadline, step
from app.prompts.faq import ANSWER, CLASSIFY
from app.providers.contracts import DependencyError, TurnBudget
from app.schemas.faq import GroundedAnswer, Intent


def public_text(text: str) -> str:
    text = re.sub(r"(?i)bearer\s+\S+|[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}", "[credential]", text)
    text = re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[contact]", text)
    return re.sub(r"(?<!\w)\+?\d[\d ()-]{8,}\d(?!\w)", "[contact]", text)


class Faq:
    def __init__(self, provider, index, mode):
        self.provider, self.index, self.mode = provider, index, mode

    async def run(self, payload):
        with context(operation=Operation.TURN, new=True), step(Phase.APPLICATION):
            return await self._run(payload)

    async def _run(self, payload):
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
                evidence = self.index.search(intent.query, payload.context.today)
                status, answer = "insufficient_evidence", "Chưa có đủ nguồn để trả lời câu hỏi này."
                if evidence:
                    with context(operation=Operation.ANSWER):
                        result = await self.provider.generate(
                            ANSWER,
                            {
                                "message": public_text(payload.message),
                                "query": intent.query,
                                "evidence": [e.model_dump() for e in evidence],
                            },
                            GroundedAnswer,
                            budget,
                        )
                    if result.supported:
                        registry = {e.citationId: e for e in evidence}
                        if (
                            not result.citationIds
                            or len(set(result.citationIds)) != len(result.citationIds)
                            or any(cid not in registry for cid in result.citationIds)
                        ):
                            raise DependencyError(
                                "AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA
                            )
                        selected = [
                            registry[cid].model_dump(exclude={"excerpt", "corpusMode"})
                            for cid in result.citationIds
                        ]
                        status, answer = "answered", result.answer
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
