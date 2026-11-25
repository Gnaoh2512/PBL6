"""D1.13a standalone synthetic collector. Default preflight is read-only and never calls Gemini."""

import argparse
import asyncio
import hashlib
import json
import math
import re
import subprocess
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from d1_collector_capture import Capture, RecordingFaq  # noqa: E402
from d1_collector_schema import (  # noqa: E402
    BUDGET,
    MODEL,
    ArtifactWriter,
    CaseRecord,
    CollectorStop,
    Corpus,
    Dataset,
    Input,
    Manifest,
    NotRun,
    Privacy,
    Summary,
)
from pydantic import ValidationError  # noqa: E402

from app.ingestion.snapshot import ROOT  # noqa: E402
from app.orchestration.verification.artifacts import load_verification_gate  # noqa: E402
from app.prompts.faq import CLASSIFY  # noqa: E402
from app.prompts.verified_faq import ANSWER, VERSION  # noqa: E402
from app.providers.contracts import DependencyError  # noqa: E402
from app.providers.gemini import Gemini  # noqa: E402
from app.retrieval.index import KnowledgeIndex  # noqa: E402
from app.schemas.turn import Context, TurnRequest  # noqa: E402
from app.settings import Settings  # noqa: E402

TODAY = date(2026, 11, 13)
DATASET_SHA256 = "a3ce75ce3e421a956fa3f0f743e798bdc45fe25a8de21650906de3005752a03a"
FIXTURE_SHA256 = "70c38269eeef80b828f7e8480be29833741cba81350a8bd426703ff1fa1c241f"
SOURCE = "tests/fixtures/d1/faq.md"
DATASET = "tests/evaluation/d1_queries.json"
CODE = (
    "app/main.py",
    "app/settings.py",
    "app/diagnostics.py",
    "app/api/boundary.py",
    "app/orchestration/faq.py",
    "app/providers/gemini.py",
    "app/providers/http_timing.py",
    "app/providers/contracts.py",
    "app/ingestion/snapshot.py",
    "app/retrieval/index.py",
    "app/schemas/faq.py",
    "app/schemas/turn.py",
    "app/prompts/faq.py",
    "requirements.lock",
    "tests/evaluation/collect_d1_live.py",
    "tests/evaluation/d1_collector_schema.py",
    "tests/evaluation/d1_collector_capture.py",
    "app/prompts/verified_faq.py",
    "app/schemas/verification.py",
    "app/orchestration/verification/__init__.py",
    "app/orchestration/verification/assembly.py",
    "app/orchestration/verification/artifacts.py",
    "app/orchestration/verification/catalog.py",
    "app/orchestration/verification/gate.py",
    "app/orchestration/verification/questions.py",
    "app/orchestration/verification/renderer.py",
    "app/orchestration/verification/runtime.py",
    "app/orchestration/verification/settings.py",
)


def sha(data):
    return hashlib.sha256(data).hexdigest()


@dataclass
class PinnedRun:
    root: Path
    index: KnowledgeIndex
    dataset: Dataset
    manifest: Manifest
    corpus: Corpus
    files: dict[Path, str]

    def verify(self):
        try:
            if any(
                path.is_symlink() or sha(path.read_bytes()) != digest
                for path, digest in self.files.items()
            ):
                raise CollectorStop("source_drift")
        except OSError:
            raise CollectorStop("source_drift") from None


def preflight(snapshot_id, *, root=ROOT, privacy=None):
    """Pin existing bytes; intentionally no build(), Settings(), provider, or artifact writes."""
    privacy = privacy or Privacy()
    if not re.fullmatch(r"[0-9a-f]{64}", snapshot_id) or VERSION != "d1-verified-faq-1":
        raise CollectorStop("source_drift")
    root = root.resolve()
    snapshot = root / ".local/assistant-index/demo_synthetic" / snapshot_id
    relative = [
        SOURCE,
        DATASET,
        *CODE,
        str(snapshot.relative_to(root) / "manifest.json"),
        str(snapshot.relative_to(root) / "index.sqlite"),
    ]
    try:
        files = {}
        for name in relative:
            path = root / name
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                raise CollectorStop("source_drift")
            files[path] = sha(path.read_bytes())
        if files[root / SOURCE] != FIXTURE_SHA256 or files[root / DATASET] != DATASET_SHA256:
            raise CollectorStop("source_drift")
        dataset = Dataset.model_validate_json((root / DATASET).read_bytes())
        rows = [*dataset.dev, *dataset.held_out]
        if len({c.id for c in rows}) != 24 or {c.group for c in dataset.dev} & {
            c.group for c in dataset.held_out
        }:
            raise CollectorStop("source_drift")
        index = KnowledgeIndex(snapshot, "demo_synthetic", TODAY, root)
        corpus = Corpus(
            source_sha256=files[root / SOURCE],
            text=(root / SOURCE).read_text(encoding="utf-8"),
            dataset=dataset,
            snapshot_manifest=json.loads((snapshot / "manifest.json").read_text(encoding="utf-8")),
        )
        privacy.check(dataset)
        privacy.check(corpus)
        started = datetime.now(timezone.utc)
        context = Context(
            locale="vi-VN", timeZone="Asia/Ho_Chi_Minh", today=TODAY.isoformat(), currency="VND"
        )
        manifest = Manifest(
            run_id=str(uuid4()),
            started_at=started.isoformat(),
            context=context,
            snapshot_id=snapshot_id,
            dataset_sha256=files[root / DATASET],
            source_sha256={
                path.relative_to(root).as_posix(): digest for path, digest in files.items()
            },
            prompt_sha256={"classify": sha(CLASSIFY.encode()), "answer": sha(ANSWER.encode())},
            planned_cases=[c.id for c in rows],
            full_retention_until=(started + timedelta(days=14)).isoformat(),
            summary_retention_until=(started + timedelta(days=90)).isoformat(),
        )
        try:
            manifest.head = (
                subprocess.check_output(
                    ["git", "rev-parse", "HEAD"], cwd=root, stderr=subprocess.DEVNULL
                )
                .decode()
                .strip()
            )
            manifest.working_tree_dirty = bool(
                subprocess.check_output(
                    ["git", "status", "--porcelain"], cwd=root, stderr=subprocess.DEVNULL
                )
            )
        except subprocess.CalledProcessError:
            pass
        privacy.check(manifest)
        return PinnedRun(root, index, dataset, manifest, corpus, files)
    except (OSError, ValueError, ValidationError, DependencyError):
        raise CollectorStop("source_drift") from None


