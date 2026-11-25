from datetime import date

import pytest
from indexing_support import TODAY, corpus

from app.indexing import ChunkingConfig, HybridConfig, IndexingError
from app.ingestion.documents import load_chunks
from app.retrieval.fusion import Candidate, rrf


@pytest.fixture
def chunks(tmp_path):
    corpus(tmp_path)
    return load_chunks(tmp_path, "demo_synthetic", TODAY, ChunkingConfig())[0]


def fuse(a, b, **kw):
    return rrf(a, b, mode="demo_synthetic", today=TODAY, **kw)


def test_rank_fusion_uses_ranks_not_incommensurate_raw_scores(chunks):
    a, b, c = chunks
    bm = [Candidate(a, "bm25", 1, -1000), Candidate(b, "bm25", 2, -0.00001)]
    vec = [Candidate(b, "vector", 1, 0.1), Candidate(c, "vector", 2, 0.99)]
    result = fuse(bm, vec)
    assert result[0].chunk == b and result[0].rrf_score == pytest.approx(1 / 62 + 1 / 61)
    assert [s.backend for s in result[0].sources] == ["bm25", "vector"]
    changed = [Candidate(a, "bm25", 1, -0.1), Candidate(b, "bm25", 2, -10000)]
    assert [r.chunk.chunk_id for r in fuse(changed, vec)] == [r.chunk.chunk_id for r in result]
    assert [r.rank for r in result] == [1, 2, 3]


def test_duplicates_do_not_vote_twice_and_ties_are_deterministic(chunks):
    a, b, _ = chunks
    bm = [Candidate(a, "bm25", 1, -1), Candidate(a, "bm25", 2, -1), Candidate(b, "bm25", 1, -1)]
    result = fuse(bm, [])
    assert len(result) == 2 and all(r.rrf_score == pytest.approx(1 / 61) for r in result)
    assert [r.chunk.chunk_id for r in result] == sorted([a.chunk_id, b.chunk_id])
    assert fuse(list(reversed(bm)), []) == result
    assert len(fuse(bm, [], top_k=1)) == 1
    assert fuse([], []) == ()
    assert fuse([], [Candidate(a, "vector", 1, 0.1)])[0].chunk == a


@pytest.mark.parametrize(
    "change",
    [
        {"approved": False},
        {"corpus_mode": "production"},
        {"effective_from": date(2099, 1, 1)},
        {"effective_to": date(2020, 1, 1)},
    ],
)
def test_approval_mode_and_validity_filtering(chunks, change):
    c = chunks[0].model_copy(update=change)
    assert fuse([Candidate(c, "bm25", 1, -1)], []) == ()


def test_filters_are_applied_before_final_top_k_and_preserve_provenance(chunks):
    a, b, _ = chunks
    b = b.model_copy(update={"document_type": "policy", "source_id": "other"})
    hits = fuse(
        [Candidate(a, "bm25", 1, -1), Candidate(b, "bm25", 2, -0.1)],
        [],
        top_k=1,
        category="policy",
        source_id="other",
    )
    assert hits[0].chunk == b and hits[0].debug()["chunk"] == b.payload()
    assert hits[0].sources[0].rank == 2


def test_identity_mismatch_and_invalid_config_are_rejected(chunks):
    c = chunks[0]
    with pytest.raises(IndexingError, match="RETRIEVAL_IDENTITY_MISMATCH"):
        fuse(
            [Candidate(c, "bm25", 1, -1)],
            [Candidate(c.model_copy(update={"content": "tampered"}), "vector", 1, 0.1)],
        )
    with pytest.raises(IndexingError):
        fuse([], [], constant=0)
    with pytest.raises(IndexingError):
        Candidate(c, "bm25", 0, 1)
    assert HybridConfig().final_top_k == 3


@pytest.mark.parametrize("change", [{"approved": False}, {"corpus_mode": "production"}])
def test_ineligible_duplicate_cannot_vote_or_poison_an_authorized_chunk(chunks, change):
    allowed = chunks[0]
    forbidden = allowed.model_copy(update={**change, "content": "ineligible payload"})
    good = Candidate(allowed, "bm25", 2, -1)
    result = fuse([Candidate(forbidden, "bm25", 1, -10), good], [])
    assert result == fuse([good], [])
    assert result[0].chunk == allowed and result[0].rrf_score == pytest.approx(1 / 62)


@pytest.mark.parametrize("score", [float("nan"), float("inf"), True, "1", 10**400])
def test_invalid_raw_scores_raise_typed_error(chunks, score):
    with pytest.raises(IndexingError, match="RETRIEVAL_PROTOCOL_ERROR"):
        Candidate(chunks[0], "vector", 1, score)
