"""CLASS GATE — a model sentence about future calls is never spoken, and never ends the call.

Follow-ups to final-0b #1: when the stop detector does NOT fire, the model's
reply was spoken unchecked, and positive_feedback's prompt has no rule
against promising, so "जी ठीक है, अब आपको फ़ोन नहीं करेंगे।" was said: a
promise the school may break. The first fix ended the call on a match, which
made every false match expensive (an ordinary call cut short, a bogus
optOutRequested), and phrase tuning would not converge. Design since: a
match REPLACES the sentence with a fixed line ("The class teacher will
decide about future calls.") and the call goes on; only the PARENT's words
(the stop detector, the post-call analysis) record an opt-out or close.

The class is "a sentence about future calls reaching the parent, or the
model's side deciding about an opt-out". The gate:
  * true promises in all ten call languages (each old acknowledgement among
    them), fed with no stop detected, in both modes, never reach TTS: the
    fixed line is said instead, the call goes on (no goodbye, no end), and
    nothing is recorded;
  * the review's limit acknowledgements ("we won't call you in the morning",
    in five languages) get at most that line, and the call goes on;
  * structurally, nothing on the model's side can record an opt-out: only
    the parent-side functions in bot.py reach the recorder, and CallManager
    takes no recorder;
  * ordinary replies, genuine reschedules, replies about someone else and
    the engine's own lines are not matches and are spoken as before; the
    phrasings the detector missed are detected.
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
    ScriptedRunner,
    TranscriptionFrame,
    TTSSpeakFrame,
    import_main,
    run_from_recorder,
    run_twilio_path,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, opt_out_requests, suppressions
from src.call_policy import LANGUAGE_CODES, load_call_lines
from src.opt_out import is_no_more_calls_promise, is_stop_request
from test_opt_out_never_suppresses import OLD_PROMISES

OID = "OutreachFs0000000001"

# One promise per call language (the engine's own old acknowledgement in
# each), plus the review's examples and a few more ways to say it.
PROMISES = {
    "English": ["Okay, we won't call you anymore, thank you.", "We will never call you again.",
                "Of course, we will not call you again."],
    "Hindi": ["जी ठीक है, अब आपको फ़ोन नहीं करेंगे।", "हम आपको दोबारा फ़ोन नहीं करेंगे।",
              "theek hai, ab hum phone nahi karenge.", "theek hai, ab phone nahi karenge."],
    "Bengali": ["অবশ্যই, আমরা আপনাকে আর ফোন করব না।"],
    "Marathi": ["नक्कीच, आम्ही तुम्हाला पुन्हा फोन करणार नाही."],
    "Gujarati": ["ચોક્કસ, અમે તમને ફરીથી ફોન નહીં કરીએ."],
    "Punjabi": ["ਜੀ ਬਿਲਕੁਲ, ਅਸੀਂ ਤੁਹਾਨੂੰ ਦੁਬਾਰਾ ਫ਼ੋਨ ਨਹੀਂ ਕਰਾਂਗੇ।"],
    "Kannada": ["ಖಂಡಿತ, ನಾವು ನಿಮಗೆ ಮತ್ತೆ ಕರೆ ಮಾಡುವುದಿಲ್ಲ."],
    "Tamil": ["கண்டிப்பாக, நாங்கள் இனி உங்களை அழைக்க மாட்டோம்."],
    "Telugu": ["తప్పకుండా, మేము మీకు మళ్ళీ ఫోన్ చేయము."],
    "Malayalam": ["തീർച്ചയായും, ഞങ്ങൾ ഇനി നിങ്ങളെ വിളിക്കില്ല."],
}
NOT_PROMISES = [
    "The class teacher will call you on Tuesday at five.", "Is there a good time this week?",
    "क्लास टीचर आपको शाम को फ़ोन करेंगे।", "अभी फ़ोन नहीं करेंगे, शाम को करेंगे।",
    "We will not call your husband, only you.", "Don't worry, it will not take long.",
    "Thank you, have a lovely evening, goodbye.", "आरव ने इस हफ़्ते बहुत अच्छा किया।",
]
MISSED_STOPS = ["Stop calling me, I am busy", "मुझे दोबारा फ़ोन मत करना, मैं व्यस्त रहता हूँ",
                "मुझे ये कॉल्स नहीं चाहिए", "बंद करो ये कॉल्स"]
MODES = {
    "request_to_talk": {"reason": "consecutive_absences"},
    "positive_feedback": {"reason": "positive_feedback", "studentName": "Vaibhav",
                          "generatedMessage": "Hello, this is Ms. Sharma. Vaibhav did very well this week."},
}
PARENT_SAYS = "ठीक है जी, समझ गए"  # not a stop: the detector stays silent


# ── the pure pieces ──────────────────────────────────────────────────────────


@pytest.mark.parametrize("text", [t for ts in PROMISES.values() for t in ts] + OLD_PROMISES)
def test_promises_are_recognised(text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("text", NOT_PROMISES)
def test_ordinary_replies_are_not_promises(text):
    assert not is_no_more_calls_promise(text), text


def test_none_of_the_engine_lines_is_a_promise():
    from src.prompts.agent_reply import CALL_GREETINGS

    own = [v for entry in load_call_lines().values() for k, v in entry.items() if k != "review"]
    own += [g["greeting"] for g in CALL_GREETINGS.values()]
    assert [t for t in own if is_no_more_calls_promise(t)] == []


@pytest.mark.parametrize("text", MISSED_STOPS)
def test_the_missed_phrasings_are_now_detected(text):
    assert is_stop_request(text)


def test_the_parent_line_used_below_is_not_a_stop():
    assert not is_stop_request(PARENT_SAYS)


# ── through the real handler ─────────────────────────────────────────────────


async def _model_reply(run, text):
    manager = run.processor("CallManager")
    await manager.process_frame(LLMFullResponseStartFrame(), FrameDirection.DOWNSTREAM)
    for part in (text[: len(text) // 3], text[len(text) // 3: 2 * len(text) // 3], text[2 * len(text) // 3:]):
        await manager.process_frame(LLMTextFrame(text=part), FrameDirection.DOWNSTREAM)
    await manager.process_frame(LLMFullResponseEndFrame(), FrameDirection.DOWNSTREAM)
    await asyncio.sleep(0)


def _vobiz_call(language, mode, reply, tmp_path, monkeypatch, parent_says=None):
    parent_says = PARENT_SAYS if parent_says is None else parent_says
    monkeypatch.setattr(ModelRunner, "max_wait", 0.05)  # the call rightly goes on; do not wait for it
    db = FakeAsyncFirestore({("parent_outreach", OID): {**RECORD, **MODES[mode], "parentLanguage": language}})
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        async def script():
            run = run_from_recorder()
            guard = run.processor("StopRequestGuard")
            await guard.process_frame(TranscriptionFrame(text=parent_says), FrameDirection.DOWNSTREAM)
            run.context.add_message({"role": "user", "content": parent_says})  # the aggregator's job
            await _model_reply(run, reply)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = script
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 5))
        finally:
            ModelRunner.script = None
        runner = ModelRunner.last
        run = run_from_recorder()
        manager = run.processor("CallManager")
    model_text = "".join(f.text for f, _ in manager.pushed if isinstance(f, LLMTextFrame))
    tts = [f.text for f, _ in manager.pushed if isinstance(f, TTSSpeakFrame)]
    return runner, run, model_text, tts, hangups, db


CASES = [(lang, mode, reply) for lang in sorted(PROMISES) for mode in sorted(MODES) for reply in PROMISES[lang][:2]]


def _assert_replaced_and_going_on(language, reply, run, model_text, tts, db):
    lines = load_call_lines()[LANGUAGE_CODES[language]]
    assert model_text == "", "no model text reached TTS"
    assert tts == [lines["future_calls"]], "the fixed line, and nothing else, is said in its place"
    assert run.task.end_reason is None and not [
        f for f, _ in run.processor("CallManager").pushed if type(f).__name__ == "EndTaskFrame"], "the call goes on"
    assert opt_out_requests(db) == [], "the model's side never records an opt-out"
    said = [m["content"] for m in run.context.messages if m.get("role") == "assistant"]
    assert reply not in said and lines["future_calls"] in said


@pytest.mark.parametrize("language,mode,reply", CASES, ids=lambda v: v if len(v) < 40 else v[:40])
def test_a_promise_is_replaced_and_the_call_goes_on(language, mode, reply, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, mode, reply, tmp_path, monkeypatch)
    _assert_replaced_and_going_on(language, reply, run, model_text, tts, db)


@pytest.mark.parametrize("mode", sorted(MODES))
def test_an_ordinary_reply_is_spoken_as_before(mode, tmp_path, monkeypatch):
    reply = "Thank you, the class teacher will call you this evening."
    _runner, _run, model_text, tts, _hangups, db = _vobiz_call("English", mode, reply, tmp_path, monkeypatch)
    assert model_text == reply and tts == []
    assert opt_out_requests(db) == []


def test_on_the_last_turn_the_line_is_followed_by_the_goodbye(tmp_path, monkeypatch):
    """The future-calls line is not a goodbye: a call that ends on this turn still says goodbye."""
    with stubbed_runtime():
        from bot_harness import FakeCallStore as Store, build_bot

        async def go():
            run = await build_bot({**RECORD, "id": OID, "parentLanguage": "Hindi"}, call_store=Store())
            run.processor("CallManager")._max_turns = 1
            await _model_reply(run, PROMISES["Hindi"][0])
            return run

        run = asyncio.run(go())
    lines = load_call_lines()["hi-IN"]
    manager = run.processor("CallManager")
    assert [f.text for f, _ in manager.pushed if isinstance(f, TTSSpeakFrame)] == [lines["future_calls"], lines["goodbye"]]
    assert any(type(f).__name__ == "EndTaskFrame" for f, _ in manager.pushed)


def test_on_the_unauthenticated_route_the_promise_is_still_never_said(tmp_path, monkeypatch):
    web_ctx = {"studentName": "Aarav", "reason": "", "requestToTalk": True, "parentLanguage": "Hindi"}
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def script():
            await _model_reply(run_from_recorder(), PROMISES["Hindi"][0])

        ScriptedRunner.script = script
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_twilio_path(main, web_ctx, outreach_id="OutreachTw0000000001"))
        finally:
            ScriptedRunner.script = None
        manager = run_from_recorder().processor("CallManager")
    assert not [f for f, _ in manager.pushed if isinstance(f, LLMTextFrame)]
    assert [f.text for f, _ in manager.pushed if isinstance(f, TTSSpeakFrame)] == [load_call_lines()["hi-IN"]["future_calls"]]


# ── the review's limit acknowledgements: at most the line, never an ending ──

LIMIT_ACKS = [
    ("English", "Please don't call in the morning", "Of course, we won't call you in the morning."),
    ("English", "Don't call me at the office again.", "Okay, we won't call you at the office again."),
    ("Hindi", "मुझे सुबह फ़ोन मत करना", "जी ठीक है, हम आपको सुबह फ़ोन नहीं करेंगे।"),
    ("Bengali", "রাতে ফোন করবেন না", "ঠিক আছে, রাতে আপনাকে ফোন করব না।"),
    ("Marathi", "आता फोन करू नका", "ठीक आहे, आम्ही तुम्हाला आता फोन करणार नाही."),
    ("Tamil", "இப்போ போன் பண்ணாதீங்க", "சரி, நாங்கள் இப்போது உங்களை அழைக்க மாட்டோம்."),
]


@pytest.mark.parametrize("mode", sorted(MODES))
@pytest.mark.parametrize("language,parent,reply", LIMIT_ACKS, ids=lambda v: v if len(v) < 30 else v[:30])
def test_a_limit_acknowledgement_costs_at_most_one_sentence(language, parent, reply, mode, tmp_path, monkeypatch):
    assert not is_stop_request(parent), "the parent's limit is not a stop"
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, mode, reply, tmp_path, monkeypatch,
                                                              parent_says=parent)
    lines = load_call_lines()[LANGUAGE_CODES[language]]
    assert (model_text, tts) in [(reply, []), ("", [lines["future_calls"]])], (model_text, tts)
    assert run.task.end_reason is None and opt_out_requests(db) == []
    assert lines["opt_out_noted"] not in tts and lines["goodbye"] not in tts


# ── the model's side never records an opt-out ───────────────────────────────

PARENT_SIDE = {"_on_stop_heard", "_finalize_once", "_record_request"}


def _functions_reaching(source, name):
    import ast

    tree = ast.parse(source)
    out = set()
    for fn in ast.walk(tree):
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
            inner = {id(n) for sub in ast.walk(fn) if sub is not fn and isinstance(sub, (ast.FunctionDef, ast.AsyncFunctionDef))
                     for n in ast.walk(sub)}
            if any(isinstance(n, ast.Name) and n.id == name and id(n) not in inner for n in ast.walk(fn)):
                out.add(fn.name)
    return out


def _source(name):
    from pathlib import Path

    return (Path(__file__).resolve().parents[1] / "src" / name).read_text(encoding="utf-8")


def test_only_the_parent_side_reaches_the_opt_out_recorder():
    reaching = _functions_reaching(_source("bot.py"), "_record_request") - {"create_bot"}
    assert reaching and reaching <= PARENT_SIDE, reaching
    assert _functions_reaching(_source("bot.py"), "on_opt_out_request") - {"create_bot"} <= PARENT_SIDE


def test_callmanager_takes_no_recorder():
    import ast

    tree = ast.parse(_source("call_manager.py"))
    init = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == "__init__")
    params = {a.arg for a in init.args.args + init.args.kwonlyargs}
    assert params <= {"self", "context", "call_context", "max_turns", "on_turn_complete", "on_ending",
                      "phase_instructor", "ai_reveal_pattern", "ai_reveal_line", "closing_line",
                      "future_calls_line"}, params
    assert "opt_out_request" not in _source("call_manager.py")


def test_the_checker_sees_a_model_side_recorder():
    bad = _source("bot.py").replace(
        "    # ── Call Manager: turn counting, transcript, call lifecycle ──",
        "    async def _on_promise(words):\n        return await _record_request(words, LIVE)\n\n"
        "    # ── Call Manager: turn counting, transcript, call lifecycle ──", 1)
    assert "_on_promise" in _functions_reaching(bad, "_record_request")


# ── recall: the review's #6 English forms, and no bare "not" ────────────────

MORE_PROMISES = ["We're not calling you again.", "We are not calling you anymore.", "I am not calling you again.",
                 "Okay, we will stop these calls.", "Of course, we'll stop the calls.",
                 "The school will stop calling you.", "Okay, won't call again.",
                 "Okay, we won't call you about him again.", "Okay, we won't call you about her attendance again."]
QUESTIONS = ["Should I not call you in the morning?", "Would you prefer I not call you at work?",
             "Shall I not call you on weekends?"]


@pytest.mark.parametrize("text", MORE_PROMISES)
def test_the_restored_english_forms_are_matched(text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("text", QUESTIONS)
def test_a_question_with_not_is_not_a_match(text):
    assert not is_no_more_calls_promise(text), text


# ── politeness is not a promise ──────────────────────────────────────────────
# Independent review of 5191d1e72 (#1): "won't disturb / bother" counted as a
# promise with no "again" and no check on who is speaking, so an ordinary
# polite reply ended the call and recorded a bogus optOutRequested. Only
# CALLING counts, and only a promise made by us (we/I) or to the parent (you).

POLITE = [
    "I won't disturb you for long.",
    "I won't bother you much, just wanted to share good news.",
    "जी, मैं आपको ज़्यादा परेशान नहीं करूँगा।",
    "Thank you, I won't disturb you any further, have a good day.",
    "আপনাকে বেশিক্ষণ বিরক্ত করব না।",
    "जास्त वेळ त्रास देणार नाही.",
    "Rahul won't disturb anyone in class anymore, he has improved a lot.",
    "क्लास टीचर फ़ोन नहीं करेंगे, आप स्कूल आकर मिल सकते हैं।",
]


@pytest.mark.parametrize("text", POLITE)
def test_politeness_and_someone_elses_plans_are_not_promises(text):
    assert not is_no_more_calls_promise(text), text


POLITE_CALLS = [("Hindi", POLITE[2]), ("English", POLITE[0]), ("English", POLITE[3]), ("Bengali", POLITE[4]),
                ("Marathi", POLITE[5]), ("English", POLITE[6]), ("Hindi", POLITE[7])]


@pytest.mark.parametrize("mode", sorted(MODES))
@pytest.mark.parametrize("language,reply", POLITE_CALLS, ids=lambda v: v if len(v) < 30 else v[:30])
def test_a_polite_reply_to_a_busy_parent_is_spoken_and_records_nothing(language, reply, mode, tmp_path, monkeypatch):
    # The reviewer's probe: the parent says they are a bit busy; the model is polite.
    runner, run, model_text, tts, hangups, db = _vobiz_call(
        language, mode, reply, tmp_path, monkeypatch, parent_says="मैं थोड़ा बिज़ी हूँ")
    first = reply.split("।")[0].split(". ")[0]
    assert model_text.startswith(first[:20]), (model_text, reply)
    assert tts == [], "no opt-out line, no goodbye"
    assert opt_out_requests(db) == []
    assert not [f for f, _ in run.processor("CallManager").pushed if type(f).__name__ == "EndTaskFrame"]


# ── a time word does not excuse a promise ────────────────────────────────────
# Independent review of 5191d1e72 (#2): any time word (now, after, today,
# बाद, आज, এখন, आता) vetoed the match, so "आज के बाद आपको फ़ोन नहीं
# करेंगे" ("after today we won't call you") was spoken. Only a genuine
# reschedule (a time AND a "will call") excuses a reply, and "from now on /
# after today / আজ থেকে / आता पासून" mark a promise.

TIMED_PROMISES = [
    "आज के बाद आपको फ़ोन नहीं करेंगे।",
    "अब के बाद फ़ोन नहीं करेंगे।",
    "इसके बाद आपको कोई फ़ोन नहीं आएगा।",
    "Okay, from now on we won't call you.",
    "we won't call you again after this",
    "no more calls from now on",
    "এখন থেকে আর ফোন করব না।",
    "আজ থেকে আর ফোন করব না।",
    "आता पासून फोन करणार नाही.",
    "जी ठीक है, आज के बाद आपको फ़ोन नहीं करेंगे।",  # the probe's reply
]
RESCHEDULES = [
    "हम अभी फ़ोन नहीं करेंगे, शाम को करेंगे।",
    "We won't call now, the class teacher will call you this evening.",
    "abhi phone nahi karenge, shaam ko karenge",
    "আমরা এখন ফোন করব না, সন্ধ্যায় ফোন করব।",
]


@pytest.mark.parametrize("text", TIMED_PROMISES)
def test_a_time_word_does_not_excuse_a_promise(text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("text", RESCHEDULES)
def test_a_genuine_reschedule_is_not_a_promise(text):
    assert not is_no_more_calls_promise(text), text


TIMED_CALLS = [("Hindi", TIMED_PROMISES[-1]), ("Hindi", TIMED_PROMISES[2]), ("English", TIMED_PROMISES[3]),
               ("Bengali", TIMED_PROMISES[6]), ("Marathi", TIMED_PROMISES[8])]


@pytest.mark.parametrize("mode", sorted(MODES))
@pytest.mark.parametrize("language,reply", TIMED_CALLS, ids=lambda v: v if len(v) < 30 else v[:30])
def test_a_promise_with_a_time_word_never_reaches_tts(language, reply, mode, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, mode, reply, tmp_path, monkeypatch)
    _assert_replaced_and_going_on(language, reply, run, model_text, tts, db)


# ── a negated verb is not a "will call" (review #2) ─────────────────────────
# The reschedule check's "will call" matched the start of a NEGATED verb:
# "করবো না" read as "করব" + "ো" with no "না" right after, so "এখন থেকে আর
# ফোন করবো না" (a time word plus that "will call") was excused and spoken.

NEGATED_VERB_PROMISES = [
    ("Bengali", "এখন থেকে আর ফোন করবো না।"),
    ("Bengali", "আজ থেকে আর ফোন করবো না।"),
    ("Bengali", "আজ থেকে আমরা আপনাকে আর ফোন দেবো না।"),
    ("Gujarati", "હવે પછી અમે તમને ફોન કરીશું નહીં."),
]


@pytest.mark.parametrize("language,text", NEGATED_VERB_PROMISES, ids=lambda v: v[:30])
def test_a_negated_verb_is_not_read_as_will_call(language, text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("language,text", NEGATED_VERB_PROMISES, ids=lambda v: v[:30])
def test_through_the_handler_a_negated_verb_promise_is_replaced(language, text, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, "request_to_talk", text, tmp_path, monkeypatch)
    _assert_replaced_and_going_on(language, text, run, model_text, tts, db)


def test_a_genuine_bengali_and_gujarati_reschedule_still_excuses():
    assert not is_no_more_calls_promise("আমরা এখন ফোন করবো না, সন্ধ্যায় ফোন করবো।")
    assert not is_no_more_calls_promise("અમે હમણાં ફોન નહીં કરીએ, સાંજે ફોન કરીશું.")


# ── "won't disturb you again" (review #7) ───────────────────────────────────
# Dropping disturb/bother entirely (for "I won't disturb you for long") also
# let "We won't bother you again" / "हम आपको दोबारा परेशान नहीं करेंगे"
# through. They count again, but only with a we/I subject or a you object,
# a repeat word, and no "for long / much / ज़्यादा / বেশিক্ষণ / जास्त वेळ".

DISTURB_PROMISES = [
    ("English", "We won't bother you again."),
    ("Hindi", "जी, अब हम आपको दोबारा परेशान नहीं करेंगे।"),
    ("Hindi", "माफ़ कीजिए, आगे से आपको परेशान नहीं करेंगे।"),
    ("Bengali", "আমরা আর আপনাকে বিরক্ত করব না।"),
    ("Marathi", "आम्ही तुम्हाला पुन्हा त्रास देणार नाही."),
    ("Gujarati", "અમે તમને ફરીથી હેરાન નહીં કરીએ."),
]
STILL_POLITE = POLITE + ["अब मैं आपको ज़्यादा परेशान नहीं करूँगा।", "আর বেশিক্ষণ বিরক্ত করব না।",
                         "आरव अब क्लास में किसी को परेशान नहीं करता।", "I won't disturb you again for long."]


@pytest.mark.parametrize("language,text", DISTURB_PROMISES, ids=lambda v: v[:30])
def test_wont_disturb_you_again_is_a_promise(language, text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("text", STILL_POLITE)
def test_politeness_stays_politeness(text):
    assert not is_no_more_calls_promise(text), text


@pytest.mark.parametrize("language,text", DISTURB_PROMISES[:4], ids=lambda v: v[:30])
def test_through_the_handler_wont_disturb_you_again_is_replaced(language, text, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, "positive_feedback", text, tmp_path, monkeypatch)
    _assert_replaced_and_going_on(language, text, run, model_text, tts, db)


# ── a Hindi promise that names no caller (review, lower priority) ───────────

NO_CALLER_PROMISES = ["जी ठीक है, फ़ोन नहीं करेंगे।", "आगे कोई कॉल नहीं आएगी।"]


@pytest.mark.parametrize("text", NO_CALLER_PROMISES)
def test_a_hindi_promise_that_names_no_caller_is_matched(text):
    assert is_no_more_calls_promise(text), text


def test_a_named_third_person_caller_is_still_not_a_match():
    assert not is_no_more_calls_promise("क्लास टीचर फ़ोन नहीं करेंगे, आप स्कूल आकर मिल सकते हैं।")
    assert not is_no_more_calls_promise("अभी फ़ोन नहीं करेंगे, शाम को करेंगे।")


@pytest.mark.parametrize("text", NO_CALLER_PROMISES)
def test_through_the_handler_a_no_caller_promise_is_replaced(text, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call("Hindi", "request_to_talk", text, tmp_path, monkeypatch)
    _assert_replaced_and_going_on("Hindi", text, run, model_text, tts, db)


# ── Marathi: "we won't call their father" is about someone else ─────────────

MARATHI_SOMEONE_ELSE = ["आम्ही त्यांच्या वडिलांना फोन करणार नाही", "आम्ही आईला फोन करणार नाही, तुम्हालाच करू",
                        "आम्ही मिस्टरांना फोन करणार नाही"]


@pytest.mark.parametrize("text", MARATHI_SOMEONE_ELSE)
def test_a_marathi_reply_about_someone_else_is_not_a_promise(text):
    assert not is_no_more_calls_promise(text), text


def test_a_marathi_promise_to_the_parent_still_is():
    assert is_no_more_calls_promise("आम्ही तुम्हाला पुन्हा फोन करणार नाही")


def test_through_the_handler_the_marathi_reply_about_someone_else_is_spoken(tmp_path, monkeypatch):
    reply = MARATHI_SOMEONE_ELSE[0]
    _runner, _run, model_text, tts, _hangups, db = _vobiz_call("Marathi", "request_to_talk", reply, tmp_path, monkeypatch)
    assert model_text.startswith("आम्ही त्यांच्या") and tts == []


# ── the someone-else veto is about the call's object only ───────────────────
# Security review: the veto excused any reply that merely CONTAINED a
# someone-else word, so a real promise to the parent that also mentions
# someone ("आम्ही तुम्हाला पुन्हा फोन करणार नाही, त्यांना सांगू" - we won't
# call you again, we'll tell them) was spoken. Now that person must be the
# object of the call verb in the same clause, and the clause must not also
# call the parent. Tightened for Marathi, Hindi, Hinglish and Bengali.

PROMISES_MENTIONING_SOMEONE = [
    ("Marathi", "आम्ही तुम्हाला पुन्हा फोन करणार नाही, त्यांना सांगू"),
    ("Marathi", "आम्ही तुम्हाला पुन्हा फोन करणार नाही त्यांना सांगू"),
    ("Marathi", "वडिलांना सांगितले आहे, आम्ही तुम्हाला पुन्हा फोन करणार नाही"),
    ("Hindi", "हम आपको दोबारा फ़ोन नहीं करेंगे, उन्हें बता देंगे"),
    ("Hindi", "पापा को बता दिया है, हम आपको दोबारा फ़ोन नहीं करेंगे"),
    ("Hindi", "hum aapko dobara phone nahi karenge, unko bata denge"),
    ("Hindi", "papa ko bata diya, hum aapko phone nahi karenge"),
    ("Bengali", "আমরা আপনাকে আর ফোন করব না, ওনাকে বলে দেব"),
    ("Bengali", "বাবাকে বলেছি, আমরা আপনাকে আর ফোন করব না"),
]
TRULY_SOMEONE_ELSE = ["आम्ही त्यांच्या वडिलांना फोन करणार नाही", "हम उनके पापा को फ़ोन नहीं करेंगे",
                      "আমরা ওর বাবাকে ফোন করব না", "We will not call your husband, only you."]


@pytest.mark.parametrize("language,text", PROMISES_MENTIONING_SOMEONE, ids=lambda v: v[:40])
def test_a_promise_to_the_parent_that_mentions_someone_is_still_a_promise(language, text):
    assert is_no_more_calls_promise(text), text


@pytest.mark.parametrize("language,text", PROMISES_MENTIONING_SOMEONE[::3], ids=lambda v: v[:40])
def test_through_the_handler_it_is_replaced(language, text, tmp_path, monkeypatch):
    _runner, run, model_text, tts, _hangups, db = _vobiz_call(language, "request_to_talk", text, tmp_path, monkeypatch)
    _assert_replaced_and_going_on(language, text, run, model_text, tts, db)


@pytest.mark.parametrize("text", TRULY_SOMEONE_ELSE)
def test_a_reply_about_someone_else_is_still_spoken(text):
    assert not is_no_more_calls_promise(text), text
