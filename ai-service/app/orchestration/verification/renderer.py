"""Release only catalog values through reviewed, data-only renderer segments."""

from .catalog import value_key
from .gate import VerificationResult, protocol


def render(turn, result):
    turn._check()
    if not isinstance(result, VerificationResult):
        raise protocol()
    verified = result.verifiedFactSet
    if (
        result.outcome != "verified"
        or verified is None
        or verified is not turn._grant
        or verified._issuer is not turn._issuer
        or verified.contextHash != turn._context_hash
        or verified.catalogHash != turn.catalog.expected_hash
    ):
        raise protocol()
    texts, citations, seen = [], [], set()
    for fact_id in verified.factIds:
        fact = turn.catalog.facts[fact_id]
        template = turn.catalog.templates[fact.renderer.key]
        # Recheck coverage before release; a renderer invariant failure is not abstention.
        turn.catalog._template(fact, template)
        parts = []
        for segment in template.segments:
            if segment.kind == "literal":
                text = segment.text
            elif segment.kind == "value":
                text = next(
                    label.text
                    for label in template.valueLabels
                    if value_key(label.value) == value_key(fact.value)
                )
            elif segment.kind == "qualifier":
                text = turn.catalog.qualifiers[segment.qualifierId].rendererToken
            elif segment.kind == "unit":
                text = template.unitText
            else:
                text = template.scopeText
            if text is None:
                raise RuntimeError("Renderer invariant failed")
            parts.append(text)
        texts.append("".join(parts))
        for binding in fact.provenance.bindings:
            if binding.citationId not in seen:
                seen.add(binding.citationId)
                citations.append(
                    turn._by_id[binding.citationId].model_dump(exclude={"excerpt", "corpusMode"})
                )
    answer = " ".join(texts)
    if len(answer) > 4000 or len(answer.encode("utf-16-le")) // 2 > 4000 or len(citations) > 3:
        turn._grant = None
        return None
    turn._check()
    turn._grant = None  # A successful release consumes the per-turn permit.
    return answer, citations
