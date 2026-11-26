"""Closed vocabulary & structured policy-domain question binding, never model votes."""

import re
import unicodedata
from dataclasses import dataclass
from datetime import date

from app.schemas.verification import QuestionPattern, Requirement

from .catalog import VerifiedCatalog, digest

# Match clock expressions including invalid ones (e.g. 25:99, 29h75) so malformed values
# are surfaced as invalid_parameter rather than silently skipped when a valid time co-occurs.
_TIME_CANDIDATE_RE = re.compile(
    r"(?<![a-z0-9/])(\d{1,2})\s*(?:(?::|h)(\d{2})(?::(\d{2}))?|(?:h|gio)\b)(?![a-z0-9/])"
)
# Exclude 24/7 ("24 hours / 7 days") so it is not misparsed as July 24.
_DATE_CANDIDATE_RE = re.compile(
    r"(?<![a-z0-9/])(?!24/7(?![a-z0-9/]))(\d{1,2})/(\d{1,2})(?:/(\d{4}))?(?![a-z0-9/])"
)
_VND_GROUPED_RE = re.compile(
    r"(?<![a-z0-9])(\d{1,3}(?:\.\d{3})+)(?:\s*(?:vnd|dong|d))?(?![a-z0-9])"
)
_VND_UNIT_RE = re.compile(r"(?<![a-z0-9])(\d+)\s*(?:vnd|dong)(?![a-z0-9])")
_PERCENT_CANDIDATE_RE = re.compile(r"(?<![a-z0-9])(\d{1,4})\s*(?:%|phan tram)(?![a-z0-9])")
_AGE_CANDIDATE_RE = re.compile(r"(?<![a-z0-9])(\d{1,4})\s*tuoi(?![a-z0-9])")
_DURATION_RE = re.compile(r"(?<![a-z0-9])(\d{1,4})\s*(phut|gio|ngay|dem|thang)(?![a-z0-9])")
_COUNT_RE = re.compile(
    r"(?<![a-z0-9])(\d{1,3})\s*(phong|khach|nguoi|package|kg|don|khoan)(?![a-z0-9])"
)

# Domain-agnostic Vietnamese interrogative markers used to detect compound multi-question inputs.
_INTERROGATIVE_PATTERNS = (
    re.compile(
        r"(?<![a-z0-9])(?:o dau|cho nao|may gio|bao nhieu|bao lau|the nao|nhu the nao|"
        r"ra sao|la gi|thi sao|tai sao|vi sao|khi nao|luc nao|bao gio|may ngay|may dem|"
        r"may phut|may phong|duoc khong|phai khong|dung khong|hay khong|co khong)(?![a-z0-9])"
    ),
    re.compile(r"(?<![a-z0-9])co\b.{1,120}\bkhong(?![a-z0-9])"),
)
_SENTENCE_SPLIT_RE = re.compile(r"[?!;]+|\.(?!\d)\s+")
_ADDITIVE_SPLIT_RE = re.compile(
    r"(?<![a-z0-9])(?:ngoai ra|them nua|voi lai|ben canh do|mat khac|dong thoi)(?![a-z0-9])"
)
_COORD_SPLIT_RE = re.compile(r"(?<![a-z0-9])(?:va|hay|hoac)(?![a-z0-9])")
_REPEATED_PREDICATE_COORD_RE = re.compile(
    r"(?<![a-z0-9])(co|chinh sach|quy dinh|phi|gio)\b[^?!;]{1,80}\bva\s+\1\b"
)
_TRAILING_CLAUSE_STOP = frozenset(
    {
        "va",
        "hay",
        "hoac",
        "thi",
        "la",
        "co",
        "khong",
        "a",
        "nhe",
        "nha",
        "vay",
        "gio",
        "ngay",
        "phut",
        "dem",
    }
)
_QUESTION_FRAME_STOP = frozenset(
    {
        "bao",
        "nhieu",
        "lau",
        "ra",
        "sao",
        "the",
        "nao",
        "nhu",
        "la",
        "gi",
        "duoc",
        "khong",
        "co",
        "can",
        "phai",
        "thi",
        "bi",
        "de",
        "cho",
        "cua",
        "cac",
        "nhung",
        "may",
        "luc",
        "khi",
        "o",
        "dau",
        "tai",
        "vi",
        "vay",
        "a",
        "nhe",
        "nha",
        "va",
        "hay",
        "hoac",
        # Generic hotel/self-reference and Vietnamese question framing tokens only
        # (never domain-topic nouns like wifi/pool/pet/parking/laundry).
        "khach",
        "san",
        "azure",
        "bay",
        "ben",
        "minh",
        "toi",
        "em",
        "anh",
        "chi",
        "ban",
        "hoi",
        "giup",
        "biet",
        "xem",
        "ap",
        "dung",
        "tinh",
        "day",
        "nay",
        "tieu",
        "chuan",
        "muc",
    }
)


