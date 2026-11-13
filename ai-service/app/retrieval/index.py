"""Immutable local FTS5 search. Approval and source checks are repeated before each query."""

import json
import re
import sqlite3
from contextlib import closing
from datetime import date
from pathlib import Path

from app.ingestion.snapshot import ROOT, SOURCES, digest, document, normalize
from app.providers.contracts import DependencyError, Evidence


class KnowledgeIndex:
    def __init__(self, path: Path, mode: str, today: date, root: Path = ROOT):
        self.path, self.mode, self.root = path.resolve(), mode, root.resolve()
        self.snapshot_id = self.path.name
        self.validate(today)

    def validate(self, today: date):
        try:
            expected = (self.root / ".local/assistant-index" / self.mode).resolve()
            if (
                self.mode not in SOURCES
                or self.path.parent != expected
                or not re.fullmatch(r"[a-f0-9]{64}", self.snapshot_id)
            ):
                raise ValueError()
            manifest = json.loads((self.path / "manifest.json").read_text(encoding="utf8"))
            if manifest["corpusMode"] != self.mode or manifest["snapshotId"] != self.snapshot_id:
                raise ValueError()
            if set(manifest["sources"]) != set(SOURCES[self.mode]):
                raise ValueError()
            for name, sha in manifest["sources"].items():
                if document(self.root, name, self.mode, today)[2] != sha:
                    raise ValueError()
            if digest((self.path / "index.sqlite").read_bytes()) != manifest["databaseChecksum"]:
                raise ValueError()
        except (OSError, KeyError, TypeError, ValueError):
            raise DependencyError() from None

    def search(
        self, query: str, today: date, top_k: int = 3, category: str | None = None
    ) -> list[Evidence]:
        self.validate(today)
        tokens = list(dict.fromkeys(re.findall(r"[a-z0-9]+", normalize(query))))[:64]
        # Vietnamese glue words should not make every FAQ appear relevant.
        stop = {"co", "khong", "la", "gi", "toi", "cho", "hoi", "cua", "va", "the", "nao", "o"}
        tokens = [token for token in tokens if token not in stop]
        if not tokens:
            return []
        expression = " OR ".join(f'"{token}"' for token in tokens)
        try:
            with closing(
                sqlite3.connect((self.path / "index.sqlite").as_uri() + "?mode=ro", uri=True)
            ) as db:
                rows = db.execute(
                    "SELECT metadata FROM chunks WHERE chunks MATCH ? ORDER BY bm25(chunks), rowid",
                    (expression,),
                ).fetchall()
            evidence = []
            for (text,) in rows:
                data = json.loads(text)
                group = data.pop("category")
                if category is None or group == category:
                    evidence.append(Evidence.model_validate(data))
                if len(evidence) >= min(3, max(1, top_k)):
                    break
            return evidence
        except (sqlite3.Error, ValueError, KeyError, TypeError):
            raise DependencyError() from None
