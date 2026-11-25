import copy
import json

import pytest
from indexing_support import TODAY, FakeEmbedding, MemoryQdrant, corpus

from app.indexing import ChunkingConfig, EmbeddingProfile, IndexingError
from app.ingestion.snapshot import build
from app.ingestion.vector_pipeline import PairedIndex
from app.retrieval.index import KnowledgeIndex


@pytest.fixture
def pipeline(tmp_path):
    p = corpus(tmp_path)
    provider, store = FakeEmbedding(), MemoryQdrant()
    return PairedIndex("demo_synthetic", provider, store, root=tmp_path), p


def test_paired_rebuild_preserves_fts_and_all_chunk_source_identities(pipeline):
    index, _ = pipeline
    manifest = index.rebuild(TODAY)
    assert index.active(TODAY) == manifest
    sql = index.lexical_search("wifi", TODAY)
    vector = [1.0] + [0.0] * 767
    semantic = index.similarity_search(vector, TODAY)
    assert semantic[0]["chunk"]["section_id"] == "FAQ-WIFI"
    assert sql[0]["chunk_id"] == semantic[0]["chunk"]["chunk_id"]
    assert sql[0]["source_id"] == semantic[0]["chunk"]["source_id"] == "demo-faq"
    assert {c["chunk_id"] for c in manifest["chunks"]} == set(
        index.store.inventory(manifest["collection"], 768)
    )
    assert index.lexical_search("astronaut rocket", TODAY) == []
    assert index.similarity_search(vector, TODAY, category="policy") == []
    assert index.similarity_search(vector, TODAY, source_id="missing") == []
    assert index.lexical_search("", TODAY) == []
    # Original D1 builder/KnowledgeIndex remains usable and uses its original snapshot format.
    old = KnowledgeIndex(
        build("demo_synthetic", TODAY, index.root), "demo_synthetic", TODAY, index.root
    )
    assert old.search("wifi", TODAY)[0].sectionId == "FAQ-WIFI"


def test_rebuild_is_reproducible_but_never_overwrites_old_collection(pipeline):
    index, _ = pipeline
    first = index.rebuild(TODAY)
    second = index.rebuild(TODAY)
    assert first["snapshot_id"] == second["snapshot_id"]
    assert first["chunks"] == second["chunks"]
    assert first["collection"] != second["collection"]
    assert len(index.store.collections) == 2
    assert index.active(TODAY) == second


@pytest.mark.parametrize(
    "stage",
    [
        "source",
        "embedding",
        "dimension",
        "upsert",
        "payload",
        "activate",
        "fts",
        "source_race",
        "create_ack",
    ],
)
def test_failed_rebuild_retains_original_active_pair(pipeline, monkeypatch, stage):
    index, source = pipeline
    first = index.rebuild(TODAY)
    pointer = index.directory / "active.json"
    original = pointer.read_bytes()
    source_bytes = source.read_bytes()
    original_write = index._write_fts
    if stage == "source":
        source.write_text("empty", encoding="utf-8")
    if stage == "embedding":
        index.embedding.failure = True
    if stage == "dimension":
        monkeypatch.setattr(index.embedding, "document", lambda *_: [1.0])
    if stage == "upsert":
        index.store.fail_upsert = True
    if stage == "create_ack":
        create = index.store.create

        def failed_ack(name, dimension):
            create(name, dimension)
            raise IndexingError("QDRANT_TIMEOUT")

        monkeypatch.setattr(index.store, "create", failed_ack)
    if stage == "payload":
        real = index.store.upsert

        def broken(*args):
            real(*args)
            next(iter(index.store.collections[args[0]][1].values()))[0]["source_id"] = "wrong"

        monkeypatch.setattr(index.store, "upsert", broken)
    if stage == "activate":

        def broken(*_):
            raise OSError("synthetic disk failure")

        monkeypatch.setattr(index, "_activate", broken)
    if stage in {"fts", "source_race"}:

        def write(path, chunks):
            original_write(path, chunks)
            if stage == "fts":
                path.write_bytes(b"corrupt")
            else:
                source.write_bytes(source_bytes + b"\nchanged")

        monkeypatch.setattr(index, "_write_fts", write)
    with pytest.raises(IndexingError):
        index.rebuild(TODAY)
    assert pointer.read_bytes() == original
    assert len(index.store.collections) == 1
    source.write_bytes(source_bytes)
    assert index.active(TODAY) == first
    assert not (index.directory / ".build.lock").exists()


def test_cleanup_failure_is_reported_without_losing_active_index(pipeline):
    index, _ = pipeline
    first = index.rebuild(TODAY)
    index.store.fail_upsert = index.store.fail_cleanup = True
    with pytest.raises(IndexingError) as failure:
        index.rebuild(TODAY)
    assert failure.value.cleanup_pending
    assert index.active(TODAY) == first
    assert len(index.store.collections) == 2


