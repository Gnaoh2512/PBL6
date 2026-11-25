import asyncio
import importlib.util
import json

import pytest
from hybrid_support import hybrid
from indexing_support import TODAY

from app.ingestion.snapshot import ROOT
from app.retrieval import hybrid_cli
from app.retrieval.hybrid import HybridFaqIndex
from app.settings import Settings


def test_cli_requires_explicit_embedding_permission_before_configuration_or_network(
    monkeypatch, capsys
):
    monkeypatch.setattr(hybrid_cli, "Settings", lambda **_: pytest.fail("must not start"))
    assert hybrid_cli.main(["--mode", "demo_synthetic", "--query", "wifi"]) == 1
    assert json.loads(capsys.readouterr().out)["error"] == "EMBEDDING_API_NOT_AUTHORIZED"


def test_cli_returns_debug_ranks_and_explicit_failure(tmp_path, monkeypatch, capsys):
    retriever = hybrid(tmp_path, TODAY)
    monkeypatch.setattr(
        hybrid_cli,
        "Settings",
        lambda **_: Settings(
            _env_file=None, gemini_key="offline-placeholder", corpus_mode="demo_synthetic"
        ),
    )

    async def factory(_):
        return HybridFaqIndex(retriever)

    monkeypatch.setattr(hybrid_cli, "create_hybrid_index", factory)
    args = ["--mode", "demo_synthetic", "--query", "wifi", "--allow-embedding-api"]
    assert hybrid_cli.main(args) == 0
    result = json.loads(capsys.readouterr().out)
    assert result["status"] == "hybrid" and result["evidence"][0]["retrieval_sources"]
    retriever.embedder.error = "EMBEDDING_UNAVAILABLE"
    assert hybrid_cli.main(args) == 1
    assert json.loads(capsys.readouterr().out)["status"] == "failed"


def test_benchmark_metric_denominators_and_label_independent_encoder():
    spec = importlib.util.spec_from_file_location(
        "benchmark_metrics", ROOT / "tests/evaluation/benchmark_hybrid.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.metrics(["A", "B", "C"], ["B", "D"], 3) == {
        "recall": 0.5,
        "mrr": 0.5,
        "precision": 1 / 3,
        "empty": False,
    }
    assert module.metrics([], [], 3) == {
        "recall": None,
        "mrr": None,
        "precision": 0.0,
        "empty": True,
    }
    assert module.metrics(["X"], ["A"], 3)["recall"] == 0
    encoder = module.OfflineHashEmbedding()
    assert encoder.document("fixed text", "title") == asyncio.run(encoder.query("fixed text", None))
