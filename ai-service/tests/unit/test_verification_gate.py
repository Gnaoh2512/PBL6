import copy

import pytest
from verification_support import TL, TT, fixture

from app.orchestration.verification.catalog import digest
from app.orchestration.verification.gate import ABSTENTION, VerificationGate
from app.orchestration.verification.renderer import render
from app.providers.contracts import DependencyError, TurnBudget


def prepare(f, question="L", *, registry=None, context=None, budget=None):
    registry = f.evidence if registry is None else registry
    context = f.context(registryHash=digest(registry)) if context is None else context
    budget = TurnBudget() if budget is None else budget
    message = next(r["aliases"][0] for r in f.data["questionRules"] if r["bindingKey"] == question)
    return VerificationGate(f.load()).prepare(context, message, registry, budget)


def test_verified_fact_rendering_uses_canonical_catalog_and_existing_envelope():
    f = fixture()
    turn = prepare(f)
    turn.budget.record(10, 5)
    turn.budget.record(10, 5)
    before = (turn.budget.started, turn.budget.calls)
    result = turn.final_payload(f.proposal("F_L"))
    assert result["final"]["status"] == "answered" and result["final"]["answer"] == TL
    assert [c["citationId"] for c in result["final"]["citations"]] == ["CL"]
    assert set(result) == {
        "requestId",
        "conversationId",
        "turnId",
        "kind",
        "continuationId",
        "toolCalls",
        "final",
        "evidence",
        "usage",
    }
    assert result["usage"] == {
        "toolCallsUsed": 1,
        "brokerBatchesUsed": 0,
        "inputTokensUsed": 20,
        "outputTokensUsed": 10,
    }
    assert (turn.budget.started, turn.budget.calls) == before


@pytest.mark.parametrize("status", ["pending_review", "rejected", "revoked", "expired", "future"])
def test_ineligible_fact_in_healthy_catalog_abstains_before_draft(status):
    f = fixture()
    fact = f.data["facts"][0]
    if status == "expired":
        fact["validity"]["validThrough"] = "2026-11-12"
    elif status == "future":
        fact["validity"]["validFrom"] = "2026-11-14"
    else:
        fact["approval"]["status"] = status
    f.publish()
    turn = prepare(f)
    assert not turn.needs_candidate and "F_L" not in turn.offered_fact_ids
    assert turn.preflight.reason == "fact_ineligible"
    assert turn.final_payload()["final"]["answer"] == ABSTENTION


@pytest.mark.parametrize("field", ["validFrom", "validThrough"])
def test_fact_validity_boundaries_are_inclusive(field):
    f = fixture()
    f.data["facts"][0]["validity"][field] = "2026-11-13"
    f.publish()
    assert prepare(f).final_payload(f.proposal("F_L"))["final"]["answer"] == TL


@pytest.mark.parametrize(
    "mutation,reason",
    [
        ("pair", "support_ref_invalid"),
        ("unknown", "citation_invalid"),
        ("extra", "schema_invalid"),
        ("missing", "schema_invalid"),
        ("legacy", "schema_invalid"),
    ],
)
def test_protocol_faults_do_not_turn_into_semantic_refusal(mutation, reason):
    f = fixture()
    p = f.proposal("F_L")
    if mutation == "pair":
        p["claims"][0]["supportRefs"] = [{"citationId": "CL", "bindingId": "BW"}]
    elif mutation == "unknown":
        p["claims"][0]["supportRefs"][0]["citationId"] = "missing"
    elif mutation == "extra":
        p["claims"].append({"claimId": "extra", "text": "Unverified fact"})
    elif mutation == "missing":
        p["claims"][0].pop("supportRefs")
    else:
        p = {"supported": True, "answer": "Unverified fact", "citationIds": ["CL"]}
    turn = prepare(f)
    result = turn.verify(p)
    assert result.outcome == "invalid" and result.reason == reason
    assert result.claimResults == () and result.verifiedFactSet is None
    with pytest.raises(DependencyError) as error:
        turn.final_payload(p)
    assert error.value.code == "AI_PROTOCOL_ERROR"


