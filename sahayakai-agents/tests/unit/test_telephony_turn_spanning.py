"""Regression gate: a call must outlive the model's first turn.

`session.receive()` is a PER-TURN async generator — it ends when the model
stops speaking, not when the session closes. The obvious implementation,

    async for resp in session.receive():
        ...

therefore hangs up the moment the greeting finishes. That is what shipped to
the staging telephony service, and the live smoke test caught it: 5.4 seconds
of call, `reason: live_stream_end`. On a real call the parent would hear one
sentence and then a dead line, and the log line reads as though the model quit
rather than as though we stopped listening.

The test drives the pump with a session whose `receive()` deliberately ends
after each turn. A pump that treats one turn as the whole call collects only
the first turn's audio and returns immediately.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony


class _Turn:
    """One chunk of model audio."""

    def __init__(self, data: bytes) -> None:
        self.data = data
        self.server_content = None


class _PerTurnSession:
    """A Live session whose `receive()` ends after every turn, as the real one does."""

    def __init__(self, turns: list[list[bytes]]) -> None:
        self._turns = turns
        self.turns_consumed = 0

    def receive(self) -> Any:
        turn = self._turns[self.turns_consumed] if self.turns_consumed < len(self._turns) else []
        self.turns_consumed += 1

        async def _gen() -> Any:
            for chunk in turn:
                yield _Turn(chunk)

        return _gen()


class _Sink:
    def __init__(self) -> None:
        self.sent: list[str] = []

    async def send_text(self, text: str) -> None:
        self.sent.append(text)


def _bridge() -> telephony._Bridge:
    b = telephony._Bridge(_Sink(), "outreach123", call_uuid="")  # type: ignore[arg-type]
    b.stream_id = "s1"
    return b


# 20 ms of 24 kHz PCM16 = 480 samples = 960 bytes.
_CHUNK = b"\x00\x01" * 480


@pytest.mark.asyncio
class TestTurnSpanning:
    async def test_keeps_listening_after_the_first_turn_ends(self) -> None:
        bridge = _bridge()
        session = _PerTurnSession([[_CHUNK], [_CHUNK], [_CHUNK]])

        task = asyncio.create_task(telephony._pump_live_to_carrier(bridge, session))
        # Let it work through every turn, then end the call the way a real
        # guard would rather than letting the pump decide.
        for _ in range(50):
            await asyncio.sleep(0)
            if session.turns_consumed > 3:
                break
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)

        assert session.turns_consumed > 1, (
            "the pump stopped after one turn — a real call would hang up on the "
            "parent as soon as the greeting finished"
        )

    async def test_relays_audio_from_turns_after_the_first(self) -> None:
        # Not just "it kept looping": later turns must actually reach the carrier.
        bridge = _bridge()
        session = _PerTurnSession([[_CHUNK], [_CHUNK, _CHUNK]])
        task = asyncio.create_task(telephony._pump_live_to_carrier(bridge, session))
        for _ in range(50):
            await asyncio.sleep(0)
            if session.turns_consumed > 2:
                break
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)
        # 960 bytes of 24 kHz PCM16 is 480 samples, which decimates to exactly
        # one 160-byte carrier frame. Turn one contributes 1; turn two
        # contributes 2. Anything less than 3 means a later turn was dropped.
        assert bridge.out.qsize() == 3

    async def test_stops_when_the_session_is_genuinely_gone(self) -> None:
        # An empty generator means the session ended, not that a turn finished.
        # Re-entering it forever would spin a CPU on a dead call.
        bridge = _bridge()
        session = _PerTurnSession([[]])
        result = await asyncio.wait_for(
            telephony._pump_live_to_carrier(bridge, session), timeout=2
        )
        assert result == "live_stream_end"
        assert session.turns_consumed == 1
