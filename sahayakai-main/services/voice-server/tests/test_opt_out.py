"""CLASS GATE — a parent's "do not call me again" reaches the teacher.

The live engine had no stop handling at all: a parent who asked not to be
called was answered by the model (which might even say "noted"), nothing was
recorded, and the next click called them again with the teacher none the
wiser. The class of bug is "a stop request that leaves no trace the teacher
can see". (Blocking the number is NOT the engine's job: see
test_opt_out_never_suppresses.py.) The gate:

  * the real create_bot pipeline (pipecat stubbed) is fed the parent's words;
    a stop request is recorded on the outreach (optOutRequested), answered with
    the fixed line, moves the call to its close and is kept from the model;
    any ordinary or rescheduling sentence records nothing and reaches the model;
  * a failed record is retried once at the end of the call;
  * the authenticated entry point (Vobiz) wires the recorder to Firestore
    (/ws/call deliberately does not; see test_opt_out_auth.py);
  * the post-call backstop counts only a verbatim parent quote;
  * the detector never fires on the engine's own lines (echo);
  * the kept, unused suppression writer and its digest still agree with the
    web app and the agents bridge, for the later designed feature.
"""

from __future__ import annotations

import asyncio
from dataclasses import replace
import json
import re
import shutil
import subprocess
from pathlib import Path

import pytest

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    TranscriptionFrame,
    build_bot,
    import_main,
    CONTRACT_FILES,
    contract_file_or_skip,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from src.call_policy import load_call_lines
from main_ast import opt_out_requests
from src.opt_out import (
    SUPPRESSION_COLLECTION,
    StopListener,
    backstop_quote,
    is_stop_request,
    opt_out_request,
    persist_opt_out,
    phone_suppression_id,
    record_opt_out_request,
    suppression_record,
    utc_now_iso,
)

TESTS = Path(__file__).resolve().parent
FIXTURE = json.loads((TESTS / "fixtures" / "suppression_digest.json").read_text(encoding="utf-8"))
PHONE = FIXTURE["cases"][0]["phone"]
DIGEST = FIXTURE["cases"][0]["digest"]
RECORD_KEYS = {"teacherUid", "classId", "studentId", "outreachId", "reason", "createdAt"}


def outreach(phone: str = PHONE, **extra) -> dict:
    return {
        "parentPhone": phone,
        "teacherUid": "teacher-test-1",
        "classId": "class-test-1",
        "studentId": "student-test-1",
        "studentName": "Aarav",
        "reason": "consecutive_absences",
        "parentLanguage": "Hindi",
        "teacherName": "Ms. Sharma",
        "schoolName": "Demo Public School",
        **extra,
    }


def suppression_writes(db: FakeAsyncFirestore) -> list[tuple]:
    return [w for w in db.writes if w[1] == SUPPRESSION_COLLECTION]


# ── digest parity ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("case", FIXTURE["cases"], ids=lambda c: c["phone"])
def test_python_digest_matches_the_shared_fixture(case):
    assert phone_suppression_id(case["phone"]) == case["digest"]
    assert phone_suppression_id(f"  {case['phone']}\n") == case["digest"], "trimmed like JS .trim()"
    assert case["phone"].lstrip("+") not in phone_suppression_id(case["phone"])


@pytest.mark.skipif(shutil.which("node") is None, reason="node is not installed here")
def test_node_computes_the_same_digest_with_the_web_modules_expression():
    # The body of phoneSuppressionId in sahayakai-main/src/lib/call-suppression.ts.
    expr = "require('crypto').createHash('sha256').update(process.argv[1].trim(), 'utf8').digest('hex')"
    for case in FIXTURE["cases"]:
        out = subprocess.run(["node", "-e", f"process.stdout.write({expr})", case["phone"]],
                             capture_output=True, text=True, timeout=30, check=True)
        assert out.stdout == case["digest"]


