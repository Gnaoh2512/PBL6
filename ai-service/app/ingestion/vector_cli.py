"""Offline Phase 1 commands. Rebuild requires explicit permission to call embedding API."""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

from pydantic import ValidationError

from app.indexing import IndexingError, IndexingSettings
from app.ingestion.snapshot import DEMO_SOURCE_PACKS
from app.ingestion.vector_pipeline import PairedIndex
from app.providers.embeddings import GeminiEmbedding
from app.providers.qdrant import Qdrant


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["rebuild", "status", "search", "lexical"])
    parser.add_argument("--mode", required=True, choices=["production", "demo_synthetic"])
    parser.add_argument("--source-pack", choices=["d1_fixture", *DEMO_SOURCE_PACKS], default=None)
    parser.add_argument("--allow-embedding-api", action="store_true")
    parser.add_argument("--vector-file", type=Path)
    parser.add_argument("--query")
    parser.add_argument("--category")
    parser.add_argument("--source-id")
    parser.add_argument("--limit", type=int, default=3)
    args = parser.parse_args(argv)
    provider, store = None, None
    try:
        settings = IndexingSettings()
        source_pack = args.source_pack or settings.demo_source_pack
        if args.command == "rebuild":
            if not args.allow_embedding_api:
                raise IndexingError("EMBEDDING_API_NOT_AUTHORIZED")
            if settings.gemini_key is None:
                raise IndexingError("EMBEDDING_NOT_CONFIGURED")
            provider = GeminiEmbedding(
                settings.gemini_key, settings.embedding, timeout=settings.http_timeout
            )
        store = Qdrant(settings.qdrant_url, key=settings.qdrant_key, timeout=settings.http_timeout)
        index = PairedIndex(
            args.mode,
            provider,
            store,
            profile=settings.embedding,
            chunking=settings.chunking,
            source_pack=source_pack,
        )
        today = datetime.now(timezone(timedelta(hours=7))).date()
        if args.command in {"rebuild", "status"}:
            manifest = index.rebuild(today) if args.command == "rebuild" else index.active(today)
            result = {
                key: manifest[key]
                for key in (
                    "corpus_mode",
                    "snapshot_id",
                    "collection",
                    "run_id",
                    "embedding",
                    "chunking",
                )
            }
            result["chunk_count"] = len(manifest["chunks"])
        elif args.command == "lexical":
            if args.query is None:
                raise IndexingError("SEARCH_INVALID")
            result = index.lexical_search(
                args.query, today, category=args.category, limit=args.limit
            )
        else:
            if args.vector_file is None or args.vector_file.stat().st_size > 256 * 1024:
                raise IndexingError("SEARCH_INVALID")
            vector = json.loads(args.vector_file.read_text(encoding="utf-8"))
            result = index.similarity_search(
                vector, today, category=args.category, source_id=args.source_id, limit=args.limit
            )
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except IndexingError as error:
        print(
            json.dumps(
                {"error": error.code, "cleanup_pending": getattr(error, "cleanup_pending", False)}
            )
        )
        return 1
    except ValidationError:
        print(json.dumps({"error": "INDEX_CONFIGURATION_INVALID"}))
        return 1
    except (OSError, ValueError, TypeError):
        print(json.dumps({"error": "INDEX_INPUT_OR_IO_ERROR"}))
        return 1
    finally:
        if provider is not None:
            provider.close()
        if store is not None:
            store.close()


if __name__ == "__main__":
    raise SystemExit(main())
