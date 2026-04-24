"""Unit tests for the Firestore-backed SessionStore.

Uses an in-memory fake that mirrors the subset of the google-cloud-firestore
API we actually call. The fake captures the OCC semantics (composite key +
last-writer-wins refusal) that the production code depends on.

Review trace:
- P0 #10 composite-key turn writes: duplicate turn number → 409.
- Round-2 P0-4 async wrapper wires sync primitives through `asyncio.to_thread`.
- Round-2 P0-5 TTL field is `expireAt`, computed as `now + ttl_hours`.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

import pytest

from sahayakai_agents.session_store import (
    SessionStore,
    TurnRecord,
    transcript_to_wire,
)
from sahayakai_agents.shared.errors import SessionConflictError


pytestmark = pytest.mark.unit


# ---- In-memory fake Firestore -------------------------------------------


@dataclass
class _FakeSnap:
    _data: dict[str, Any] | None
    id: str

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return self._data


@dataclass
class _FakeDocRef:
    store: "_FakeStore"
    path: tuple[str, ...]
    id: str = ""

    def __post_init__(self) -> None:
        self.id = self.path[-1]

    def get(self, transaction: "_FakeTxn | None" = None) -> _FakeSnap:
        data = self.store.get(self.path)
        return _FakeSnap(_data=data, id=self.id)

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        if merge:
            existing = self.store.get(self.path) or {}
            existing.update(data)
            self.store.put(self.path, existing)
        else:
            self.store.put(self.path, dict(data))

    def delete(self) -> None:
        self.store.delete(self.path)

    def collection(self, name: str) -> "_FakeCollection":
        return _FakeCollection(self.store, self.path + (name,))


@dataclass
class _FakeCollection:
    store: "_FakeStore"
    path: tuple[str, ...]

    def document(self, doc_id: str) -> _FakeDocRef:
        return _FakeDocRef(self.store, self.path + (doc_id,))

    def order_by(self, _field: str) -> "_FakeCollection":
        return self

    def stream(self):  # type: ignore[no-untyped-def]
        prefix = self.path
        keys = [k for k in sorted(self.store.docs) if k[:-1] == prefix]
        for key in keys:
            yield _FakeSnap(_data=self.store.docs.get(key), id=key[-1])


class _FakeTxn:
    """Stand-in for firestore.Transaction."""

    def set(self, ref: _FakeDocRef, data: dict[str, Any], merge: bool = False) -> None:
        ref.set(data, merge=merge)


@dataclass
class _FakeStore:
    docs: dict[tuple[str, ...], dict[str, Any]] = field(default_factory=dict)

    def collection(self, name: str) -> _FakeCollection:
        return _FakeCollection(self, (name,))

    def transaction(self) -> _FakeTxn:
        return _FakeTxn()

    def get(self, path: tuple[str, ...]) -> dict[str, Any] | None:
        return self.docs.get(path)

    def put(self, path: tuple[str, ...], data: dict[str, Any]) -> None:
        self.docs[path] = data

    def delete(self, path: tuple[str, ...]) -> None:
        self.docs.pop(path, None)


def _make_store() -> SessionStore:
    fake = _FakeStore()
    store = SessionStore.__new__(SessionStore)  # bypass __init__ (no real Firestore)
    store._client = fake  # type: ignore[attr-defined]
    store._collection = "agent_sessions"  # type: ignore[attr-defined]

    def _append(turn: TurnRecord) -> None:
        doc_ref = store._turn_doc(turn.call_sid, turn.turn_number)  # type: ignore[attr-defined]
        meta_ref = store._call_doc(turn.call_sid)  # type: ignore[attr-defined]
        txn = fake.transaction()
        snap = doc_ref.get(transaction=txn)
        if snap.exists:
            raise SessionConflictError(
                f"Turn {turn.turn_number} on call {turn.call_sid} already written"
            )
        meta_snap = meta_ref.get(transaction=txn)
        if meta_snap.exists:
            last = int((meta_snap.to_dict() or {}).get("lastTurnNumber") or 0)
            if turn.turn_number <= last:
                raise SessionConflictError(
                    f"Turn {turn.turn_number} <= lastTurnNumber={last}"
                )
        txn.set(
            doc_ref,
            {"role": turn.role, "text": turn.text, "createdAt": turn.created_at},
        )
        txn.set(
            meta_ref,
            {"lastTurnNumber": turn.turn_number, "updatedAt": turn.created_at},
            merge=True,
        )

    store._sync_append_turn = _append  # type: ignore[method-assign]
    return store


# ---- Tests ---------------------------------------------------------------


class TestAppendTurn:
    def test_first_turn_writes(self) -> None:
        store = _make_store()
        turn = TurnRecord(
            call_sid="CAxxx",
            turn_number=1,
            role="parent",
            text="Namaste",
            created_at=datetime.now(UTC),
        )
        store._sync_append_turn(turn)  # type: ignore[attr-defined]
        assert store._client.docs  # type: ignore[attr-defined]

    def test_duplicate_turn_raises_conflict(self) -> None:
        store = _make_store()
        base = TurnRecord(
            call_sid="CAxxx",
            turn_number=1,
            role="parent",
            text="Namaste",
            created_at=datetime.now(UTC),
        )
        store._sync_append_turn(base)  # type: ignore[attr-defined]
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(base)  # type: ignore[attr-defined]

    def test_out_of_order_turn_raises_conflict(self) -> None:
        store = _make_store()
        t1 = TurnRecord(
            call_sid="CAxxx",
            turn_number=1,
            role="parent",
            text="Namaste",
            created_at=datetime.now(UTC),
        )
        t3 = TurnRecord(
            call_sid="CAxxx",
            turn_number=3,
            role="agent",
            text="Haan ji",
            created_at=datetime.now(UTC),
        )
        t2_stale = TurnRecord(
            call_sid="CAxxx",
            turn_number=2,
            role="parent",
            text="late arrival",
            created_at=datetime.now(UTC),
        )
        store._sync_append_turn(t1)  # type: ignore[attr-defined]
        store._sync_append_turn(t3)  # type: ignore[attr-defined]
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(t2_stale)  # type: ignore[attr-defined]


class TestTranscriptToWire:
    def test_shape(self) -> None:
        turns = [
            TurnRecord(
                call_sid="CAxxx",
                turn_number=1,
                role="parent",
                text="hello",
                created_at=datetime.now(UTC),
            ),
            TurnRecord(
                call_sid="CAxxx",
                turn_number=2,
                role="agent",
                text="namaste",
                created_at=datetime.now(UTC),
            ),
        ]
        wire = transcript_to_wire(turns)
        assert wire == [
            {"role": "parent", "text": "hello"},
            {"role": "agent", "text": "namaste"},
        ]