def normalize_message(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text).casefold()).strip()


def fold_text(text: str) -> str:
    """Deterministic Vietnamese diacritic folding for structured policy pattern matching."""
    folded = unicodedata.normalize("NFC", text).casefold().replace("đ", "d")
    stripped = "".join(
        ch for ch in unicodedata.normalize("NFD", folded) if unicodedata.category(ch) != "Mn"
    )
    return re.sub(r"\s+", " ", stripped).strip()


@dataclass(frozen=True)
class ExtractedParam:
    kind: str
    raw: str
    value: int
    normalized: str


@dataclass(frozen=True)
class InvalidParam:
    kind: str
    raw: str
    reason: str


@dataclass(frozen=True)
class ParamAnalysis:
    valid: dict[str, tuple[ExtractedParam, ...]]
    invalid: tuple[InvalidParam, ...]


@dataclass(frozen=True)
class QuestionBinding:
    status: str
    reason: str
    key: str | None = None
    requirements: tuple[Requirement, ...] = ()
    permitted_keys: frozenset[str] = frozenset()
    matchSource: str | None = None
    matchedPatternId: str | None = None
    extractedParams: tuple[ExtractedParam, ...] = ()
    invalidParams: tuple[InvalidParam, ...] = ()


def analyze_params(text: str) -> ParamAnalysis:
    """Extract typed parameters and record any malformed values instead of silently dropping them."""
    folded = fold_text(text)
    found: dict[str, list[ExtractedParam]] = {
        "time_hhmm": [],
        "date_dmy": [],
        "vnd_amount": [],
        "percent": [],
        "age_years": [],
        "count": [],
        "duration": [],
    }
    invalid: list[InvalidParam] = []

    for match in _TIME_CANDIDATE_RE.finditer(folded):
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        second = int(match.group(3) or 0)
        if 0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59:
            found["time_hhmm"].append(
                ExtractedParam(
                    "time_hhmm",
                    match.group(0),
                    hour * 60 + minute,
                    f"{hour:02d}:{minute:02d}",
                )
            )
        else:
            invalid.append(InvalidParam("time_hhmm", match.group(0), "invalid_time"))

    for match in _DATE_CANDIDATE_RE.finditer(folded):
        day, month = int(match.group(1)), int(match.group(2))
        year_text = match.group(3)
        year = int(year_text) if year_text else 2026
        try:
            parsed = date(year, month, day)
        except ValueError:
            invalid.append(InvalidParam("date_dmy", match.group(0), "invalid_date"))
            continue
        norm = parsed.isoformat() if year_text else f"{day:02d}/{month:02d}"
        found["date_dmy"].append(
            ExtractedParam("date_dmy", match.group(0), parsed.toordinal(), norm)
        )

    vnd_spans: list[tuple[int, int]] = []
    for regex in (_VND_GROUPED_RE, _VND_UNIT_RE):
        for match in regex.finditer(folded):
            span = match.span()
            if any(not (span[1] <= s[0] or span[0] >= s[1]) for s in vnd_spans):
                continue
            amount = int(match.group(1).replace(".", ""))
            vnd_spans.append(span)
            found["vnd_amount"].append(
                ExtractedParam("vnd_amount", match.group(0), amount, f"{amount} VND")
            )

    for match in _PERCENT_CANDIDATE_RE.finditer(folded):
        pct = int(match.group(1))
        if 0 <= pct <= 100:
            found["percent"].append(ExtractedParam("percent", match.group(0), pct, f"{pct}%"))
        else:
            invalid.append(InvalidParam("percent", match.group(0), "invalid_percent"))

    for match in _AGE_CANDIDATE_RE.finditer(folded):
        age = int(match.group(1))
        if 0 <= age <= 120:
            found["age_years"].append(
                ExtractedParam("age_years", match.group(0), age, f"{age} tuoi")
            )
        else:
            invalid.append(InvalidParam("age_years", match.group(0), "invalid_age"))

    for match in _DURATION_RE.finditer(folded):
        qty, unit = int(match.group(1)), match.group(2)
        found["duration"].append(ExtractedParam("duration", match.group(0), qty, f"{qty} {unit}"))

    for match in _COUNT_RE.finditer(folded):
        qty, unit = int(match.group(1)), match.group(2)
        found["count"].append(ExtractedParam("count", match.group(0), qty, f"{qty} {unit}"))

    return ParamAnalysis({k: tuple(v) for k, v in found.items()}, tuple(invalid))


def extract_params(text: str) -> dict[str, tuple[ExtractedParam, ...]]:
    """Return validated typed parameters extracted on the host."""
    return analyze_params(text).valid