@pytest.mark.parametrize(
    "mutation,reason",
    [
        ("wrong_fact", "support_binding_mismatch"),
        ("qualifier", "qualifier_mismatch"),
        ("unit", "unit_mismatch"),
        ("time", "time_scope_mismatch"),
        ("value", "contradicted"),
    ],
)
def test_well_formed_unsupported_claims_never_release_draft(mutation, reason):
    f = fixture()
    is_duration = mutation in {"unit", "time"}
    p = f.proposal("F_T" if is_duration else "F_L")
    claim = p["claims"][0]
    if mutation == "wrong_fact":
        claim["supportRefs"] = [{"citationId": "CW", "bindingId": "BW"}]
    elif mutation == "qualifier":
        claim["qualifierIds"] = []
    elif mutation == "unit":
        claim["value"]["data"], claim["unit"] = "1", "hour"
    elif mutation == "time":
        claim["timeScope"] = {"kind": "rolling_duration", "amount": "24", "unit": "hour"}
    else:
        claim["value"]["data"] = True
    turn = prepare(f, "T" if is_duration else "L")
    result = turn.verify(p)
    assert result.outcome == "abstain" and result.reason == reason
    final = turn.final_payload(p)["final"]
    assert final["answer"] == ABSTENTION and final["citations"] == []


def test_partial_coverage_or_partial_support_rejects_whole_answer_and_orders_verified_facts():
    f = fixture()
    turn = prepare(f, "LT")
    assert turn.verify(f.proposal("F_L")).reason == "missing_claim_coverage"
    p = f.proposal("F_L", "F_T")
    p["claims"][1]["supportRefs"] = [{"citationId": "CW", "bindingId": "BW"}]
    result = turn.verify(p)
    assert [r.verdict for r in result.claimResults] == ["supported", "unsupported"]
    assert result.outcome == "abstain" and result.verifiedFactSet is None
    final = turn.final_payload(f.proposal("F_T", "F_L"))["final"]
    assert final["answer"] == TL + " " + TT
    assert [c["citationId"] for c in final["citations"]] == ["CL", "CT"]


def test_wrong_question_unknown_empty_unreviewed_and_model_abstention_are_distinct():
    f = fixture()
    turn = prepare(f)
    assert turn.verify(f.proposal("F_W")).reason == "outside_question_binding"
    assert turn.verify(f.proposal()).reason == "model_abstained"
    assert prepare(f, registry=[]).preflight.reason == "empty_evidence"
    gate = VerificationGate(f.load())
    unknown = gate.prepare(f.context(), "jacuzzi", f.evidence, TurnBudget())
    assert not unknown.needs_candidate and unknown.preflight.reason == "question_unbound"
    f.data["reviewDeclarations"]["CL"] = "partial"
    f.publish()
    assert prepare(f).preflight.reason == "unknown"


def test_source_or_catalog_drift_is_dependency_failure_not_insufficient_evidence():
    f = fixture()
    turn = prepare(f)
    verified = turn.verify(f.proposal("F_L"))
    f.source_state[0]["approval"]["status"] = "revoked"
    with pytest.raises(DependencyError) as error:
        render(turn, verified)
    assert error.value.code == "DEPENDENCY_UNAVAILABLE"
    f = fixture()
    turn = prepare(f)
    verified = turn.verify(f.proposal("F_L"))
    f.raw += b" "
    with pytest.raises(DependencyError):
        render(turn, verified)


def test_verification_permit_is_bound_single_use_and_not_a_model_certificate():
    f = fixture()
    turn, other = prepare(f), prepare(f)
    result = turn.verify(f.proposal("F_L"))
    with pytest.raises(DependencyError):
        render(other, result)
    assert render(turn, result)[0] == TL
    with pytest.raises(DependencyError):
        render(turn, result)
    old = turn.verify(f.proposal("F_L"))
    turn.verify({"supported": True})
    with pytest.raises(DependencyError):
        render(turn, old)


