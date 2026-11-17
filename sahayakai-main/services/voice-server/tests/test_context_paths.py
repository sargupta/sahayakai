"""CLASS GATE — request-to-talk holds on BOTH ways a call gets its context.

main.py loads the outreach context two ways:

  * Vobiz (/telephony/vobiz/stream, production today): reads the
    parent_outreach record straight from Firestore, where the reason is present
    exactly as the web app stored it;
  * /ws/call (the Twilio streaming path, one config value away): asks the web
    app's /api/attendance/call-context, which for a concern call blanks reason
    and subject, puts the request line in generatedMessage and sets
    `requestToTalk: true`. Older web builds send the full record instead.

The class of bug is "one path classifies the call differently". These tests
run the real main.py handlers end to end (pipecat stubbed, Firestore and the
web app faked) with every concern field set to a sentinel, and require the same
outcome on both paths: the engine's own request-to-talk line, and no sentinel
anywhere the model or the parent could get it from.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    ai_reveal_replacement,
    import_main,
    phase_guidance,
    recorded_strings,
    run_from_recorder,
    run_twilio_path,
    run_vobiz_path,
    spoken_greeting,
    stubbed_runtime,
)
from src.call_policy import lang_code_for, load_call_lines

MARK = "SNTL"
HISTORY = f"PARENT HISTORY (2 previous calls):\n- Open concerns: {MARK}-HISTORY"


def firestore_record(reason, language: str) -> dict:
    """parent_outreach/{id} as the web app writes it (types/attendance.ts ParentOutreach)."""
    return {
        "teacherUid": "teacher-test-1",
        "classId": "class-test-1",
        "className": "Class 6A",
        "studentId": "student-test-1",
        "studentName": "Aarav",
        "parentPhone": "+919800000101",
        "parentLanguage": language,
        "reason": reason,
        "teacherNote": f"{MARK}-NOTE",
        "generatedMessage": f"{MARK}-GENMSG Aarav has missed school",
        "spokenScript": f"{MARK}-SPOKEN",
        "subject": f"{MARK}-SUBJECT",
        "teacherName": "Ms. Sharma",
        "schoolName": "Demo Public School",
        "performanceContext": {"summary": f"{MARK}-PERF", "subjects": [{"name": "Science", "percentage": 18}]},
        "deliveryMethod": "twilio_call",
    }


def call_context_response(language: str, **fields) -> dict:
    """What /api/attendance/call-context returns (shape of the in-flight web change)."""
    base = {
        "studentName": "Aarav",
        "className": "Class 6A",
        "subject": "",
        "reason": "",
        "generatedMessage": f"{MARK}-WEBLINE",
        "requestToTalk": True,
        "parentLanguage": language,
        "teacherName": "Ms. Sharma",
        "schoolName": "Demo Public School",
        "teacherUid": "teacher-test-1",
    }
    base.update(fields)
    return base


# Every shape the call-context endpoint can send for a concern call: the new
# web build, a contradictory one, the current (pre-change) build, and junk.
CALL_CONTEXT_CONCERN_SHAPES = {
    "flag_true_reason_blank": {},
    "flag_true_reason_positive_contradiction": {"reason": "positive_feedback"},
    "flag_string_true": {"requestToTalk": "true", "reason": "positive_feedback"},
    "flag_absent_reason_blank": {"requestToTalk": None},
    "old_web_full_record": {
        "requestToTalk": None, "reason": "consecutive_absences",
        "subject": f"{MARK}-SUBJECT", "generatedMessage": f"{MARK}-GENMSG",
    },
    "old_web_unknown_reason": {"requestToTalk": None, "reason": f"{MARK}-REASON"},
}

FIRESTORE_CONCERN_REASONS = ["consecutive_absences", "poor_performance", "behavioral_concern",
                             "", None, f"{MARK}-REASON", "Positive_Feedback"]


def _assert_request_to_talk(run, store, greeting, guidance, replacement, added, language, extra_markers=()):
    line = load_call_lines()[lang_code_for(language)]["request_to_talk"]
    assert greeting == line
    assert run.seed_messages == [{"role": "assistant", "content": line}]
    assert replacement == line
    assert store.history_requests == []
    everything = recorded_strings()
    assert len(everything) > 20
    for text in [greeting, run.system_instruction, replacement, *guidance.values(),
                 *(m["content"] for m in added), *everything]:
        for marker in (MARK, *extra_markers):
            assert marker not in text, (marker, text[:200])
    from test_request_to_talk import assert_no_disclosure_instruction

    assert_no_disclosure_instruction([run.system_instruction, *guidance.values()])


async def _drive():
    run = run_from_recorder()
    greeting = await spoken_greeting(run)
    guidance = await phase_guidance(run)
    replacement, added = await ai_reveal_replacement(run)
    return run, greeting, guidance, replacement, added


@pytest.mark.parametrize("language", ["Hindi", "English", "Malayalam"])
@pytest.mark.parametrize("shape", sorted(CALL_CONTEXT_CONCERN_SHAPES))
def test_call_context_path_is_request_to_talk(shape, language, tmp_path, monkeypatch):
    ctx = call_context_response(language, **CALL_CONTEXT_CONCERN_SHAPES[shape])
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        store = FakeCallStore(history=HISTORY)
        main.call_store = store

        async def go():
            await run_twilio_path(main, ctx)
            return await _drive()

        run, greeting, guidance, replacement, added = asyncio.run(go())
        _assert_request_to_talk(run, store, greeting, guidance, replacement, added, language,
                                extra_markers=("consecutive_absences",))


@pytest.mark.parametrize("language", ["Hindi", "English", "Malayalam"])
@pytest.mark.parametrize("reason", FIRESTORE_CONCERN_REASONS, ids=repr)
def test_firestore_path_is_request_to_talk(reason, language, tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): firestore_record(reason, language)})
    markers = (reason,) if isinstance(reason, str) and len(reason) > 3 else ()
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        store = FakeCallStore(history=HISTORY)
        main.call_store = store

        async def go():
            ws = await run_vobiz_path(main, db)
            assert ws.closed is None, ws.closed  # the token and the record were accepted
            return await _drive()

        run, greeting, guidance, replacement, added = asyncio.run(go())
        _assert_request_to_talk(run, store, greeting, guidance, replacement, added, language, markers)
    assert ("parent_outreach", "OutreachFs0000000001") in db.reads


def test_both_paths_give_the_model_the_same_instructions(tmp_path, monkeypatch):
    """Same call, two paths: the model must be told exactly the same thing."""
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        asyncio.run(run_twilio_path(main, call_context_response("Hindi")))
        via_web = run_from_recorder()
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): firestore_record("poor_performance", "Hindi")})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        asyncio.run(run_vobiz_path(main, db))
        via_firestore = run_from_recorder()
    assert via_web.system_instruction == via_firestore.system_instruction
    assert via_web.seed_messages == via_firestore.seed_messages


@pytest.mark.parametrize("path", ["call_context", "firestore"])
def test_positive_feedback_still_speaks_the_teacher_message_on_both_paths(path, tmp_path, monkeypatch):
    message = "नमस्ते जी, आरव ने इस हफ़्ते बहुत अच्छा किया।"
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def go():
            if path == "call_context":
                await run_twilio_path(main, call_context_response(
                    "Hindi", requestToTalk=False, reason="positive_feedback", generatedMessage=message,
                    subject="Mathematics"))
            else:
                record = {**firestore_record("positive_feedback", "Hindi"), "generatedMessage": message}
                await run_vobiz_path(main, FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): record}))
            run = run_from_recorder()
            return run, await spoken_greeting(run)

        run, greeting = asyncio.run(go())
    assert greeting == message
    assert f"Teacher's message: {message}" in run.system_instruction
