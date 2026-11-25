import copy
import unicodedata

import pytest
from verification_support import fixture

from app.orchestration.verification import VerificationGate
from app.orchestration.verification.questions import analyze_params, bind_question, extract_params
from app.providers.contracts import DependencyError, TurnBudget


@pytest.mark.parametrize("variant", ["original", "case", "whitespace", "nfd"])
def test_full_match_normalization_preserves_question_requirements(variant):
    f = fixture()
    text = f.data["questionRules"][0]["aliases"][0]
    if variant == "case":
        text = text.upper()
    elif variant == "whitespace":
        text = "  " + text.replace(" ", " \t ") + "\n"
    elif variant == "nfd":
        text = unicodedata.normalize("NFD", text)
    result = bind_question(f.load(), text)
    assert result.status == "bound" and result.key == "L"
    assert result.matchSource == "alias"
    assert [r.factKey for r in result.requirements] == ["L"]


@pytest.mark.parametrize(
    "text", ["jacuzzi", "KHÔNG hỏi Wi-Fi", "Trong demo Wi-Fi ở đâu", "wifi", ""]
)
def test_unknown_negation_and_punctuation_do_not_get_fuzzy_binding(text):
    result = bind_question(fixture().load(), text)
    assert result.status == "unknown" and result.reason == "question_unbound"


def test_ambiguous_binding_is_not_resolved_by_rule_order_and_equal_aliases_deduplicate():
    f = fixture()
    first, second = f.data["questionRules"][:2]
    duplicate = copy.deepcopy(first)
    f.data["questionRules"].append(duplicate)
    f.publish()
    text = first["aliases"][0]
    assert bind_question(f.load(), text).status == "bound"
    second["aliases"] = [text]
    f.publish()
    result = bind_question(f.load(), text)
    assert result.status == "ambiguous" and result.reason == "question_ambiguous"


def test_structured_pattern_binds_diacritic_insensitive_paraphrase_and_checks_none_of():
    f = fixture()
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-wifi-location",
            "allOf": [["wifi", "wi-fi"], ["o dau", "vi tri", "khu vuc"]],
            "noneOf": ["khong hoi", "mat khau", "toc do"],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    catalog = f.load()

    bound = bind_question(catalog, "Cho toi hoi wifi o dau trong khach san?")
    assert bound.status == "bound" and bound.key == "W"
    assert bound.matchSource == "pattern" and bound.matchedPatternId == "p-wifi-location"
    assert [r.factKey for r in bound.requirements] == ["W"]

    assert bind_question(catalog, "Tôi KHÔNG hỏi Wi-Fi ở đâu đâu nhé").status == "unknown"
    assert bind_question(catalog, "Mật khẩu Wi-Fi ở đâu?").status == "unknown"
    assert bind_question(catalog, "wifi").status == "unknown"


def test_structured_pattern_validates_typed_parameters_on_host():
    f = fixture()
    f.data["questionRules"][2]["patterns"] = [
        {
            "patternId": "p-late-time",
            "allOf": [["den muon", "toi", "nhan phong"], ["gio", "24/7", "bao truoc"]],
            "noneOf": ["khong ro", "chua biet"],
            "requiredParams": [
                {"kind": "time_hhmm", "minCount": 1, "minValue": 22 * 60, "maxValue": None}
            ],
            "disallowedParams": [],
            "asciiFold": True,
        },
        {
            "patternId": "p-birth-dates",
            "allOf": [["sinh", "tuoi"], ["nhan phong", "checkin"]],
            "noneOf": ["khong biet ngay thang", "chi biet sinh nam"],
            "requiredParams": [
                {"kind": "date_dmy", "minCount": 2, "minValue": None, "maxValue": None}
            ],
            "disallowedParams": [],
            "asciiFold": True,
        },
    ]
    f.publish()
    catalog = f.load()

    ok_time = bind_question(catalog, "Tôi định tới 23:00, có tiếp nhận 24/7 không?")
    assert ok_time.status == "bound" and ok_time.matchedPatternId == "p-late-time"
    assert any(p.kind == "time_hhmm" and p.normalized == "23:00" for p in ok_time.extractedParams)

    # Out-of-bounds (<22:00) and invalid clock (25:99) must not bind.
    assert bind_question(catalog, "Tôi tới 20:00 có cần báo trước không?").status == "unknown"
    assert bind_question(catalog, "Tôi tới 25:99 có tiếp nhận 24/7 không?").status == "unknown"

    # Full valid dd/mm/yyyy dates bind; year-only or invalid calendar date do not bind.
    ok_dates = bind_question(
        catalog, "Khách sinh 05/12/2008 và nhận phòng 10/12/2026 thì đủ tuổi không?"
    )
    assert ok_dates.status == "bound" and ok_dates.matchedPatternId == "p-birth-dates"
    assert len([p for p in ok_dates.extractedParams if p.kind == "date_dmy"]) == 2
    assert (
        bind_question(
            catalog, "Khách chỉ biết sinh năm 2008, không biết ngày tháng, nhận phòng 01/12/2026."
        ).status
        == "unknown"
    )
    assert (
        bind_question(
            catalog, "Khách sinh 31/02/2008 và nhận phòng 10/12/2026 thì đủ tuổi không?"
        ).status
        == "unknown"
    )


