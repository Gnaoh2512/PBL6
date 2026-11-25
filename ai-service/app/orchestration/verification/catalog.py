"""Validate a publisher-pinned catalog against separately supplied source state."""

import hashlib
import json
from collections.abc import Callable
from datetime import date
from decimal import Decimal
from types import MappingProxyType

from pydantic import BaseModel, ValidationError

from app.diagnostics import Category
from app.providers.contracts import DependencyError
from app.schemas.verification import Approval, CatalogData, Fact, Source, Value

MAX_CATALOG_BYTES = 1024 * 1024


def _normalize_rule_dump(rule_dict: dict) -> dict:
    if rule_dict.get("patterns") == []:
        out = dict(rule_dict)
        out.pop("patterns", None)
        return out
    return rule_dict


def _dump_for_hash(value):
    if isinstance(value, BaseModel):
        dumped = value.model_dump(mode="json", by_alias=True)
        if isinstance(value, CatalogData):
            dumped["questionRules"] = [
                _normalize_rule_dump(r) for r in dumped.get("questionRules", [])
            ]
        elif isinstance(dumped, dict) and "bindingKey" in dumped and "aliases" in dumped:
            dumped = _normalize_rule_dump(dumped)
        return dumped
    return value


def canonical(value) -> bytes:
    value = _dump_for_hash(value)
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def digest(value) -> str:
    return hashlib.sha256(value if isinstance(value, bytes) else canonical(value)).hexdigest()


def review_hash(record, *, vocabulary=None, template=None):
    """Publisher-side hash definition; calculating a hash does not grant approval."""
    data = dict(_dump_for_hash(record)) if isinstance(record, BaseModel) else dict(record)
    data.pop("approval", None)
    if vocabulary is not None:
        data = {
            "fact": data,
            "vocabularyHash": digest(vocabulary),
            "rendererHash": digest(template),
        }
    return digest(data)


def dependency():
    return DependencyError(diagnostic_category=Category.INDEX_VALIDATION)


def unique(items, key):
    result = {}
    for item in items:
        identity = key(item)
        if identity in result:
            raise ValueError("Duplicate catalog identity")
        result[identity] = item
    return result


def value_key(value: Value):
    return value.kind, Decimal(value.data) if value.kind == "decimal" else value.data


def active(validity, today: date):
    return validity.validFrom <= today and (
        validity.validThrough is None or today <= validity.validThrough
    )


def component_hashes(data):
    return (
        digest(data.vocabulary),
        digest(
            {
                "version": data.questionRulesVersion,
                "rules": [_dump_for_hash(r) for r in data.questionRules],
            }
        ),
        digest(
            {
                "version": data.rendererVersion,
                "templates": [t.model_dump(mode="json", by_alias=True) for t in data.templates],
            }
        ),
    )


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


