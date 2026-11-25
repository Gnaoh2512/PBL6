import copy

import pytest
from verification_support import fixture

from app.orchestration.verification import VerificationGate
from app.orchestration.verification.assembly import assemble
from app.providers.contracts import DependencyError


def build(f, evidence, **kw):
    return assemble(
        VerificationGate(f.load()),
        evidence,
        mode="demo_synthetic",
        snapshot_id="SX",
        today=f.context().asOfDate,
        **kw,
    )


def test_complete_sections_provenance_and_exact_duplicate_dedup():
    f = fixture()
    e = f.evidence
    result = build(f, [e[0], e[0], e[1]])
    assert len(result) == 2 and result[0].model_dump() == e[0]
    assert result[0].excerpt == e[0]["excerpt"]
    assert build(f, []) == []
    assert len(build(f, e, max_evidence=1)) == 1


@pytest.mark.parametrize(
    "change",
    [
        {"corpusMode": "production"},
        {"sourceRef": "wrong"},
        {"version": "unknown"},
        {"excerpt": "tampered source"},
    ],
)
def test_invalid_evidence_never_enters_context(change):
    f = fixture()
    e = copy.deepcopy(f.evidence)
    e[0].update(change)
    with pytest.raises(DependencyError):
        build(f, e)


@pytest.mark.parametrize("status", ["pending_review", "rejected", "revoked"])
def test_unapproved_source_is_dependency_not_answer(status):
    f = fixture()
    f.data["sources"][0]["approval"]["status"] = status
    f.publish()
    with pytest.raises(DependencyError):
        build(f, f.evidence)


def test_expired_source_and_conflicting_duplicate_are_rejected():
    f = fixture()
    f.source_state[0]["validity"]["validThrough"] = "2020-01-01"
    from verification_support import approve

    approve(f.source_state[0])
    with pytest.raises(DependencyError):
        build(f, f.evidence)
    f = fixture()
    other = {**f.evidence[0], "title": "different"}
    with pytest.raises(DependencyError):
        build(f, [f.evidence[0], other])