def _pinned(path: Path) -> tuple[str, str]:
    text = path.read_text(encoding="utf-8")
    phone = re.search(r"FIXTURE_PHONE\s*=\s*['\"]([^'\"]+)['\"]", text)
    digest = re.search(r"FIXTURE_DIGEST\s*=\s*['\"]([0-9a-f]{64})['\"]", text)
    assert phone and digest, f"{path} no longer pins FIXTURE_PHONE/FIXTURE_DIGEST"
    return phone.group(1), digest.group(1)


@pytest.mark.parametrize("relative", [f for f in CONTRACT_FILES if "suppression" in f or "opt_out" in f])
def test_the_web_and_agents_tests_pin_a_pair_we_agree_with(relative):
    # Not literal equality with our fixture: each side may pin its own made-up
    # number. What must hold is that their pinned digest is the one we compute.
    phone, digest = _pinned(contract_file_or_skip(relative))
    assert phone_suppression_id(phone) == digest, relative


# ── the write ────────────────────────────────────────────────────────────────


def test_persist_writes_the_web_apps_document_under_the_digest():
    db = FakeAsyncFirestore({("parent_outreach", "out-1"): outreach()})
    result = asyncio.run(persist_opt_out(db, "out-1", now="2026-11-15T10:00:00.000000Z"))

    assert result.ok, result.detail
    writes = suppression_writes(db)
    assert len(writes) == 1
    kind, _coll, doc_id, record, _merge = writes[0]
    assert kind == "set" and doc_id == DIGEST
    assert set(record) == RECORD_KEYS
    assert record == {
        "teacherUid": "teacher-test-1",
        "classId": "class-test-1",
        "studentId": "student-test-1",
        "outreachId": "out-1",
        "reason": "opt_out",
        "createdAt": "2026-11-15T10:00:00.000000Z",
    }
    flag = db.docs[("parent_outreach", "out-1")]
    assert flag["optedOut"] is True and flag["optedOutAt"] == "2026-11-15T10:00:00.000000Z"
    for _k, _c, doc, data, _m in db.writes:
        assert "9800000101" not in doc and PHONE not in repr(data)
    assert "9800000101" not in result.detail


def test_default_timestamp_matches_the_agents_bridge_shape():
    record = suppression_record(outreach(), "out-1", utc_now_iso())
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z", record["createdAt"])


def test_no_phone_means_no_suppression_and_a_reported_failure():
    db = FakeAsyncFirestore({("parent_outreach", "out-1"): outreach(phone="")})
    result = asyncio.run(persist_opt_out(db, "out-1"))
    assert not result.ok and suppression_writes(db) == []


def test_firestore_failure_is_reported_not_raised():
    db = FakeAsyncFirestore(fail=RuntimeError("firestore down"))
    result = asyncio.run(persist_opt_out(db, "out-1"))
    assert not result.ok and "firestore down" in result.detail


def test_the_suppression_is_written_even_if_the_outreach_flag_fails():
    db = FakeAsyncFirestore({("parent_outreach", "out-1"): outreach()})

    async def broken_update(self, data):
        raise RuntimeError("update failed")

    from bot_harness import _AsyncDoc

    original = _AsyncDoc.update
    _AsyncDoc.update = broken_update
    try:
        result = asyncio.run(persist_opt_out(db, "out-1"))
    finally:
        _AsyncDoc.update = original
    assert result.ok and len(suppression_writes(db)) == 1


# ── detection ────────────────────────────────────────────────────────────────

