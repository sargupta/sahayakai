"""CLASS GATE (timed) — a held plain stop follows the parent's speech, not a stopwatch.

Verifier, with real timings through create_bot: the hold's timer counted from
when the held words ARRIVED and ignored the parent starting to speak again.
With the 0.5 s VAD stop, "Don't call me" ... "after nine" with any natural
pause over about 0.6 s fired a false stop, and "after nine" landed after the
notice (D1).

The class is "a live decision made while the parent is still talking". The
gate runs the real create_bot with the REAL hold timings (QUIET_SECONDS 1.2,
STT_MARGIN_SECONDS 0.6, HOLD_CAP_SECONDS 5.0) and real gaps between frames:
  * the parent starting to speak at 0.9 s and "after nine" at 1.6 s is not a
    stop, and both reach the model in order;
  * true silence still makes the stop stand, at about 1.2 s plus the margin,
    and not before;
  * the quiet counts from the parent stopping (VAD stop at 1.0 s: about 2.8 s);
  * a parent who keeps talking past the cap gets a decision at the cap: the
    held words go to the model, nothing is recorded, nothing is held.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import FakeCallStore, Frame, FrameDirection, TranscriptionFrame, build_bot, stubbed_runtime
from main_ast import RECORD


class VADUserStartedSpeakingFrame(Frame):
    pass


class VADUserStoppedSpeakingFrame(Frame):
    pass


HANG_UP = "__hang_up__"


def _timeline(steps, *, until: float, keep: dict | None = None):
    """Feed (at_seconds, text-or-frame) to the real guard; return what happened, with times.

    A step HANG_UP fires the transport's client-disconnected event (the real
    end-of-call path). `keep` receives the run.
    """
    records: list = []
    with stubbed_runtime():
        async def go():
            loop = asyncio.get_running_loop()

            async def recorded(quote, source):
                records.append((loop.time() - t0, quote))
                return True

            run = await build_bot({**RECORD, "parentLanguage": "English", "id": "OutreachFs0000000001"},
                                  call_store=FakeCallStore(), on_opt_out_request=recorded)
            guard = run.processor("StopRequestGuard")
            to_model: list = []
            original = guard.push_frame

            async def timed_push(frame, direction=FrameDirection.DOWNSTREAM):
                if isinstance(frame, TranscriptionFrame):
                    to_model.append((loop.time() - t0, frame.text))
                await original(frame, direction)

            guard.push_frame = timed_push
            t0 = loop.time()
            for at, what in steps:
                await asyncio.sleep(max(0.0, t0 + at - loop.time()))
                if what == HANG_UP:
                    await run.transport.handlers["on_client_disconnected"](run.transport, object())
                    continue
                frame = TranscriptionFrame(text=what) if isinstance(what, str) else what
                await guard.process_frame(frame, FrameDirection.DOWNSTREAM)
            await asyncio.sleep(max(0.0, t0 + until - loop.time()))
            if keep is not None:
                keep["run"] = run
            return records, to_model, guard

        records, to_model, guard = asyncio.run(go())
    return records, to_model, guard


def test_the_parent_speaking_again_inside_the_hold_is_not_a_stop():
    records, to_model, guard = _timeline(
        [(0.0, "Don't call me"), (0.9, VADUserStartedSpeakingFrame()), (1.6, "after nine")], until=2.6)
    assert records == [], "a false stop"
    assert [t for _, t in to_model] == ["Don't call me", "after nine"]
    assert not guard.noticed and not guard.waiting


def test_true_silence_still_makes_the_stop_stand_after_the_quiet_and_the_margin():
    records, to_model, _guard = _timeline([(0.0, "Don't call me")], until=2.4)
    [(at, quote)] = records
    assert quote == "Don't call me" and to_model == []
    assert 1.7 <= at <= 2.2, f"stood at {at:.2f} s, expected about 1.8 s (1.2 + 0.6)"


def test_the_quiet_counts_from_when_the_parent_stops_speaking():
    records, _to_model, _guard = _timeline(
        [(0.0, "Don't call me"), (0.4, VADUserStartedSpeakingFrame()), (1.0, VADUserStoppedSpeakingFrame())],
        until=3.4)
    [(at, _quote)] = records
    assert 2.7 <= at <= 3.2, f"stood at {at:.2f} s, expected about 2.8 s (1.0 + 1.2 + 0.6)"


def test_a_parent_who_keeps_talking_gets_a_decision_at_the_cap():
    records, to_model, guard = _timeline(
        [(0.0, "Don't call me"), (0.5, VADUserStartedSpeakingFrame())], until=5.6)
    assert records == [], "no live stop while they were still talking"
    [(at, text)] = to_model
    assert text == "Don't call me" and 4.9 <= at <= 5.4, f"released at {at:.2f} s, expected the 5 s cap"
    assert not guard.waiting



# ── D2: a punctuation-only final during the hold ────────────────────────────
# StopListener.hear returned PASS on a "." or "।" final without clearing the
# held stop; the guard then released the held words, and a later
# transcription joined the stale stop however late it came: "okay" 5 s later
# fired a stop quoted "Don't call me okay" (S6), and a hang-up 4 s later
# recorded the stop plus an empty user message (S6b).

def test_s6_a_punctuation_final_does_not_break_the_hold():
    keep: dict = {}
    records, to_model, guard = _timeline([(0.0, "Don't call me"), (0.3, "."), (5.0, "okay")], until=5.3, keep=keep)
    [(at, quote)] = records
    assert quote == "Don't call me" and 1.7 <= at <= 2.2, (at, quote)
    assert [t for _, t in to_model] == ["okay"], "the '.' is not words; 'okay' is speech after the notice"
    users = [m["content"] for m in keep["run"].context.messages if m.get("role") == "user"]
    assert users == ["Don't call me"]


def test_s6b_a_punctuation_final_then_a_hang_up_records_once_with_no_empty_message():
    keep: dict = {}
    records, _to_model, _guard = _timeline([(0.0, "Don't call me"), (0.3, "।"), (4.0, HANG_UP)], until=4.3,
                                           keep=keep)
    assert [q for _, q in records] == ["Don't call me"]
    users = [m["content"] for m in keep["run"].context.messages if m.get("role") == "user"]
    assert users == ["Don't call me"] and "" not in users


def test_a_transcription_long_after_the_last_sound_does_not_join_the_held_stop():
    records, to_model, _guard = _timeline(
        [(0.0, "Don't call me"), (0.3, VADUserStartedSpeakingFrame()), (3.2, "after nine")], until=3.5)
    assert [q for _, q in records] == ["Don't call me"], "the held stop stands on its own"
    assert [t for _, t in to_model] == ["after nine"]


# ── D3: a noise fragment during the hold ────────────────────────────────────
# "फ़ोन मत करना" + "हम्म" (or "हां", "hmm", a single letter) cancelled the
# held stop: the fragment was judged as the rest of the sentence. Those
# fragments are what STTConfidenceFilter drops before the model; the hold
# now ignores the same ones (src/stt_noise.py, shared by both).

FRAGMENTS = ["हम्म", "हां", "hmm", "a"]


@pytest.mark.parametrize("fragment", FRAGMENTS)
def test_a_noise_fragment_does_not_cancel_a_held_stop(fragment):
    keep: dict = {}
    records, to_model, _guard = _timeline([(0.0, "फ़ोन मत करना"), (0.6, fragment)], until=2.3, keep=keep)
    [(at, quote)] = records
    assert quote == "फ़ोन मत करना" and 1.7 <= at <= 2.2, (fragment, at, quote)
    assert to_model == []
    users = [m["content"] for m in keep["run"].context.messages if m.get("role") == "user"]
    assert users == ["फ़ोन मत करना"], "the fragment is not part of the parent's words"


@pytest.mark.parametrize("fragment", FRAGMENTS)
def test_the_fragments_are_exactly_what_the_stt_filter_drops(fragment):
    with stubbed_runtime():
        from src.stt_filter import STTConfidenceFilter

        async def go():
            f = STTConfidenceFilter()
            await f.process_frame(TranscriptionFrame(text=fragment), FrameDirection.DOWNSTREAM)
            return f.pushed

        assert asyncio.run(go()) == []
