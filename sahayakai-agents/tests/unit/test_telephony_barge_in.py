"""Barge-in: VIDYA stops on the parent's speech onset, not on the model's say-so.

Feedback after the 2026-10-10 live call: interruption must be reliable and
immediate. Before this, playback stopped only when Gemini Live sent
`interrupted`, so the pacer kept talking over the parent while the model's own
detector made up its mind. These tests pin the class of bug — "audio keeps
playing after the parent starts speaking" — at every point it can recur:

- the detector (deterministic clock): onset, confirm, backchannel release,
  echo, refractory;
- the bridge: the pacer stops within one tick, the carrier is told to clear,
  held frames play on after a backchannel, cancelled audio can never resume,
  stale chunks still streaming from the model are dropped, the model catching
  up does not cancel the NEXT reply, and cleanup is safe while all of that is
  in flight;
- latency: onset -> last frame sent, measured on the real pacer.
"""

from __future__ import annotations

import asyncio
import json
import math
import time
from array import array
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.audio import pcm16_to_ulaw
from sahayakai_agents.telephony.barge_in import Action, BargeIn, BargeInConfig, percentile

F = 0.02  # one frame


def _ulaw(level: int) -> bytes:
    return pcm16_to_ulaw(
        array("h", [int(level * math.sin(2 * math.pi * 200 * i / 8000)) for i in range(160)])
    )


LOUD = _ulaw(6000)
QUIET = _ulaw(0)


def _feed(det: BargeIn, levels: list[float], t0: float = 0.0, *, audible: bool = True) -> list[Action]:
    return [
        det.on_frame(level, t0 + i * F, ai_audible=audible) for i, level in enumerate(levels)
    ]


# ---------------------------------------------------------------------------
# The detector
# ---------------------------------------------------------------------------


class TestDetector:
    def test_pauses_after_the_onset_window_while_vidya_is_audible(self) -> None:
        det = BargeIn()
        acts = _feed(det, [3000] * 6)
        assert acts[:4] == [Action.NONE] * 4
        assert acts[4] is Action.PAUSE  # 5 of the last 7 frames: 100 ms of speech
        assert det.onset_at == 0.0 and det.detected_at == pytest.approx(4 * F)

    def test_a_dip_between_syllables_does_not_reset_the_onset(self) -> None:
        # The old detector needed six CONSECUTIVE loud frames; real speech dips.
        det = BargeIn()
        acts = _feed(det, [3000, 3000, 3000, 0, 3000, 3000])
        assert Action.PAUSE in acts

    def test_never_triggers_while_vidya_is_silent(self) -> None:
        # Talking into silence is just the parent's turn, not an interruption.
        det = BargeIn()
        assert set(_feed(det, [3000] * 40, audible=False)) == {Action.NONE}

    def test_a_click_is_not_an_interruption(self) -> None:
        det = BargeIn()
        assert set(_feed(det, [3000, 3000, 0, 0, 3000, 0, 0])) == {Action.NONE}

    def test_sustained_speech_confirms_and_cancels(self) -> None:
        det = BargeIn()
        acts = _feed(det, [3000] * 20)
        assert acts.count(Action.PAUSE) == 1
        assert acts[-1] is Action.CANCEL
        assert det.cancels == 1

    def test_a_backchannel_releases_and_resumes(self) -> None:
        # "haan" — 160 ms of voice, then quiet. Playback must continue.
        det = BargeIn()
        acts = _feed(det, [3000] * 8 + [0] * 15)  # 160 ms: a short "haan"
        assert Action.PAUSE in acts
        assert acts[-1] is Action.RESUME
        assert Action.CANCEL not in acts
        assert det.false_triggers == 1

    def test_refractory_after_a_click_needs_more_speech(self) -> None:
        det = BargeIn()
        _feed(det, [3000] * 5 + [0] * 15)  # barely past onset: a click, ends at t = 0.4
        later = _feed(det, [3000, 3000, 3000, 3000, 3000, 0], t0=0.5)
        assert Action.PAUSE not in later  # a full window is needed while refractory
        assert Action.PAUSE in _feed(det, [3000] * 7, t0=0.62)

    def test_a_word_then_more_words_is_one_interruption(self) -> None:
        # "Wait... wait, one minute": the comma pause released the first word.
        # The second must continue the same interruption, not start over.
        det = BargeIn()
        first = _feed(det, [3000] * 10 + [0] * 25)
        assert first[-1] is Action.RESUME
        second = _feed(det, [3000] * 10, t0=0.6)
        assert Action.CANCEL in second, "the second 'wait' did not confirm the interruption"

    def test_a_sentence_pause_after_a_word_does_not_resume(self) -> None:
        # "Wait." then a 400 ms pause: still the parent's turn.
        det = BargeIn()
        acts = _feed(det, [3000] * 12 + [0] * 20)
        assert Action.RESUME not in acts and det.paused

    def test_carry_expires(self) -> None:
        det = BargeIn()
        _feed(det, [3000] * 10 + [0] * 25)
        later = _feed(det, [3000] * 10, t0=3.0)
        assert Action.CANCEL not in later and Action.PAUSE in later

    def test_echo_of_vidyas_own_voice_does_not_trigger(self) -> None:
        # A speakerphone leaks our audio back at a steady, moderate level.
        det = BargeIn()
        acts = _feed(det, [300] * 200)  # a steady leak, above the absolute floor
        assert Action.PAUSE not in acts, "VIDYA's own echo paused her"
        assert det.echo_floor == 300
        # Echo that creeps just above the fixed floor is still not the parent.
        assert set(_feed(det, [700] * 30, t0=4.0)) == {Action.NONE}
        # The parent, much louder than the leak, still gets through.
        assert Action.PAUSE in _feed(det, [4000] * 6, t0=5.0)

    def test_the_models_interruption_is_always_final(self) -> None:
        det = BargeIn()
        assert det.on_model_interrupted(1.0) is Action.CANCEL
        assert det.model_first == 1
        # ...also when we had already paused: no double count of model_first.
        det2 = BargeIn()
        _feed(det2, [3000] * 6)
        assert det2.on_model_interrupted(0.2) is Action.CANCEL
        assert det2.model_first == 0

    def test_config_is_respected(self) -> None:
        det = BargeIn(BargeInConfig(onset_votes=3, onset_window=3, confirm_frames=4))
        acts = _feed(det, [3000] * 4)
        assert acts[2] is Action.PAUSE and acts[3] is Action.CANCEL


