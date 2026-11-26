"""In-memory single-use continuation store for D2/D3/D4 broker tool_calls/resume cycles."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from time import monotonic
from uuid import UUID, uuid4

from app.providers.contracts import DependencyError

MAX_CONTINUATIONS = 1024
MAX_TTL_SECONDS = 120.0


class ContinuationNotFoundError(Exception):
    """Raised when a continuation ID is unknown, expired, replayed, or mismatched."""


@dataclass(frozen=True)
class PendingCall:
    call_id: UUID
    name: str


@dataclass(frozen=True)
class CombinedPolicyContext:
    """Host-pinned policy context for D4 combined booking + policy resume turns."""

    original_message: str
    policy_query: str
    today: date
    allowed_tools: tuple[str, ...]


@dataclass(frozen=True)
class FollowupClarification:
    """Optional clarification appended deterministically after rendering partial multi-intent results."""

    note: str
    missing_fields: tuple[str, ...] = ()
    actions: tuple[dict, ...] = ()


@dataclass(frozen=True)
class ContinuationEntry:
    continuation_id: UUID
    conversation_id: UUID
    turn_id: UUID
    pending_calls: tuple[PendingCall, ...]
    expires_at: float
    policy_context: CombinedPolicyContext | None = None
    followup: FollowupClarification | None = None


class ContinuationStore:
    """Bounded, TTL-enforced, atomic single-use continuation registry."""

    def __init__(
        self,
        *,
        clock: Callable[[], float] = monotonic,
        max_entries: int = MAX_CONTINUATIONS,
        max_ttl_s: float = MAX_TTL_SECONDS,
    ):
        self._clock = clock
        self._max_entries = max_entries
        self._max_ttl_s = max_ttl_s
        self._entries: dict[UUID, ContinuationEntry] = {}

    def _prune(self, now: float) -> None:
        expired = [cid for cid, entry in self._entries.items() if entry.expires_at <= now]
        for cid in expired:
            del self._entries[cid]

    def create(
        self,
        *,
        conversation_id: UUID,
        turn_id: UUID,
        pending_calls: list[PendingCall],
        remaining_ms: int,
        policy_context: CombinedPolicyContext | None = None,
        followup: FollowupClarification | None = None,
    ) -> UUID:
        if not pending_calls or remaining_ms <= 0:
            raise DependencyError("DEADLINE_EXCEEDED")
        now = self._clock()
        self._prune(now)
        if len(self._entries) >= self._max_entries:
            raise DependencyError("DEPENDENCY_UNAVAILABLE")
        ttl = min(self._max_ttl_s, remaining_ms / 1000.0)
        continuation_id = uuid4()
        self._entries[continuation_id] = ContinuationEntry(
            continuation_id=continuation_id,
            conversation_id=conversation_id,
            turn_id=turn_id,
            pending_calls=tuple(pending_calls),
            expires_at=now + ttl,
            policy_context=policy_context,
            followup=followup,
        )
        return continuation_id

    def consume(
        self,
        *,
        continuation_id: UUID,
        conversation_id: UUID,
        turn_id: UUID,
        tool_results: list,
    ) -> ContinuationEntry:
        now = self._clock()
        self._prune(now)
        # Atomic single-use pop: any replay or mismatched caller invalidates this continuation.
        entry = self._entries.pop(continuation_id, None)
        if entry is None or entry.expires_at <= now:
            raise ContinuationNotFoundError()
        if entry.conversation_id != conversation_id or entry.turn_id != turn_id:
            raise ContinuationNotFoundError()
        expected = {(call.call_id, call.name) for call in entry.pending_calls}
        supplied = {(result.callId, result.name) for result in tool_results}
        if len(tool_results) != len(entry.pending_calls) or expected != supplied:
            raise ContinuationNotFoundError()
        return entry
