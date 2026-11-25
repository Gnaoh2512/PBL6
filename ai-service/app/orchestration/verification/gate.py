"""Fail-closed, host-bound claim verification. No provider, prompt, or business I/O."""

import copy
import json
from dataclasses import dataclass, field

from pydantic import ValidationError

from app.diagnostics import Category
from app.providers.contracts import DependencyError, Evidence, TurnBudget
from app.schemas.verification import CandidateDraft, FactSelectionProposal, VerificationContext

from .calculator import evaluate_hypothetical_calculation
from .catalog import (
    VerifiedCatalog,
    _pairs,
    active,
    component_hashes,
    dependency,
    digest,
    value_key,
)
from .questions import bind_question

MAX_DRAFT_BYTES = 64 * 1024
ABSTENTION = "Chưa có đủ nguồn để trả lời câu hỏi này."


def protocol():
    return DependencyError("AI_PROTOCOL_ERROR", diagnostic_category=Category.RESPONSE_SCHEMA)


@dataclass(frozen=True)
class ClaimResult:
    claimId: str
    verdict: str
    reason: str


@dataclass(frozen=True)
class VerifiedFacts:
    contextHash: str
    catalogHash: str
    factIds: tuple[str, ...]
    _issuer: object = field(repr=False, compare=False)


@dataclass(frozen=True)
class VerificationResult:
    outcome: str
    reason: str
    claimResults: tuple[ClaimResult, ...] = ()
    verifiedFactSet: VerifiedFacts | None = None


def abstain(reason, claims=()):
    return VerificationResult("abstain", reason, tuple(claims))


def invalid(reason):
    return VerificationResult("invalid", reason)


def _scope_matches(fact, requirement):
    return (
        fact.subjectId == requirement.subjectId
        and set(fact.qualifierIds) == set(requirement.qualifierIds)
        and fact.unit == requirement.unit
        and fact.timeScope == requirement.timeScope
    )


class VerificationGate:
    def __init__(self, catalog: VerifiedCatalog):
        self.catalog = catalog

    def prepare(self, context, redacted_message, evidence, budget):
        return VerificationTurn(self.catalog, context, redacted_message, evidence, budget)