STOPS = [
    "Please don't call me again.", "Do not call this number again", "Stop calling me!",
    "No more calls please", "Remove my number", "Don't call me.", "Please don't call.",
    "I don't want these calls", "We don't want you to call",
    "दोबारा फ़ोन मत करना", "आगे से फोन मत कीजिए", "फोन मत करो", "मेरा नंबर हटा दीजिए",
    "phir se call mat karna", "phone mat karo", "dobara phone mat karna",
    "আর ফোন করবেন না", "ফোন করবেন না", "पुन्हा फोन करू नका", "फोन करू नका",
    "ફરીથી ફોન ન કરશો", "ફોન ન કરો", "ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਾ ਕਰੋ", "ਫੋਨ ਨਾ ਕਰੋ",
    "ಮತ್ತೆ ಫೋನ್ ಮಾಡಬೇಡಿ", "ಫೋನ್ ಮಾಡಬೇಡಿ", "இனிமேல் போன் பண்ணாதீங்க", "கூப்பிடாதீங்க",
    "మళ్ళీ ఫోన్ చేయకండి", "ఫోన్ చేయవద్దు", "ഇനി വിളിക്കരുത്", "വിളിക്കരുത്",
]
NOT_STOPS = [
    "Don't call me now, I'm in a meeting", "Please don't call in the morning", "Call me in the evening",
    "Yes, tomorrow at 5 is fine", "Why is the teacher calling?", "Is it about his marks?",
    "Don't call him naughty", "Okay thank you, bye", "haan ji boliye", "",
    "अभी फोन मत करो, बाद में करना", "शाम को फोन करना", "उसको फोन मत करो", "abhi phone mat karo",
    "এখন ফোন করবেন না", "आता फोन करू नका", "હમણાં ફોન ન કરો", "ਹੁਣ ਫੋਨ ਨਾ ਕਰੋ",
    "ಈಗ ಫೋನ್ ಮಾಡಬೇಡಿ", "இப்போ போன் பண்ணாதீங்க", "ఇప్పుడు ఫోన్ చేయకండి", "ഇപ്പോൾ വിളിക്കേണ്ട",
]


@pytest.mark.parametrize("text", STOPS)
def test_stop_requests_are_recognised(text):
    assert is_stop_request(text)


@pytest.mark.parametrize("text", NOT_STOPS)
def test_ordinary_and_rescheduling_replies_are_not_stops(text):
    assert not is_stop_request(text)


def test_the_engine_never_hears_its_own_lines_as_a_stop():
    from src.prompts.agent_reply import CALL_GREETINGS

    own = [v for entry in load_call_lines().values() for k, v in entry.items() if k != "review"]
    own += [g["greeting"] for g in CALL_GREETINGS.values()]
    own += ["ज़रा दोबारा बोलिए, आवाज़ ठीक से नहीं आ रही।"]  # STTConfidenceFilter's repeat prompt
    assert [t for t in own if is_stop_request(t)] == []


def test_a_stop_split_across_two_transcriptions_is_still_noticed():
    c = StopListener()
    assert c.on_parent_speech("please don't") is False
    assert c.on_parent_speech("call me again") is True
    assert c.quote == "please don't call me again"


def test_an_earlier_reschedule_cannot_veto_a_later_strong_stop():
    # A PLAIN "don't call me" is judged together with what was just said
    # before it (precision first: "मेरे पति को" + "फ़ोन मत करना"); a strong
    # stop is judged on its own utterance.
    c = StopListener()
    assert c.on_parent_speech("I am free in the evening") is False
    assert c.on_parent_speech("actually, don't call me again") is True
    assert c.quote == "actually, don't call me again"


def test_a_stop_is_noticed_once_per_call():
    c = StopListener()
    assert c.on_parent_speech("don't call me again") is True
    assert c.on_parent_speech("I said don't call me again") is False


# ── the record ───────────────────────────────────────────────────────────────


def test_the_record_is_the_outreach_field_and_nothing_else():
    db = FakeAsyncFirestore({("parent_outreach", "out-1"): outreach()})
    result = asyncio.run(record_opt_out_request(db, "out-1", "phone mat karo", "live", now="2026-11-16T10:00:00Z"))
    assert result.ok, result.detail
    assert db.writes == [("update", "parent_outreach", "out-1", {
        "optOutRequested": {"quote": "phone mat karo", "at": "2026-11-16T10:00:00Z", "source": "live"},
        "updatedAt": "2026-11-16T10:00:00Z",
    }, None)]


