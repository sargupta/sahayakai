"""CLASS GATE — a concern call is a request to talk.

Founder decision (23 Oct 2026): only `positive_feedback` may deliver the
teacher's message. Every other reason, including a missing, misspelt or unknown
one, opens with the fixed request-to-talk line, and the model is never given
the concern: not generatedMessage, message, spokenScript, reason, subject,
marks, performance context, nor the parent history built from earlier calls.

The class of bug is "some field that carries the concern reaches the parent or
the model". The instance was bot.py speaking generatedMessage verbatim and
building the prompt from the whole record. The gate is on the class:

  * sentinels: every concern-carrying field (and the reason itself) is filled
    with a marker, the REAL create_bot is run against pipecat stand-ins, and no
    marker may appear in anything handed to a pipecat object — LLM settings,
    seeded context, queued frames — nor in any phase guidance or the identity
    guard's replacement line;
  * invariance: two concern calls that differ only in their concern produce
    byte-identical greeting, instructions and guidance, so no transformation of
    the concern can leak either;
  * fail closed: unknown, missing, misspelt and non-string reasons all get the
    request-to-talk line;
  * positive unchanged: positive_feedback output equals the golden captured
    from the engine before this change, plus the one deliberate FUTURE CALLS
    rule (tests/test_future_calls_rule.py);
  * language coverage: every language the engine speaks has every line.
"""

from __future__ import annotations

import asyncio
import json
import re
import unicodedata
from pathlib import Path

import pytest

from bot_harness import (
    FakeCallStore,
    ai_reveal_replacement,
    build_bot,
    phase_guidance,
    recorded_strings,
    spoken_greeting,
    stubbed_runtime,
)
from src import call_policy
from src.call_policy import (
    AI_REVEAL_ORIGINAL,
    AI_REVEAL_WORD_BOUNDED,
    DEFAULT_LANGUAGE_CODE,
    LANGUAGE_CODES,
    LINE_KEYS,
    MODE_POSITIVE_FEEDBACK,
    MODE_REQUEST_TO_TALK,
    load_call_lines,
    plan_call,
)

GOLDEN = Path(__file__).parent / "golden" / "positive_feedback.json"
FOUNDER_LINE = (
    "Your child's class teacher would like to speak with you this week. "
    "Is there a good time for a short call?"
)

MARK = "SNTL"
CONCERN_FIELDS = {
    "generatedMessage": f"{MARK}-GENMSG आरव कई दिनों से स्कूल नहीं आ रहा",
    "message": f"{MARK}-MESSAGE",
    "spokenScript": f"{MARK}-SPOKEN",
    "subject": f"{MARK}-SUBJECT Science",
    "teacherNote": f"{MARK}-NOTE fought in class",
    "marks": f"{MARK}-MARKS 18/100",
    "score": f"{MARK}-SCORE",
    "concern": f"{MARK}-CONCERN",
    "performanceContext": {
        "summary": f"{MARK}-PERF",
        "subjects": [{"name": f"{MARK}-PERFSUBJ", "percentage": 17}],
    },
    "callSummary": {"parentConcerns": [f"{MARK}-PRIORSUMMARY"]},
    "transcript": [{"role": "parent", "text": f"{MARK}-PRIORTRANSCRIPT"}],
}
HISTORY = f"PARENT HISTORY (3 previous calls):\n- Open concerns: {MARK}-HISTORY fees overdue"

# Every reason that is NOT the exact enum value — the web app stores the
# reason unvalidated, so all of these reach the engine in practice.
MISSING = object()
CONCERN_REASONS = [
    "consecutive_absences",
    "poor_performance",
    "behavioral_concern",
    f"{MARK}-REASON-unknown-category",
    "fees_due",
    "",
    None,
    MISSING,
    "Positive_Feedback",
    "POSITIVE_FEEDBACK",
    " positive_feedback",
    "positive_feedback ",
    "positive feedback",
    "positive-feedback",
    1,
    ["positive_feedback"],
    {"value": "positive_feedback"},
]