class VerificationTurn:
    """One host-created turn; verified permits are not serializable model certificates."""

    def __init__(
        self,
        catalog: VerifiedCatalog,
        context: VerificationContext,
        redacted_message: str,
        evidence,
        budget: TurnBudget,
    ):
        if (
            not isinstance(context, VerificationContext)
            or not isinstance(evidence, (list, tuple))
            or len(evidence) > 3
        ):
            raise protocol()
        self.catalog, self.context, self.budget = catalog, context, budget
        self._issuer, self._grant, self._source_stamp = object(), None, None
        self._context_hash = digest(context)
        try:
            self.registry = tuple(
                Evidence.model_validate_json(
                    json.dumps(
                        e.model_dump(mode="json") if isinstance(e, Evidence) else e,
                        ensure_ascii=False,
                    )
                )
                for e in evidence
            )
        except (ValueError, TypeError, ValidationError):
            raise protocol() from None
        self._check()
        self._by_id = {e.citationId: e for e in self.registry}
        self._redacted_message = redacted_message
        self.binding = bind_question(catalog, redacted_message)
        self._calculation = evaluate_hypothetical_calculation(self.binding.key, redacted_message)
        self._offered = {}
        self.preflight = self._prepare()

    @property
    def needs_candidate(self):
        return self.preflight is None

    @property
    def offered_fact_ids(self):
        return tuple(self._offered)

    def _check(self):
        self.budget.seconds()
        if (
            not 0 <= self.budget.input_used <= self.budget.input_limit
            or not 0 <= self.budget.output_used <= self.budget.output_limit
            or not 0 <= self.budget.calls <= 2
        ):
            raise DependencyError("BUDGET_EXCEEDED", diagnostic_category=Category.BUDGET_LIMIT)
        ctx, data = self.context, self.catalog.data
        if (
            digest(ctx) != self._context_hash
            or ctx.registryTurnId != ctx.turnId
            or ctx.registryHash != digest([e.model_dump(mode="json") for e in self.registry])
            or ctx.catalogHash != self.catalog.expected_hash
            or (ctx.vocabularyHash, ctx.questionRulesHash, ctx.rendererHash)
            != component_hashes(data)
            or (ctx.mode, ctx.snapshotId) != (data.mode, data.snapshotId)
            or len(self.registry) > 3
            or len({e.citationId for e in self.registry}) != len(self.registry)
        ):
            raise protocol()
        actual = self.catalog.check_current()
        current = {}
        for evidence in self.registry:
            source = actual.get((evidence.documentId, evidence.version))
            if (
                source is None
                or source.approval.status != "approved"
                or not active(source.validity, ctx.asOfDate)
            ):
                raise dependency()
            if (source.snapshotId, source.sourceRef, evidence.corpusMode) != (
                ctx.snapshotId,
                evidence.sourceRef,
                ctx.mode,
            ):
                raise dependency()
            current[(source.documentId, source.sourceVersion)] = source
        stamp = digest(
            [current[key].model_dump(mode="json", by_alias=True) for key in sorted(current)]
        )
        if self._source_stamp is not None and self._source_stamp != stamp:
            raise dependency()
        self._source_stamp = stamp
        self._sources = actual
        self.budget.seconds()

    def _available(self, fact):
        for binding in fact.provenance.bindings:
            evidence = self._by_id.get(binding.citationId)
            if evidence is None or (binding.documentId, binding.sourceVersion) != (
                evidence.documentId,
                evidence.version,
            ):
                return False
            source = self._sources[(evidence.documentId, evidence.version)]
            if (
                (binding.chunkId, binding.sectionId, binding.sourceRef, binding.snapshotId)
                != (
                    evidence.chunkId,
                    evidence.sectionId,
                    evidence.sourceRef,
                    self.context.snapshotId,
                )
                or binding.sourceSha256 != source.sourceSha256
                or binding.excerptSha256 != digest(evidence.excerpt.encode())
                or any(end > len(evidence.excerpt) for _, end in binding.spans)
            ):
                raise dependency()
        return True

    def _prepare(self):
        if not self.registry:
            return abstain("empty_evidence")
        if self.binding.status != "bound":
            return abstain(self.binding.reason)
        if self._calculation.status == "abstain":
            return abstain(self._calculation.reason)
        for evidence in self.registry:
            sha = self.catalog.data.reviewedChunkHashes.get(evidence.citationId)
            if sha is not None and sha != digest(evidence.excerpt.encode()):
                raise dependency()
            if (
                sha is None
                or self.catalog.data.reviewDeclarations.get(evidence.citationId) != "complete"
            ):
                return abstain("unknown")
        source_missing = set()
        for fact in self.catalog.data.facts:
            if fact.approval.status == "approved" and active(fact.validity, self.context.asOfDate):
                if self._available(fact):
                    self._offered[fact.factId] = fact
                else:
                    source_missing.add(fact.factKey)
        for requirement in self.binding.requirements:
            related = [f for f in self._offered.values() if f.factKey == requirement.factKey]
            matching = [f for f in related if _scope_matches(f, requirement)]
            if not matching:
                return abstain(
                    "source_version_unavailable"
                    if requirement.factKey in source_missing
                    else "fact_ineligible"
                )
            if len(matching) != len(related):
                return abstain("unknown")  # No general condition/interval entailment solver.
            if any(self.catalog.predicates[f.predicate].cardinality != "single" for f in matching):
                return abstain("unknown")
            if len({value_key(f.value) for f in matching}) > 1:
                return abstain("contradicted")
        return None

    def _expand_selection(
        self, proposal: FactSelectionProposal
    ) -> tuple[CandidateDraft | None, VerificationResult | None]:
        """Validate a slim FactSelectionProposal strictly before synthesizing internal claims.

        Never auto-fills missing requirements or accepts IDs outside this turn's offeredFacts.
        """
        if proposal.decision == "abstain":
            return None, abstain("model_abstained")
        selected_by_key = {}
        seen_ids = set()
        for fid in proposal.factIds:
            if fid in seen_ids or fid not in self._offered:
                return None, invalid("schema_invalid")
            seen_ids.add(fid)
            fact = self._offered[fid]
            if (
                fact.approval.status != "approved"
                or not active(fact.validity, self.context.asOfDate)
                or not self.catalog.proposition_known(fact)
            ):
                return None, abstain("fact_ineligible")
            if not self._available(fact):
                return None, abstain("source_version_unavailable")
            if fact.factKey not in self.binding.permitted_keys:
                return None, abstain("outside_question_binding")
            if fact.factKey in selected_by_key:
                return None, invalid("schema_invalid")
            selected_by_key[fact.factKey] = fact
        if any(r.factKey not in selected_by_key for r in self.binding.requirements):
            return None, abstain("missing_claim_coverage")
        ordered_keys = [r.factKey for r in self.binding.requirements]
        if set(selected_by_key) - set(ordered_keys):
            return None, abstain("unknown")
        claims = []
        for idx, requirement in enumerate(self.binding.requirements, start=1):
            fact = selected_by_key[requirement.factKey]
            if not _scope_matches(fact, requirement):
                return None, abstain("fact_ineligible")
            claims.append(
                {
                    "claimId": f"sel-{idx}",
                    "factId": fact.factId,
                    "subjectId": fact.subjectId,
                    "predicate": fact.predicate,
                    "value": fact.value.model_dump(mode="json", by_alias=True),
                    "unit": fact.unit,
                    "qualifierIds": list(fact.qualifierIds),
                    "timeScope": fact.timeScope.model_dump(mode="json", by_alias=True),
                    "supportRefs": [
                        {"citationId": b.citationId, "bindingId": b.bindingId}
                        for b in fact.provenance.bindings
                    ],
                }
            )
        draft = CandidateDraft.model_validate_json(
            json.dumps(
                {
                    "schemaVersion": "d1-claim-proposal-2",
                    "decision": "propose_answer",
                    "claims": claims,
                },
                ensure_ascii=False,
            )
        )
        return draft, None

    def verify(self, raw_candidate) -> VerificationResult:
        self._grant = None
        self._check()
        if self.preflight is not None:
            return self.preflight
        try:
            if isinstance(raw_candidate, (CandidateDraft, FactSelectionProposal)):
                raw = raw_candidate.model_dump_json(by_alias=True).encode()
            elif isinstance(raw_candidate, bytes):
                raw = raw_candidate
            elif isinstance(raw_candidate, str):
                raw = raw_candidate.encode()
            else:
                raw = json.dumps(raw_candidate, ensure_ascii=False, allow_nan=False).encode()
            if len(raw) > MAX_DRAFT_BYTES:
                return invalid("schema_invalid")
            parsed_obj = json.loads(raw, object_pairs_hook=_pairs)
            if not isinstance(parsed_obj, dict):
                return invalid("schema_invalid")
            schema_ver = parsed_obj.get("schemaVersion")
            if schema_ver == "d1-fact-selection-1":
                selection = FactSelectionProposal.model_validate_json(raw)
                candidate, early = self._expand_selection(selection)
                if early is not None:
                    return early
            else:
                candidate = CandidateDraft.model_validate_json(raw)
        except (ValueError, TypeError, ValidationError):
            return invalid("schema_invalid")
        if candidate.decision == "abstain":
            return abstain("model_abstained")
        allowed_bindings = {
            b.bindingId: b for f in self._offered.values() for b in f.provenance.bindings
        }
        for claim in candidate.claims:
            if claim.factId not in self._offered or not self.catalog.proposition_known(claim):
                return invalid("schema_invalid")
            for ref in claim.supportRefs:
                binding = allowed_bindings.get(ref.bindingId)
                if ref.citationId not in self._by_id:
                    return invalid("citation_invalid")
                if binding is None or binding.citationId != ref.citationId:
                    return invalid("support_ref_invalid")
        claims_by_key = {}
        for claim in candidate.claims:
            key = self._offered[claim.factId].factKey
            if key not in self.binding.permitted_keys:
                return abstain("outside_question_binding")
            if key in claims_by_key:
                return invalid("schema_invalid")  # Basic profile supports single-valued keys.
            claims_by_key[key] = claim
        if any(r.factKey not in claims_by_key for r in self.binding.requirements):
            return abstain("missing_claim_coverage")
        ordered_keys = [r.factKey for r in self.binding.requirements]
        if set(claims_by_key) - set(ordered_keys):
            return abstain("unknown")  # Optional keys need their own explicit scope rules.
        results, fact_ids = [], []
        for key in ordered_keys:
            claim = claims_by_key[key]
            fact = self._offered[claim.factId]
            reason = self._support(claim, fact)
            verdict = (
                "supported"
                if reason == "all_supported"
                else reason
                if reason in {"contradicted", "unknown"}
                else "unsupported"
            )
            results.append(ClaimResult(claim.claimId, verdict, reason))
            fact_ids.append(fact.factId)
        failed = next((r for r in results if r.verdict != "supported"), None)
        self._check()
        if failed:
            return abstain(failed.reason, results)
        self._grant = VerifiedFacts(
            self._context_hash, self.catalog.expected_hash, tuple(fact_ids), self._issuer
        )
        return VerificationResult("verified", "all_supported", tuple(results), self._grant)

    @staticmethod
    def _support(claim, fact):
        if {(r.citationId, r.bindingId) for r in claim.supportRefs} != {
            (b.citationId, b.bindingId) for b in fact.provenance.bindings
        }:
            return "support_binding_mismatch"
        if (claim.subjectId, claim.predicate) != (fact.subjectId, fact.predicate):
            return "unknown"
        if set(claim.qualifierIds) != set(fact.qualifierIds):
            return "qualifier_mismatch"
        if claim.unit != fact.unit:
            return "unit_mismatch"
        if claim.timeScope != fact.timeScope:
            return "time_scope_mismatch"
        return (
            "all_supported" if value_key(claim.value) == value_key(fact.value) else "contradicted"
        )

    def final_payload(self, candidate=None):
        """Host adapter to the existing FAQ final/error contract; never invokes a provider."""
        from .renderer import render

        result = self.verify(candidate)
        if result.outcome == "invalid":
            raise protocol()
        answer, citations = ABSTENTION, []
        if result.outcome == "verified":
            released = render(self, result)
            if released is not None:
                answer, citations = released
                if self._calculation.status == "computed" and self._calculation.rendered:
                    combined = f"{answer} {self._calculation.rendered}"
                    if len(combined) <= 4000 and len(combined.encode("utf-16-le")) // 2 <= 4000:
                        answer = combined
                    else:
                        answer, citations = ABSTENTION, []
                        result = abstain("render_limit")
            else:
                result = abstain("render_limit")
        self._check()
        return {
            "requestId": self.context.requestId,
            "conversationId": self.context.conversationId,
            "turnId": self.context.turnId,
            "kind": "final",
            "continuationId": None,
            "toolCalls": [],
            "final": {
                "status": "answered" if result.outcome == "verified" else "insufficient_evidence",
                "answer": answer,
                "missingFields": [],
                "citations": citations,
                "cards": [],
                "actions": [],
                "corpusMode": self.context.mode,
            },
            "evidence": [copy.deepcopy(e.model_dump()) for e in self.registry],
            "usage": {
                "toolCallsUsed": 1,
                "brokerBatchesUsed": 0,
                "inputTokensUsed": self.budget.input_used,
                "outputTokensUsed": self.budget.output_used,
            },
        }
