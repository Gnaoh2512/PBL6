import asyncio

import pytest
from hybrid_support import hybrid
from indexing_support import TODAY

from app.indexing import EmbeddingProfile, HybridConfig, IndexingError
from app.providers.contracts import DependencyError, TurnBudget
from app.retrieval.hybrid import HybridFaqIndex, faq_batch


def run(awaitable):
    return asyncio.run(awaitable)


@pytest.fixture
def retriever(tmp_path):
    return hybrid(tmp_path, TODAY)


def test_hybrid_retrieval_pins_identity_embeds_once_preserves_scores_and_provenance(retriever):
    budget = TurnBudget()
    result = run(retriever.retrieve("wifi", TODAY, budget=budget))
    assert result.status == "hybrid" and result.bm25.status == result.vector.status == "ok"
    assert len(retriever.embedder.calls) == 1 and retriever.embedder.calls[0][1] is budget
    assert len(retriever.vector.calls) == 1
    assert result.bm25.candidates[0].score < 0
    assert result.ranked[0].chunk.section_id == "FAQ-WIFI"
    assert result.ranked[0].chunk.source_id == "demo-faq"
    assert {s.backend for s in result.ranked[0].sources} == {"bm25", "vector"}
    assert "source_checksum" in result.debug()["evidence"][0]["chunk"]
    batch = faq_batch(result)
    assert batch.snapshot_id == result.snapshot_id
    assert batch.evidence[0].citationId == result.ranked[0].chunk.chunk_id
    assert set(batch.evidence[0].model_dump()) == {
        "citationId",
        "documentId",
        "version",
        "chunkId",
        "sectionId",
        "title",
        "sourceRef",
        "excerpt",
        "corpusMode",
    }


def test_empty_query_does_not_encode_or_search_and_empty_backend_is_success(retriever):
    assert run(retriever.retrieve(" \n", TODAY)).status == "empty"
    assert not retriever.embedder.calls
    result = run(retriever.retrieve("astronaut", TODAY))
    assert (
        result.status == "hybrid" and result.bm25.status == "empty" and result.vector.status == "ok"
    )
    result = run(retriever.retrieve("wifi", TODAY, category="policy"))
    assert result.status == "empty" and result.bm25.status == result.vector.status == "empty"
    assert faq_batch(result).evidence == ()


@pytest.mark.parametrize(
    "embedding,error",
    [
        (True, "EMBEDDING_UNAVAILABLE"),
        (True, "EMBEDDING_TIMEOUT"),
        (True, "EMBEDDING_PROTOCOL_ERROR"),
        (False, "QDRANT_UNAVAILABLE"),
        (False, "QDRANT_COLLECTION_MISSING"),
        (False, "QDRANT_TIMEOUT"),
    ],
)
def test_backend_failure_is_not_silently_full_hybrid(retriever, embedding, error):
    target = retriever.embedder if embedding else retriever.vector
    target.error = error
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "failed" and result.ranked == ()
    assert result.bm25.status == "ok" and result.vector.status == "error"
    assert result.vector.error == error
    with pytest.raises(DependencyError) as raised:
        faq_batch(result)
    expected = (
        "DEADLINE_EXCEEDED"
        if error.endswith("_TIMEOUT")
        else "AI_PROTOCOL_ERROR"
        if error.endswith("PROTOCOL_ERROR")
        else "DEPENDENCY_UNAVAILABLE"
    )
    assert raised.value.code == expected


@pytest.mark.parametrize("both", [False, True])
def test_bm25_failure_and_both_backends_failure_are_distinct(retriever, monkeypatch, both):
    def fail(*args, **kwargs):
        raise IndexingError("BM25_UNAVAILABLE")

    monkeypatch.setattr(retriever, "bm25", fail)
    if both:
        retriever.vector.error = "QDRANT_UNAVAILABLE"
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "failed" and result.bm25.status == "error"
    assert result.vector.status == ("error" if both else "ok")
    assert result.ranked == ()


@pytest.mark.parametrize("kind", ["missing", "pointer", "config", "source"])
def test_invalid_or_missing_snapshot_stops_all_dispatch(retriever, kind):
    p = retriever.paired
    if kind == "missing":
        (p.directory / "active.json").unlink()
    elif kind == "pointer":
        (p.directory / "active.json").write_text('{"run_id":"../bad"}')
    elif kind == "config":
        retriever.embedder.profile = EmbeddingProfile(dimension=1536)
    else:
        (p.root / "tests/fixtures/d1/faq.md").write_text("unapproved")
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "failed" and result.snapshot_error
    assert result.bm25.status == result.vector.status == "not_run"
    assert not retriever.embedder.calls and not retriever.vector.calls