IDENTITY = {
    "id": "out-concern-test",
    "studentName": "Aarav",
    "className": "Class 5",
    "teacherName": "Ms. Sharma",
    "schoolName": "Demo Public School",
    "parentPhone": "+919800000101",
}


def concern_context(reason, language="Hindi", **overrides) -> dict:
    ctx = {**IDENTITY, **CONCERN_FIELDS, "parentLanguage": language, **overrides}
    if reason is not MISSING:
        ctx["reason"] = reason
    return ctx


# The concern-call instructions the original prompt carries (seen in the live
# prompt on 2026-11-16): "ANSWER DIRECT QUESTIONS HONESTLY ... GIVE THE HONEST
# ANSWER ... (100 mein se 18 number aaye hain, science mein)" and friends. Any of
# them in a request-to-talk call tells the model to disclose what it must not.
DISCLOSURE_INSTRUCTIONS = re.compile(
    r"honest|100 mein se|number aaye|score kitna|actual score|actual incident|"
    r"problem kya hai|kya hua hai|share concern|ease into problems|dodg|"
    r"attendance/absent|exam performance|behavioral issues|fees scenario",
    re.IGNORECASE,
)


def assert_no_disclosure_instruction(texts) -> None:
    for text in texts:
        hit = DISCLOSURE_INSTRUCTIONS.search(text)
        assert hit is None, (hit.group(0) if hit else None, text[:200])


def reason_markers(reason) -> list[str]:
    """Strings that must never reach the model for this reason."""
    markers = [MARK]
    if isinstance(reason, str) and len(reason.strip()) >= 4:
        markers.append(reason.strip())
    return markers


# ── pure policy ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("reason", CONCERN_REASONS, ids=repr)
@pytest.mark.parametrize("language", sorted(LANGUAGE_CODES) + ["Klingon", None])
def test_every_non_positive_reason_fails_closed_to_request_to_talk(reason, language):
    plan = plan_call(concern_context(reason, language), parent_history=HISTORY)
    lines = load_call_lines()[plan.lang_code]

    assert plan.mode == MODE_REQUEST_TO_TALK
    assert plan.greeting == lines["request_to_talk"]
    assert plan.uses_parent_history is False
    assert set(plan.manager_context) == set(call_policy.MODEL_IDENTITY_FIELDS)
    model_facing = [plan.greeting, plan.system_instruction, plan.ai_reveal_line or "",
                    *plan.phase_guidance.values(), *map(str, plan.manager_context.values())]
    for text in model_facing:
        for marker in reason_markers(reason):
            assert marker not in text, (marker, text)
    assert_no_disclosure_instruction(model_facing)


def test_only_the_exact_enum_value_is_positive():
    assert plan_call({"reason": "positive_feedback"}).mode == MODE_POSITIVE_FEEDBACK
    for reason in CONCERN_REASONS:
        ctx = {} if reason is MISSING else {"reason": reason}
        assert plan_call(ctx).mode == MODE_REQUEST_TO_TALK, reason


@pytest.mark.parametrize("flag", [True, "true", 1, "yes", [], {}])
def test_a_request_to_talk_flag_overrides_even_positive_feedback(flag):
    """The call-context endpoint sets requestToTalk; anything but absent/False fails closed."""
    assert plan_call({"reason": "positive_feedback", "requestToTalk": flag}).mode == MODE_REQUEST_TO_TALK


@pytest.mark.parametrize("flag", [False, None])
def test_an_explicitly_false_flag_leaves_positive_feedback_alone(flag):
    assert plan_call({"reason": "positive_feedback", "requestToTalk": flag}).mode == MODE_POSITIVE_FEEDBACK


def test_concern_content_cannot_change_anything_the_model_sees():
    """Two concern calls differing only in their concern are indistinguishable."""
    a = plan_call(concern_context("consecutive_absences"), parent_history=HISTORY)
    b = plan_call(
        concern_context(
            "poor_performance",
            generatedMessage="something else entirely",
            subject="Mathematics",
            performanceContext={"summary": "different"},
        ),
        parent_history="PARENT HISTORY: completely different",
    )
    for attr in ("greeting", "system_instruction", "phase_guidance", "ai_reveal_line", "manager_context"):
        assert getattr(a, attr) == getattr(b, attr), attr


