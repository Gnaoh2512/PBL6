"""Offline allowlisted Markdown ingestion. Generated snapshots are never hotel source data."""

import argparse
import hashlib
import json
import re
import sqlite3
import tempfile
from contextlib import closing
from datetime import date
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
ALGORITHM = "fts5-bm25-unicode61-v2"
SOURCES = {
    "demo_synthetic": ("tests/fixtures/d1/faq.md",),
    "production": (
        "knowledge/faq/general.md",
        "knowledge/faq/room-catalog.md",
        "knowledge/faq/booking-guide.md",
        "knowledge/services/usage-guide.md",
    ),
}
DEMO_SOURCE_PACKS = {
    "academic_policies": (
        "knowledge/policies/publication-draft/pol-01-booking.md",
        "knowledge/policies/publication-draft/pol-02-check-in-out.md",
        "knowledge/policies/publication-draft/pol-03-deposit-payment.md",
        "knowledge/policies/publication-draft/pol-04-cancellation.md",
        "knowledge/policies/publication-draft/pol-05-refund.md",
        "knowledge/policies/publication-draft/pol-06-children-guests.md",
        "knowledge/policies/publication-draft/pol-07-pets.md",
        "knowledge/policies/publication-draft/pol-08-services.md",
        "knowledge/policies/publication-draft/pol-09-complaints.md",
        "knowledge/policies/publication-draft/pol-10-privacy.md",
    ),
}


def sources_for(mode: str, source_pack: str = "d1_fixture") -> tuple[str, ...]:
    if mode not in SOURCES:
        raise ValueError("Invalid corpus mode")
    if mode == "production":
        if source_pack != "d1_fixture":
            raise ValueError("Production mode does not accept demo source packs")
        return SOURCES["production"]
    if source_pack == "d1_fixture":
        return SOURCES["demo_synthetic"]
    if source_pack in DEMO_SOURCE_PACKS:
        return DEMO_SOURCE_PACKS[source_pack]
    raise ValueError("Invalid demo source pack")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize(text: str) -> str:
    import unicodedata

    text = re.sub(r"\bwi[ -]?fi\b", "wifi", text.lower())
    return "".join(
        c
        for c in unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
        if unicodedata.category(c) != "Mn"
    )


def document(root: Path, name: str, mode: str, today: date, *, source_pack: str = "d1_fixture"):
    if name not in sources_for(mode, source_pack):
        raise ValueError("Source is not allowlisted")
    path = (root / name).resolve()
    if not path.is_relative_to(root.resolve()) or path.is_symlink():
        raise ValueError("Source escapes root")
    raw = path.read_bytes()
    text = raw.decode("utf-8")
    if not text.startswith("---\n"):
        # Windows checkouts may use CRLF.
        text = text.replace("\r\n", "\n")
    parts = text.split("---\n", 2)
    if len(parts) != 3 or parts[0]:
        raise ValueError("Missing front matter")
    meta = yaml.safe_load(parts[1])
    required = ("document_id", "title", "category", "version", "source_ref")
    if not isinstance(meta, dict) or any(
        not isinstance(meta.get(k), str) or not meta[k].strip() for k in required
    ):
        raise ValueError("Invalid source metadata")
    start = meta.get("effective_from")
    end = meta.get("effective_to")
    if (
        meta.get("approved") is not True
        or not isinstance(start, date)
        or start > today
        or (end is not None and (not isinstance(end, date) or end < today))
    ):
        raise ValueError("Source is unapproved or outside effective dates")
    if mode == "demo_synthetic" and meta.get("synthetic") is not True:
        raise ValueError("Demo source must be synthetic")
    if mode == "production" and meta.get("synthetic") is True:
        raise ValueError("Synthetic source rejected")
    sections = re.split(r"(?m)^## ", parts[2])[1:]
    chunks = []
    for section in sections:
        heading, _, body = section.partition("\n")
        excerpt = (heading + "\n" + body).strip()
        if not body.strip() or len(excerpt) > 2000:
            raise ValueError("Section must be complete and at most 2000 characters")
        section_id = heading.split(" ", 1)[0]
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", section_id):
            raise ValueError("Section requires a stable identifier")
        chunks.append((section_id, excerpt))
    if not chunks or len({x[0] for x in chunks}) != len(chunks):
        raise ValueError("Missing or duplicate section identifiers")
    return meta, chunks, digest(raw)


def build(mode: str, today: date, root: Path = ROOT, *, source_pack: str = "d1_fixture") -> Path:
    allowed = sources_for(mode, source_pack)
    documents = [
        (name, *document(root, name, mode, today, source_pack=source_pack)) for name in allowed
    ]
    manifest = {
        "format": 1,
        "corpusMode": mode,
        "algorithm": ALGORITHM,
        "chunking": "heading-complete-2000-v1",
        "sources": {name: sha for name, _, _, sha in documents},
    }
    snapshot_id = digest(json.dumps(manifest, sort_keys=True).encode())
    manifest["snapshotId"] = snapshot_id
    parent = root / ".local/assistant-index" / mode
    parent.mkdir(parents=True, exist_ok=True)
    target = parent / snapshot_id
    if target.exists():
        from app.retrieval.index import KnowledgeIndex

        KnowledgeIndex(target, mode, today, root, source_pack=source_pack)
        return target
    with tempfile.TemporaryDirectory(prefix="building-", dir=parent) as directory:
        temporary = Path(directory)
        with closing(sqlite3.connect(temporary / "index.sqlite")) as db:
            db.execute("CREATE VIRTUAL TABLE chunks USING fts5(search, metadata UNINDEXED)")
            for _, meta, chunks, _ in documents:
                for section, excerpt in chunks:
                    chunk_id = digest(
                        f"{meta['document_id']}:{meta['version']}:{section}:{excerpt}".encode()
                    )
                    row = {
                        "citationId": chunk_id,
                        "documentId": meta["document_id"],
                        "version": meta["version"],
                        "chunkId": chunk_id,
                        "sectionId": section,
                        "title": meta["title"],
                        "sourceRef": meta["source_ref"],
                        "excerpt": excerpt,
                        "corpusMode": mode,
                        "category": meta["category"],
                    }
                    db.execute(
                        "INSERT INTO chunks VALUES (?,?)", (normalize(excerpt), json.dumps(row))
                    )
            db.commit()
        manifest["databaseChecksum"] = digest((temporary / "index.sqlite").read_bytes())
        (temporary / "manifest.json").write_text(
            json.dumps(manifest, sort_keys=True), encoding="utf8"
        )
        # Rename only a complete snapshot. The temporary directory is managed by tempfile.
        temporary.rename(target)
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", choices=list(SOURCES), required=True)
    parser.add_argument(
        "--source-pack", choices=["d1_fixture", *DEMO_SOURCE_PACKS], default="d1_fixture"
    )
    arguments = parser.parse_args()
    print(build(arguments.mode, date.today(), source_pack=arguments.source_pack))
