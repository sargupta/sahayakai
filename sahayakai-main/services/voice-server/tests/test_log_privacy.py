"""CLASS GATE — no conversation content or phone number in the engine's logs.

Production, 2026-11-16: loguru's default DEBUG sink let pipecat log the whole
model context ("Generating chat from context [...]") — the system prompt, a
child's concern in the greeting, and the parent's own words — into Cloud
Logging, and the app's own INFO lines printed the greeting, each model reply
and the parent's phone. Under the DPDP Act that is personal data in a log
store many people can read.

The class is "a log line at the production level carries what was said, or
who was called". The gate:
  * production logging is INFO with loguru's variable dump off, set before
    anything else in main.py runs;
  * a full call through the real handlers (concern call and positive call on
    the Vobiz path, a concern call on /ws/call) — greeting, phase guidance, a
    model reply, the parent's speech, a stop request and the end-of-call
    analysis, every field a sentinel — leaves no INFO-or-above record
    containing a sentinel or the parent's phone.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    LOGGER,
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMTextFrame,
    ScriptedRunner,
    TranscriptionFrame,
    import_main,
    phase_guidance,
    run_from_recorder,
    run_twilio_path,
    run_vobiz_path,
    spoken_greeting,
    stubbed_runtime,
)
from src.log_setup import DEFAULT_LEVEL, LEVEL_ENV, configure_logging, log_level

MARK = "SNTL"
PHONE = "+919800000101"
OID = "OutreachFs0000000001"
PRODUCTION_LEVELS = {"INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL", "EXCEPTION"}


def record(reason: str) -> dict:
    return {
        "parentPhone": PHONE, "teacherUid": "teacher-test-1", "classId": "class-test-1",
        "studentId": "student-test-1", "studentName": "Aarav", "className": "Class 6A",
        "reason": reason, "parentLanguage": "Hindi",
        "generatedMessage": f"{MARK}-GENMSG Aarav scored 18 in science",
        "subject": f"{MARK}-SUBJECT", "teacherName": "Ms. Sharma", "schoolName": "Demo Public School",
    }


# ── the configuration ────────────────────────────────────────────────────────


class FakeLoguru:
    def __init__(self):
        self.calls = []

    def remove(self, *a, **k):
        self.calls.append(("remove", a, k))

    def add(self, *a, **k):
        self.calls.append(("add", a, k))


def test_production_logging_is_info_without_variable_dumps():
    fake = FakeLoguru()
    assert configure_logging(fake, env={}) == DEFAULT_LEVEL == "INFO"
    assert fake.calls[0][0] == "remove"
    _, _, kwargs = fake.calls[1]
    assert kwargs == {"level": "INFO", "backtrace": False, "diagnose": False}


@pytest.mark.parametrize("value,expected", [("debug", "DEBUG"), (" warning ", "WARNING"), ("loud", "INFO"), ("", "INFO")])
def test_the_level_can_be_changed_on_purpose_but_never_by_accident(value, expected):
    assert log_level({LEVEL_ENV: value}) == expected


def test_main_configures_logging_before_anything_else(tmp_path, monkeypatch):
    monkeypatch.delenv(LEVEL_ENV, raising=False)
    with stubbed_runtime():
        import_main(tmp_path, monkeypatch)
        calls = list(LOGGER.config_calls)
        first_records = list(LOGGER.records)
    assert [c[0] for c in calls[:2]] == ["remove", "add"]
    assert calls[1][2]["level"] == "INFO" and calls[1][2]["diagnose"] is False
    assert first_records[:1] == [] or all(level != "DEBUG" for level, _ in first_records)


# ── a whole call ─────────────────────────────────────────────────────────────


async def _live_call() -> None:
    """Everything that happens while the call is up, with sentinels in every utterance."""
    run = run_from_recorder()
    await spoken_greeting(run)
    await phase_guidance(run)
    manager = run.processor("CallManager")
    await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMTextFrame(text=f"{MARK}-MODEL ji, aapka beta padhai mein kamzor hai."), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    for name in ("StopRequestGuard", "STTConfidenceFilter"):
        for stage in [p for p in run.processors if type(p).__name__ == name]:
            await stage.process_frame(TranscriptionFrame(text=f"{MARK}-PARENT mera number {PHONE} hai"), FrameDirection.DOWNSTREAM)
    for stage in [p for p in run.processors if type(p).__name__ == "StopRequestGuard"]:
        await stage.process_frame(TranscriptionFrame(text=f"{MARK} please don't call me again"), FrameDirection.DOWNSTREAM)
    for _ in range(5):
        await asyncio.sleep(0)


def _install_analysis(monkeypatch):
    from src import bot

    async def analysis(call_context, transcript, api_key=None, **kwargs):
        return {"parentSentiment": "upset", "concerns": [{"text": f"{MARK}-CONCERN", "category": "fees"}],
                "followUps": [f"{MARK}-FOLLOWUP"], "parentResponse": f"{MARK}-RESPONSE"}

    monkeypatch.setattr(bot, "analyze_call", analysis)


def _production_records():
    return [(level, text) for level, text in LOGGER.records if level in PRODUCTION_LEVELS]


def _assert_clean(records):
    assert len(records) > 5, "almost nothing was logged; the scan would be vacuous"
    leaks = [(level, text[:160]) for level, text in records
             if MARK in text or PHONE in text or "9800000101" in text]
    assert leaks == []


@pytest.mark.parametrize("reason", ["consecutive_absences", "positive_feedback"])
def test_a_vobiz_call_logs_no_conversation_text_or_phone(reason, tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", OID): record(reason)})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore(history=f"PARENT HISTORY for {PHONE}: {MARK}-HISTORY")
        _install_analysis(monkeypatch)
        ScriptedRunner.script = _live_call
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_vobiz_path(main, db, outreach_id=OID))
        finally:
            ScriptedRunner.script = None
        records = _production_records()
        [task] = RECORDER.instances_of("PipelineTask")
        spoken = [f.text for f in task.queued if f.text]
    _assert_clean(records)
    # The call really carried the sentinels: a positive call speaks the
    # teacher's message, and the stop was heard and recorded.
    if reason == "positive_feedback":
        assert any(MARK in text for text in spoken)
    assert any("optOutRequested" in w[3] for w in db.writes), "the stop was not heard"
    assert any("Playing greeting" in text for _, text in records)


def test_a_ws_call_logs_no_conversation_text_or_phone(tmp_path, monkeypatch):
    web_ctx = {"studentName": "Aarav", "reason": "", "requestToTalk": True, "parentLanguage": "Hindi",
               "generatedMessage": f"{MARK}-WEBLINE", "parentPhone": PHONE,
               "teacherName": "Ms. Sharma", "schoolName": "Demo Public School"}
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore(history=f"{MARK}-HISTORY {PHONE}")
        _install_analysis(monkeypatch)
        ScriptedRunner.script = _live_call
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_twilio_path(main, web_ctx, outreach_id="OutreachTw0000000001"))
        finally:
            ScriptedRunner.script = None
        records = _production_records()
    _assert_clean(records)