def test_percentile_nearest_rank() -> None:
    assert percentile([], 95) is None
    assert percentile([10.0], 95) == 10.0
    vals = [float(v) for v in range(1, 101)]
    assert percentile(vals, 50) == 50.0
    assert percentile(vals, 95) == 95.0


# ---------------------------------------------------------------------------
# The bridge
# ---------------------------------------------------------------------------


class _Ws:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_text(self, text: str) -> None:
        self.sent.append(json.loads(text))

    def events(self) -> list[str]:
        return [m.get("event", "") for m in self.sent]


def _speech_frame(n: int) -> bytes:
    # A recognisable, non-silent frame (silence is 0xFF).
    return bytes([n % 200]) * 160


def _bridge() -> Any:
    b = telephony._Bridge(_Ws(), "o-barge", call_uuid="")  # type: ignore[arg-type]
    b.stream_id = "s1"
    b.local_barge_in = True
    return b


def _speech_frames_sent(ws: _Ws) -> int:
    return sum(
        1
        for m in ws.sent
        if m.get("event") == "playAudio" and set(_payload(m)) != {0xFF}
    )


def _payload(m: dict[str, Any]) -> bytes:
    import base64

    return base64.b64decode(m["media"]["payload"])


async def _run_pacer(bridge: Any, seconds: float) -> None:
    task = asyncio.create_task(telephony._pace_outbound(bridge))
    await asyncio.sleep(seconds)
    bridge.stop = True
    await asyncio.wait_for(task, timeout=1)
    bridge.stop = False