def test_request_to_talk_tells_the_model_how_to_answer_why():
    plan = plan_call(concern_context("behavioral_concern", "English"))
    explain = load_call_lines()["en-IN"]["explain_in_person"]
    assert f'say exactly: "{explain}"' in plan.system_instruction
    assert "do not confirm it and do not deny it" in plan.system_instruction
    assert all(explain in g for phase, g in plan.phase_guidance.items() if phase in ("opening", "explore"))


# ── the real wiring (bot.py against pipecat stand-ins) ───────────────────────


async def _drive_concern_call(ctx: dict):
    store = FakeCallStore(history=HISTORY)
    run = await build_bot(ctx, call_store=store)
    greeting = await spoken_greeting(run)
    guidance = await phase_guidance(run)
    replacement, added = await ai_reveal_replacement(run)
    return run, store, greeting, guidance, replacement, added


@pytest.mark.parametrize("reason", CONCERN_REASONS, ids=repr)
@pytest.mark.parametrize("language", ["Hindi", "English", "Tamil"])
def test_sentinels_never_reach_any_model_input_through_create_bot(reason, language):
    ctx = concern_context(reason, language)
    with stubbed_runtime():
        run, store, greeting, guidance, replacement, added = asyncio.run(_drive_concern_call(ctx))
        everything = recorded_strings()

    lines = load_call_lines()[call_policy.lang_code_for(language)]
    assert greeting == lines["request_to_talk"]
    assert replacement == lines["request_to_talk"]
    assert run.seed_messages == [{"role": "assistant", "content": lines["request_to_talk"]}]
    assert store.history_requests == [], "parent history must not even be read for a concern call"

    checked = [greeting, run.system_instruction, replacement, *guidance.values(),
               *(m["content"] for m in run.seed_messages + added), *everything]
    assert len(everything) > 20, "the recorder saw almost nothing; the scan would be vacuous"
    for text in checked:
        for marker in reason_markers(reason):
            assert marker not in text, (marker, text[:200])
    assert_no_disclosure_instruction([run.system_instruction, *guidance.values()])


def test_wiring_and_plan_agree_for_a_concern_call():
    ctx = concern_context("poor_performance", "Bengali")
    plan = plan_call(ctx)
    with stubbed_runtime():
        run, _store, greeting, guidance, _r, _a = asyncio.run(_drive_concern_call(ctx))
    assert run.system_instruction == plan.system_instruction
    assert guidance == plan.phase_guidance
    assert greeting == plan.greeting
    assert run.tts_settings["language"] == run.stt_settings["language"] == "bn-IN"


# ── positive_feedback is unchanged ───────────────────────────────────────────


def test_positive_feedback_output_matches_the_pre_change_golden():
    from positive_scenarios import capture_all

    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    now = json.loads(json.dumps(capture_all(), ensure_ascii=False, sort_keys=True))
    assert set(now) == set(golden)
    for name in golden:
        assert now[name] == golden[name], name


def test_the_disclosure_check_would_catch_the_original_prompt():
    """The regex is not vacuous: the pre-change prompt, used for every call, trips it."""
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    hi = golden["hindi_with_message_subject_and_history"]
    assert "GIVE THE HONEST ANSWER" in hi["system_instruction"]
    assert "100 mein se 18 number aaye hain" in hi["system_instruction"]
    assert DISCLOSURE_INSTRUCTIONS.search(hi["system_instruction"])


def test_positive_feedback_still_speaks_the_teacher_message_and_reads_history():
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    hi = golden["hindi_with_message_subject_and_history"]
    assert hi["greeting"].startswith("नमस्ते जी, मैं शर्मा मैम")
    assert "Subject: Mathematics" in hi["system_instruction"]
    assert "PARENT HISTORY" in hi["system_instruction"]
    assert hi["history_requested_for"] == ["+919800000101"]