def payload_for(case, context):
    return TurnRequest.validate_python(
        {
            "phase": "start",
            "requestId": case.id,
            "conversationId": str(uuid4()),
            "turnId": str(uuid4()),
            "message": case.query,
            "history": [],
            "allowedTools": ["search_knowledge"],
            "context": context.model_dump(mode="json"),
            "budget": dict(BUDGET),
        }
    )


def checkpoint(writer, pinned, capture):
    """Called only before/after timed turns; never from a handler or recording proxy."""
    hashes = {}
    for name, value in (
        ("corpus.json", pinned.corpus),
        ("cases.jsonl", capture.cases),
        (
            "diagnostics.jsonl",
            [e for e in capture.event_snapshot() if not hasattr(e.event, "http_attempt_id")],
        ),
        (
            "http-timing.jsonl",
            [e for e in capture.event_snapshot() if hasattr(e.event, "http_attempt_id")],
        ),
        ("manifest.json", pinned.manifest),
    ):
        hashes[name] = writer.write(name, value)
    return hashes


def summarize(pinned, capture, hashes, closed, unchanged):
    cases = capture.cases
    final = [c for c in cases if c.final is not None]
    durations = sorted(c.elapsed_ms for c in cases)
    reason = capture.stop_reason
    completed = len(cases) == len(pinned.manifest.planned_cases) and reason is None
    return Summary(
        run_id=capture.run_id,
        state="completed" if completed else "stopped",
        stop_reason=reason,
        planned=len(pinned.manifest.planned_cases),
        attempted=len(cases),
        final_cases=sum(c.outcome == "final" for c in cases),
        captured_final_cases=len(final),
        status_matches=sum(c.returned_status == c.expected_status for c in cases),
        outcomes=dict(Counter(c.outcome for c in cases)),
        errors=dict(Counter(c.error_code for c in cases if c.error_code)),
        http_attempts=dict(capture.counts),
        gaps=dict(Counter(g for c in cases for g in c.gaps)),
        not_run=[
            NotRun(case_id=i, reason=reason or "unexpected")
            for i in pinned.manifest.planned_cases[len(cases) :]
        ],
        all_case_p50_ms=durations[math.ceil(0.5 * len(durations)) - 1] if durations else None,
        all_case_p95_ms=durations[math.ceil(0.95 * len(durations)) - 1] if durations else None,
        usage_for_final_cases_only={
            "inputTokensUsed": sum(c.usage.inputTokensUsed for c in final if c.usage),
            "outputTokensUsed": sum(c.usage.outputTokensUsed for c in final if c.usage),
        },
        provider_closed=closed,
        baseline_unchanged=unchanged,
        artifact_sha256=hashes,
        retention_until=pinned.manifest.summary_retention_until,
    )


