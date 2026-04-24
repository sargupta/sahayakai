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

TTL (Round-2 P0-5 fix):
- A separate `agent_sessions/{call_sid}` metadata doc records `expireAt`, a
  future datetime computed as `now + session_ttl_hours`.
- Firestore TTL policy (set at deploy time via `gcloud firestore fields ttl
  update`) purges docs whose `expireAt` is <= now. Writing `expireAt` as a
  future timestamp means docs live until the TTL elapses, not until the
  write itself.

Async wrapper (Round-2 P0-4 fix):
- Firestore's stable Python client is synchronous. FastAPI handlers are
  async. Calling the sync client directly inside an `async def` would hold
  the event loop for the full Firestore round-trip (~50-200ms), collapsing
  effective concurrency to ~5-10 even with `containerConcurrency=20`.
- All public methods are `async def` and dispatch the blocking work through
  `asyncio.to_thread`. The sync call bodies remain as helpers for testing.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
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
    """Async wrapper around the Firestore sync client.

    Firestore's Python async client is still alpha; we use the stable sync
    client via `asyncio.to_thread` so blocking I/O doesn't park the event
    loop. Tests can instantiate directly and call `_sync_*` helpers.
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

    # --- Sync primitives (test-accessible, not called from handlers) --------

    def _sync_append_turn(self, turn: TurnRecord) -> None:
        doc_ref = self._turn_doc(turn.call_sid, turn.turn_number)
        meta_ref = self._call_doc(turn.call_sid)

        @firestore.transactional
        def _txn(txn: firestore.Transaction) -> None:
            snap = doc_ref.get(transaction=txn)
            if snap.exists:
                raise SessionConflictError(
                    f"Turn {turn.turn_number} on call {turn.call_sid} already written"
                )
            # OCC on metadata as well: refuse a turn whose number is <= a
            # previously-written one. Protects against Twilio retry storms
            # that arrive out-of-order.
            meta_snap = meta_ref.get(transaction=txn)
            if meta_snap.exists:
                last = int((meta_snap.to_dict() or {}).get("lastTurnNumber") or 0)
                if turn.turn_number <= last:
                    raise SessionConflictError(
                        f"Turn {turn.turn_number} is <= lastTurnNumber={last} "
                        f"on call {turn.call_sid}"
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

    def _sync_load_transcript(self, call_sid: str) -> list[TurnRecord]:
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

    def _sync_mark_ended(self, call_sid: str, duration_seconds: float | None = None) -> None:
        ttl_hours = get_settings().session_ttl_hours
        expire_at = datetime.now(UTC) + timedelta(hours=ttl_hours)
        self._call_doc(call_sid).set(
            {
                "endedAt": datetime.now(UTC),
                "expireAt": expire_at,
                "durationSeconds": duration_seconds,
            },
            merge=True,
        )

    def _sync_clear_for_test(self, call_sid: str) -> None:
        for snap in self._call_doc(call_sid).collection("turns").stream():
            snap.reference.delete()
        self._call_doc(call_sid).delete()

    # --- Async wrappers used by FastAPI handlers ----------------------------

    async def append_turn(self, turn: TurnRecord) -> None:
        await asyncio.to_thread(self._sync_append_turn, turn)

    async def load_transcript(self, call_sid: str) -> list[TurnRecord]:
        return await asyncio.to_thread(self._sync_load_transcript, call_sid)

    async def mark_ended(
        self, call_sid: str, duration_seconds: float | None = None
    ) -> None:
        await asyncio.to_thread(self._sync_mark_ended, call_sid, duration_seconds)

    async def clear_for_test(self, call_sid: str) -> None:
        await asyncio.to_thread(self._sync_clear_for_test, call_sid)


def transcript_to_wire(turns: Iterable[TurnRecord]) -> list[dict[str, str]]:
    """Convert stored turns to the dict shape that the ADK agent consumes."""
    return [{"role": t.role, "text": t.text} for t in turns]
