"""CLASS GATE — a call that is over stops using the instance promptly.

Production, 2026-11-16: after the parent hung up, the pipeline idled until
pipecat's idle timeout (07:04:37 to 07:09:35 UTC), holding a Cloud Run slot
whose CPU is always allocated. Nothing cancelled the pipeline when the far
end went away.

The class is "an ended call keeps its pipeline". The gate, with the real
create_bot and the real handlers:
  * on the client-disconnected event the pipeline is cancelled within a
    bounded time, the end-of-call bookkeeping still runs, and an opt-out
    request heard earlier whose first record failed is still retried and saved;
  * after a stop request and silence the call closes gracefully (the line,
    then EndFrame), and if that has not finished in time the pipeline is
    cancelled;
  * through the Vobiz handler, a disconnect mid-call cancels the pipeline, the
    leg is hung up once and the opt-out request is recorded.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    ScriptedRunner,
    TranscriptionFrame,
    build_bot,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import PHONE, RECORD, opt_out_requests, suppressions

BOUND_SECONDS = 1.0
CTX = {"id": "OutreachFs0000000001", "studentName": "Aarav", "reason": "consecutive_absences",
       "parentLanguage": "Hindi", "teacherName": "Ms. Sharma", "schoolName": "Demo Public School",
       "parentPhone": PHONE}


class Writer:
    def __init__(self, results=(True,)):
        self.results, self.calls = list(results), 0

    async def __call__(self, *args):
        self.calls += 1
        return self.results[min(self.calls, len(self.results)) - 1]


async def _hear(run, text):
    guard = run.processor("StopRequestGuard")
    await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


async def _disconnect(run):
    loop = asyncio.get_running_loop()
    started = loop.time()
    await asyncio.wait_for(run.transport.handlers["on_client_disconnected"](run.transport, object()), BOUND_SECONDS)
    return started


def test_a_disconnect_cancels_the_pipeline_promptly_and_still_finishes_the_call():
    store = FakeCallStore()
    with stubbed_runtime():
        async def go():
            run = await build_bot(CTX, call_store=store, on_opt_out_request=Writer())
            started = await _disconnect(run)
            return run, started

        run, started = asyncio.run(go())
    assert run.task.cancelled_at is not None, "the pipeline was left to idle"
    assert run.task.cancelled_at - started < BOUND_SECONDS
    assert store.completed == ["OutreachFs0000000001"], "the end-of-call bookkeeping did not run"


def test_an_opt_out_heard_before_the_disconnect_is_still_retried_and_saved():
    writer = Writer(results=(False, True))  # the immediate write fails
    with stubbed_runtime():
        async def go():
            run = await build_bot(CTX, call_store=FakeCallStore(), on_opt_out_request=writer)
            await _hear(run, "please don't call me again")
            await _disconnect(run)
            return run

        run = asyncio.run(go())
    assert writer.calls == 2, "the end-of-call retry did not run"
    assert run.task.cancelled_at is not None


def test_a_stop_that_does_not_end_the_call_in_time_cancels_it(monkeypatch):
    with stubbed_runtime():
        from src import bot

        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.05)
        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.0)  # the parent says nothing

        async def go():
            run = await build_bot(CTX, call_store=FakeCallStore(), on_opt_out_request=Writer())
            await _hear(run, "stop calling me")
            await asyncio.sleep(0.01)  # the silence after the line
            queued = [type(f).__name__ for f in run.task.queued]
            await asyncio.sleep(0.05 + BOUND_SECONDS / 2)
            return run, queued

        run, queued = asyncio.run(go())
    assert queued == ["TTSSpeakFrame", "TTSSpeakFrame", "EndFrame"], "the line, the goodbye, then the graceful close"
    assert run.task.cancelled_at is not None, "a stalled stop left the pipeline running"


def test_a_stop_that_ended_the_call_is_not_cancelled_again(monkeypatch):
    with stubbed_runtime():
        from src import bot

        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.05)
        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.0)  # the parent says nothing

        async def go():
            run = await build_bot(CTX, call_store=FakeCallStore(), on_opt_out_request=Writer())
            await _hear(run, "stop calling me")
            run.task.finished = True
            await asyncio.sleep(0.2)
            return run

        run = asyncio.run(go())
    assert run.task.cancelled_at is None


def test_a_vobiz_disconnect_mid_call_cancels_hangs_up_once_and_records_the_stop(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD}, fail_opt_out_requests=1)
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup

        async def live():
            run = run_from_recorder()
            await _hear(run, "दोबारा फ़ोन मत करना")
            await _disconnect(run)

        ScriptedRunner.script = live
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db), 5))
        finally:
            ScriptedRunner.script = None
        [task] = RECORDER.instances_of("PipelineTask")
    assert task.cancelled_at is not None
    assert hangups == ["123e4567-e89b-42d3-a456-426614174000"]
    assert len(opt_out_requests(db)) == 1 and suppressions(db) == []


# ── a graceful end that never finishes ───────────────────────────────────────
# Independent review #7: after a stop the task is blocked on its EndFrame;
# task.cancel() only queues a CancelFrame BEHIND it, so the old
# watchdog did nothing, runner.run() never returned and the record was never
# written. ModelRunner models exactly that (PipelineTask.stall_end).


def test_the_watchdog_ends_a_stalled_graceful_end_and_still_finishes_the_call(tmp_path, monkeypatch):
    from bot_harness import ModelRunner

    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)  # first: it points the call store at tmp_path
        main.call_store = FakeCallStore()
        from src import bot

        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.05)
        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.0)  # the parent says nothing

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup

        async def live():
            run = run_from_recorder()
            run.task.stall_end = True  # a processor hangs on the EndFrame
            await _hear(run, "दोबारा फ़ोन मत करना")

        ModelRunner.script = live
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        [task] = RECORDER.instances_of("PipelineTask")
    assert task.end_in_flight, "the scenario really stalled the graceful end"
    assert runner.ended and not runner.timed_out, "the watchdog could not get past the stuck EndFrame"
    assert task.end_reason == "CancelFrame injected into the pipeline"
    assert hangups == ["123e4567-e89b-42d3-a456-426614174000"]
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes)
    assert len(opt_out_requests(db)) == 1 and suppressions(db) == []
