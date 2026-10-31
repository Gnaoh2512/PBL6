"""Controlled amenity vocabulary and evidence from backend room-type text."""

import unicodedata
from dataclasses import dataclass
from enum import Enum


def normalize(value: str) -> str:
    folded = unicodedata.normalize("NFKD", unicodedata.normalize("NFKC", value))
    folded = "".join(char for char in folded if not unicodedata.combining(char))
    return " ".join(folded.casefold().replace("đ", "d").split())


# Each affirmative backend phrase is explicit. A shared prefix alone proves nothing.
CATALOG: dict[str, tuple[str, ...]] = {
    "WIFI": ("wifi", "wi-fi", "wifi tốc độ cao"),
    "BALCONY": ("balcony", "ban công", "ban công ngắm cảnh biển", "ban công biển"),
    "MINIBAR": ("minibar",),
    "TV": ("tv", "tv 4k", "tv màn hình phẳng"),
    "AIR_CONDITIONING": ("air conditioning", "điều hòa", "điều hòa hai chiều"),
    "BATHTUB": ("bồn tắm", "bồn tắm ngâm", "bồn tắm massage"),
    "WATER_HEATER": ("bình nóng lạnh", "nóng lạnh"),
    "KITCHEN": ("kitchen", "bếp mini"),
    "LIVING_ROOM": ("phòng khách riêng",),
    "KING_BED": ("2 giường king",),
    "SOFA_BED": ("sofa bed",),
}

_ALIASES = {normalize(alias): code for code, aliases in CATALOG.items() for alias in aliases}
_ALIASES.update({normalize(code): code for code in CATALOG})
_NEGATIVE_PHRASES = {
    phrase: code
    for code, aliases in CATALOG.items()
    for alias in {normalize(item) for item in aliases}
    for phrase in (
        f"khong co {alias}",
        f"khong {alias}",
        f"no {alias}",
        f"without {alias}",
        f"{alias} khong co",
        f"{alias} not available",
    )
}


class AmenityStatus(str, Enum):
    PRESENT = "PRESENT"
    ABSENT = "ABSENT"
    UNKNOWN = "UNKNOWN"


@dataclass(frozen=True)
class AmenityEvidence:
    status: AmenityStatus
    raw_token: str | None = None


class AmenityCriteriaError(ValueError):
    def __init__(self, field: str, message: str, *, reason: str) -> None:
        super().__init__(message)
        self.field = field
        self.reason = reason


def canonical_code(value: str) -> str | None:
    return _ALIASES.get(normalize(value))


def requested_codes(values: list[str], field: str) -> set[str]:
    codes: set[str] = set()
    for value in values:
        code = canonical_code(value)
        if code is None:
            raise AmenityCriteriaError(field, f"Unknown amenity: {value}", reason="UNKNOWN")
        codes.add(code)
    return codes


def resolve_criteria(required: list[str], preferred: list[str]) -> tuple[set[str], set[str]]:
    required_codes = requested_codes(required, "requiredAmenities")
    preferred_codes = requested_codes(preferred, "preferredAmenities")
    overlap = required_codes & preferred_codes
    if overlap:
        raise AmenityCriteriaError(
            "preferredAmenities",
            "An amenity cannot be both required and preferred: " + ", ".join(sorted(overlap)),
            reason="CONFLICT",
        )
    return required_codes, preferred_codes


def evidence_for(amenities: str | None) -> dict[str, AmenityEvidence]:
    """Unknown is distinct from an explicit negative statement or verified presence."""
    observations: dict[str, list[AmenityEvidence]] = {}
    for raw in (amenities or "").split(","):
        display = " ".join(raw.split())
        token = normalize(display).strip(" .;:")
        if not token:
            continue
        absent_code = _NEGATIVE_PHRASES.get(token)
        present_code = _ALIASES.get(token)
        if absent_code is not None:
            observations.setdefault(absent_code, []).append(
                AmenityEvidence(AmenityStatus.ABSENT, display)
            )
        elif present_code is not None:
            observations.setdefault(present_code, []).append(
                AmenityEvidence(AmenityStatus.PRESENT, display)
            )
    result: dict[str, AmenityEvidence] = {}
    for code, items in observations.items():
        statuses = {item.status for item in items}
        result[code] = items[0] if len(statuses) == 1 else AmenityEvidence(AmenityStatus.UNKNOWN)
    return result


def status_for(evidence: dict[str, AmenityEvidence], code: str) -> AmenityStatus:
    return evidence.get(code, AmenityEvidence(AmenityStatus.UNKNOWN)).status
