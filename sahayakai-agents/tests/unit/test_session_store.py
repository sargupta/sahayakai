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


def _record(call_sid: str, turn_number: int, role: str, text: str = "x") -> TurnRecord:
    return TurnRecord(
        call_sid=call_sid,
        turn_number=turn_number,
        role=role,
        text=text,
        created_at=datetime.now(UTC),
    )


class TestAppendTurn:
    def test_first_parent_turn_writes(self) -> None:
        store = make_fake_session_store()
        store._sync_append_turn(_record("CAxxx", 1, "parent", "Namaste"))  # type: ignore[attr-defined]
        assert store._client.docs  # type: ignore[attr-defined]

    def test_parent_then_agent_same_turn_both_persist(self) -> None:
        """Round-2 P0 fix: composite-key doc IDs let parent + agent share
        a turn_number without colliding. Previously the second write 409'd
        because both used `turns/0001` as the doc ID; now they use
        `turns/0001_parent` and `turns/0001_agent` respectively.
        """
        store = make_fake_session_store()
        store._sync_append_turn(_record("CAxxx", 1, "parent", "Namaste"))  # type: ignore[attr-defined]
        store._sync_append_turn(_record("CAxxx", 1, "agent", "Bataaiye"))  # type: ignore[attr-defined]
        # Both docs land:
        paths = list(store._client.docs.keys())  # type: ignore[attr-defined]
        leaves = [p[-1] for p in paths if p[-2] == "turns"]
        assert "0001_parent" in leaves
        assert "0001_agent" in leaves

    def test_full_six_turn_call_lands_without_409s(self) -> None:
        """End-to-end: 6 turns, each with a parent + agent write, all
        succeed. This is the regression test for the multi-turn collision
        bug — previously broke at turn-1's agent write."""
        store = make_fake_session_store()
        for n in range(1, 7):
            store._sync_append_turn(_record("CAxxx", n, "parent", f"p{n}"))  # type: ignore[attr-defined]
            store._sync_append_turn(_record("CAxxx", n, "agent", f"a{n}"))  # type: ignore[attr-defined]
        turn_docs = [
            p[-1] for p in store._client.docs.keys()  # type: ignore[attr-defined]
            if len(p) >= 4 and p[-2] == "turns"
        ]
        assert len(turn_docs) == 12

    def test_duplicate_parent_turn_raises_conflict(self) -> None:
        store = make_fake_session_store()
        base = _record("CAxxx", 1, "parent", "Namaste")
        store._sync_append_turn(base)  # type: ignore[attr-defined]
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(base)  # type: ignore[attr-defined]

    def test_duplicate_agent_turn_raises_conflict(self) -> None:
        store = make_fake_session_store()
        store._sync_append_turn(_record("CAxxx", 1, "parent", "p"))  # type: ignore[attr-defined]
        store._sync_append_turn(_record("CAxxx", 1, "agent", "a"))  # type: ignore[attr-defined]
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(_record("CAxxx", 1, "agent", "a-again"))  # type: ignore[attr-defined]

    def test_agent_without_prior_parent_raises_conflict(self) -> None:
        """Agent turn requires the parent turn for the same number to be
        persisted first (so `lastTurnNumber == turn.turn_number`). An
        orphan agent write must fail."""
        store = make_fake_session_store()
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(_record("CAxxx", 1, "agent", "no parent yet"))  # type: ignore[attr-defined]

    def test_stale_parent_turn_after_advance_raises_conflict(self) -> None:
        """Twilio retries that arrive out-of-order: parent N+1 succeeds,
        then a stale parent N retry must fail."""
        store = make_fake_session_store()
        store._sync_append_turn(_record("CAxxx", 1, "parent", "p1"))  # type: ignore[attr-defined]
        store._sync_append_turn(_record("CAxxx", 1, "agent", "a1"))  # type: ignore[attr-defined]
        store._sync_append_turn(_record("CAxxx", 2, "parent", "p2"))  # type: ignore[attr-defined]
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(_record("CAxxx", 1, "parent", "stale"))  # type: ignore[attr-defined]

    def test_unknown_role_raises_conflict(self) -> None:
        store = make_fake_session_store()
        with pytest.raises(SessionConflictError):
            store._sync_append_turn(_record("CAxxx", 1, "system", "?"))  # type: ignore[attr-defined]


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
