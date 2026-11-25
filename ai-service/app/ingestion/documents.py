"""Reuse D1 allowlist/parser; retain complete sections and document-level context."""

import json
import re
from datetime import date, datetime
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field

from app.indexing import ChunkingConfig, IndexingError
from app.ingestion.snapshot import ALGORITHM, digest, document, sources_for


class Chunk(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", strict=True)
    source_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    chunk_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    content: str = Field(min_length=1, max_length=2000)
    document_type: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=256)
    document_version: str = Field(min_length=1, max_length=64)
    section_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    source_ref: str = Field(min_length=1, max_length=256)
    source_path: str
    source_checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    content_checksum: str = Field(pattern=r"^[a-f0-9]{64}$")
    corpus_mode: str = Field(pattern=r"^(production|demo_synthetic)$")
    approved: bool
    approved_by: str = Field(min_length=1, max_length=256)
    approved_at: date | None
    effective_from: date
    effective_to: date | None

    def payload(self):
        return self.model_dump(mode="json")


class UniqueYaml(yaml.SafeLoader):
    pass


def _mapping(loader, node):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node)
        if key in result:
            raise ValueError("Duplicate metadata key")
        result[key] = loader.construct_object(value_node)
    return result


UniqueYaml.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def load_chunks(
    root: Path, mode: str, today: date, config: ChunkingConfig, *, source_pack: str = "d1_fixture"
):
    """All allowlisted sources must be eligible; reject duplicates rather than silently drop."""
    try:
        allowed = sources_for(mode, source_pack)
    except ValueError:
        raise IndexingError("SOURCE_INVALID") from None
    chunks, sources, source_ids, contents = [], {}, set(), set()
    try:
        root = root.resolve()
        for name in allowed:
            candidate = root / name
            if any(p.is_symlink() for p in (candidate, *candidate.parents) if p != root):
                raise ValueError("Symlink source")
            raw = candidate.read_bytes()
            if len(raw) > 1024 * 1024:
                raise ValueError("Source too large")
            text = raw.decode("utf-8").replace("\r\n", "\n")
            _, front, body = text.split("---\n", 2)
            strict_meta = yaml.load(front, Loader=UniqueYaml)
            meta, sections, checksum = document(root, name, mode, today, source_pack=source_pack)
            if strict_meta != meta or checksum != digest(raw):
                raise ValueError("Source changed while reading")
            if (
                meta["document_id"] in source_ids
                or not isinstance(meta.get("approved_by"), str)
                or not meta["approved_by"].strip()
                or meta.get("status", "approved") != "approved"
                or (mode == "production" and not meta.get("approved_at"))
                or (mode == "production" and meta["source_ref"].startswith("synthetic:"))
            ):
                raise ValueError("Invalid approval or duplicate document identity")
            source_ids.add(meta["document_id"])
            approved_at = meta.get("approved_at")
            if approved_at is not None:
                if isinstance(approved_at, str):
                    approved_at = datetime.fromisoformat(approved_at).date()
                elif isinstance(approved_at, datetime):
                    approved_at = approved_at.date()
                if not isinstance(approved_at, date) or approved_at > today:
                    raise ValueError("Invalid review timestamp")
            sources[name] = checksum
            preamble = re.split(r"(?m)^## ", body, maxsplit=1)[0].strip()
            section_bodies = set()
            for section_id, excerpt in sections:
                content = (preamble + "\n\n" + "## " + excerpt).strip()
                body_key = re.sub(r"\s+", " ", excerpt.partition("\n")[2]).strip()
                content_sha = digest(content.encode())
                if len(content) > config.max_characters:
                    raise IndexingError("CHUNK_TOO_LARGE")
                if content_sha in contents or body_key in section_bodies:
                    raise IndexingError("DUPLICATE_CHUNK")
                contents.add(content_sha)
                section_bodies.add(body_key)
                chunk_id = digest(
                    f"{meta['document_id']}:{meta['version']}:{section_id}:{content}".encode()
                )
                chunks.append(
                    Chunk(
                        source_id=meta["document_id"],
                        chunk_id=chunk_id,
                        content=content,
                        document_type=meta["category"],
                        title=meta["title"],
                        document_version=meta["version"],
                        section_id=section_id,
                        source_ref=meta["source_ref"],
                        source_path=name,
                        source_checksum=checksum,
                        content_checksum=content_sha,
                        corpus_mode=mode,
                        approved=True,
                        approved_by=meta["approved_by"],
                        approved_at=approved_at,
                        effective_from=meta["effective_from"],
                        effective_to=meta.get("effective_to"),
                    )
                )
        if not chunks or len(chunks) > 4096:
            raise ValueError("Empty or oversized corpus")
        return tuple(chunks), sources
    except IndexingError:
        raise
    except (OSError, ValueError, TypeError, KeyError, yaml.YAMLError):
        raise IndexingError("SOURCE_INVALID") from None


def fingerprint(chunks, sources, chunking, embedding):
    identity = {
        "format": 1,
        "fts_algorithm": ALGORITHM,
        "sources": sources,
        "chunking": chunking.model_dump(),
        "embedding": embedding.model_dump(),
        "chunk_ids": [c.chunk_id for c in chunks],
    }
    return digest(json.dumps(identity, sort_keys=True, ensure_ascii=False).encode())