@pytest.mark.asyncio
class TestBridgePlayback:
    async def _speaking(self, frames: int) -> Any:
        b = _bridge()
        for i in range(frames):
            b.out.put_nowait((b.generation, _speech_frame(i + 1)))
        # VIDYA counts as audible: she has just been sending speech.
        b.last_speech_frame_at = time.monotonic()
        return b

    async def _talk_over(self, b: Any, frames: int) -> None:
        for _ in range(frames):
            telephony._note_parent_audio(b, LOUD)

    async def test_pause_stops_speech_within_one_tick_and_clears_the_carrier(self) -> None:
        b = await self._speaking(100)
        pacer = asyncio.create_task(telephony._pace_outbound(b))
        await asyncio.sleep(0.2)  # VIDYA is mid-sentence
        before = _speech_frames_sent(b.ws)
        assert before > 0
        await self._talk_over(b, 6)  # 120 ms of the parent
        assert b.barge.paused
        await asyncio.sleep(0.2)
        after = _speech_frames_sent(b.ws)
        b.stop = True
        await pacer
        assert after - before <= 1, "VIDYA kept talking after the parent's onset"
        assert "clearAudio" in b.ws.events()
        assert b.detect_to_stop_ms and b.detect_to_stop_ms[0] <= 40

    async def test_a_backchannel_resumes_the_held_frames(self) -> None:
        b = await self._speaking(60)
        pacer = asyncio.create_task(telephony._pace_outbound(b))
        await asyncio.sleep(0.1)
        await self._talk_over(b, 7)
        held = b.out.qsize()
        assert b.barge.paused and held > 0
        for _ in range(15):
            telephony._note_parent_audio(b, QUIET)
        assert not b.barge.paused
        await asyncio.sleep(0.3)
        b.stop = True
        await pacer
        assert b.out.qsize() < held, "the held sentence never resumed"
        assert b.generation == 0

    async def test_confirmed_interruption_cancels_for_good(self) -> None:
        b = await self._speaking(80)
        b.model_turn_open = True  # still generating
        b.agent_turn_text = " Ravi's science marks have"
        await self._talk_over(b, 20)
        assert b.out.empty() and b.pending == b""
        assert b.generation == 1
        assert b.discard_model_audio
        # The cut-off turn is filed as cut off, not as if it was all heard.
        assert b.transcript[-1]["text"].endswith("…")
        # Nothing of the old response can play.
        await _run_pacer(b, 0.1)
        assert _speech_frames_sent(b.ws) == 0

    async def test_frames_from_before_the_cancel_never_play(self) -> None:
        b = await self._speaking(0)
        old = b.generation
        await self._talk_over(b, 20)
        b.out.put_nowait((old, _speech_frame(9)))  # raced in from the old turn
        await _run_pacer(b, 0.1)
        assert _speech_frames_sent(b.ws) == 0


class _Msg(SimpleNamespace):
    pass


def _audio(n: int = 1) -> _Msg:
    return _Msg(data=b"\x10\x00" * 480 * n, server_content=None)


def _content(**kw: Any) -> _Msg:
    fields = {
        "interrupted": False, "turn_complete": False, "input_transcription": None,
        "output_transcription": None,
    }
    fields.update(kw)
    return _Msg(data=None, server_content=SimpleNamespace(**fields))


class _Session:
    def __init__(self, turns: list[list[_Msg]]) -> None:
        self.turns = turns
        self.i = 0
        self.tool_responses: list[Any] = []
        self.cues: list[Any] = []

    def receive(self) -> Any:
        turn = self.turns[self.i] if self.i < len(self.turns) else []
        self.i += 1

        async def gen() -> Any:
            for m in turn:
                yield m
                await asyncio.sleep(0)

        return gen()

    async def send_tool_response(self, **kw: Any) -> None:
        self.tool_responses.append(kw)

    async def send_client_content(self, **kw: Any) -> None:
        self.cues.append(kw)


async def _pump(bridge: Any, session: _Session) -> None:
    task = asyncio.create_task(telephony._pump_live_to_carrier(bridge, session))
    for _ in range(200):
        await asyncio.sleep(0)
        if session.i > len(session.turns):
            break
    bridge.stop = True
    await asyncio.wait_for(task, timeout=2)
    bridge.stop = False


@pytest.mark.asyncio
class TestStaleModelAudio:
    async def test_chunks_still_streaming_for_the_cancelled_turn_are_dropped(self) -> None:
        b = _bridge()
        b.model_turn_open = True  # the model is still generating
        telephony._cancel_response(b, by_model=False)  # local barge-in fired
        session = _Session([[_audio(), _audio(), _content(output_transcription=SimpleNamespace(text=" stale words"))]])
        await _pump(b, session)
        assert b.out.empty()
        assert b.stale_chunks_dropped == 2
        assert "stale" not in b.agent_turn_text

    async def test_the_models_late_interrupted_does_not_cancel_the_next_reply(self) -> None:
        b = _bridge()
        b.model_turn_open = True
        telephony._cancel_response(b, by_model=False)
        gen_after_local_cancel = b.generation
        session = _Session([[_content(interrupted=True), _audio(), _audio()]])
        await _pump(b, session)
        assert b.generation == gen_after_local_cancel, "the reply was cancelled too"
        assert b.out.qsize() == 2
        assert not b.discard_model_audio

    async def test_turn_complete_ends_the_discard_even_without_interrupted(self) -> None:
        b = _bridge()
        b.model_turn_open = True
        telephony._cancel_response(b, by_model=False)
        session = _Session([[_audio(), _content(turn_complete=True)], [_audio()]])
        await _pump(b, session)
        assert b.stale_chunks_dropped == 1
        assert b.out.qsize() == 1

    async def test_model_first_interruption_still_clears_everything(self) -> None:
        b = _bridge()
        for i in range(10):
            b.out.put_nowait((b.generation, _speech_frame(i)))
        session = _Session([[_content(interrupted=True), _audio()]])
        await _pump(b, session)
        assert b.generation == 1
        assert b.out.qsize() == 1  # only the new reply
        assert b.barge.model_first == 1
        assert b.clear_pending

    async def test_repeated_interruptions_each_cancel_once(self) -> None:
        b = _bridge()
        for _ in range(3):
            b.model_turn_open = True
            b.last_speech_frame_at = time.monotonic()
            for i in range(10):
                b.out.put_nowait((b.generation, _speech_frame(i)))
            for _ in range(20):
                telephony._note_parent_audio(b, LOUD)
            for _ in range(20):
                telephony._note_parent_audio(b, QUIET)
            # model catches up, then the next reply starts
            await _pump(b, _Session([[_content(interrupted=True)]]))
        assert b.barge.cancels == 3
        assert b.generation == 3
        assert b.dialogue.interruptions == 3


