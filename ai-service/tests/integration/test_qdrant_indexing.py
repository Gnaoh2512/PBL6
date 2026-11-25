"""Opt-in real Docker Qdrant; synthetic temporary corpus + fake embedding, never Gemini."""

import os
import shutil
import socket
import subprocess
import threading
import time
from uuid import uuid4

import httpx
import pytest
import yaml

from app.indexing import EmbeddingProfile, IndexingError
from app.ingestion.snapshot import ROOT
from app.ingestion.vector_pipeline import PairedIndex
from app.providers.qdrant import Qdrant

pytestmark = pytest.mark.skipif(
    os.getenv("PBL6_QDRANT_DOCKER") != "1", reason="Explicit Docker opt-in required"
)


class OfflineEmbedding:
    profile = EmbeddingProfile()

    def document(self, text, title):
        axis = 0 if "FAQ-WIFI" in text else 1 if "FAQ-LUGGAGE" in text else 2
        return [float(i == axis) for i in range(self.profile.dimension)]


@pytest.fixture(scope="module")
def docker_url():
    image = yaml.safe_load((ROOT / "compose.qdrant.yaml").read_text())["services"]["qdrant"][
        "image"
    ]
    name = "pbl6-phase1-test-" + uuid4().hex
    created = False
    try:
        subprocess.run(
            [
                "docker",
                "run",
                "--detach",
                "--rm",
                "--name",
                name,
                "--publish",
                "127.0.0.1::6333",
                image,
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
        created = True
        address = subprocess.check_output(
            ["docker", "port", name, "6333/tcp"], text=True, timeout=15
        ).strip()
        assert address.startswith("127.0.0.1:")
        url = "http://" + address
        expires = time.monotonic() + 30
        with httpx.Client(trust_env=False, timeout=1) as client:
            while True:
                try:
                    if client.get(url + "/readyz").status_code == 200:
                        break
                except httpx.HTTPError:
                    pass
                if time.monotonic() > expires:
                    pytest.fail("Docker Qdrant did not become ready")
                time.sleep(0.1)
        yield url
    finally:
        if created:
            subprocess.run(
                ["docker", "stop", "--time", "5", name], check=True, capture_output=True, timeout=30
            )


@pytest.fixture
def no_network(monkeypatch, docker_url):
    """Override the offline guard only here: allow this container's loopback port."""
    port = int(docker_url.rsplit(":", 1)[1])
    create, connect, connect_ex, resolve = (
        socket.create_connection,
        socket.socket.connect,
        socket.socket.connect_ex,
        socket.getaddrinfo,
    )
    original_pair = socket.socketpair
    local = threading.local()

    def check(address):
        if getattr(local, "socketpair", False) and address[0] in ("127.0.0.1", "::1"):
            return
        if address[0] != "127.0.0.1" or int(address[1]) != port:
            raise AssertionError("Only the test Qdrant loopback port is permitted")

    def connection(address, *args, **kwargs):
        check(address)
        return create(address, *args, **kwargs)

    def tcp(sock, address):
        check(address)
        return connect(sock, address)

    def tcp_ex(sock, address):
        check(address)
        return connect_ex(sock, address)

    def dns(host, service, *args, **kwargs):
        check((host, service))
        return resolve(host, service, *args, **kwargs)

    def pair(*args, **kwargs):
        local.socketpair = True
        try:
            return original_pair(*args, **kwargs)
        finally:
            local.socketpair = False

    monkeypatch.setattr(socket, "create_connection", connection)
    monkeypatch.setattr(socket.socket, "connect", tcp)
    monkeypatch.setattr(socket.socket, "connect_ex", tcp_ex)
    monkeypatch.setattr(socket, "getaddrinfo", dns)
    monkeypatch.setattr(socket, "socketpair", pair)


@pytest.fixture
def index(tmp_path, docker_url):
    source = tmp_path / "tests/fixtures/d1/faq.md"
    source.parent.mkdir(parents=True)
    shutil.copyfile(ROOT / "tests/fixtures/d1/faq.md", source)
    store, created = Qdrant(docker_url), []
    create = store.create

    def record(name, dimension):
        create(name, dimension)
        created.append(name)

    store.create = record
    try:
        yield PairedIndex("demo_synthetic", OfflineEmbedding(), store, root=tmp_path), source
    finally:
        for name in created:
            store.delete(name)
        store.close()


def test_real_qdrant_roundtrip_similarity_filters_and_rebuild(index):
    from datetime import date

    pipeline, _ = index
    today = date(2026, 11, 21)
    first = pipeline.rebuild(today)
    assert pipeline.active(today) == first
    hits = pipeline.similarity_search(
        [0.0, 1.0] + [0.0] * 766, today, category="faq", source_id="demo-faq"
    )
    assert hits[0]["chunk"]["section_id"] == "FAQ-LUGGAGE"
    assert hits[0]["score"] == pytest.approx(1.0)
    sql = pipeline.lexical_search("hành lý", today)
    assert sql[0]["source_id"] == hits[0]["chunk"]["source_id"]
    assert sql[0]["chunk_id"] == hits[0]["chunk"]["chunk_id"]
    assert pipeline.similarity_search([1.0] + [0.0] * 767, today, category="policy") == []
    assert pipeline.lexical_search("astronaut", today) == []
    second = pipeline.rebuild(today)
    assert second["snapshot_id"] == first["snapshot_id"]
    assert second["collection"] != first["collection"]
    assert len(pipeline.store.inventory(first["collection"], 768)) == 3


@pytest.mark.parametrize("stage", ["partial_upsert", "activation"])
def test_real_qdrant_failed_rebuild_keeps_previous_pair(index, monkeypatch, stage):
    from datetime import date

    pipeline, _ = index
    today = date(2026, 11, 21)
    first = pipeline.rebuild(today)
    before = (pipeline.directory / "active.json").read_bytes()
    if stage == "partial_upsert":
        original = pipeline.store.upsert

        def broken(name, chunks, vectors, snapshot, dimension):
            original(name, chunks[:1], vectors[:1], snapshot, dimension)
            raise IndexingError("QDRANT_TIMEOUT")

        monkeypatch.setattr(pipeline.store, "upsert", broken)
    else:

        def broken(*_):
            raise OSError("synthetic disk error")

        monkeypatch.setattr(pipeline, "_activate", broken)
    with pytest.raises(IndexingError):
        pipeline.rebuild(today)
    assert (pipeline.directory / "active.json").read_bytes() == before
    assert pipeline.active(today) == first


def test_real_remote_drift_and_dimension_changes_are_detected(index):
    from datetime import date

    pipeline, _ = index
    today = date(2026, 11, 21)
    manifest = pipeline.rebuild(today)
    points = pipeline.store.inventory(manifest["collection"], 768)
    cid = next(iter(points))
    from app.providers.qdrant import point_id

    payload, vector = points[cid]
    payload["source_id"] = "tampered"
    pipeline.store._request(
        "PUT",
        pipeline.store._name(manifest["collection"]) + "/points?wait=true",
        {"points": [{"id": point_id(cid), "payload": payload, "vector": vector}]},
    )
    with pytest.raises(IndexingError, match="INDEX_OUT_OF_SYNC"):
        pipeline.active(today)
    pipeline.profile = pipeline.embedding.profile = EmbeddingProfile(
        model="gemini-embedding-2", dimension=1536
    )
    rebuilt = pipeline.rebuild(today)
    assert rebuilt["snapshot_id"] != manifest["snapshot_id"]
    assert pipeline.active(today) == rebuilt
