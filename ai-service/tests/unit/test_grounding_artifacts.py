import json
from types import SimpleNamespace

import pytest
from grounding_support import write_artifacts
from hybrid_support import QueryEmbedding, VectorSearch
from indexing_support import TODAY, FakeEmbedding, MemoryQdrant, corpus

from app.ingestion.vector_pipeline import PairedIndex
from app.orchestration.verification.artifacts import load_verification_gate
from app.orchestration.verification.settings import GroundingConfig
from app.providers.contracts import DependencyError
from app.retrieval.hybrid import HybridFaqIndex, HybridRetriever


@pytest.fixture
def published(tmp_path):
    corpus(tmp_path)
    provider = FakeEmbedding()
    store = MemoryQdrant()
    paired = PairedIndex("demo_synthetic", provider, store, root=tmp_path)
    paired.rebuild(TODAY)
    index = HybridFaqIndex(
        HybridRetriever(paired, QueryEmbedding(provider.profile), VectorSearch(store))
    )
    f, config = write_artifacts(index)
    return SimpleNamespace(corpus_mode="demo_synthetic", grounding=config), index, f


def test_loader_uses_independent_source_receipts_and_real_source_bytes(published):
    settings, index, f = published
    gate = load_verification_gate(settings, index, TODAY)
    assert gate.catalog.data.snapshotId == f.data["snapshotId"]
    assert len(gate.catalog.check_current()) == 1
    source = index.retriever.paired.root / "tests/fixtures/d1/faq.md"
    source.write_bytes(source.read_bytes() + b"\nchanged")
    with pytest.raises(DependencyError):
        gate.catalog.check_current()


@pytest.mark.parametrize("target", ["catalog", "sources", "authority", "mode", "missing"])
def test_missing_drifted_or_untrusted_artifacts_never_load(published, target):
    settings, index, _ = published
    c = settings.grounding
    if target == "catalog":
        c.catalog_path.write_bytes(c.catalog_path.read_bytes() + b" ")
    if target == "sources":
        c.sources_path.write_bytes(c.sources_path.read_bytes() + b" ")
    if target == "authority":
        settings.grounding = c.model_copy(update={"authorities": frozenset({"unknown"})})
    if target == "mode":
        settings.corpus_mode = "production"
    if target == "missing":
        settings.grounding = GroundingConfig()
    with pytest.raises(DependencyError):
        load_verification_gate(settings, index, TODAY)


def test_separate_receipt_pin_cannot_be_replaced_by_catalog_sources(published):
    from app.orchestration.verification.catalog import digest

    settings, index, f = published
    raw = json.dumps(
        {
            "schemaVersion": "grounding-sources-1",
            "mode": "demo_synthetic",
            "snapshotId": f.data["snapshotId"],
            "sources": [],
        }
    ).encode()
    settings.grounding.sources_path.write_bytes(raw)
    settings.grounding = settings.grounding.model_copy(update={"sources_sha256": digest(raw)})
    with pytest.raises(DependencyError):
        load_verification_gate(settings, index, TODAY)