def test_candidate_limits_filters_and_faq_cap(retriever):
    retriever.config = HybridConfig(bm25_top_k=1, vector_top_k=2, final_top_k=1, rrf_constant=10)
    result = run(retriever.retrieve("wifi", TODAY, source_id="demo-faq", category="faq"))
    assert len(result.bm25.candidates) == 1 and len(result.vector.candidates) == 2
    assert len(result.ranked) == 1
    assert run(retriever.retrieve("wifi", TODAY, source_id="other")).status == "empty"


def test_bm25_ties_are_rowid_stable(retriever):
    import json
    import sqlite3
    from contextlib import closing

    original = retriever.pin(TODAY)
    chunks = [
        dict(original["chunks"][i], content="needle", chunk_id=cid * 64)
        for i, cid in [(0, "b"), (1, "a")]
    ]
    run_id = "c" * 32
    directory = retriever.paired.directory / run_id
    directory.mkdir()
    with closing(sqlite3.connect(directory / "index.sqlite")) as db:
        db.execute("CREATE VIRTUAL TABLE chunks USING fts5(search, metadata UNINDEXED)")
        for chunk in chunks:
            db.execute("INSERT INTO chunks VALUES (?,?)", ("needle", json.dumps(chunk)))
        db.commit()
    manifest = {**original, "run_id": run_id, "chunks": chunks}
    a = retriever.bm25("needle", manifest, TODAY)
    assert len(a) == 2 and a[0].score == a[1].score
    assert [c.chunk.chunk_id for c in a] == ["b" * 64, "a" * 64]
    assert a == retriever.bm25("needle", manifest, TODAY)


def test_vector_empty_is_not_an_error_and_publication_mid_query_never_mixes_collections(
    retriever, monkeypatch
):
    first = retriever.pin(TODAY)
    original = retriever.embedder.query

    async def publish(*args):
        retriever.paired.rebuild(TODAY)
        return await original(*args)

    monkeypatch.setattr(retriever.embedder, "query", publish)
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "hybrid" and retriever.vector.calls == [first["collection"]]
    assert retriever.pin(TODAY)["collection"] != first["collection"]

    async def empty(*args, **kwargs):
        return []

    monkeypatch.setattr(retriever.vector, "search", empty)
    result = run(retriever.retrieve("wifi", TODAY))
    assert (
        result.status == "hybrid" and result.bm25.status == "ok" and result.vector.status == "empty"
    )


def test_wrong_query_vector_dimension_fails_before_vector_dispatch(retriever, monkeypatch):
    async def wrong(*_):
        return [1]

    monkeypatch.setattr(retriever.embedder, "query", wrong)
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.vector.error == "DIMENSION_MISMATCH" and not retriever.vector.calls
    with pytest.raises(DependencyError) as error:
        faq_batch(result)
    assert error.value.code == "AI_PROTOCOL_ERROR"


def test_cancelled_embedding_is_cleaned_up_and_never_replaced_by_bm25_success(
    retriever, monkeypatch
):
    closed = []

    async def wait(*_):
        try:
            await asyncio.Event().wait()
        finally:
            closed.append(True)

    monkeypatch.setattr(retriever.embedder, "query", wait)

    async def scenario():
        with pytest.raises(TimeoutError):
            async with asyncio.timeout(0.02):
                await retriever.retrieve("wifi", TODAY)

    run(scenario())
    assert closed == [True]


def test_unexpected_backend_bugs_propagate_and_snapshot_changes_fail_closed(retriever, monkeypatch):
    original = retriever.embedder.query

    async def changed(*args):
        vector = await original(*args)
        source = retriever.paired.root / "tests/fixtures/d1/faq.md"
        source.write_bytes(source.read_bytes() + b"\nchanged")
        return vector

    monkeypatch.setattr(retriever.embedder, "query", changed)
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "failed" and result.snapshot_error
    index = HybridFaqIndex(retriever)
    with pytest.raises(DependencyError):
        index.validate(TODAY)


def test_vector_metadata_types_fail_as_typed_backend_error_not_uncaught_validation(
    retriever, monkeypatch
):
    original = retriever.vector.search

    async def invalid(*args, **kwargs):
        points = await original(*args, **kwargs)
        points[0]["payload"]["approved"] = 1  # Equality matches True; strict schema must reject.
        return points

    monkeypatch.setattr(retriever.vector, "search", invalid)
    result = run(retriever.retrieve("wifi", TODAY))
    assert result.status == "failed" and result.vector.error == "QDRANT_PROTOCOL_ERROR"