@pytest.mark.parametrize("db", [FakeAsyncFirestore(), FakeAsyncFirestore(fail=RuntimeError("firestore down"))])
def test_a_failed_record_is_reported_not_raised(db):
    result = asyncio.run(record_opt_out_request(db, "out-missing", "stop calling", "analysis"))
    assert not result.ok and db.writes == []


def test_only_the_two_sources_exist():
    with pytest.raises(ValueError):
        opt_out_request("x", "2026-11-16T10:00:00Z", "parent_speech")
    db = FakeAsyncFirestore({("parent_outreach", "out-1"): outreach()})
    assert not asyncio.run(record_opt_out_request(db, "out-1", "x", "parent_speech")).ok
    assert db.writes == []


# ── backstop ─────────────────────────────────────────────────────────────────

TRANSCRIPT = [
    {"role": "agent", "text": "Is there a good time for a short call?"},
    {"role": "parent", "text": "Honestly we would prefer the school stops ringing this house."},
]


def test_backstop_counts_a_verbatim_parent_quote():
    insights = {"optOut": {"requested": True, "quote": "prefer the school stops ringing this house"}}
    assert backstop_quote(insights, TRANSCRIPT) == "prefer the school stops ringing this house"


@pytest.mark.parametrize("insights", [
    {"optOut": {"requested": True, "quote": "please never call us"}},               # not said
    {"optOut": {"requested": True, "quote": "Is there a good time"}},               # agent's words
    {"optOut": {"requested": "true", "quote": "stops ringing this house"}},         # not exactly True
    {"optOut": {"requested": True, "quote": ""}},
    {"optOut": {"requested": False, "quote": "stops ringing this house"}},
    {"optOut": {"requested": True, "quote": "call me in the evening"}},             # reschedule
    {"optOut": None}, {}, None,
])
def test_backstop_ignores_anything_but_a_verbatim_stop(insights):
    transcript = TRANSCRIPT + [{"role": "parent", "text": "call me in the evening"}]
    assert backstop_quote(insights, transcript) is None


# ── the real pipeline (create_bot, pipecat stubbed) ──────────────────────────


class Writer:
    def __init__(self, results=(True,)):
        self.results = list(results)
        self.calls: list[tuple] = []

    async def __call__(self, *args):
        self.calls.append(args)
        return self.results[min(len(self.calls), len(self.results)) - 1]


async def _hear(run, text: str):
    guard = run.processor("StopRequestGuard")
    before = len(guard.pushed)
    await guard.process_frame(TranscriptionFrame(text=text), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)
    return guard.pushed[before:]


@pytest.mark.parametrize("reason", ["consecutive_absences", "positive_feedback"])
@pytest.mark.parametrize("language", ["Hindi", "Tamil", "English"])
def test_a_stop_is_recorded_answered_once_and_hidden_from_the_model(reason, language):
    writer = Writer()
    ctx = {**outreach(), "id": "out-1", "reason": reason, "parentLanguage": language}
    with stubbed_runtime():
        async def go():
            run = await build_bot(ctx, call_store=FakeCallStore(), on_opt_out_request=writer)
            passed = await _hear(run, "Please don't call me again")
            after = await _hear(run, "hello? are you there?")
            return run, passed, after

        run, passed, after = asyncio.run(go())

    lines = load_call_lines()[{"Hindi": "hi-IN", "Tamil": "ta-IN", "English": "en-IN"}[language]]
    assert writer.calls == [("Please don't call me again", "live")]
    assert passed == [], "the model must not answer the stop itself"
    assert [f.text for f, _ in after] == ["hello? are you there?"], "after the line the parent is heard again"
    assert [type(f).__name__ for f in run.task.queued] == ["TTSSpeakFrame"]
    assert run.task.queued[0].text == lines["opt_out_noted"]
    assert run.processor("PhaseInstructor").phase.value == "close", "the call moves to its goodbye"