def _contains_phrase(haystack: str, phrase: str, *, ascii_fold: bool) -> bool:
    target = fold_text(phrase) if ascii_fold else normalize_message(phrase)
    if not target:
        return False
    boundary_left = r"(?<![a-z0-9])" if ascii_fold else r"(?<!\w)"
    boundary_right = r"(?![a-z0-9])" if ascii_fold else r"(?!\w)"
    return re.search(boundary_left + re.escape(target) + boundary_right, haystack) is not None


def _has_interrogative(clause: str) -> bool:
    return any(regex.search(clause) is not None for regex in _INTERROGATIVE_PATTERNS)


def _content_tokens(clause: str) -> list[str]:
    return [tok for tok in re.findall(r"[a-z0-9]+", clause) if tok not in _TRAILING_CLAUSE_STOP]


def _clause_matches_pattern_concepts(pattern: QuestionPattern, clause: str) -> bool:
    """True if a sub-clause itself expresses concepts from the matched pattern (not an unrelated ask)."""
    haystack = fold_text(clause) if pattern.asciiFold else normalize_message(clause)
    if any(
        _contains_phrase(haystack, blocked, ascii_fold=pattern.asciiFold)
        for blocked in pattern.noneOf
    ):
        return False
    return all(
        any(_contains_phrase(haystack, phrase, ascii_fold=pattern.asciiFold) for phrase in group)
        for group in pattern.allOf
    )


def _clause_owned_by_pattern(pattern: QuestionPattern, clause: str) -> bool:
    """True if a coordinated clause inside a single question contains only concepts owned by pattern."""
    if _clause_matches_pattern_concepts(pattern, clause):
        return True
    haystack = fold_text(clause) if pattern.asciiFold else normalize_message(clause)
    if any(
        _contains_phrase(haystack, blocked, ascii_fold=pattern.asciiFold)
        for blocked in pattern.noneOf
    ):
        return False
    covered_tokens: set[str] = set()
    matched_any = False
    for group in pattern.allOf:
        for phrase in group:
            if _contains_phrase(haystack, phrase, ascii_fold=pattern.asciiFold):
                matched_any = True
                target = fold_text(phrase) if pattern.asciiFold else normalize_message(phrase)
                covered_tokens.update(re.findall(r"[a-z0-9]+", target))
    if not matched_any:
        return False
    clause_tokens = set(re.findall(r"[a-z0-9]+", haystack))
    uncovered = clause_tokens - covered_tokens - _QUESTION_FRAME_STOP
    return len(uncovered) == 0


def _has_uncovered_compound_clause(folded: str, pattern: QuestionPattern) -> bool:
    """Reject compound questions where an additional interrogative/request clause is uncovered."""
    # 1. Explicit multi-question sentences (e.g. "Wi-Fi ở đâu? Hồ bơi mở mấy giờ?").
    raw_sentences = [seg.strip() for seg in _SENTENCE_SPLIT_RE.split(folded) if seg.strip()]
    interrogative_sentences = [seg for seg in raw_sentences if _has_interrogative(seg)]
    if len(interrogative_sentences) > 1:
        if any(
            not _clause_matches_pattern_concepts(pattern, seg) for seg in interrogative_sentences
        ):
            return True

    # 2. Additive connectors ("ngoài ra", "thêm nữa", "với lại", "bên cạnh đó", ...).
    additive_parts = [seg.strip() for seg in _ADDITIVE_SPLIT_RE.split(folded) if seg.strip()]
    if len(additive_parts) > 1:
        if any(
            len(_content_tokens(part)) >= 2 and not _clause_matches_pattern_concepts(pattern, part)
            for part in additive_parts
        ):
            return True

    # 3. Repeated predicate/topic introducer across "và" (e.g. "có thú cưng và có hồ bơi không?",
    #    "chính sách thú cưng và chính sách hồ bơi").
    for match in _REPEATED_PREDICATE_COORD_RE.finditer(folded):
        va_pos = folded.find(" va ", match.start(), match.end())
        if va_pos != -1:
            left = folded[:va_pos].strip()
            right = folded[va_pos + 4 :].strip()
            if (
                len(_content_tokens(left)) >= 2
                and len(_content_tokens(right)) >= 2
                and (
                    not _clause_matches_pattern_concepts(pattern, left)
                    or not _clause_matches_pattern_concepts(pattern, right)
                )
            ):
                return True

    # 4. Coordinating split ("và"/"hay"/"hoặc") where either side contains an interrogative
    #    and the opposite non-trivial side is not covered by the matched pattern (symmetric for
    #    both "Wi-Fi ở đâu và hồ bơi mở cửa lúc mấy giờ?" and
    #    "Hồ bơi mở cửa lúc mấy giờ và Wi-Fi ở đâu?").
    for sent in raw_sentences:
        for match in _COORD_SPLIT_RE.finditer(sent):
            left = sent[: match.start()].strip(" ,")
            right = sent[match.end() :].strip(" ,")
            left_q = _has_interrogative(left)
            right_q = _has_interrogative(right)
            if not (left_q or right_q):
                continue
            if len(_content_tokens(left)) < 2 or len(_content_tokens(right)) < 2:
                continue
            if left_q:
                if not _clause_matches_pattern_concepts(pattern, left):
                    return True
                if not _clause_matches_pattern_concepts(pattern, right):
                    return True
            else:
                if not _clause_owned_by_pattern(pattern, right):
                    return True

    return False


