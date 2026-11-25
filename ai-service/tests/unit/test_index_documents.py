import shutil
from datetime import date

import pytest

from app.indexing import ChunkingConfig, EmbeddingProfile, IndexingError
from app.ingestion.documents import fingerprint, load_chunks
from app.ingestion.snapshot import ROOT

TODAY = date(2026, 11, 21)


@pytest.fixture
def source(tmp_path):
    p = tmp_path / "tests/fixtures/d1/faq.md"
    p.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", p)
    return tmp_path, p


def load(root, **kwargs):
    return load_chunks(root, "demo_synthetic", TODAY, ChunkingConfig(**kwargs))


def test_complete_sections_retain_document_context_exceptions_and_provenance(source):
    root, _ = source
    chunks, sources = load(root)
    assert len(chunks) == 3
    luggage = chunks[1]
    assert "trong ngày" in luggage.content and "Không nhận vật dễ cháy" in luggage.content
    assert "# Dữ liệu giả lập" in luggage.content
    assert luggage.source_id == "demo-faq" and luggage.section_id == "FAQ-LUGGAGE"
    assert luggage.source_checksum == sources[luggage.source_path]
    assert luggage.document_version == "1.0.0" and luggage.approved
    assert luggage.effective_from == date(2026, 1, 1)
    assert load(root) == (chunks, sources)
    profile = EmbeddingProfile()
    before = fingerprint(chunks, sources, ChunkingConfig(), profile)
    assert before != fingerprint(chunks, sources, ChunkingConfig(max_characters=1999), profile)
    assert before != fingerprint(
        chunks, sources, ChunkingConfig(), profile.model_copy(update={"dimension": 1536})
    )


@pytest.mark.parametrize(
    "old,new",
    [
        ("approved: true", "approved: false"),
        ("approved: true", "approved: true\napproved: false"),
        ('approved_by: "synthetic-test-fixture"', "approved_by: null"),
        ("effective_from: 2026-01-01", "effective_from: 2099-01-01"),
        ("effective_to: 2099-12-31", "effective_to: 2020-01-01"),
        ("document_id: demo-faq", "document_id: bad id"),
        ("synthetic: true", "synthetic: false"),
        ("## FAQ-LUGGAGE", "## FAQ-WIFI"),
    ],
)
def test_invalid_sources_fail_before_indexing(source, old, new):
    root, p = source
    p.write_text(p.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")
    with pytest.raises(IndexingError):
        load(root)


def test_empty_missing_and_oversized_documents(source):
    root, p = source
    original = p.read_text(encoding="utf-8")
    p.write_text(original.split("## FAQ-WIFI")[0], encoding="utf-8")
    with pytest.raises(IndexingError):
        load(root)
    p.write_text(original, encoding="utf-8")
    with pytest.raises(IndexingError, match="CHUNK_TOO_LARGE"):
        load(root, max_characters=200)
    p.unlink()
    with pytest.raises(IndexingError):
        load(root)


def test_duplicate_chunks_and_documents_are_rejected(source, monkeypatch):
    from app.ingestion.snapshot import SOURCES

    root, p = source
    original = p.read_text(encoding="utf-8")
    body = original.split("## FAQ-WIFI ")[1].split("\n", 1)[1].split("## FAQ-LUGGAGE")[0]
    p.write_text(original + "\n## OTHER Duplicate\n" + body, encoding="utf-8")
    with pytest.raises(IndexingError, match="DUPLICATE_CHUNK"):
        load(root)
    p.write_text(original, encoding="utf-8")
    q = p.with_name("second.md")
    q.write_text(original, encoding="utf-8")
    monkeypatch.setitem(
        SOURCES, "demo_synthetic", ("tests/fixtures/d1/faq.md", "tests/fixtures/d1/second.md")
    )
    with pytest.raises(IndexingError):
        load(root)


def test_production_drafts_and_synthetic_sources_cannot_be_indexed(source, monkeypatch):
    from app.ingestion.snapshot import SOURCES

    root, p = source
    monkeypatch.setitem(SOURCES, "production", ("tests/fixtures/d1/faq.md",))
    with pytest.raises(IndexingError):
        load_chunks(root, "production", TODAY, ChunkingConfig())
    with pytest.raises(IndexingError):
        load_chunks(ROOT, "production", TODAY, ChunkingConfig())


def test_global_conditions_nested_headings_tables_and_exceptions_are_not_split(source):
    root, p = source
    text = (
        p.read_text(encoding="utf-8")
        .replace(
            "# Dữ liệu giả lập",
            "# Dữ liệu giả lập\n\nChỉ áp dụng trong năm 2026, trừ ngày bảo trì.",
        )
        .replace(
            "## FAQ-LUGGAGE",
            "### Điều kiện riêng\n\n| Thời gian | Phạm vi |\n|---|---|\n| Trong ngày | Sảnh |\n\n- Không áp dụng cho khu vực riêng.\n\n## FAQ-LUGGAGE",
        )
    )
    p.write_text(text, encoding="utf-8")
    chunks, _ = load(root)
    assert all("Chỉ áp dụng trong năm 2026, trừ ngày bảo trì." in c.content for c in chunks)
    assert "### Điều kiện riêng" in chunks[0].content
    assert "| Trong ngày | Sảnh |" in chunks[0].content
    assert "Không áp dụng cho khu vực riêng." in chunks[0].content
    assert len(chunks) == 3


@pytest.mark.parametrize("stamp", ["2026-11-20", "not-a-date", "2099-01-01", "true", "null"])
def test_review_timestamp_validation_uses_temporary_metadata_only(source, monkeypatch, stamp):
    from app.ingestion.snapshot import SOURCES

    root, p = source
    # Parser-only simulation. No production index or external embedding is created.
    text = p.read_text(encoding="utf-8").replace("synthetic: true", "synthetic: false")
    text = text.replace('source_ref: "synthetic:d1-faq"', 'source_ref: "reviewed:test-only"')
    text = text.replace("approved: true", "approved: true\napproved_at: " + stamp)
    p.write_text(text, encoding="utf-8")
    monkeypatch.setitem(SOURCES, "production", ("tests/fixtures/d1/faq.md",))
    if stamp == "2026-11-20":
        chunks, _ = load_chunks(root, "production", TODAY, ChunkingConfig())
        assert len(chunks) == 3
    else:
        with pytest.raises(IndexingError):
            load_chunks(root, "production", TODAY, ChunkingConfig())