def test_disk_failure_preserves_cleanup_pending_detail(pipeline, monkeypatch):
    index, _ = pipeline
    first = index.rebuild(TODAY)
    index.store.fail_cleanup = True

    def failed(*_):
        raise OSError("synthetic disk failure")

    monkeypatch.setattr(index, "_activate", failed)
    with pytest.raises(IndexingError, match="INDEX_IO_ERROR") as error:
        index.rebuild(TODAY)
    assert error.value.cleanup_pending
    assert index.active(TODAY) == first


def test_no_active_index_on_first_failed_build_or_concurrent_writer(pipeline):
    index, _ = pipeline
    with pytest.raises(IndexingError, match="INDEX_NOT_AVAILABLE"):
        index.active(TODAY)
    index.embedding.failure = True
    with pytest.raises(IndexingError):
        index.rebuild(TODAY)
    assert not (index.directory / "active.json").exists()
    (index.directory / ".build.lock").write_text("test-owned")
    with pytest.raises(IndexingError, match="INDEX_BUILD_IN_PROGRESS"):
        index.rebuild(TODAY)
    assert (index.directory / ".build.lock").read_text() == "test-owned"


@pytest.mark.parametrize(
    "change",
    [
        "source",
        "chunking",
        "model_revision",
        "model",
        "dimension",
        "payload",
        "vector",
        "database",
        "manifest",
        "pointer",
    ],
)
def test_drift_is_detected_fail_closed(pipeline, change):
    index, source = pipeline
    manifest = index.rebuild(TODAY)
    path = index.directory / manifest["run_id"]
    if change == "source":
        source.write_bytes(source.read_bytes() + b"\nchange")
    if change == "chunking":
        index.chunking = ChunkingConfig(max_characters=1999)
    if change == "model_revision":
        index.profile = EmbeddingProfile(revision="reviewed-next")
    if change == "dimension":
        index.profile = EmbeddingProfile(dimension=1536)
    if change == "model":
        index.profile = EmbeddingProfile(model="gemini-embedding-2")
    if change == "payload":
        next(iter(index.store.collections[manifest["collection"]][1].values()))[0][
            "document_version"
        ] = "stale"
    if change == "vector":
        next(iter(index.store.collections[manifest["collection"]][1].values()))[1][0] = 0.5
    if change == "database":
        (path / "index.sqlite").write_bytes(b"bad")
    if change == "manifest":
        (path / "manifest.json").write_text("{}")
    if change == "pointer":
        (index.directory / "active.json").write_text('{"run_id":"../outside"}')
    with pytest.raises(IndexingError):
        index.active(TODAY)


def test_rebuild_after_content_or_configuration_change_activates_new_consistent_pair(pipeline):
    index, source = pipeline
    first = index.rebuild(TODAY)
    source.write_bytes(source.read_bytes().replace("quầy lễ tân".encode(), "bàn tiếp tân".encode()))
    second = index.rebuild(TODAY)
    assert second["snapshot_id"] != first["snapshot_id"]
    assert second["chunks"][0]["chunk_id"] != first["chunks"][0]["chunk_id"]
    index.profile = index.embedding.profile = EmbeddingProfile(dimension=1536)
    third = index.rebuild(TODAY)
    assert third["snapshot_id"] != second["snapshot_id"]
    assert index.active(TODAY) == third
    assert len(index.store.collections) == 3
    index.profile = index.embedding.profile = EmbeddingProfile(
        model="gemini-embedding-2", dimension=1536
    )
    with pytest.raises(IndexingError, match="INDEX_CONFIGURATION_CHANGED"):
        index.active(TODAY)
    fourth = index.rebuild(TODAY)
    assert fourth["snapshot_id"] != third["snapshot_id"]
    assert index.active(TODAY) == fourth and len(index.store.collections) == 4


def test_tampered_search_payload_cannot_escape_a_valid_inventory(pipeline, monkeypatch):
    index, _ = pipeline
    index.rebuild(TODAY)
    original = index.store.search

    def search(*args, **kwargs):
        result = copy.deepcopy(original(*args, **kwargs))
        result[0]["payload"]["content"] = "not the indexed source"
        return result

    monkeypatch.setattr(index.store, "search", search)
    with pytest.raises(IndexingError, match="INDEX_OUT_OF_SYNC"):
        index.similarity_search([1.0] + [0.0] * 767, TODAY)


def test_pointer_publication_observes_previous_then_new_complete_release(pipeline, monkeypatch):
    index, _ = pipeline
    first = index.rebuild(TODAY)
    original = index._activate

    def activate(run_id, checksum):
        assert index.active(TODAY) == first
        assert (index.directory / run_id / "manifest.json").is_file()
        assert len(index.store.collections) == 2
        original(run_id, checksum)

    monkeypatch.setattr(index, "_activate", activate)
    second = index.rebuild(TODAY)
    assert index.active(TODAY) == second
    assert json.loads((index.directory / "active.json").read_bytes())["run_id"] == second["run_id"]
