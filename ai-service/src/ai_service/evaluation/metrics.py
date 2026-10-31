"""Ranking metrics used only with independently proposed relevance grades."""

from __future__ import annotations

from math import log2


def ndcg_at_k(ranked_ids: list[int], relevance: dict[int, int], k: int) -> float:
    if k < 1:
        raise ValueError("k must be positive")
    if len(ranked_ids) != len(set(ranked_ids)):
        raise ValueError("ranked IDs must be unique")
    if any(room_id not in relevance for room_id in ranked_ids[:k]):
        raise ValueError("ranked ID lacks a relevance label")
    if any(grade < 0 for grade in relevance.values()):
        raise ValueError("relevance must be nonnegative")

    def dcg(grades: list[int]) -> float:
        return sum((2**grade - 1) / log2(position + 2) for position, grade in enumerate(grades))

    observed = dcg([relevance[room_id] for room_id in ranked_ids[:k]])
    ideal = dcg(sorted(relevance.values(), reverse=True)[:k])
    return observed / ideal if ideal else 0.0
