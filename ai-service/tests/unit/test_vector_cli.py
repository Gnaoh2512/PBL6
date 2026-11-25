import json

import pytest
from indexing_support import FakeEmbedding, MemoryQdrant, corpus
from pydantic import SecretStr

from app.indexing import IndexingSettings
from app.ingestion import vector_cli
from app.ingestion.vector_pipeline import PairedIndex


@pytest.fixture
def cli(tmp_path, monkeypatch):
    corpus(tmp_path)
    store = MemoryQdrant()
    store.close = lambda: None

    class Provider(FakeEmbedding):
        def __init__(self, key, profile, **kwargs):
            super().__init__(profile)

        def close(self):
            pass

    monkeypatch.setattr(
        vector_cli,
        "IndexingSettings",
        lambda: IndexingSettings(_env_file=None, gemini_key=SecretStr("offline-placeholder")),
    )
    monkeypatch.setattr(vector_cli, "GeminiEmbedding", Provider)
    monkeypatch.setattr(vector_cli, "Qdrant", lambda *args, **kwargs: store)
    monkeypatch.setattr(
        vector_cli,
        "PairedIndex",
        lambda mode, provider, store, **kwargs: PairedIndex(
            mode, provider, store, root=tmp_path, **kwargs
        ),
    )
    return tmp_path


def test_cli_requires_explicit_embedding_api_permission_before_dispatch(monkeypatch, capsys):
    monkeypatch.setattr(vector_cli, "Qdrant", lambda *a, **kw: pytest.fail("must not dispatch"))
    monkeypatch.setattr(vector_cli, "IndexingSettings", lambda: IndexingSettings(_env_file=None))
    assert vector_cli.main(["rebuild", "--mode", "demo_synthetic"]) == 1
    assert json.loads(capsys.readouterr().out)["error"] == "EMBEDDING_API_NOT_AUTHORIZED"
    assert vector_cli.main(["rebuild", "--mode", "demo_synthetic", "--allow-embedding-api"]) == 1
    assert json.loads(capsys.readouterr().out)["error"] == "EMBEDDING_NOT_CONFIGURED"


def test_cli_rebuild_status_lexical_and_similarity_search(cli, capsys):
    assert vector_cli.main(["rebuild", "--mode", "demo_synthetic", "--allow-embedding-api"]) == 0
    build = json.loads(capsys.readouterr().out)
    assert build["chunk_count"] == 3
    assert vector_cli.main(["status", "--mode", "demo_synthetic"]) == 0
    assert json.loads(capsys.readouterr().out)["snapshot_id"] == build["snapshot_id"]
    assert vector_cli.main(["lexical", "--mode", "demo_synthetic", "--query", "wifi"]) == 0
    lexical = json.loads(capsys.readouterr().out)
    vector = cli / "query.json"
    vector.write_text(json.dumps([1.0] + [0.0] * 767))
    assert (
        vector_cli.main(["search", "--mode", "demo_synthetic", "--vector-file", str(vector)]) == 0
    )
    semantic = json.loads(capsys.readouterr().out)
    assert semantic[0]["chunk"]["chunk_id"] == lexical[0]["chunk_id"]


@pytest.mark.parametrize("extra", [[], ["--vector-file", "missing.json"]])
def test_cli_invalid_search_input_is_explicit(cli, capsys, extra):
    assert vector_cli.main(["search", "--mode", "demo_synthetic", *extra]) == 1
    assert "error" in json.loads(capsys.readouterr().out)