def test_renderer_checks_utf16_limit_and_never_truncates_qualifiers():
    f = fixture()
    f.data["templates"][0]["segments"].insert(
        0, {"kind": "literal", "text": "😀" * 2001, "qualifierId": None}
    )
    f.publish()
    final = prepare(f).final_payload(f.proposal("F_L"))["final"]
    assert final["status"] == "insufficient_evidence" and final["citations"] == []
    assert "😀" not in final["answer"]


def test_deadline_and_budget_errors_are_not_swallowed(monkeypatch):
    import app.providers.contracts as contracts

    f = fixture()
    now = [0.0]
    monkeypatch.setattr(contracts, "monotonic", lambda: now[0])
    budget = TurnBudget(started=0.0)
    turn = prepare(f, budget=budget)
    now[0] = 21
    with pytest.raises(DependencyError) as error:
        turn.verify(f.proposal("F_L"))
    assert error.value.code == "DEADLINE_EXCEEDED"
    now[0] = 0
    budget.input_used = budget.input_limit + 1
    with pytest.raises(DependencyError) as error:
        turn.final_payload(f.proposal("F_L"))
    assert error.value.code == "BUDGET_EXCEEDED"


def test_conflicting_sources_cannot_be_resolved_by_model_selection_or_rank():
    f = fixture()
    text = "Trong demo, có nhận hành lý chứa vật dễ cháy."
    source, fact, template = [
        copy.deepcopy(f.data[key][0]) for key in ("sources", "facts", "templates")
    ]
    source.update(documentId="X", sourceSha256=digest(text.encode()))
    fact.update(factId="F_X", value={"kind": "boolean", "data": True})
    binding = fact["provenance"]["bindings"][0]
    binding.update(
        bindingId="BX",
        factId="F_X",
        documentId="X",
        citationId="CX",
        chunkId="CX",
        sectionId="X",
        sourceSha256=source["sourceSha256"],
        excerptSha256=digest(text.encode()),
        spans=[[0, len(text)]],
    )
    template.update(
        key="X",
        valueLabels=[
            {"value": {"kind": "boolean", "data": True}, "text": "có nhận hành lý chứa vật dễ cháy"}
        ],
    )
    fact["renderer"]["key"] = "X"
    f.data["sources"].append(source)
    f.data["facts"].append(fact)
    f.data["templates"].append(template)
    f.data["vocabulary"]["qualifiers"][0]["supportBindingIds"].append("BX")
    extra = copy.deepcopy(f.evidence[0])
    extra.update(documentId="X", citationId="CX", chunkId="CX", sectionId="X", excerpt=text)
    f.evidence = [f.evidence[0], extra]
    f.data["reviewedChunkHashes"]["CX"] = digest(text.encode())
    f.data["reviewDeclarations"]["CX"] = "complete"
    f.publish()
    turn = prepare(f)
    assert not turn.needs_candidate and turn.preflight.reason == "contradicted"
    assert turn.final_payload()["final"]["citations"] == []
    fact["validity"]["validThrough"] = "2026-10-31"
    f.publish()
    assert prepare(f).final_payload(f.proposal("F_L"))["final"]["answer"] == TL


def test_healthy_archived_version_is_unavailable_support_not_dependency_outage():
    f = fixture()
    actual_current = copy.deepcopy(f.source_state)
    f.data["sources"][0]["sourceVersion"] = "0.9.0"
    f.data["facts"][0]["provenance"]["bindings"][0]["sourceVersion"] = "0.9.0"
    f.publish()
    f.source_state = actual_current  # Separately provided host view, still version 1.0.0.
    turn = prepare(f)
    assert not turn.needs_candidate
    assert turn.preflight.reason == "source_version_unavailable"


def test_g20_wrong_approved_semantics_can_pass_consistency_but_fail_human_gold():
    f = fixture()
    f.data["facts"][0]["value"]["data"] = True
    label = f.data["templates"][0]["valueLabels"][0]
    label.update(value={"kind": "boolean", "data": True}, text="có nhận hành lý chứa vật dễ cháy")
    f.publish()  # Intentionally WRONG human review, but internally correct stamps.
    final = prepare(f).final_payload(f.proposal("F_L"))["final"]
    assert final["status"] == "answered"
    assert final["answer"] == "Trong demo, có nhận hành lý chứa vật dễ cháy."
    assert f.evidence[0]["excerpt"] == TL  # Independent semantic gold contradicts the answer.


