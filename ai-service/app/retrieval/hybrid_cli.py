"""Explicit Hybrid retrieval command, independent of generation and never rebuilding."""

import argparse
import asyncio
import json
from datetime import datetime, timedelta, timezone

from app.indexing import IndexingError
from app.ingestion.snapshot import DEMO_SOURCE_PACKS
from app.providers.contracts import DependencyError, TurnBudget
from app.retrieval.hybrid import create_hybrid_index
from app.settings import Settings


async def execute(args):
    kwargs = {"corpus_mode": args.mode}
    if args.source_pack is not None:
        kwargs["demo_source_pack"] = args.source_pack
    settings = Settings(**kwargs)
    if settings.gemini_key is None:
        raise IndexingError("EMBEDDING_NOT_CONFIGURED")
    index = await create_hybrid_index(settings)
    try:
        today = datetime.now(timezone(timedelta(hours=7))).date()
        result = await index.retriever.retrieve(
            args.query, today, budget=TurnBudget(), category=args.category, source_id=args.source_id
        )
        print(json.dumps(result.debug(), ensure_ascii=False))
        return 1 if result.status == "failed" else 0
    finally:
        await index.close()


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode", required=True, choices=["production", "demo_synthetic"])
    parser.add_argument("--source-pack", choices=["d1_fixture", *DEMO_SOURCE_PACKS], default=None)
    parser.add_argument("--query", required=True)
    parser.add_argument("--category")
    parser.add_argument("--source-id")
    parser.add_argument("--allow-embedding-api", action="store_true")
    args = parser.parse_args(argv)
    if not args.allow_embedding_api:
        print(json.dumps({"error": "EMBEDDING_API_NOT_AUTHORIZED"}))
        return 1
    try:
        return asyncio.run(execute(args))
    except TimeoutError:
        print(json.dumps({"error": "DEADLINE_EXCEEDED"}))
        return 1
    except (IndexingError, DependencyError) as error:
        print(json.dumps({"error": error.code}))
        return 1
    except (OSError, ValueError):
        print(json.dumps({"error": "RETRIEVAL_CONFIGURATION_INVALID"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
