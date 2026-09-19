"""Delivery cadence and framing: why the calls sounded broken.

Measured against the deployed service before these fixes: p99 inter-frame gap
110ms, eleven frames more than 100ms late, and 15% of frames arriving less than
5ms apart. Telephony is constant-bitrate; both the holes and the bursts are
heard as speech breaking up.

Two separate defects, so two separate sets of assertions:

1. The sender blocked on an empty queue, which put HOLES inside an utterance
   whenever the model paused between bursts.
2. Every model chunk was zero-padded up to a frame boundary, which put up to
   19ms of silence into the middle of continuous speech at EVERY chunk seam.
"""

from __future__ import annotations

import asyncio
import json
import time

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.router import _FRAME_BYTES, _flush_ulaw, _queue_ulaw


class _Sink:
    def __init__(self) -> None:
        self.frames: list[bytes] = []
        self.at: list[float] = []

    async def send_text(self, text: str) -> None:
        import base64

        d = json.loads(text)
        self.frames.append(base64.b64decode(d["media"]["payload"]))
        self.at.append(time.monotonic())


def _bridge() -> telephony._Bridge:
    b = telephony._Bridge(_Sink(), "outreach123", call_uuid="")  # type: ignore[arg-type]
    b.stream_id = "s1"
    return b


class TestFraming:
    def test_does_not_pad_in_the_middle_of_a_stream(self) -> None:
        # 250 bytes is one full frame plus 90 left over. Padding that 90 up to
        # 160 would insert 8.75ms of silence mid-word.
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * 250)
        assert bridge.out.qsize() == 1
        assert bridge.pending == b"\x01" * 90

    def test_joins_the_remainder_to_the_next_chunk(self) -> None:
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * 250)
        _queue_ulaw(bridge, b"\x02" * 70)   # 90 + 70 = one more whole frame
        assert bridge.out.qsize() == 2
        assert bridge.pending == b""
        frames = [bridge.out.get_nowait()[1] for _ in range(2)]
        # The seam must be a real join, not silence: 70 bytes of the first chunk
        # followed by 90 of the second.
        assert frames[1] == b"\x01" * 90 + b"\x02" * 70
        assert all(len(f) == _FRAME_BYTES for f in frames)

    def test_pads_only_once_at_the_end_of_an_utterance(self) -> None:
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * 250)
        _flush_ulaw(bridge)
        assert bridge.out.qsize() == 2
        bridge.out.get_nowait()
        tail = bridge.out.get_nowait()[1]
        assert len(tail) == _FRAME_BYTES
        assert tail.endswith(bytes([telephony.ULAW_SILENCE]) * 70)
        assert bridge.pending == b""

    def test_flush_is_a_no_op_with_nothing_pending(self) -> None:
        bridge = _bridge()
        _flush_ulaw(bridge)
        assert bridge.out.qsize() == 0

    def test_abandoned_speech_is_not_prepended_to_the_next_utterance(self) -> None:
        # Half a frame left over when the parent interrupts must be dropped, or
        # the tail of what VIDYA abandoned is glued to the front of her next reply.
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * 90)
        assert bridge.pending
        bridge.pending = b""  # what the barge-in path does
        _queue_ulaw(bridge, b"\x02" * 160)
        assert bridge.out.get_nowait()[1] == b"\x02" * 160


@pytest.mark.asyncio
class TestPacing:
    async def test_holds_the_cadence_when_the_model_pauses(self) -> None:
        # The defect: a sender that blocks on an empty queue sends nothing while
        # the model thinks, the carrier's buffer drains, and the parent hears a
        # break inside the utterance.
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * _FRAME_BYTES)  # one frame, then nothing
        task = asyncio.create_task(telephony._pace_outbound(bridge))
        await asyncio.sleep(0.25)
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)

        sink: _Sink = bridge.ws  # type: ignore[assignment]
        # ~12 ticks in 250ms; it must have kept sending rather than stopped at 1.
        assert len(sink.frames) >= 8, f"sender went quiet after {len(sink.frames)} frames"
        assert sink.frames[0] == b"\x01" * _FRAME_BYTES
        assert all(f == telephony._SILENCE_FRAME for f in sink.frames[1:])

    async def test_never_leaves_an_audible_hole(self) -> None:
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * _FRAME_BYTES * 3)
        task = asyncio.create_task(telephony._pace_outbound(bridge))
        await asyncio.sleep(0.3)
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)

        sink: _Sink = bridge.ws  # type: ignore[assignment]
        gaps = [(sink.at[i + 1] - sink.at[i]) * 1000 for i in range(len(sink.at) - 1)]
        # 100ms is roughly where a gap stops sounding like speech rhythm and
        # starts sounding like a broken line.
        assert max(gaps) < 100, f"largest gap {max(gaps):.0f}ms"

    async def test_goes_quiet_once_the_call_is_genuinely_idle(self) -> None:
        # Comfort silence bridges gaps inside a turn; it must not flood a line
        # where nobody has spoken for a long time.
        assert 0 < telephony._COMFORT_TICKS <= 100
        seconds = telephony._COMFORT_TICKS * telephony._FRAME_SECONDS
        assert 0.4 <= seconds <= 2.0, f"comfort tail is {seconds:.1f}s"

    async def test_discards_superseded_frames_without_spending_a_tick(self) -> None:
        # Barge-in must feel immediate. Stale frames are dropped, not played
        # slowly, so the parent is answered rather than talked over.
        bridge = _bridge()
        for _ in range(20):
            bridge.out.put_nowait((bridge.generation, b"\x09" * _FRAME_BYTES))
        bridge.generation += 1  # the parent interrupted
        bridge.out.put_nowait((bridge.generation, b"\x07" * _FRAME_BYTES))

        task = asyncio.create_task(telephony._pace_outbound(bridge))
        await asyncio.sleep(0.06)
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)

        sink: _Sink = bridge.ws  # type: ignore[assignment]
        assert b"\x09" * _FRAME_BYTES not in sink.frames, "played audio the parent had interrupted"
        assert sink.frames[0] == b"\x07" * _FRAME_BYTES


@pytest.mark.asyncio
class TestPrebuffer:
    async def test_fills_the_carrier_s_buffer_before_pacing(self) -> None:
        # Sending in exact real time leaves the carrier holding nothing, so any
        # stall on our side is a hole in the parent's ear. The first frames go
        # out fast on purpose.
        bridge = _bridge()
        _queue_ulaw(bridge, b"\x01" * _FRAME_BYTES * 40)
        task = asyncio.create_task(telephony._pace_outbound(bridge))
        await asyncio.sleep(0.12)
        bridge.stop = True
        await asyncio.wait_for(task, timeout=2)

        sink: _Sink = bridge.ws  # type: ignore[assignment]
        # In 120ms of real time, strict pacing would send ~6 frames. With the
        # lead, the carrier should already hold appreciably more.
        assert len(sink.frames) > 12, f"only {len(sink.frames)} frames buffered"

    async def test_the_lead_is_bounded(self) -> None:
        # Too much lead and an interruption has seconds of speech already
        # committed to the carrier, so barge-in stops feeling immediate.
        assert 0.2 <= telephony._PREBUFFER_SECONDS <= 1.0
        # And it must cover the worst stall actually observed on a real call
        # (493ms), or the tail of that stall is a gap in the parent's ear.
        assert telephony._PREBUFFER_SECONDS >= 0.5
        # And the resync threshold must not be tighter than the lead, or every
        # call would resync away the buffer it just built.
        assert telephony._MAX_PACING_LAG >= telephony._PREBUFFER_SECONDS