def test_disallowed_params_and_cross_rule_pattern_overlap_fail_closed():
    f = fixture()
    f.data["questionRules"][0]["patterns"] = [
        {
            "patternId": "p-luggage-general",
            "allOf": [["hanh ly", "gui do"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": ["vnd_amount"],
            "asciiFold": True,
        }
    ]
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-wifi-overlap",
            "allOf": [["gui do", "wifi"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    catalog = f.load()

    # Disallowed parameter blocks match.
    assert bind_question(catalog, "Gửi hành lý mất 120.000 VND đúng không?").status == "unknown"
    # Overlap between two distinct rules -> ambiguous, never rule-order precedence.
    overlap = bind_question(catalog, "Khách sạn có dịch vụ gửi đồ không?")
    assert overlap.status == "ambiguous" and overlap.reason == "question_ambiguous"
    # Overlap between Rule 0 exact alias and Rule 1 pattern also returns ambiguous.
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-alias-conflict",
            "allOf": [["hanh ly"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    alias_text = f.data["questionRules"][0]["aliases"][0]
    conflict = bind_question(f.load(), alias_text)
    assert conflict.status == "ambiguous" and conflict.reason == "question_ambiguous"


def test_pattern_bound_question_still_enforces_host_gate_qualifiers_and_tamper_pin():
    f = fixture()
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-wifi-where",
            "allOf": [["wifi", "wi-fi"], ["o dau", "cho nao"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    catalog = f.load()

    gate = VerificationGate(catalog)
    turn = gate.prepare(f.context(), "Cho mình hỏi wifi ở chỗ nào ạ?", f.evidence, TurnBudget())
    assert turn.binding.status == "bound" and turn.binding.matchSource == "pattern"
    assert turn.needs_candidate is True
    payload = turn.final_payload(f.proposal("F_W"))
    assert payload["final"]["status"] == "answered"
    assert len(payload["final"]["citations"]) == 1

    # Tampering a pattern field without updating catalog review_hash fails closed.
    tampered = copy.deepcopy(f.data)
    tampered["questionRules"][1]["patterns"][0]["noneOf"] = ["tampered"]
    f.raw = f.raw  # original bytes untouched; test mismatched content with old approval hash
    f.data = tampered
    with pytest.raises(DependencyError):
        # Re-encode without re-signing approval hash.
        from app.orchestration.verification.catalog import VerifiedCatalog, canonical, digest

        raw = canonical(tampered)
        VerifiedCatalog(
            lambda: raw,
            expected_hash=digest(raw),
            authorities=frozenset({"test-reviewer"}),
            source_reader=lambda: (),
        )


def test_extract_params_handles_vietnamese_units_and_rejects_malformed_values():
    params = extract_params(
        "Đơn tạo 01/12/2026 lúc 10h14, cọc 30% tương đương 510.000 VND, giữ 15 phút cho 2 khách 18 tuổi."
    )
    assert [p.normalized for p in params["date_dmy"]] == ["2026-12-01"]
    assert [p.normalized for p in params["time_hhmm"]] == ["10:14"]
    assert [p.value for p in params["percent"]] == [30]
    assert [p.value for p in params["vnd_amount"]] == [510000]
    assert [p.normalized for p in params["duration"]] == ["15 phut"]
    assert [p.normalized for p in params["count"]] == ["2 khach"]
    assert [p.value for p in params["age_years"]] == [18]

    bad = extract_params("Ngày 32/13/2026 lúc 29:75, tỷ lệ 150%, tuổi 199 tuổi.")
    assert not bad["date_dmy"]
    assert not bad["time_hhmm"]
    assert not bad["percent"]
    assert not bad["age_years"]

    analyzed = analyze_params(
        "Tiếp nhận 24/7: ngày 32/13/2026 lúc 23:00 hay 25:99, tỷ lệ 150%, 199 tuổi."
    )
    assert not analyzed.valid["date_dmy"]  # 24/7 must not be misparsed as July 24
    assert [p.normalized for p in analyzed.valid["time_hhmm"]] == ["23:00"]
    assert {(p.kind, p.raw) for p in analyzed.invalid} == {
        ("date_dmy", "32/13/2026"),
        ("time_hhmm", "25:99"),
        ("percent", "150%"),
        ("age_years", "199 tuoi"),
    }


@pytest.mark.parametrize(
    "query",
    [
        "Wi-Fi ở đâu và hồ bơi mở cửa lúc mấy giờ?",
        "Hồ bơi mở cửa lúc mấy giờ và Wi-Fi ở đâu?",
        "Wi-Fi ở đâu? Hồ bơi mở cửa lúc mấy giờ?",
        "Wi-Fi ở đâu, ngoài ra có bữa sáng miễn phí không?",
        "Khách sạn có Wi-Fi ở đâu và có hồ bơi miễn phí không?",
    ],
)
def test_compound_question_with_uncovered_clause_never_releases_partial_answer(query):
    f = fixture()
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-wifi-location",
            "allOf": [["wifi", "wi-fi"], ["o dau", "vi tri", "khu vuc"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    catalog = f.load()

    binding = bind_question(catalog, query)
    assert binding.status == "unknown"
    assert binding.reason == "compound_question_uncovered"

    gate = VerificationGate(catalog)
    turn = gate.prepare(f.context(), query, f.evidence, TurnBudget())
    assert turn.needs_candidate is False
    payload = turn.final_payload(None)
    assert payload["final"]["status"] == "insufficient_evidence"
    assert payload["final"]["citations"] == []


@pytest.mark.parametrize(
    "query,expected_invalid_raw",
    [
        ("Tôi đến muộn lúc 23:00 hay 25:99 có cần báo trước không?", "25:99"),
        ("Tôi đến muộn lúc 18:00 hay 23:00 có cần báo trước không?", None),
        (
            "Khách sinh 05/12/2008, nhận phòng 10/12/2026 hay 31/02/2026 thì đủ tuổi không?",
            "31/02/2026",
        ),
    ],
)
def test_mixed_valid_and_invalid_parameters_fail_closed_in_binding_and_gate(
    query, expected_invalid_raw
):
    f = fixture()
    f.data["questionRules"][2]["patterns"] = [
        {
            "patternId": "p-late-time",
            "allOf": [["den muon", "toi", "nhan phong"], ["bao truoc", "24/7"]],
            "noneOf": [],
            "requiredParams": [
                {"kind": "time_hhmm", "minCount": 1, "minValue": 22 * 60, "maxValue": None}
            ],
            "disallowedParams": [],
            "asciiFold": True,
        },
        {
            "patternId": "p-birth-dates",
            "allOf": [["sinh", "tuoi"], ["nhan phong", "du tuoi"]],
            "noneOf": [],
            "requiredParams": [
                {"kind": "date_dmy", "minCount": 2, "minValue": None, "maxValue": None}
            ],
            "disallowedParams": [],
            "asciiFold": True,
        },
    ]
    f.publish()
    catalog = f.load()

    binding = bind_question(catalog, query)
    assert binding.status == "unknown"
    assert binding.reason == "invalid_parameter"
    if expected_invalid_raw is not None:
        assert any(p.raw == expected_invalid_raw for p in binding.invalidParams)

    gate = VerificationGate(catalog)
    turn = gate.prepare(f.context(), query, f.evidence, TurnBudget())
    assert turn.needs_candidate is False
    payload = turn.final_payload(None)
    assert payload["final"]["status"] == "insufficient_evidence"
    assert payload["final"]["citations"] == []


def test_single_question_coordinated_aspects_allowed_while_unrelated_clause_rejected():
    f = fixture()
    f.data["questionRules"][2]["patterns"] = [
        {
            "patternId": "p-deposit-topup",
            "allOf": [
                ["coc kha dung", "dang giu coc"],
                ["can bo sung", "phan bo sung"],
            ],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.data["questionRules"][1]["patterns"] = [
        {
            "patternId": "p-wifi-policy",
            "allOf": [["wi-fi", "wifi"], ["chinh sach", "o dau"]],
            "noneOf": [],
            "requiredParams": [],
            "disallowedParams": [],
            "asciiFold": True,
        }
    ]
    f.publish()
    catalog = f.load()

    # Single question listing coordinated aspects owned by one pattern + sentence ending in a number.
    ok = bind_question(
        catalog,
        "Cọc mới yêu cầu 255.000. Cọc khả dụng và cần bổ sung là bao nhiêu?",
    )
    assert ok.status == "bound"
    assert ok.key == f.data["questionRules"][2]["bindingKey"]

    # Unrelated topic ("hồ bơi") coordinated even when sharing generic phrase "chính sách" must fail closed.
    bad = bind_question(catalog, "Wi-Fi và chính sách hồ bơi là gì?")
    assert bad.status == "unknown"
    assert bad.reason == "compound_question_uncovered"
