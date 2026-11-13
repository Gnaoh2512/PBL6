import shutil
from datetime import date

import pytest

from app.ingestion.snapshot import ROOT, build, document
from app.providers.contracts import DependencyError
from app.retrieval.index import KnowledgeIndex


@pytest.fixture
def corpus(tmp_path):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    return tmp_path


def test_snapshot_is_reproducible_and_vietnamese_query_preserves_evidence(corpus):
    today = date(2026, 11, 13)
    path = build("demo_synthetic", today, corpus)
    assert build("demo_synthetic", today, corpus) == path
    index = KnowledgeIndex(path, "demo_synthetic", today, corpus)
    result = index.search("wifi sanh", today)
    assert result[0].sectionId == "FAQ-WIFI"
    assert "lễ tân" in result[0].excerpt
    assert index.search("Wi-Fi sảnh", today) == result
    assert index.search('" OR * NOT NEAR()', today) == []
    assert index.search("astronaut rocket", today) == []
    with pytest.raises(DependencyError):
        KnowledgeIndex(path, "production", today, corpus)


@pytest.mark.parametrize(
    "old,new",
    [
        ("approved: true", "approved: false"),
        ("effective_from: 2026-01-01", "effective_from: 2099-01-01"),
        ("effective_to: 2099-12-31", "effective_to: 2020-01-01"),
        ("synthetic: true", "synthetic: false"),
        ("document_id: demo-faq", "document_id: null"),
    ],
)
def test_invalid_sources_never_build(corpus, old, new):
    path = corpus / "tests/fixtures/d1/faq.md"
    path.write_text(path.read_text(encoding="utf8").replace(old, new), encoding="utf8")
    with pytest.raises(ValueError):
        build("demo_synthetic", date(2026, 11, 13), corpus)


def test_source_revocation_or_checksum_change_invalidates_loaded_index(corpus):
    today = date(2026, 11, 13)
    path = build("demo_synthetic", today, corpus)
    index = KnowledgeIndex(path, "demo_synthetic", today, corpus)
    source = corpus / "tests/fixtures/d1/faq.md"
    source.write_text(source.read_text(encoding="utf8") + "\nchanged", encoding="utf8")
    with pytest.raises(DependencyError):
        index.search("wifi", today)


def test_management_files_corrupt_snapshot_and_wrong_root_are_rejected(corpus):
    today = date(2026, 11, 13)
    with pytest.raises(ValueError):
        document(corpus, "../../AGENTS.md", "demo_synthetic", today)
    path = build("demo_synthetic", today, corpus)
    (path / "index.sqlite").write_bytes(b"corrupt")
    with pytest.raises(DependencyError):
        KnowledgeIndex(path, "demo_synthetic", today, corpus)


def test_real_drafts_are_not_approved():
    with pytest.raises(ValueError):
        build("production", date(2026, 11, 13))