@pytest.mark.parametrize(
    "field,value",
    [
        ("registryTurnId", "other-turn"),
        ("registryHash", "0" * 64),
        ("catalogHash", "0" * 64),
        ("vocabularyHash", "0" * 64),
        ("questionRulesHash", "0" * 64),
        ("rendererHash", "0" * 64),
    ],
)
def test_context_binding_mismatch_is_protocol_error(field, value):
    f = fixture()
    with pytest.raises(DependencyError) as error:
        prepare(f, context=f.context(**{field: value}))
    assert error.value.code == "AI_PROTOCOL_ERROR"


def test_duplicate_raw_json_and_renderer_from_unverified_result_are_rejected():
    f = fixture()
    turn = prepare(f)
    assert turn.verify('{"decision":"abstain","decision":"propose_answer"}').outcome == "invalid"
    with pytest.raises(DependencyError):
        render(turn, turn.verify(f.proposal()))


def test_multi_valued_rules_without_explicit_exclusion_solver_fail_closed():
    f = fixture()
    f.data["vocabulary"]["predicates"][0]["cardinality"] = "multi"
    f.publish()
    assert prepare(f).preflight.reason == "unknown"


def test_optional_key_without_requirement_scope_is_not_implicitly_verified():
    f = fixture()
    f.data["questionRules"][0]["permittedFactKeys"].append("W")
    f.publish()
    assert prepare(f).verify(f.proposal("F_L", "F_W")).reason == "unknown"


def test_dependency_reader_cancellation_and_unexpected_failures_propagate():
    import asyncio

    f = fixture()
    catalog = f.load()

    def cancelled():
        raise asyncio.CancelledError()

    catalog._source_reader = cancelled
    with pytest.raises(asyncio.CancelledError):
        VerificationGate(catalog).prepare(f.context(), "jacuzzi", f.evidence, TurnBudget())

    def broken():
        raise RuntimeError("synthetic adapter failure")

    catalog._source_reader = broken
    with pytest.raises(RuntimeError, match="synthetic adapter failure"):
        VerificationGate(catalog).prepare(f.context(), "jacuzzi", f.evidence, TurnBudget())


def test_registry_and_compiled_catalog_are_not_mutable_release_authority():
    f = fixture()
    turn = prepare(f)
    result = turn.verify(f.proposal("F_L"))
    with pytest.raises(TypeError):
        turn.catalog.facts["F_L"] = turn.catalog.facts["F_W"]
    turn.registry[0].excerpt = "tampered"
    with pytest.raises(DependencyError) as error:
        render(turn, result)
    assert error.value.code == "AI_PROTOCOL_ERROR"


def test_actual_span_bounds_and_mutated_review_maps_fail_dependency_integrity():
    f = fixture()
    f.data["facts"][0]["provenance"]["bindings"][0]["spans"] = [[0, len(TL) + 1]]
    f.publish()  # Well-formed catalog bytes, but source span exceeds real excerpt.
    with pytest.raises(DependencyError) as error:
        prepare(f)
    assert error.value.code == "DEPENDENCY_UNAVAILABLE"
    f = fixture()
    turn = prepare(f)
    verified = turn.verify(f.proposal("F_L"))
    turn.catalog.data.reviewDeclarations["CL"] = "partial"
    with pytest.raises(DependencyError):
        render(turn, verified)


def test_unknown_proposition_scope_is_not_mislabeled_as_supported_or_unsupported():
    f = fixture()
    f.data["vocabulary"]["subjects"].append("other-known-subject")
    f.publish()
    p = f.proposal("F_L")
    p["claims"][0]["subjectId"] = "other-known-subject"
    result = prepare(f).verify(p)
    assert result.outcome == "abstain" and result.reason == "unknown"
    assert result.claimResults[0].verdict == "unknown"
