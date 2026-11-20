"""CLASS GATE — every way a call ends hangs up the leg exactly once.

Independent review #6: the normal endings (the CLOSE phase and max turns)
pushed an EndFrame DOWNSTREAM from the middle of the pipeline. pipecat's task
never sees that frame, so runner.run() never returned, main.py's hang-up after
the pipeline never ran, and with keepCallAlive the parent sat on a silent,
billed line until they hung up or the idle timeout fired.

The class is "an ending that does not end the task". The gate runs the real
Vobiz handler with a runner that ends exactly the way pipecat does
(bot_harness.ModelRunner): only an EndFrame queued at the source, an
EndTaskFrame sent upstream, a cancel, or a CancelFrame injected into the
pipeline ends it. For every ending — CLOSE phase, max turns, a stop request
followed by silence, the parent hanging up, a pipeline error — the call must
end within a bound, hang up exactly once and write its record.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    ModelRunner,
    TranscriptionFrame,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD
from src.call_policy import lang_code_for, load_call_lines

OID = "OutreachFs0000000001"


async def _model_turn(run, text="ji, dhanyavaad."):
    manager = run.processor("CallManager")
    await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMTextFrame(text=text), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


async def _close_phase():
    run = run_from_recorder()
    run.processor("PhaseInstructor").skip_to_close()
    await _model_turn(run, "ji, dhanyavaad, namaste.")


async def _max_turns():
    run = run_from_recorder()
    run.processor("CallManager")._max_turns = 2
    await _model_turn(run)
    await _model_turn(run)


async def _stop_request():
    run = run_from_recorder()
    guard = run.processor("StopRequestGuard")
    await guard.process_frame(TranscriptionFrame(text="दोबारा फ़ोन मत करना"), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


async def _parent_hangs_up():
    run = run_from_recorder()
    await run.transport.handlers["on_client_disconnected"](run.transport, object())


async def _pipeline_error():
    raise RuntimeError("the pipeline blew up mid-call")


ENDINGS = {
    "close phase": _close_phase,
    "max turns": _max_turns,
    "stop request": _stop_request,
    "parent hangs up": _parent_hangs_up,
    "pipeline error": _pipeline_error,
}


@pytest.mark.parametrize("ending", sorted(ENDINGS))
def test_every_ending_hangs_up_exactly_once_and_writes_the_record(ending, tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", OID): RECORD})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot

        # After the opt-out line the parent says nothing; close well inside the runner's bound.
        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.05)

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = ENDINGS[ending]
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
    if ending != "pipeline error":
        assert runner.ended and not runner.timed_out, f"{ending}: the task never ended (pipecat would idle for minutes)"
    assert len(hangups) == 1, f"{ending}: hung up {len(hangups)} times"
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes), \
        f"{ending}: no transcript written"


# ── a last reply the AI-reveal guard replaces ────────────────────────────────
# Re-review rereview-0b #7: CallManager's reveal branch pushed the
# replacement and returned before the max-turns and CLOSE checks, so a
# goodbye that tripped the guard never ended the call. (Then the original
# pattern matched "ai" anywhere, "aGAIn", "VAIbhav"; since the final review's
# #8 every call uses the word-bounded pattern, so these goodbyes say a real
# AI word.)

POSITIVE = dict(RECORD, reason="positive_feedback", parentLanguage="English", studentName="Vaibhav",
                generatedMessage="Hello, this is Ms. Sharma. Vaibhav did very well this week.")
ORDINARY = ["That is lovely to hear.", "How are things at home?", "Good, keep it up.",
            "Reading together helps.", "Anything else on your mind?"]


def _six_turns(last):
    async def script():
        run = run_from_recorder()
        for text in ORDINARY + [last]:
            await _model_turn(run, text)
    return script


def _close_with(last):
    async def script():
        run = run_from_recorder()
        run.processor("PhaseInstructor").skip_to_close()
        await _model_turn(run, last)
    return script


def _max_turns_with(last):
    async def script():
        run = run_from_recorder()
        run.processor("CallManager")._max_turns = 2
        await _model_turn(run, ORDINARY[0])
        await _model_turn(run, last)
    return script


REVEALING_ENDINGS = {
    "positive, six turns, 'AI' goodbye": (POSITIVE, _six_turns("Thank you, as an AI I think Vaibhav is wonderful, goodbye.")),
    "positive, close phase, 'bot' goodbye": (POSITIVE, _close_with("Thank you from the school bot, goodbye.")),
    "positive, max turns, 'assistant' reply": (POSITIVE, _max_turns_with("I am the teacher's assistant, see you.")),
    "request to talk, close phase": (RECORD, _close_with("I am an AI assistant, goodbye.")),
    "request to talk, max turns": (RECORD, _max_turns_with("As an automated assistant, goodbye.")),
}


@pytest.mark.parametrize("ending", sorted(REVEALING_ENDINGS))
def test_a_last_reply_the_reveal_guard_replaces_still_ends_the_call(ending, tmp_path, monkeypatch):
    record, script = REVEALING_ENDINGS[ending]
    db = FakeAsyncFirestore({("parent_outreach", OID): record})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = script
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        manager = run_from_recorder().processor("CallManager")
    replaced = [f for f, _ in manager.pushed if type(f).__name__ == "TTSSpeakFrame"]
    assert len(replaced) == 1, "the scenario really trips the guard, on the last reply only"
    # final-0b #2: the last thing said is the fixed goodbye, never a question.
    goodbye = load_call_lines()[lang_code_for(record["parentLanguage"])]["goodbye"]
    assert replaced[0].text == goodbye and "?" not in replaced[0].text
    order = [type(f).__name__ for f, _ in manager.pushed if type(f).__name__ in ("TTSSpeakFrame", "EndTaskFrame")]
    assert order == ["TTSSpeakFrame", "EndTaskFrame"]
    assert runner.ended and not runner.timed_out, f"{ending}: the call was left up after its last turn"
    assert len(hangups) == 1
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes)


# ── a graceful ending that never finishes ────────────────────────────────────
# Re-review rereview-0b #8: CallManager's endings send EndTaskFrame, the task
# queues an EndFrame and waits for it with no timeout. One processor stuck on
# it (a Gemini stream that never completes) and runner.run() never returns:
# no hang-up, no record, a slot held until Cloud Run's request timeout. Only the
# stop path had a watchdog. ModelRunner with PipelineTask.stall_end models
# exactly that: the graceful end never completes, task.cancel() queues behind
# it, and only a CancelFrame injected into the pipeline ends the task.

STALLING_ENDINGS = {
    "close phase": _close_phase,
    "max turns": _max_turns,
    "stop request, then silence": _stop_request,
}


def _run_stalled(script, tmp_path, monkeypatch, *, bound: float):
    db = FakeAsyncFirestore({("parent_outreach", OID): RECORD})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot

        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.01)
        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", bound)

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        async def stalled():
            run_from_recorder().task.stall_end = True  # a processor hangs on the EndFrame
            await script()

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = stalled
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        task = run_from_recorder().task
    return runner, task, hangups, db


@pytest.mark.parametrize("ending", sorted(STALLING_ENDINGS))
def test_every_graceful_ending_is_bounded_even_when_it_stalls(ending, tmp_path, monkeypatch):
    runner, task, hangups, db = _run_stalled(STALLING_ENDINGS[ending], tmp_path, monkeypatch, bound=0.05)
    assert task.end_in_flight, f"{ending}: the scenario really stalled the graceful end"
    assert runner.ended and not runner.timed_out, f"{ending}: a stalled ending held the call"
    assert task.end_reason == "CancelFrame injected into the pipeline"
    assert len(hangups) == 1
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes)


def test_the_parent_hanging_up_rescues_a_stalled_ending_at_once(tmp_path, monkeypatch):
    """A disconnect seen during a stalled ending ends the call without waiting for the bound."""
    async def close_then_hang_up():
        await _close_phase()
        # The task takes the EndTaskFrame at once (ModelRunner would only see
        # it after this script), and the end then sticks.
        run_from_recorder().task.request_end("EndTaskFrame reached the task")
        await _parent_hangs_up()

    runner, task, hangups, db = _run_stalled(close_then_hang_up, tmp_path, monkeypatch, bound=60.0)
    assert task.end_in_flight
    assert runner.ended and not runner.timed_out, "the hang-up waited behind the stuck EndFrame"
    assert task.end_reason == "CancelFrame injected into the pipeline"
    assert len(hangups) == 1
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes)


def test_an_ending_that_finishes_is_not_forced_down(monkeypatch):
    with stubbed_runtime():
        from src import bot

        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.02)

        async def go():
            from bot_harness import FakeCallStore as Store, build_bot

            run = await build_bot({"id": OID, "reason": "consecutive_absences", "parentLanguage": "Hindi"},
                                  call_store=Store())
            run.processor("PhaseInstructor").skip_to_close()
            await _model_turn(run, "ji, dhanyavaad, namaste.")
            run.task.finished = True
            await asyncio.sleep(0.1)
            return run

        run = asyncio.run(go())
    assert run.task.cancelled_at is None


def test_a_blocked_reply_mid_call_still_gets_the_usual_replacement():
    """Only the LAST turn changes: mid-call the request-to-talk line is still the safe answer."""
    with stubbed_runtime():
        from bot_harness import FakeCallStore as Store, build_bot

        async def go():
            run = await build_bot({**RECORD, "id": OID, "parentLanguage": "English"}, call_store=Store())
            await _model_turn(run, "I am an AI assistant.")
            manager = run.processor("CallManager")
            return [f.text for f, _ in manager.pushed if type(f).__name__ == "TTSSpeakFrame"]

        spoken = asyncio.run(go())
    assert spoken == [load_call_lines()["en-IN"]["request_to_talk"]]


def test_a_stop_then_an_identity_question_never_ends_on_a_question(tmp_path, monkeypatch):
    """The review's path: stop, "is this a robot?", a revealing goodbye. Fixed text only, ending on the goodbye."""
    async def script():
        run = run_from_recorder()
        guard = run.processor("StopRequestGuard")
        for text in ("Please stop calling me.", "Is this a robot?"):
            await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
        await _model_turn(run, "I am the class teacher's assistant, thank you, goodbye.")

    db = FakeAsyncFirestore({("parent_outreach", OID): {**RECORD, "parentLanguage": "English"}})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def fake_hangup(*args):
            return None

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = script
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        manager = run_from_recorder().processor("CallManager")
    spoken = [f.text for f, _ in manager.pushed if type(f).__name__ == "TTSSpeakFrame"]
    assert spoken == [load_call_lines()["en-IN"]["goodbye"]]


