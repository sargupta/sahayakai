"""Regression gate: VIDYA's web voice mode must outlive her first answer.

`session.receive()` is a PER-TURN async generator — it ends when the model stops
speaking, not when the session closes. `_relay_session` waits with
FIRST_COMPLETED, so a `_pump_vertex_to_client` that returns after one pass tears
down the whole socket the moment VIDYA finishes her first reply. Voice mode
could not hold a conversation, and the close reason read "vertex_stream_end" —
as though the model had quit rather than as though we had stopped listening.

This was confirmed empirically on the telephony bridge, which copied the same
shape: a live call against the deployed service ended after 5.4 seconds, right
after the greeting. The mirror gate for that path is
`test_telephony_turn_spanning.py`.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

from sahayakai_agents.agents.vidya_voice.router import (
    _pump_vertex_to_client,
    _StreamCounters,
)


class _Audio:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.tool_call = None
        self.server_content = None


class _PerTurnSession:
    """A Live session whose `receive()` ends after each turn, as the real one does."""

    def __init__(self, turns: list[list[bytes]]) -> None:
        self._turns = turns
        self.turns_consumed = 0

    def receive(self) -> Any:
        turn = self._turns[self.turns_consumed] if self.turns_consumed < len(self._turns) else []
        self.turns_consumed += 1

        async def _gen() -> Any:
            for chunk in turn:
                yield _Audio(chunk)

        return _gen()


class _Socket:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_text(self, text: str) -> None:
        self.sent.append(json.loads(text))


@pytest.mark.asyncio
class TestTurnSpanning:
    async def test_keeps_relaying_after_the_first_turn(self) -> None:
        ws, counters = _Socket(), _StreamCounters()
        session = _PerTurnSession([[b"one"], [b"two"], [b"three"]])

        result = await asyncio.wait_for(
            _pump_vertex_to_client(ws, session, counters), timeout=2  # type: ignore[arg-type]
        )

        assert result == "vertex_stream_end"
        assert session.turns_consumed > 1, (
            "the pump returned after one turn — voice mode would close as soon as "
            "VIDYA finished her first answer"
        )
        # Every turn's audio must actually reach the client, not just be iterated.
        assert len(ws.sent) == 3
        assert all("audio" in frame for frame in ws.sent)

    async def test_stops_when_the_session_is_genuinely_gone(self) -> None:
        # An empty pass means the session closed, not that a turn finished.
        # Re-entering forever would spin a CPU on a dead socket.
        ws, counters = _Socket(), _StreamCounters()
        session = _PerTurnSession([[]])
        result = await asyncio.wait_for(
            _pump_vertex_to_client(ws, session, counters), timeout=2  # type: ignore[arg-type]
        )
        assert result == "vertex_stream_end"
        assert session.turns_consumed == 1
        assert ws.sent == []

    async def test_counters_accumulate_across_turns(self) -> None:
        # Byte telemetry is how this route's bill is attributed; it must not
        # reset or stop at the first turn boundary.
        ws, counters = _Socket(), _StreamCounters()
        session = _PerTurnSession([[b"a"], [b"b"]])
        await asyncio.wait_for(
            _pump_vertex_to_client(ws, session, counters), timeout=2  # type: ignore[arg-type]
        )
        assert counters.frames_down == 2
        assert counters.bytes_down > 0
