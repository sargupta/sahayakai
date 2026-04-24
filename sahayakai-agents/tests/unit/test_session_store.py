"""Unit tests for the Firestore-backed SessionStore.

Uses the in-memory fake at `tests/unit/fake_firestore.py` which is also
shared with the integration tests in `tests/integration/`.

Review trace:
- P0 #10 composite-key turn writes: duplicate turn number → 409.
- Round-2 P0-4 async wrapper wires sync primitives through `asyncio.to_thread`.
- Round-2 P0-5 TTL field is `expireAt`, computed as `now + ttl_hours`.
"""
from __future__ import annotations

from datetime import UTC, datetime

import pytest

from sahayakai_agents.session_store import TurnRecord, transcript_to_wire
from sahayakai_agents.shared.errors import SessionConflictError

from .fake_firestore import make_fake_session_store


pytestmark = pytest.mark.unit


class TestAppendTurn:
    def test_first_turn_writes(self) -> None:
        store = make_fake_session_store()
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
        store = make_fake_session_store()
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
        store = make_fake_session_store()
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