def test_a_mid_pipeline_endframe_alone_would_not_end_the_task():
    """The model is faithful: the old downstream EndFrame really leaves the task running."""
    with stubbed_runtime():
        from bot_harness import EndFrame, FakeCallStore as Store, build_bot

        async def go():
            run = await build_bot({"id": OID, "reason": "consecutive_absences", "parentLanguage": "Hindi"},
                                  call_store=Store())
            await run.processor("CallManager").push_frame(EndFrame(), FrameDirection.DOWNSTREAM)
            runner = ModelRunner()
            ModelRunner.max_wait = 0.05
            try:
                await runner.add_workers(run.task)
                await runner.run()
            finally:
                ModelRunner.max_wait = 1.0
            return runner

        runner = asyncio.run(go())
    assert runner.timed_out


# ── a silent turn (final review #8) ─────────────────────────────────────────
# The AI-word check ran on the whole streamed text, not the first sentence
# (the only one ever spoken): an AI word in an unspoken second sentence
# silenced the turn, and positive_feedback's unbounded pattern found "ai" in
# "said" and "again". Then the unspoken first sentence still went into the
# transcript, even a promise the screen would have replaced.

def _turn_in_one_chunk(record, text):
    with stubbed_runtime():
        from bot_harness import FakeCallStore as Store, build_bot

        async def go():
            run = await build_bot({**record, "id": OID}, call_store=Store())
            await _model_turn(run, text)
            return run

        run = asyncio.run(go())
    manager = run.processor("CallManager")
    model = "".join(f.text for f, _ in manager.pushed if type(f).__name__ == "LLMTextFrame")
    tts = [f.text for f, _ in manager.pushed if type(f).__name__ == "TTSSpeakFrame"]
    said = [m["content"] for m in run.context.messages if m.get("role") == "assistant"]
    return model, tts, said


def test_an_ai_word_in_the_unspoken_sentence_does_not_silence_a_promise_check():
    record = {**RECORD, "parentLanguage": "English"}
    model, tts, said = _turn_in_one_chunk(record, "We won't call you again. I am an automated assistant.")
    line = load_call_lines()["en-IN"]["future_calls"]
    assert model == "" and tts == [line], "the future-calls line is said, not silence"
    assert "We won't call you again." not in said and line in said, "the unheard promise is not in the transcript"


def test_said_and_again_do_not_silence_a_positive_feedback_turn():
    model, tts, said = _turn_in_one_chunk(POSITIVE, "That is lovely to hear. He said he wants to do it again.")
    assert model == "That is lovely to hear." and tts == []
    assert "That is lovely to hear." in said


def test_a_real_ai_word_in_the_first_sentence_is_still_replaced():
    model, tts, _said = _turn_in_one_chunk(POSITIVE, "I am an AI assistant. Aarav is doing well.")
    assert model == "" and len(tts) == 1
