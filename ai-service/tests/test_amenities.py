from ai_service.application.recommendation.amenities import (
    AmenityStatus,
    canonical_code,
    evidence_for,
    status_for,
)


def test_vietnamese_english_and_accentless_aliases() -> None:
    for alias in ("Ban công", "ban cong", "BALCONY", "  ban   CÔNG "):
        assert canonical_code(alias) == "BALCONY"
    for alias in ("WiFi", "wi-fi", "WIFI TỐC ĐỘ CAO"):
        assert canonical_code(alias) == "WIFI"


def test_negative_missing_and_unrecognized_candidate_evidence() -> None:
    negative = evidence_for("Không có ban công, No Wi-Fi, Minibar")
    assert status_for(negative, "BALCONY") is AmenityStatus.ABSENT
    assert status_for(negative, "WIFI") is AmenityStatus.ABSENT
    assert status_for(negative, "MINIBAR") is AmenityStatus.PRESENT
    assert status_for(evidence_for(None), "BALCONY") is AmenityStatus.UNKNOWN
    assert status_for(evidence_for("Ban công không rõ"), "BALCONY") is AmenityStatus.UNKNOWN
    assert status_for(evidence_for("Wifi booster"), "WIFI") is AmenityStatus.UNKNOWN
    conflicting = evidence_for("Ban công, Không có ban công")
    assert status_for(conflicting, "BALCONY") is AmenityStatus.UNKNOWN


def test_current_backend_seed_phrases_have_explicit_catalog_evidence() -> None:
    seeded = (
        "Wifi tốc độ cao, TV màn hình phẳng, Điều hòa hai chiều, Bình nóng lạnh, "
        "Wifi, TV 4K, Điều hòa, Bồn tắm ngâm, Ban công ngắm cảnh biển, Minibar, "
        "2 Giường King, Phòng khách riêng, Bếp mini, Bồn tắm massage, Sofa bed"
    )
    evidence = evidence_for(seeded)
    assert set(evidence) == {
        "WIFI",
        "TV",
        "AIR_CONDITIONING",
        "WATER_HEATER",
        "BATHTUB",
        "BALCONY",
        "MINIBAR",
        "KING_BED",
        "LIVING_ROOM",
        "KITCHEN",
        "SOFA_BED",
    }
    assert all(item.status is AmenityStatus.PRESENT for item in evidence.values())
