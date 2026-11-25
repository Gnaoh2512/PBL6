"""Raw proposal ambiguity must fail before REST parsing can discard duplicate fields."""

import json

import pytest
from verification_support import fixture

from app.schemas.verification import CandidateDraft


@pytest.mark.parametrize("variant", ["claims", "escaped_claims", "fact_id", "value", "support"])
def test_duplicate_json_fields_at_every_claim_layer_are_rejected(variant):
    raw = json.dumps(fixture().proposal("F_L"))
    if variant in {"claims", "escaped_claims"}:
        key = '"claims"' if variant == "claims" else '"cl\\u0061ims"'
        raw = raw.replace('"claims":', key + ': [{"text":"outside schema"}], "claims":', 1)
    elif variant == "fact_id":
        raw = raw.replace('"factId": "F_L"', '"factId": "hidden", "factId": "F_L"')
    elif variant == "value":
        raw = raw.replace('"data": false', '"data": true, "data": false')
    else:
        raw = raw.replace('"citationId": "CL"', '"citationId": "UNKNOWN", "citationId": "CL"')
    assert len(raw) > len(json.dumps(fixture().proposal("F_L")))
    with pytest.raises(ValueError, match="Duplicate JSON field"):
        CandidateDraft.model_validate_json(raw)


def test_unambiguous_proposal_round_trip_and_schema_are_preserved():
    data = fixture().proposal("F_L")
    model = CandidateDraft.model_validate_json(json.dumps(data))
    assert json.loads(model.model_dump_json(by_alias=True)) == data
    assert set(CandidateDraft.model_json_schema()["properties"]) == {
        "schemaVersion",
        "decision",
        "claims",
    }