@pytest.mark.parametrize("text", NOT_STOPS[:12])
def test_a_non_stop_records_nothing_and_reaches_the_model(text):
    writer = Writer()
    with stubbed_runtime():
        async def go():
            run = await build_bot({**outreach(), "id": "out-1"}, call_store=FakeCallStore(), on_opt_out_request=writer)
            return run, await _hear(run, text)

        run, passed = asyncio.run(go())
    assert writer.calls == []
    assert run.task.queued == []
    if text:
        assert [f.text for f, _ in passed] == [text]


def test_a_failed_record_is_retried_once_at_the_end_of_the_call():
    writer = Writer(results=(False, True))
    with stubbed_runtime():
        async def go():
            run = await build_bot({**outreach(), "id": "out-1"}, call_store=FakeCallStore(), on_opt_out_request=writer)
            await _hear(run, "stop calling me")
            await run.finalize()
            await run.finalize()  # idempotent
        asyncio.run(go())
    assert writer.calls == [("stop calling me", "live")] * 2


@pytest.mark.parametrize("found", [True, False])
def test_the_post_call_backstop_records_only_a_verbatim_quote(found, monkeypatch):
    writer = Writer()
    quote = "we would rather the school did not ring this house"
    with stubbed_runtime():
        from src import bot

        async def fake_analysis(call_context, transcript, api_key=None, **kwargs):
            return {"optOut": {"requested": True, "quote": quote if found else "something never said"}}

        monkeypatch.setattr(bot, "analyze_call", fake_analysis)

        async def go():
            run = await build_bot({**outreach(), "id": "out-1"}, call_store=FakeCallStore(), on_opt_out_request=writer)
            run.context.add_message({"role": "user", "content": f"Honestly, {quote}."})
            await run.finalize()
        asyncio.run(go())
    assert writer.calls == ([(quote, "analysis")] if found else [])


# ── the authenticated entry point records to Firestore ───────────────────────


def test_vobiz_path_records_the_request_and_hangs_up_once(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): outreach()})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        main.hangup_vobiz_call = fake_hangup

        async def go():
            await run_vobiz_path(main, db)  # runs to the end: pipeline, hangup, finalize
            run = run_from_recorder()
            await _hear(run, "दोबारा फ़ोन मत करना")
            for _ in range(5):
                await asyncio.sleep(0)
        asyncio.run(go())

    assert hangups == ["123e4567-e89b-42d3-a456-426614174000"], "the leg is ended exactly once after the pipeline stops"
    [request] = opt_out_requests(db)
    assert request["quote"] == "दोबारा फ़ोन मत करना" and request["source"] == "live"
    assert suppression_writes(db) == []
    assert any(w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3] for w in db.writes)


# /ws/call is unauthenticated, so it must NOT record: see
# test_opt_out_auth.test_ws_call_cannot_record_anything_for_a_named_outreach.


def test_a_built_in_test_call_persists_nothing(tmp_path, monkeypatch):
    db = FakeAsyncFirestore()
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import vobiz

        vobiz._db = lambda project: db

        async def go():
            main.config = replace(main.config, allow_test_scenarios=True)
            await run_vobiz_path(main, db, outreach_id="__test__003")
            run = run_from_recorder()
            await _hear(run, "please stop calling")
            for _ in range(5):
                await asyncio.sleep(0)
            return run
        run = asyncio.run(go())
    # Only the stream-token consumption touches Firestore on a built-in test call.
    assert [w[1] for w in db.writes] == ["vobiz_stream_tokens"] and db.reads == []
    assert [type(f).__name__ for f in run.task.queued][-1:] == ["TTSSpeakFrame"]