class VerifiedCatalog:
    """The pin and authority set MUST come from the host, never from model output."""

    def __init__(
        self,
        reader: Callable[[], bytes],
        *,
        expected_hash: str,
        authorities: frozenset[str],
        source_reader: Callable[[], tuple[Source, ...]],
    ):
        self._reader, self._source_reader = reader, source_reader
        self.expected_hash, self._authorities = expected_hash, frozenset(authorities)
        try:
            raw = reader()
            if (
                not isinstance(raw, bytes)
                or len(raw) > MAX_CATALOG_BYTES
                or digest(raw) != expected_hash
            ):
                raise ValueError("Catalog pin mismatch")
            json.loads(raw, object_pairs_hook=_pairs)
            self.data = CatalogData.model_validate_json(raw)
            self._model_hash = digest(self.data)
            self._compile()
        except (OSError, ValueError, TypeError, ValidationError):
            raise dependency() from None

    def _approval(self, approval: Approval, expected_hash: str):
        if approval.status == "pending_review":
            return
        if (
            approval.authorityRef not in self._authorities
            or approval.reviewedContentSha256 != expected_hash
        ):
            raise ValueError("Untrusted review")

    def _compile(self):
        data = self.data
        self._approval(data.approval, review_hash(data))
        if data.approval.status != "approved":
            raise ValueError("Catalog not approved")
        self.predicates = unique(data.vocabulary.predicates, lambda p: p.id)
        self.qualifiers = unique(data.vocabulary.qualifiers, lambda q: q.id)
        self.templates = unique(data.templates, lambda t: t.key)
        self.sources = unique(data.sources, lambda s: (s.documentId, s.sourceVersion))
        self.facts = unique(data.facts, lambda f: f.factId)
        self.bindings = unique(
            (b for f in data.facts for b in f.provenance.bindings), lambda b: b.bindingId
        )
        if len(set(data.vocabulary.subjects)) != len(data.vocabulary.subjects):
            raise ValueError("Duplicate subject")
        for source in data.sources:
            self._approval(source.approval, review_hash(source))
        keys = {}
        for fact in data.facts:
            predicate = self.predicates.get(fact.predicate)
            if not self.proposition_known(fact) or predicate is None:
                raise ValueError("Fact outside vocabulary")
            identity = (fact.subjectId, fact.predicate)
            if keys.setdefault(fact.factKey, identity) != identity:
                raise ValueError("Inconsistent fact key")
            template = self.templates.get(fact.renderer.key)
            if (
                template is None
                or template.version != fact.renderer.version
                or digest(template) != fact.renderer.hash
            ):
                raise ValueError("Renderer pin mismatch")
            self._approval(
                fact.approval, review_hash(fact, vocabulary=data.vocabulary, template=template)
            )
            if any(b.factId != fact.factId for b in fact.provenance.bindings):
                raise ValueError("Binding owner mismatch")
            for binding in fact.provenance.bindings:
                source = self.sources.get((binding.documentId, binding.sourceVersion))
                if source is None or (
                    binding.sourceSha256,
                    binding.sourceRef,
                    binding.snapshotId,
                ) != (source.sourceSha256, source.sourceRef, source.snapshotId):
                    raise ValueError("Invalid source binding")
            self._template(fact, template)
        for qualifier in data.vocabulary.qualifiers:
            if any(b not in self.bindings for b in qualifier.supportBindingIds):
                raise ValueError("Qualifier source missing")
        for rule in data.questionRules:
            required = [r.factKey for r in rule.requirements]
            if len(set(required)) != len(required) or not set(required) <= set(
                rule.permittedFactKeys
            ):
                raise ValueError("Invalid question coverage")
            pattern_ids = [p.patternId for p in rule.patterns]
            if len(set(pattern_ids)) != len(pattern_ids):
                raise ValueError("Duplicate question pattern")
            for pattern in rule.patterns:
                if any(not phrase.strip() for group in pattern.allOf for phrase in group):
                    raise ValueError("Empty pattern phrase")
                if any(not phrase.strip() for phrase in pattern.noneOf):
                    raise ValueError("Empty pattern disqualifier")
            for r in rule.requirements:
                if (
                    r.subjectId not in data.vocabulary.subjects
                    or not set(r.qualifierIds) <= self.qualifiers.keys()
                ):
                    raise ValueError("Unknown question scope")
        for name in ("predicates", "qualifiers", "templates", "sources", "facts", "bindings"):
            setattr(self, name, MappingProxyType(getattr(self, name)))

    def proposition_known(self, p):
        predicate = self.predicates.get(p.predicate)
        return bool(
            p.subjectId in self.data.vocabulary.subjects
            and predicate
            and p.value.kind == predicate.valueKind
            and (p.value.kind != "enum" or p.value.data in predicate.enumValues)
            and (p.unit is None or p.unit in predicate.units)
            and set(p.qualifierIds) <= self.qualifiers.keys()
        )

    def _template(self, fact: Fact, template):
        counts = [s.kind for s in template.segments]
        qids = [s.qualifierId for s in template.segments if s.kind == "qualifier"]
        if len(qids) != len(set(qids)) or set(qids) != set(fact.qualifierIds):
            raise ValueError("Renderer qualifier coverage")
        if counts.count("value") != 1 or counts.count("unit") != int(fact.unit is not None):
            raise ValueError("Renderer value/unit coverage")
        if counts.count("scope") != int(fact.timeScope.kind != "none"):
            raise ValueError("Renderer time coverage")
        if (template.unitText is not None) != (fact.unit is not None) or (
            template.scopeText is not None
        ) != (fact.timeScope.kind != "none"):
            raise ValueError("Renderer scope text")
        labels = [value_key(label.value) for label in template.valueLabels]
        if len(set(labels)) != len(labels) or value_key(fact.value) not in labels:
            raise ValueError("Invalid value label")
        for qid in fact.qualifierIds:
            if not set(self.qualifiers[qid].supportBindingIds) & {
                b.bindingId for b in fact.provenance.bindings
            }:
                raise ValueError("Qualifier provenance missing")

    def check_current(self):
        try:
            raw = self._reader()
            if (
                not isinstance(raw, bytes)
                or len(raw) > MAX_CATALOG_BYTES
                or digest(raw) != self.expected_hash
            ):
                raise ValueError("Catalog drift")
            if digest(self.data) != self._model_hash:
                raise ValueError("Catalog state mutated")
            records = tuple(self._source_reader())
            if any(not isinstance(s, Source) for s in records):
                raise ValueError("Invalid host source record")
            sources = unique(records, lambda s: (s.documentId, s.sourceVersion))
            for source in records:
                self._approval(source.approval, review_hash(source))
            return sources
        except (OSError, ValueError, TypeError, ValidationError):
            raise dependency() from None