@pytest.mark.asyncio
class TestCleanupWhileBusy:
    async def test_settle_cancels_lookups_and_files_the_last_turn(self, monkeypatch: pytest.MonkeyPatch) -> None:
        async def _noop(*_a: Any, **_k: Any) -> None:
            return None

        monkeypatch.setattr(telephony, "_hangup", _noop)
        monkeypatch.setattr(telephony, "_persist_transcript", _noop)
        b = _bridge()
        slow = asyncio.create_task(asyncio.sleep(3600))
        b.tool_tasks["call-1"] = slow
        b.agent_turn_text = " Thank you for your time."
        await telephony._settle_call(b, None, time.monotonic())
        await asyncio.sleep(0)
        assert slow.cancelled()
        assert b.tool_tasks == {}
        assert b.transcript[-1]["text"] == "Thank you for your time."

    async def test_pacer_stops_cleanly_while_paused(self) -> None:
        b = _bridge()
        for i in range(50):
            b.out.put_nowait((b.generation, _speech_frame(i)))
        b.last_speech_frame_at = time.monotonic()
        for _ in range(6):
            telephony._note_parent_audio(b, LOUD)
        assert b.barge.paused
        await _run_pacer(b, 0.1)  # returns: no hang while paused


@pytest.mark.asyncio
class TestInterruptionLatency:
    """Onset -> last VIDYA frame, on the real pacer. Target: p95 < 300 ms.

    The detector needs 120 ms of speech by design (a click is not a parent), so
    onset-to-stop is ~120 ms plus at most one 20 ms tick. Decision-to-stop is
    what the bridge controls and must be within a tick or two.
    """

    async def test_p95_is_under_target(self) -> None:
        b = _bridge()
        # Independent interruptions: no refractory window, no carry-over between them.
        b.barge = BargeIn(BargeInConfig(refractory_seconds=0.0, carry_seconds=0.0))
        pacer = asyncio.create_task(telephony._pace_outbound(b))
        try:
            for _ in range(10):
                for i in range(30):
                    b.out.put_nowait((b.generation, _speech_frame(i + 1)))
                await asyncio.sleep(0.12)
                for _ in range(6):  # 6 frames arrive in real time
                    telephony._note_parent_audio(b, LOUD)
                    await asyncio.sleep(F)
                for _ in range(15):  # the parent's silence, also in real time
                    telephony._note_parent_audio(b, QUIET)
                    await asyncio.sleep(F)
                telephony._cancel_response(b, by_model=True)
                await asyncio.sleep(0.2)
        finally:
            b.stop = True
            await pacer
        onset = percentile(b.onset_to_stop_ms, 95)
        detect = percentile(b.detect_to_stop_ms, 95)
        assert len(b.onset_to_stop_ms) >= 10
        assert onset is not None and onset < 300, b.onset_to_stop_ms
        assert detect is not None and detect <= 60, b.detect_to_stop_ms


@pytest.mark.asyncio
class TestTheNextReplyIsNotSwallowed:
    """Neha staging run 4: the parent cut in after VIDYA's reply had finished
    GENERATING but while it was still PLAYING. The bridge set discard-until-the-
    engine-confirms, a finished turn never confirms, and the NEXT reply (the
    attendance answer) was thrown away. True of the Live engine as well."""

    async def test_cutting_into_a_finished_but_playing_reply_does_not_discard_the_next(self) -> None:
        b = _bridge()
        for i in range(50):
            b.out.put_nowait((b.generation, _speech_frame(i)))
        b.model_turn_open = False  # turn_complete already received
        telephony._cancel_response(b, by_model=False)
        assert not b.discard_model_audio
        # The next reply is played.
        await _pump(b, _Session([[_audio(), _audio()]]))
        assert b.out.qsize() == 2 and b.stale_chunks_dropped == 0

    async def test_cutting_into_a_reply_still_generating_discards_its_rest(self) -> None:
        b = _bridge()
        b.model_turn_open = True
        telephony._cancel_response(b, by_model=False)
        assert b.discard_model_audio
