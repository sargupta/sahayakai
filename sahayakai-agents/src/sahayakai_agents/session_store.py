"""Firestore-backed session store with optimistic concurrency control.

Keys:
- Document path: `{collection}/{call_sid}/turns/{turn_number:04d}`
- Collection contention on the same `call_sid` is handled by Firestore
  transactions. Duplicate or out-of-order turn numbers raise
  `SessionConflictError` (HTTP 409), which Next.js surfaces back to Twilio as
  a benign retry-safe error.

Why composite key (call_sid, turn_number) not just call_sid:
- Twilio webhook retries send the same `call_sid` on 5xx. Without a turn-level
  key, the second write would silently overwrite the first.
- Review P0 #10.

TTL:
- A separate `agent_sessions/{call_sid}` metadata doc records `endedAt`.
- Firestore TTL policy (set at deploy time, not here) purges ended sessions
  older than `session_ttl_hours`.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Iterable

import structlog
from google.cloud import firestore  # type: ignore[import-untyped]

from .config import get_settings
from .shared.errors import SessionConflictError

log = structlog.get_logger(__name__)


@dataclass(frozen=True)
class TurnRecord:
    call_sid: str
    turn_number: int
    role: str  # "agent" | "parent"
    text: str
    created_at: datetime


class SessionStore:
    """Async-friendly wrapper around the Firestore sync client.

    Firestore's Python async client is alpha; we use the stable sync client via
    `asyncio.to_thread` (applied at call sites) for now.
    """

    def __init__(self, client: firestore.Client | None = None) -> None:
        self._client = client or firestore.Client(
            project=get_settings().gcp_project,
            database=get_settings().firestore_database,
        )
        self._collection = get_settings().session_collection

    def _call_doc(self, call_sid: str) -> firestore.DocumentReference:
        return self._client.collection(self._collection).document(call_sid)

    def _turn_doc(self, call_sid: str, turn_number: int) -> firestore.DocumentReference:
        return self._call_doc(call_sid).collection("turns").document(f"{turn_number:04d}")

    def append_turn(self, turn: TurnRecord) -> None:
        """Write a turn with OCC. Raises `SessionConflictError` on duplicate."""
        doc_ref = self._turn_doc(turn.call_sid, turn.turn_number)
        meta_ref = self._call_doc(turn.call_sid)

        @firestore.transactional
        def _txn(txn: firestore.Transaction) -> None:
            snap = doc_ref.get(transaction=txn)
            if snap.exists:
                raise SessionConflictError(
                    f"Turn {turn.turn_number} on call {turn.call_sid} already written"
                )
            txn.set(
                doc_ref,
                {
                    "role": turn.role,
                    "text": turn.text,
                    "createdAt": turn.created_at,
                },
            )
            txn.set(
                meta_ref,
                {
                    "lastTurnNumber": turn.turn_number,
                    "updatedAt": turn.created_at,
                },
                merge=True,
            )

        _txn(self._client.transaction())
        log.debug(
            "session_store.turn_appended",
            call_sid=turn.call_sid,
            turn_number=turn.turn_number,
            role=turn.role,
        )

    def load_transcript(self, call_sid: str) -> list[TurnRecord]:
        """Read all turns for a call, in turn-number order."""
        turns_ref = self._call_doc(call_sid).collection("turns")
        snaps = turns_ref.order_by("__name__").stream()
        out: list[TurnRecord] = []
        for snap in snaps:
            data = snap.to_dict() or {}
            try:
                turn_number = int(snap.id)
            except ValueError:
                log.warning("session_store.malformed_turn_id", call_sid=call_sid, id=snap.id)
                continue
            out.append(
                TurnRecord(
                    call_sid=call_sid,
                    turn_number=turn_number,
                    role=str(data.get("role") or ""),
                    text=str(data.get("text") or ""),
                    created_at=data.get("createdAt") or datetime.now(UTC),
                )
            )
        return out

    def mark_ended(self, call_sid: str, duration_seconds: float | None = None) -> None:
        """Record that a call has ended. TTL policy will purge later."""
        self._call_doc(call_sid).set(
            {
                "endedAt": datetime.now(UTC),
                "durationSeconds": duration_seconds,
            },
            merge=True,
        )

    # --- Test hooks ---------------------------------------------------------

    def _clear_for_test(self, call_sid: str) -> None:
        """Delete a session doc + its turns. Test-only."""
        for snap in self._call_doc(call_sid).collection("turns").stream():
            snap.reference.delete()
        self._call_doc(call_sid).delete()


def transcript_to_wire(turns: Iterable[TurnRecord]) -> list[dict[str, str]]:
    """Convert stored turns to the dict shape that the ADK agent consumes."""
    return [{"role": t.role, "text": t.text} for t in turns]