# ── over-recall: a limit is not a stop ───────────────────────────────────────
# Independent review of 5191d1e72 (#3): putting place/activity words with
# "busy", counting "ever / कभी" as strong, checking "strong" on the joined
# window, and taking "बंद करो ये फ़ोन" (hang up) as "stop these calls" made
# these into stop requests: each one ended an ordinary call with the opt-out
# line and recorded optOutRequested.

NOT_STOPS_OVER_RECALL = [
    "Don't call me at the office again.",
    "Don't call me at work anymore.",
    "Don't ever call me while I'm driving.",
    "ऑफिस में दोबारा फ़ोन मत करना।",
    "मीटिंग में कभी फ़ोन मत करना।",
    "आप मुझे कभी भी फ़ोन कर लीजिए, बस मीटिंग में फ़ोन मत करना",
    "बंद करो ये फ़ोन",
    "बंद करो यह फ़ोन",
    "बंद कर दो ये फ़ोन",
]
TWO_UTTERANCES = ("Sorry, can you say that again?", "I'm at work, don't call me at work")
STILL_STOPS = ["Stop calling me, I am busy", "मुझे ये कॉल्स नहीं चाहिए",
               "मुझे दोबारा फ़ोन मत करना, मैं व्यस्त रहता हूँ", "बंद करो ये कॉल्स"]


@pytest.mark.parametrize("text", NOT_STOPS_OVER_RECALL)
def test_a_place_or_activity_limit_is_not_a_stop(text):
    assert not is_stop_request(text), text


def test_strength_is_judged_on_what_was_just_said():
    c = StopListener()
    assert [c.on_parent_speech(t) for t in TWO_UTTERANCES] == [False, False]


