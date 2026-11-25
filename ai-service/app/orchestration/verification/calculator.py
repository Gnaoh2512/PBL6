"""Deterministic host-side hypothetical policy calculators. Fail-closed on missing/invalid inputs."""

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from .questions import fold_text

_RATE_30 = Decimal("0.30")
_ONE_VND = Decimal("1")
_MAX_VND = 10_000_000_000  # 10B VND safety ceiling for hypothetical inputs.

_VAR_PATTERNS = {
    "G": re.compile(r"(?<![a-z0-9_])g\s*=\s*([+\-\u2212]?\d+(?:[.,]\d+)*)"),
    "A_room": re.compile(r"(?<![a-z0-9_])a_room\s*=\s*([+\-\u2212]?\d+(?:[.,]\d+)*)"),
    "A_other": re.compile(r"(?<![a-z0-9_])a_other\s*=\s*([+\-\u2212]?\d+(?:[.,]\d+)*)"),
    "A_bill": re.compile(r"(?<![a-z0-9_])a_bill\s*=\s*([+\-\u2212]?\d+(?:[.,]\d+)*)"),
}
_TOTAL_DISCOUNT_RE = re.compile(r"(?<![a-z0-9_])tong\s+giam\s+([+\-\u2212]?\d+(?:[.,]\d+)*)")
_HYPOTHETICAL_TRIGGER_RE = re.compile(r"(?:=|\d|\b(?:gia su|vi du|bao nhieu)\b)")
_UNAPPROVED_INPUT_CUES = (
    "chua duoc chap nhan",
    "chua chap nhan",
    "chua duyet",
    "khong duoc chap nhan",
    "chua ro phan bo",
    "khong ro phan bo",
    "chua phan bo",
)


@dataclass(frozen=True)
class CalculationOutcome:
    status: str  # "not_applicable" | "computed" | "abstain"
    reason: str
    rendered: str | None = None
    values: dict[str, int] | None = None


def _parse_vnd_int(raw: str) -> int | None:
    """Parse a non-negative integer VND token (plain digits or dot-grouped thousands)."""
    token = raw.strip().replace("\u2212", "-")
    if not token or token.startswith("-") or "," in token:
        return None
    if token.startswith("+"):
        token = token[1:]
    if "." in token:
        parts = token.split(".")
        if not parts[0].isdigit() or not 1 <= len(parts[0]) <= 3:
            return None
        if any(not p.isdigit() or len(p) != 3 for p in parts[1:]):
            return None
        digits = "".join(parts)
    else:
        if not token.isdigit():
            return None
        digits = token
    value = int(digits)
    if value < 0 or value > _MAX_VND:
        return None
    return value


def _fmt_vnd(amount: int) -> str:
    return f"{amount:,}".replace(",", ".")


def calculate_deposit_discount_basis(
    room_gross: int,
    room_discount: int,
    other_discount: int = 0,
) -> dict[str, int]:
    """POL-03-U02: A_bill = A_room + A_other; Deposit = HALF_UP[30% * max(G - A_room, 0)]."""
    if room_gross < 0 or room_discount < 0 or other_discount < 0:
        raise ValueError("Amounts must be non-negative integers")
    a_bill = room_discount + other_discount
    room_net = max(room_gross - room_discount, 0)
    deposit = int((_RATE_30 * Decimal(room_net)).quantize(_ONE_VND, rounding=ROUND_HALF_UP))
    return {
        "G": room_gross,
        "A_room": room_discount,
        "A_other": other_discount,
        "A_bill": a_bill,
        "room_net": room_net,
        "deposit": deposit,
    }


def evaluate_hypothetical_calculation(
    binding_key: str | None,
    redacted_message: str,
) -> CalculationOutcome:
    """Run deterministic host calculation when a supported policy rule carries hypothetical inputs."""
    if binding_key != "q-pol03-deposit-discount-basis":
        return CalculationOutcome("not_applicable", "not_applicable")

    folded = fold_text(redacted_message)
    if not _HYPOTHETICAL_TRIGGER_RE.search(folded):
        return CalculationOutcome("not_applicable", "general_policy_question")

    if any(cue in folded for cue in _UNAPPROVED_INPUT_CUES):
        return CalculationOutcome("abstain", "unapproved_calculation_inputs")

    parsed: dict[str, int] = {}
    for name, regex in _VAR_PATTERNS.items():
        matches = regex.findall(folded)
        if not matches:
            continue
        vals = []
        for raw in matches:
            val = _parse_vnd_int(raw)
            if val is None:
                return CalculationOutcome("abstain", "invalid_calculation_inputs")
            vals.append(val)
        if len(set(vals)) > 1:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
        parsed[name] = vals[0]

    total_discount_matches = _TOTAL_DISCOUNT_RE.findall(folded)
    stated_total_discount: int | None = None
    if total_discount_matches:
        td_vals = []
        for raw in total_discount_matches:
            val = _parse_vnd_int(raw)
            if val is None:
                return CalculationOutcome("abstain", "invalid_calculation_inputs")
            td_vals.append(val)
        if len(set(td_vals)) > 1:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
        stated_total_discount = td_vals[0]

    # Fail closed if required inputs G or A_room are missing in a hypothetical scenario.
    if "G" not in parsed or "A_room" not in parsed:
        return CalculationOutcome("abstain", "missing_calculation_inputs")

    g_val = parsed["G"]
    a_room = parsed["A_room"]
    if "A_other" in parsed:
        a_other = parsed["A_other"]
        expected_bill = a_room + a_other
        if "A_bill" in parsed and parsed["A_bill"] != expected_bill:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
        if stated_total_discount is not None and stated_total_discount != expected_bill:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
    elif "A_bill" in parsed:
        if parsed["A_bill"] < a_room:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
        a_other = parsed["A_bill"] - a_room
        if stated_total_discount is not None and stated_total_discount != parsed["A_bill"]:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
    elif stated_total_discount is not None:
        if stated_total_discount < a_room:
            return CalculationOutcome("abstain", "conflicting_calculation_inputs")
        a_other = stated_total_discount - a_room
    else:
        a_other = 0

    values = calculate_deposit_discount_basis(g_val, a_room, a_other)
    rendered = (
        f"Phép tính giả định (số cuối cần nhân viên đối soát): "
        f"A_bill = {_fmt_vnd(values['A_bill'])} VND dùng cho hóa đơn; "
        f"cọc chỉ trừ A_room = {_fmt_vnd(values['A_room'])} VND nên "
        f"Cọc = HALF_UP[30% × max({_fmt_vnd(values['G'])} − {_fmt_vnd(values['A_room'])}, 0)] = "
        f"{_fmt_vnd(values['deposit'])} VND."
    )
    if values["deposit"] == 0:
        rendered += " Cọc bằng 0 VND (không tạo giao dịch 0, cần nhân viên xác nhận)."
    return CalculationOutcome("computed", "computed", rendered=rendered, values=values)