def _match_pattern(
    pattern: QuestionPattern,
    normalized: str,
    folded: str,
    analysis: ParamAnalysis,
) -> tuple[str, tuple[ExtractedParam, ...]]:
    """Return ('matched', params) | ('invalid_parameter', ()) | ('compound_question_uncovered', ()) | ('no_match', ())."""
    haystack = folded if pattern.asciiFold else normalized
    if any(
        _contains_phrase(haystack, blocked, ascii_fold=pattern.asciiFold)
        for blocked in pattern.noneOf
    ):
        return "no_match", ()
    if any(analysis.valid.get(kind) for kind in pattern.disallowedParams):
        return "no_match", ()
    for group in pattern.allOf:
        if not any(
            _contains_phrase(haystack, phrase, ascii_fold=pattern.asciiFold) for phrase in group
        ):
            return "no_match", ()

    # Concept groups matched: now strictly validate parameters (never drop invalid/out-of-bounds ones).
    if analysis.invalid:
        return "invalid_parameter", ()

    matched_params: list[ExtractedParam] = []
    for spec in pattern.requiredParams:
        candidates = analysis.valid.get(spec.kind, ())
        if len(candidates) < spec.minCount:
            return "no_match", ()
        out_of_bounds = [
            item
            for item in candidates
            if (spec.minValue is not None and item.value < spec.minValue)
            or (spec.maxValue is not None and item.value > spec.maxValue)
        ]
        if out_of_bounds:
            return "invalid_parameter" if len(candidates) > len(out_of_bounds) else "no_match", ()
        matched_params.extend(candidates)

    # Whole-question coverage guard: reject compound questions with an uncovered clause.
    if _has_uncovered_compound_clause(folded, pattern):
        return "compound_question_uncovered", ()

    return "matched", tuple(matched_params)


def bind_question(catalog: VerifiedCatalog, redacted_message: str) -> QuestionBinding:
    """Host supplies the original message after existing redaction, not classifier.query."""
    if not isinstance(redacted_message, str) or not 1 <= len(redacted_message) <= 2000:
        return QuestionBinding("unknown", "question_unbound")
    normalized = normalize_message(redacted_message)
    folded = fold_text(redacted_message)
    analysis = analyze_params(redacted_message)

    matches = {}
    compound_matches = set()
    reject_reason: str | None = None
    for rule in catalog.data.questionRules:
        identity = (
            rule.bindingKey,
            digest([r.model_dump(mode="json", by_alias=True) for r in rule.requirements]),
            tuple(sorted(rule.permittedFactKeys)),
        )
        if any(normalize_message(alias) == normalized for alias in rule.aliases):
            matches.setdefault(identity, (rule, "alias", None, ()))
            continue
        for pattern in rule.patterns:
            outcome, extracted = _match_pattern(pattern, normalized, folded, analysis)
            if outcome == "matched":
                matches.setdefault(identity, (rule, "pattern", pattern.patternId, extracted))
                break
            if outcome == "invalid_parameter":
                reject_reason = "invalid_parameter"
            elif outcome == "compound_question_uncovered":
                compound_matches.add(identity)
                if reject_reason is None:
                    reject_reason = "compound_question_uncovered"

    if len(set(matches) | compound_matches) > 1:
        return QuestionBinding("ambiguous", "question_ambiguous")
    if not matches:
        if reject_reason == "invalid_parameter":
            return QuestionBinding("unknown", "invalid_parameter", invalidParams=analysis.invalid)
        if reject_reason == "compound_question_uncovered":
            return QuestionBinding("unknown", "compound_question_uncovered")
        return QuestionBinding("unknown", "question_unbound")
    rule, source, pattern_id, extracted = next(iter(matches.values()))
    return QuestionBinding(
        "bound",
        "bound",
        rule.bindingKey,
        rule.requirements,
        frozenset(rule.permittedFactKeys),
        matchSource=source,
        matchedPatternId=pattern_id,
        extractedParams=extracted,
    )