@pytest.mark.parametrize("text", STILL_STOPS)
def test_the_strong_stops_are_still_detected(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("utterances", [(t,) for t in NOT_STOPS_OVER_RECALL] + [TWO_UTTERANCES],
                         ids=lambda u: " / ".join(u)[:40])
def test_a_limit_through_the_real_handler_records_nothing_and_reaches_the_model(utterances, tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    language = "English" if utterances[0].isascii() else "Hindi"
    db, _persisted, spoken, passed = _run_call(language, utterances, tmp_path, monkeypatch)
    assert opt_out_requests(db) == [], "a limit was recorded as a stop request"
    noted = load_call_lines()["en-IN" if language == "English" else "hi-IN"]["opt_out_noted"]
    assert noted not in spoken
    assert passed == list(utterances), "the model hears the parent as usual"



# ── a stop split across two transcriptions (review #3) ──────────────────────
# Strength was judged on the just-said part alone, so a stop whose "again"
# was in the FIRST part and "busy" in the second was vetoed by "busy".

SPLIT_STRONG_STOPS = [
    ("मुझे दोबारा फ़ोन", "मत करना, मैं व्यस्त रहता हूँ"),
    ("Stop", "calling me, I'm busy"),
    ("मुझे ये कॉल्स", "नहीं चाहिए, मैं बिज़ी रहता हूँ"),
    ("Please don't call me", "again, I'm busy"),
    ("আমাকে আর ফোন", "করবেন না, আমি ব্যস্ত"),
]
SPLIT_NOT_STOPS = [
    ("Sorry, can you say that again?", "Don't call me, I'm busy"),
    ("Sorry, can you say that again?", "I'm at work, don't call me at work"),
]


@pytest.mark.parametrize("parts", SPLIT_STRONG_STOPS, ids=lambda p: " / ".join(p)[:40])
def test_a_strong_stop_split_across_two_transcriptions_is_noticed(parts):
    c = StopListener()
    assert any([c.on_parent_speech(t) for t in parts]), parts


@pytest.mark.parametrize("parts", SPLIT_NOT_STOPS, ids=lambda p: " / ".join(p)[:40])
def test_a_repeat_word_in_an_earlier_unrelated_sentence_still_does_not_make_it_strong(parts):
    c = StopListener()
    assert [c.on_parent_speech(t) for t in parts] == [False, False]


@pytest.mark.parametrize("parts", SPLIT_STRONG_STOPS[:2], ids=lambda p: " / ".join(p)[:40])
def test_through_the_handler_the_split_stop_is_recorded(parts, tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    language = "English" if parts[0].isascii() else "Hindi"
    db, _persisted, spoken, _passed = _run_call(language, parts, tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == " ".join(parts) and request["source"] == "live"



# ── "never again" forms are strong, bare "ever / कभी" is not (review #4) ────

EVER_AGAIN_STOPS = [
    "मुझे फिर कभी फ़ोन मत करना, मैं बहुत व्यस्त रहता हूँ",
    "phir kabhi phone mat karna, main busy rehta hoon",
    "Don't ever call me, I'm busy",
    "Do not ever phone me, I am busy",
]
BARE_EVER_NOT_STOPS = [
    "मीटिंग में कभी फ़ोन मत करना।",
    "मुझे कभी फ़ोन मत करना, मैं व्यस्त हूँ",
    "Don't ever call me while I'm driving.",
    "आप मुझे कभी भी फ़ोन कर लीजिए, बस बिज़ी हूँ तो फ़ोन मत करना",
]


@pytest.mark.parametrize("text", EVER_AGAIN_STOPS)
def test_a_never_again_stop_said_with_busy_is_still_a_stop(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("text", BARE_EVER_NOT_STOPS)
def test_bare_ever_or_kabhi_does_not_make_busy_a_stop(text):
    assert not is_stop_request(text), text


def test_through_the_handler_a_never_again_stop_is_recorded(tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    db, _persisted, _spoken, _passed = _run_call("Hindi", (EVER_AGAIN_STOPS[0],), tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == EVER_AGAIN_STOPS[0]



# ── "बंद करो ये फ़ोन" with more said (review #5) ─────────────────────────────

STOP_THESE_PHONE_CALLS = ["बंद करो ये फ़ोन कॉल्स", "बंद करो ये फ़ोन, दोबारा मत करना", "बंद कर दो ये फोन कॉल्स"]
# Singular "ये (फ़ोन) कॉल" is "this call": end it, i.e. hang up (final review #1).
HANG_UPS = ["बंद करो ये फ़ोन", "बंद करो यह फ़ोन", "बंद कर दो ये फ़ोन", "फ़ोन बंद करो", "बंद करो ये कॉल",
            "बंद कर दो ये फोन कॉल"]


@pytest.mark.parametrize("text", STOP_THESE_PHONE_CALLS)
def test_stop_these_phone_calls_is_a_stop(text):
    assert is_stop_request(text), text


@pytest.mark.parametrize("text", HANG_UPS)
def test_hang_up_this_phone_is_still_not_a_stop(text):
    assert not is_stop_request(text), text


def test_through_the_handler_stop_these_phone_calls_is_recorded(tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    db, _persisted, _spoken, _passed = _run_call("Hindi", (STOP_THESE_PHONE_CALLS[1],), tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == STOP_THESE_PHONE_CALLS[1]


# ── Marathi "कामात" is "busy", a reason (review, lower priority) ────────────

def test_kamat_is_busy_not_a_place():
    assert is_stop_request("मला पुन्हा फोन करू नका, मी कामात असतो"), "a strong stop said with 'busy'"
    assert not is_stop_request("फोन करू नका, मी कामात आहे"), "a plain 'don't call' with 'busy' is still not a stop"
    assert not is_stop_request("आता फोन करू नका, मी कामात आहे"), "a time still vetoes"


def test_through_the_handler_a_marathi_busy_stop_is_recorded(tmp_path, monkeypatch):
    from test_opt_out_never_suppresses import _run_call

    text = "मला पुन्हा फोन करू नका, मी कामात असतो"
    db, _persisted, _spoken, _passed = _run_call("Marathi", (text,), tmp_path, monkeypatch)
    [request] = opt_out_requests(db)
    assert request["quote"] == text
