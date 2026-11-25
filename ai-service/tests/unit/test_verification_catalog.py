import hashlib
import json

import pytest
from pydantic import ValidationError
from verification_support import fixture

from app.orchestration.verification.catalog import VerifiedCatalog, digest
from app.providers.contracts import DependencyError
from app.schemas.verification import CandidateDraft


def test_catalog_loads_only_with_host_pin_and_independent_authority():
    f = fixture()
    catalog = f.load()
    assert set(catalog.facts) == {"F_L", "F_W", "F_T"}
    assert len(catalog.check_current()) == 3
    assert digest({"b": 2, "a": 1}) == hashlib.sha256(b'{"a":1,"b":2}').hexdigest()
    with pytest.raises(DependencyError):
        VerifiedCatalog(
            lambda: f.raw, expected_hash="0" * 64, authorities=frozenset(), source_reader=lambda: ()
        )
    with pytest.raises(DependencyError):
        VerifiedCatalog(
            lambda: f.raw,
            expected_hash=digest(f.raw),
            authorities=frozenset(),
            source_reader=lambda: (),
        )


@pytest.mark.parametrize("target", ["raw", "approval", "source", "span", "template", "qualifier"])
def test_catalog_corruption_fails_closed(target):
    f = fixture()
    if target == "raw":
        f.raw = b"{}"
    elif target == "approval":
        f.data["facts"][0]["approval"]["reviewedContentSha256"] = "0" * 64
    elif target == "source":
        f.data["facts"][0]["provenance"]["bindings"][0]["sourceSha256"] = "0" * 64
    elif target == "span":
        f.data["facts"][0]["provenance"]["bindings"][0]["spans"] = [[-1, 3]]
    elif target == "template":
        f.data["templates"][0]["segments"] = [{"kind": "value", "text": None, "qualifierId": None}]
    else:
        f.data["facts"][0]["qualifierIds"] = ["unknown"]
    if target != "raw":
        f.raw = json.dumps(f.data).encode()
    with pytest.raises(DependencyError) as error:
        f.load()
    assert error.value.code == "DEPENDENCY_UNAVAILABLE"
    assert "Trong demo" not in str(error.value)


def test_catalog_detects_drift_and_does_not_upgrade_pending_approval():
    f = fixture()
    f.data["facts"][0]["approval"]["status"] = "pending_review"
    f.publish()
    catalog = f.load()
    assert catalog.facts["F_L"].approval.status == "pending_review"
    f.raw += b" "
    with pytest.raises(DependencyError):
        catalog.check_current()


@pytest.mark.parametrize(
    "mutation", ["legacy", "extra", "boolean", "decimal", "unit", "duplicates"]
)
def test_candidate_v2_strict_boundary(mutation):
    data = fixture().proposal("F_L")
    if mutation == "legacy":
        data = {"supported": True, "answer": "unverified", "citationIds": ["CL"]}
    elif mutation == "extra":
        data["claims"][0]["text"] = "untyped claim"
    elif mutation == "boolean":
        data["claims"][0]["value"]["data"] = 1
    elif mutation == "decimal":
        data["claims"][0]["value"] = {"kind": "decimal", "data": 60.0}
    elif mutation == "unit":
        data["claims"][0]["unit"] = "hour"
    else:
        data["claims"] *= 2
    with pytest.raises(ValidationError):
        CandidateDraft.model_validate_json(json.dumps(data))


def test_candidate_preserves_explicit_scope_and_does_not_accept_supported_flag():
    data = fixture().proposal("F_L")
    candidate = CandidateDraft.model_validate_json(json.dumps(data))
    assert candidate.claims[0].unit is None and candidate.claims[0].value.data is False
    data["supported"] = True
    with pytest.raises(ValidationError):
        CandidateDraft.model_validate_json(json.dumps(data))


def test_date_range_wire_names_and_decimal_string_are_preserved():
    data = fixture().proposal("F_T")
    data["claims"][0]["timeScope"] = {
        "kind": "local_date_range",
        "from": "2026-11-13",
        "through": "2026-11-14",
        "timeZone": "Asia/Ho_Chi_Minh",
    }
    candidate = CandidateDraft.model_validate_json(json.dumps(data))
    scope = candidate.model_dump(mode="json", by_alias=True)["claims"][0]["timeScope"]
    assert scope["from"] == "2026-11-13" and "from_" not in scope
    data["claims"][0]["timeScope"]["through"] = "2026-11-12"
    with pytest.raises(ValidationError):
        CandidateDraft.model_validate_json(json.dumps(data))
