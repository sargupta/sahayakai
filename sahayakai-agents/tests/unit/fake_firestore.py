"""In-memory Firestore fake shared between unit and integration tests.

Mirrors the subset of the google-cloud-firestore sync API that
`SessionStore` uses: `collection().document().set()`, `.get()`,
`.collection()`, `.stream()`, `.order_by()`, plus a `Transaction`
stand-in.

Captures the OCC semantics (composite-key turn writes and
monotonic-turn-number enforcement) that production relies on.

Also exports `make_fake_session_store()` which returns a real
`SessionStore` instance whose internal client is the fake and whose
`_sync_append_turn` has been replaced with a version that walks the fake
directly (because `firestore.transactional` is a real decorator that
expects the real SDK).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterator

from sahayakai_agents.session_store import SessionStore, TurnRecord
from sahayakai_agents.shared.errors import SessionConflictError


@dataclass
class FakeSnap:
    """Stand-in for `firestore.DocumentSnapshot`."""

    _data: dict[str, Any] | None
    id: str

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return self._data


@dataclass
class FakeDocRef:
    """Stand-in for `firestore.DocumentReference`."""

    store: "FakeStore"
    path: tuple[str, ...]
    id: str = ""

    def __post_init__(self) -> None:
        self.id = self.path[-1]

    def get(self, transaction: "FakeTxn | None" = None) -> FakeSnap:
        data = self.store.get(self.path)
        return FakeSnap(_data=data, id=self.id)

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        if merge:
            existing = self.store.get(self.path) or {}
            existing.update(data)
            self.store.put(self.path, existing)
        else:
            self.store.put(self.path, dict(data))

    def delete(self) -> None:
        self.store.delete(self.path)

    def collection(self, name: str) -> "FakeCollection":
        return FakeCollection(self.store, self.path + (name,))


@dataclass
class FakeCollection:
    """Stand-in for `firestore.CollectionReference`."""

    store: "FakeStore"
    path: tuple[str, ...]

    def document(self, doc_id: str) -> FakeDocRef:
        return FakeDocRef(self.store, self.path + (doc_id,))

    def order_by(self, _field: str) -> "FakeCollection":
        return self

    def stream(self) -> Iterator[FakeSnap]:
        prefix = self.path
        keys = [k for k in sorted(self.store.docs) if k[:-1] == prefix]
        for key in keys:
            yield FakeSnap(_data=self.store.docs.get(key), id=key[-1])


class FakeTxn:
    """Stand-in for `firestore.Transaction`.

    The production `_sync_append_turn` uses `@firestore.transactional`,
    but test patches bypass that decorator and call into these set()
    methods directly.
    """

    def set(self, ref: FakeDocRef, data: dict[str, Any], merge: bool = False) -> None:
        ref.set(data, merge=merge)


@dataclass
class FakeStore:
    """Stand-in for `firestore.Client`."""

    docs: dict[tuple[str, ...], dict[str, Any]] = field(default_factory=dict)

    def collection(self, name: str) -> FakeCollection:
        return FakeCollection(self, (name,))

    def transaction(self) -> FakeTxn:
        return FakeTxn()

    def get(self, path: tuple[str, ...]) -> dict[str, Any] | None:
        return self.docs.get(path)

    def put(self, path: tuple[str, ...], data: dict[str, Any]) -> None:
        self.docs[path] = data

    def delete(self, path: tuple[str, ...]) -> None:
        self.docs.pop(path, None)


def make_fake_session_store() -> SessionStore:
    """Build a `SessionStore` backed by `FakeStore`.

    Side-steps `SessionStore.__init__` (which would build a real Firestore
    client) and replaces `_sync_append_turn` with a shim that mirrors the
    same OCC invariants as the production path.

    NOTE: this re-implements production logic. PY-5 reviewer flagged this
    as drift risk. Until we extract the OCC body into a non-decorated
    helper that both production and tests share, keep this shim
    byte-for-byte aligned with `session_store._sync_append_turn`.
    """
    fake = FakeStore()
    store = SessionStore.__new__(SessionStore)  # bypass __init__
    store._client = fake  # type: ignore[attr-defined]
    store._collection = "agent_sessions"  # type: ignore[attr-defined]

    def _append(turn: TurnRecord) -> None:
        # Composite key per Round-2 multi-turn doc collision fix.
        doc_ref = store._turn_doc(turn.call_sid, turn.turn_number, turn.role)  # type: ignore[attr-defined]
        meta_ref = store._call_doc(turn.call_sid)  # type: ignore[attr-defined]
        txn = fake.transaction()
        snap = doc_ref.get(transaction=txn)
        if snap.exists:
            raise SessionConflictError(
                f"Turn {turn.turn_number} ({turn.role}) on call "
                f"{turn.call_sid} already written"
            )
        meta_snap = meta_ref.get(transaction=txn)
        last = (
            int((meta_snap.to_dict() or {}).get("lastTurnNumber") or 0)
            if meta_snap.exists
            else 0
        )
        # Role-aware OCC: parent strictly advances; agent rides last.
        if turn.role == "parent":
            if turn.turn_number <= last:
                raise SessionConflictError(
                    f"Parent turn {turn.turn_number} is <= lastTurnNumber={last} "
                    f"on call {turn.call_sid} (out-of-order or replay)"
                )
        elif turn.role == "agent":
            if turn.turn_number != last:
                raise SessionConflictError(
                    f"Agent turn {turn.turn_number} does not match "
                    f"lastTurnNumber={last} on call {turn.call_sid} "
                    "(parent must be persisted first)"
                )
        else:
            raise SessionConflictError(
                f"Unknown role {turn.role!r} on call {turn.call_sid}"
            )
        txn.set(
            doc_ref,
            {"role": turn.role, "text": turn.text, "createdAt": turn.created_at},
        )
        if turn.role == "parent":
            txn.set(
                meta_ref,
                {"lastTurnNumber": turn.turn_number, "updatedAt": turn.created_at},
                merge=True,
            )
        else:
            txn.set(meta_ref, {"updatedAt": turn.created_at}, merge=True)

    store._sync_append_turn = _append  # type: ignore[method-assign]
    return store
