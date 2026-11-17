"""CLASS GATE — after a possible stop the parent hears only fixed text, never the model.

Final review (final-0b #1): after the opt-out line every parent utterance still
went to the model, and the model's closing reply was the last thing the parent
heard. Nothing screened it: "जी ठीक है, अब आपको फ़ोन नहीं करेंगे, धन्यवाद।" and
"Okay, we won't call you anymore" went straight to TTS, a promise that calls
will stop while the teacher's note says nothing was blocked. positive_feedback
calls have no stop rule in their prompt at all.

The class is "model output reaching the parent after a stop request". The gate,
through the real Vobiz handler with the pipecat-faithful runner, for both call
modes and every call language: after a stop, model replies (promises included)
never reach TTS as text or speech; the parent hears the opt-out line, then the
fixed goodbye, and the call hangs up once. A reply already under way when the
stop is heard is dropped too, and the close timer says the goodbye.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    ModelRunner,
    TranscriptionFrame,
    TTSSpeakFrame,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD
from src.call_policy import LANGUAGE_CODES, load_call_lines
from test_opt_out_never_suppresses import TRUE_STOPS

OID = "OutreachFs0000000001"
PROMISES = {
    "hi": "जी ठीक है, अब आपको फ़ोन नहीं करेंगे, धन्यवाद।",
    "en": "Okay, we won't call you anymore, thank you.",
}
MODES = {
    "request_to_talk": {"reason": "consecutive_absences"},
    "positive_feedback": {"reason": "positive_feedback", "studentName": "Vaibhav",
                          "generatedMessage": "Hello, this is Ms. Sharma. Vaibhav did very well this week."},
}


async def _model_reply(run, text):
    manager = run.processor("CallManager")
    await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    for part in (text[: len(text) // 2], text[len(text) // 2:]):
        await manager.process_frame(LLMTextFrame(text=part), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


async def _hear(run, text):
    await run.processor("StopRequestGuard").process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


def _call(language, mode, script, tmp_path, monkeypatch, *, close_after=60.0):
    db = FakeAsyncFirestore({("parent_outreach", OID): {**RECORD, **MODES[mode], "parentLanguage": language}})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot

        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", close_after)

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = lambda: script(run_from_recorder())
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        run = run_from_recorder()
        manager = run.processor("CallManager")
    return runner, run, manager, hangups, db


def _spoken(run, manager):
    """Everything sent towards TTS: frames queued at the source, then what CallManager pushed."""
    queued = [("tts", f.text) for f in run.task.queued if isinstance(f, TTSSpeakFrame)]
    pushed = []
    for f, direction in manager.pushed:
        if isinstance(f, TTSSpeakFrame):
            pushed.append(("tts", f.text))
        elif isinstance(f, LLMTextFrame):
            pushed.append(("model", f.text))
        elif type(f).__name__ == "EndTaskFrame" and direction is FrameDirection.UPSTREAM:
            pushed.append(("end", ""))
    return queued, pushed


@pytest.mark.parametrize("promise", sorted(PROMISES))
@pytest.mark.parametrize("mode", sorted(MODES))
@pytest.mark.parametrize("language", sorted(TRUE_STOPS))
def test_after_a_stop_no_model_reply_reaches_the_parent(language, mode, promise, tmp_path, monkeypatch):
    async def script(run):
        await _hear(run, TRUE_STOPS[language])
        await _hear(run, "तो अब फ़ोन नहीं आएगा ना?")
        await _model_reply(run, PROMISES[promise])
        await _model_reply(run, "Goodbye, we will never call you again.")

    runner, run, manager, hangups, db = _call(language, mode, script, tmp_path, monkeypatch)
    lines = load_call_lines()[LANGUAGE_CODES[language]]
    queued, pushed = _spoken(run, manager)
    assert queued == [("tts", lines["opt_out_noted"])]
    assert pushed == [("tts", lines["goodbye"]), ("end", "")], "only the fixed goodbye, then the end"
    assert runner.ended and not runner.timed_out and len(hangups) == 1
    [result] = [w[3] for w in db.writes if w[0] == "set" and "transcript" in w[3]]
    said = [t["text"] for t in result["transcript"]]
    assert lines["goodbye"] in said and not [t for t in said for p in PROMISES.values() if p in t]


@pytest.mark.parametrize("mode", sorted(MODES))
def test_after_a_stop_and_silence_the_goodbye_closes_the_call(mode, tmp_path, monkeypatch):
    async def script(run):
        await _hear(run, TRUE_STOPS["Hindi"])
        await asyncio.sleep(0.05)

    runner, run, manager, hangups, _db = _call("Hindi", mode, script, tmp_path, monkeypatch, close_after=0.01)
    lines = load_call_lines()["hi-IN"]
    queued, pushed = _spoken(run, manager)
    assert queued == [("tts", lines["opt_out_noted"]), ("tts", lines["goodbye"])]
    assert [type(f).__name__ for f in run.task.queued][-1] == "EndFrame"
    assert pushed == []
    assert runner.ended and len(hangups) == 1


def test_a_reply_under_way_when_the_stop_is_heard_is_dropped_too(tmp_path, monkeypatch):
    async def script(run):
        manager = run.processor("CallManager")
        await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
        await _hear(run, TRUE_STOPS["English"])
        await manager.process_frame(LLMTextFrame(text=PROMISES["en"]), FrameDirection.DOWNSTREAM)
        await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
        await asyncio.sleep(0.05)

    runner, run, manager, hangups, _db = _call("English", "request_to_talk", script, tmp_path, monkeypatch,
                                               close_after=0.01)
    lines = load_call_lines()["en-IN"]
    queued, pushed = _spoken(run, manager)
    assert pushed == [], "the reply that began before the stop is not spoken"
    assert queued == [("tts", lines["opt_out_noted"]), ("tts", lines["goodbye"])]
    assert runner.ended and len(hangups) == 1


def test_before_a_stop_the_model_is_heard_as_usual(tmp_path, monkeypatch):
    async def script(run):
        run.processor("CallManager")._max_turns = 1
        await _model_reply(run, "Is there a good time this week?")

    runner, run, manager, _hangups, _db = _call("English", "request_to_talk", script, tmp_path, monkeypatch)
    _queued, pushed = _spoken(run, manager)
    assert "".join(t for kind, t in pushed if kind == "model") == "Is there a good time this week?"
    assert runner.ended


# ── the close after the line does not depend on speech the model never gets ──
# Final review final-0b #3: any sound after the line set spoken_since_notice,
# and the close timer then stood down for good, trusting the model to answer.
# But the STT filter drops "okay", "thanks", "हां", and the turn aggregator
# drops a short backchannel said while the bot speaks, so the model never
# answered, nothing said the goodbye, and the line stayed open until the
# parent hung up or pipecat's idle timeout (about 5 minutes).

async def _say_through_guard_and_filter(run, text):
    """The parent speaks; returns what reached past the STT filter (towards the model)."""
    guard, stt_filter = run.processor("StopRequestGuard"), run.processor("STTConfidenceFilter")
    before = len(guard.pushed)
    await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    reached = []
    for frame, direction in guard.pushed[before:]:
        mark = len(stt_filter.pushed)
        await stt_filter.process_frame(frame, direction)
        reached += [f.text for f, _ in stt_filter.pushed[mark:] if isinstance(f, TranscriptionFrame)]
    await asyncio.sleep(0)
    return reached


BACKCHANNELS = {
    "okay (STT filter drops it)": ("okay", True),
    "thanks (STT filter drops it)": ("thanks", True),
    "हां (STT filter drops it)": ("हां", True),
    "हाँ जी while the bot speaks (aggregator drops it)": ("हाँ जी", False),
}


@pytest.mark.parametrize("stall", [False, True], ids=["ends", "end stalls"])
@pytest.mark.parametrize("case", sorted(BACKCHANNELS))
def test_a_backchannel_after_the_line_cannot_keep_the_call_open(case, stall, tmp_path, monkeypatch):
    text, filtered = BACKCHANNELS[case]
    seen = {}

    async def script(run):
        if stall:
            run.task.stall_end = True  # the graceful close then needs the watchdog
        await _hear(run, TRUE_STOPS["Hindi"])
        seen["reached"] = await _say_through_guard_and_filter(run, text)
        # No model reply follows: the filter or the aggregator threw it away.
        await asyncio.sleep(0.2)

    runner, run, manager, hangups, _db = _call_bounded(script, tmp_path, monkeypatch)
    lines = load_call_lines()["hi-IN"]
    assert (seen["reached"] == []) is filtered, "the scenario really drops (or passes) the backchannel"
    queued, pushed = _spoken(run, manager)
    assert queued == [("tts", lines["opt_out_noted"]), ("tts", lines["goodbye"])], "the timer still closes"
    assert [type(f).__name__ for f in run.task.queued][-1] == "EndFrame"
    assert pushed == []
    assert runner.ended and not runner.timed_out and len(hangups) == 1
    if stall:
        assert run.task.end_in_flight and run.task.end_reason == "CancelFrame injected into the pipeline", \
            "the ending watchdog was armed"


def test_when_the_model_does_reply_the_timer_stands_down(tmp_path, monkeypatch):
    async def script(run):
        await _hear(run, TRUE_STOPS["Hindi"])
        await _say_through_guard_and_filter(run, "ठीक है, पर क्यों?")
        await _model_reply(run, "जी, धन्यवाद।")
        await asyncio.sleep(0.2)  # several close-timer windows pass

    runner, run, manager, hangups, _db = _call_bounded(script, tmp_path, monkeypatch)
    lines = load_call_lines()["hi-IN"]
    queued, pushed = _spoken(run, manager)
    assert queued == [("tts", lines["opt_out_noted"])], "no second goodbye or EndFrame from the timer"
    assert pushed == [("tts", lines["goodbye"]), ("end", "")]
    assert runner.ended and len(hangups) == 1


def _call_bounded(script, tmp_path, monkeypatch):
    """_call with the close timer and the ending bound shortened, in the same runtime."""
    db = FakeAsyncFirestore({("parent_outreach", OID): {**RECORD, "parentLanguage": "Hindi"}})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot

        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.02)
        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.05)

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = lambda: script(run_from_recorder())
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        run = run_from_recorder()
        manager = run.processor("CallManager")
    return runner, run, manager, hangups, db


# ── the timer's early returns are bounded too ────────────────────────────────
# Follow-up to final-0b #3: the close timer returned without arming the
# ending watchdog when CallManager had counted a turn or claimed the goodbye.
# If CallManager then never reached _end_call (an exception, a future change),
# nothing ended the call. Both early returns now arm the watchdog.

@pytest.mark.parametrize("claimed", ["goodbye taken", "turn counted"])
def test_if_callmanager_claims_the_close_but_never_ends_the_call_the_watchdog_does(claimed, tmp_path, monkeypatch):
    async def script(run):
        await _hear(run, TRUE_STOPS["Hindi"])
        manager = run.processor("CallManager")
        if claimed == "goodbye taken":
            assert manager.take_goodbye()  # claimed, and then nothing ends the call
        else:
            manager._turn_number += 1  # a reply counted, and then nothing ends the call
        await asyncio.sleep(0.3)

    runner, run, manager, hangups, _db = _call_bounded(script, tmp_path, monkeypatch)
    assert not [f for f, d in manager.pushed if type(f).__name__ == "EndTaskFrame"], "CallManager never ended it"
    assert runner.ended and not runner.timed_out, f"{claimed}: the call was left open"
    assert run.task.cancelled_at is not None, "the ending watchdog forced it down"
    assert len(hangups) == 1