# ── language coverage ────────────────────────────────────────────────────────

SCRIPTS = {
    "en-IN": "LATIN",
    "hi-IN": "DEVANAGARI",
    "mr-IN": "DEVANAGARI",
    "bn-IN": "BENGALI",
    "pa-IN": "GURMUKHI",
    "gu-IN": "GUJARATI",
    "ta-IN": "TAMIL",
    "te-IN": "TELUGU",
    "kn-IN": "KANNADA",
    "ml-IN": "MALAYALAM",
}


def _script_share(text: str, script: str) -> float:
    letters = [c for c in text if unicodedata.category(c)[0] in "LM"]
    hits = [c for c in letters if unicodedata.name(c, "").startswith(script)]
    return len(hits) / max(len(letters), 1)


def test_every_language_the_engine_speaks_has_every_line():
    lines = load_call_lines()
    spoken = set(LANGUAGE_CODES.values()) | {DEFAULT_LANGUAGE_CODE}
    assert spoken <= set(lines), spoken - set(lines)
    assert set(lines) <= spoken, f"lines for codes the engine never speaks: {set(lines) - spoken}"
    for code in spoken:
        for key in LINE_KEYS:
            assert lines[code][key].strip(), (code, key)


def test_lines_cover_the_fallback_greeting_languages_too():
    from src.prompts.agent_reply import CALL_GREETINGS

    assert set(CALL_GREETINGS) <= set(load_call_lines())


@pytest.mark.parametrize("code", sorted(SCRIPTS))
def test_each_line_is_written_in_its_own_script(code):
    for key in LINE_KEYS:
        text = load_call_lines()[code][key]
        assert _script_share(text, SCRIPTS[code]) > 0.85, (code, key, text)


@pytest.mark.parametrize("language", sorted(LANGUAGE_CODES))
def test_each_parent_language_opens_with_its_own_line(language):
    plan = plan_call(concern_context("consecutive_absences", language))
    assert plan.greeting == load_call_lines()[LANGUAGE_CODES[language]]["request_to_talk"]


def test_english_line_is_the_founders_line_and_nothing_sounds_recorded():
    lines = load_call_lines()
    assert lines["en-IN"]["request_to_talk"] == FOUNDER_LINE
    banned = re.compile(r"record|automated|this is a call from|रिकॉर्ड|रेकॉर्ड", re.IGNORECASE)
    for code, entry in lines.items():
        for key in LINE_KEYS:
            assert not banned.search(entry[key]), (code, key)


def test_every_translation_states_its_review_status():
    for code, entry in load_call_lines().items():
        assert entry.get("review"), code


# ── the identity guard no longer eats ordinary English on concern calls ──────


def test_bounded_identity_guard():
    explain = load_call_lines()["en-IN"]["explain_in_person"]
    ordinary = [explain, "Are you available tomorrow again?", "Both of you said that.", "Please wait."]
    for text in ordinary:
        assert AI_REVEAL_ORIGINAL.search(text), "documents the original pattern's false hit"
        assert not AI_REVEAL_WORD_BOUNDED.search(text), text
    for text in ["I am an AI", "just a bot", "a Google model", "मैं एक एआई हूँ", "मैं सहायक हूँ"]:
        assert AI_REVEAL_WORD_BOUNDED.search(text), text


# The web app keeps its own copy of the request line for the paths it speaks
# itself (src/locales/call-scripts/request-to-talk.json); this service cannot
# read it at runtime because its Docker build context is this directory only.
def test_request_line_matches_the_web_apps_copy():
    from bot_harness import contract_file_or_skip

    web_lines = contract_file_or_skip("sahayakai-main/src/locales/call-scripts/request-to-talk.json")
    web = json.loads(web_lines.read_text(encoding="utf-8"))["lines"]
    ours = load_call_lines()
    for language, code in LANGUAGE_CODES.items():
        if language == "Odia":
            continue  # this engine speaks an Odia call in en-IN, so it uses the English line
        assert ours[code]["request_to_talk"] == web[language], language
