"""CLASS GATE — a plain "don't call" waits for the rest of the sentence.

Final review #2: speech-to-text splits a sentence wherever the parent pauses.
"Don't call me" + "after 9 pm", "फ़ोन मत करना" + "रात को", "আমাকে ফোন করবেন
না" + "সকালে" were each judged on their first half and ended the call; and
"मेरे पति को" + "फ़ोन मत करना" (my husband / don't call) was judged on its
second half alone.

The class is "a live stop judged on half a sentence". The gate: a plain stop
WAITs for the next transcription or QUIET_SECONDS of quiet and is then judged
on the joined text with every limit; a transcription is judged with the one
just before it; a strong stop fires without waiting. Through the real
pipeline: the held words reach the model in order when they are not a stop,
the line is said after the quiet when they are, and a parent who says it and
hangs up is still recorded.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import FakeCallStore, FrameDirection, TranscriptionFrame, build_bot, stubbed_runtime
from main_ast import RECORD
from src.call_policy import load_call_lines
from src.opt_out import NOTICE, PASS, WAIT, StopListener

SPLIT_LIMITS = [
    ("Please don't call me", "after 9 pm"),
    ("Don't call me", "in the morning, I'm at work"),
    ("फ़ोन मत करना", "रात को"),
    ("फ़ोन मत करना", "ऑफिस टाइम में"),
    ("আমাকে ফোন করবেন না", "সকালে"),
    ("Don't call me", "call my husband"),
]
SPLIT_BEFORE = [
    ("मेरे पति को", "फ़ोन मत करना"),
    ("रात को", "फ़ोन मत करना"),
    ("After 9 pm", "please don't call"),
    ("I'm busy", "don't call"),
]


@pytest.mark.parametrize("parts", SPLIT_LIMITS, ids=lambda p: " / ".join(p)[:40])
def test_a_plain_stop_finished_by_a_limit_is_not_a_stop(parts):
    c = StopListener()
    assert [c.hear(t) for t in parts] == [WAIT, PASS]
    assert not c.noticed and not c.on_quiet()


@pytest.mark.parametrize("parts", SPLIT_BEFORE, ids=lambda p: " / ".join(p)[:40])
def test_a_plain_stop_after_a_limit_is_not_a_stop(parts):
    c = StopListener()
    assert [c.hear(t) for t in parts] == [PASS, PASS]
    assert not c.on_quiet()


def test_a_plain_stop_said_alone_stands_after_the_quiet():
    c = StopListener()
    assert c.hear("Please don't call me.") == WAIT and not c.noticed
    assert c.on_quiet() and c.noticed and c.quote == "Please don't call me."


def test_an_older_utterance_does_not_join():
    c = StopListener()
    assert c.hear("मेरे पति को", now=0.0) == PASS
    assert c.hear("फ़ोन मत करना", now=60.0) == WAIT


@pytest.mark.parametrize("text", ["Stop calling me", "Please don't call me again.", "दोबारा फ़ोन मत करना",
                                  "আর ফোন করবেন না"])
def test_a_strong_stop_fires_without_waiting(text):
    assert StopListener().hear(text) == NOTICE


# ── through the real pipeline ────────────────────────────────────────────────


async def _say(run, text):
    await run.processor("StopRequestGuard").process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


def _pipeline(script, monkeypatch, quiet=0.05):
    calls: list = []
    with stubbed_runtime():
        from src import stop_guard

        monkeypatch.setattr(stop_guard, "QUIET_SECONDS", quiet)
        monkeypatch.setattr(stop_guard, "STT_MARGIN_SECONDS", 0.0)  # timed: tests/test_stop_hold_timing.py

        async def recorded(quote, source):
            calls.append((quote, source))
            return True

        async def go():
            run = await build_bot({**RECORD, "id": "OutreachFs0000000001"}, call_store=FakeCallStore(),
                                  on_opt_out_request=recorded)
            await script(run)
            guard = run.processor("StopRequestGuard")
            return run, [f.text for f, _ in guard.pushed]

        run, passed = asyncio.run(go())
    return run, passed, calls


@pytest.mark.parametrize("parts", SPLIT_LIMITS[2:4] + SPLIT_LIMITS[:1], ids=lambda p: " / ".join(p)[:40])
def test_through_the_pipeline_a_finished_limit_reaches_the_model_in_order(parts, monkeypatch):
    async def script(run):
        for t in parts:
            await _say(run, t)
        await asyncio.sleep(0.1)

    run, passed, calls = _pipeline(script, monkeypatch)
    assert passed == list(parts) and calls == [] and run.task.queued == []


def test_through_the_pipeline_a_plain_stop_said_alone_is_answered_after_the_quiet(monkeypatch):
    seen = {}

    async def script(run):
        await _say(run, "Please don't call me.")
        seen["before_quiet"] = list(run.task.queued)
        await asyncio.sleep(0.1)

    run, passed, calls = _pipeline(script, monkeypatch)
    assert seen["before_quiet"] == [], "nothing is said while it waits"
    assert passed == [] and calls == [("Please don't call me.", "live")]
    assert run.task.queued[0].text == load_call_lines()["hi-IN"]["opt_out_noted"]


def test_through_the_pipeline_a_strong_stop_is_answered_at_once(monkeypatch):
    seen = {}

    async def script(run):
        await _say(run, "Stop calling me")
        seen["queued"] = [f.text for f in run.task.queued]

    _run, _passed, calls = _pipeline(script, monkeypatch, quiet=60.0)
    assert seen["queued"] == [load_call_lines()["hi-IN"]["opt_out_noted"]] and calls == [("Stop calling me", "live")]


def test_a_plain_stop_and_a_hang_up_is_still_recorded(monkeypatch):
    async def script(run):
        await _say(run, "Please don't call me.")
        await run.finalize()  # the parent hung up before the quiet ran out

    run, _passed, calls = _pipeline(script, monkeypatch, quiet=60.0)
    assert calls == [("Please don't call me.", "live")]
    assert {"role": "user", "content": "Please don't call me."} in run.context.messages


@pytest.mark.parametrize("text", ["Please don't call me again, I'm at work all day",
                                  "Don't call me again, my husband handles school things"])
def test_the_listener_keeps_the_commas_that_mark_clauses(text):
    """The listener used to judge normalized text, losing the clause a limit belongs to."""
    assert StopListener().hear(text) == NOTICE