async def investigate(
    pinned, provider, writer, *, privacy=None, settle_seconds=1.0, verification_gate=None
):
    capture = Capture(pinned.manifest.run_id, privacy or writer.privacy)
    closed, unchanged, hashes, cancelled = False, True, {}, False
    try:
        with capture.loggers(provider.client):
            try:
                pinned.verify()
                hashes = checkpoint(writer, pinned, capture)
                for split, rows in (
                    ("dev", pinned.dataset.dev),
                    ("held_out", pinned.dataset.held_out),
                ):
                    for item in rows:
                        if capture.stop_reason:
                            break
                        pinned.verify()
                        pinned.manifest.active_case_id = item.id
                        writer.write("manifest.json", pinned.manifest)
                        payload = payload_for(item, pinned.manifest.context)
                        case = CaseRecord(
                            run_id=capture.run_id,
                            case_id=item.id,
                            split=split,
                            order=len(capture.cases) + 1,
                            expected_status=item.status,
                            input=Input(message=payload.message),
                            context=payload.context,
                            initial_budget=dict(BUDGET),
                        )
                        capture.add_case(case)
                        try:
                            await RecordingFaq(
                                provider,
                                pinned.index,
                                capture,
                                case,
                                verification_gate=verification_gate,
                            ).run(payload)
                        except asyncio.CancelledError:
                            cancelled = True
                        except (CollectorStop, DependencyError, TimeoutError):
                            pass
                        except Exception:  # noqa: BLE001 -- no raw exception is persisted or logged
                            capture.stop("unexpected")
                        await capture.settle(case, settle_seconds)
                        pinned.verify()
                        pinned.manifest.completed_cases = len(capture.cases)
                        pinned.manifest.active_case_id = None
                        hashes = checkpoint(writer, pinned, capture)
            except asyncio.CancelledError:
                cancelled = True
                capture.stop("user_cancelled")
                if capture.cases:
                    capture.reconcile(capture.cases[-1])
                pinned.manifest.completed_cases = len(capture.cases)
                pinned.manifest.active_case_id = None
            except CollectorStop as error:
                capture.stop(error.reason)
            finally:
                try:
                    await provider.close()
                    closed = True
                except Exception:  # noqa: BLE001 -- only the fixed cleanup reason may escape
                    capture.stop("cleanup_failure")
                try:
                    pinned.verify()
                except CollectorStop:
                    unchanged = False
                    capture.stop("source_drift")
                summary = summarize(pinned, capture, hashes, closed, unchanged)
                # Fail closed even if storage becomes unwritable during finalization.
                # The completed manifest is the last required write, after the summary.
                pinned.manifest.state = "stopped"
                summary_written = False
                try:
                    hashes = checkpoint(writer, pinned, capture)
                    final_manifest = pinned.manifest.model_copy(update={"state": summary.state})
                    summary.artifact_sha256 = hashes | {
                        "manifest.json": sha(writer.privacy.encode(final_manifest))
                    }
                    writer.write("summary.json", summary)
                    summary_written = True
                    writer.write("manifest.json", final_manifest)
                    pinned.manifest.state = final_manifest.state
                except CollectorStop as error:
                    capture.stop(error.reason)
                    summary = summarize(pinned, capture, hashes, closed, unchanged)
                    if summary_written:
                        # A failed completion-marker write leaves the stopped manifest.
                        # Replace the provisional summary when storage still permits it.
                        try:
                            writer.write("summary.json", summary)
                        except CollectorStop:
                            pass
    finally:
        if cancelled:
            raise asyncio.CancelledError()
    return summary


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot-id", required=True)
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--validate-only", action="store_true")
    modes.add_argument("--live", action="store_true")
    args = parser.parse_args(argv)
    try:
        pinned = preflight(args.snapshot_id)
        if not args.live:
            print(
                json.dumps(
                    {
                        "state": "validated",
                        "live": False,
                        "snapshot_id": pinned.manifest.snapshot_id,
                        "cases": 24,
                    }
                )
            )
            return 0
        settings = Settings()
        if not settings.gemini_key or settings.gemini_model != MODEL:
            raise CollectorStop("model_drift")
        # Validate approved, pinned publications before any provider is constructed.
        gate = load_verification_gate(settings, pinned.index, TODAY)
        privacy = Privacy(
            [
                settings.gemini_key.get_secret_value(),
                settings.service_token.get_secret_value() if settings.service_token else "",
            ]
        )
        privacy.check(pinned.manifest)
        output = ROOT / ".local/assistant-evaluation/d1-investigation"
        if output.resolve() != output.absolute():
            raise CollectorStop("writer_failure")
        writer = ArtifactWriter(output, pinned.manifest.run_id, privacy)
        provider = Gemini(settings.gemini_key.get_secret_value(), MODEL)
        summary = asyncio.run(
            investigate(pinned, provider, writer, privacy=privacy, verification_gate=gate)
        )
        print(
            json.dumps(
                {
                    "state": summary.state,
                    "stop_reason": summary.stop_reason,
                    "run_id": summary.run_id,
                }
            )
        )
        return 0 if summary.state == "completed" else 2
    except (CollectorStop, DependencyError, ValidationError, OSError, ValueError) as error:
        print(
            json.dumps(
                {
                    "state": "not_completed",
                    "reason": error.reason
                    if isinstance(error, CollectorStop)
                    else "dependency_unavailable"
                    if isinstance(error, DependencyError)
                    else "invalid_capture",
                }
            )
        )
        return 2
    except KeyboardInterrupt:
        print(json.dumps({"state": "not_completed", "reason": "user_cancelled"}))
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
