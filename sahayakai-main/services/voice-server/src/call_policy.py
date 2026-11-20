"""
What a parent call may say, decided once per call from the outreach record.

Founder decision (23 Oct 2026): a concern call is a request to talk. It never
states the concern. Only `positive_feedback` may deliver the teacher's message;
every other reason — including a missing, misspelt or unknown one, because the
web app stores the reason unvalidated — fails closed to a request to talk.

Pure on purpose: stdlib only, no pipecat, no SDKs, so the unit tests import it
with nothing but pytest installed. bot.py turns a CallPlan into a pipeline.

For a request-to-talk call the model is built from `model_identity()` only — an
ALLOWLIST of the names needed to say who is calling. Nothing else from the
record reaches the greeting, the system instruction, the phase guidance or the
seeded context: not generatedMessage, message, spokenScript, reason, subject,
teacherNote, marks, performanceContext, nor the parent history the local call
store keeps (it carries past concerns). The teacher's post-call summary still
gets the full record; that is call_analyzer.py, which runs after the hangup.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from src.prompts.agent_reply import (
    build_request_to_talk_instruction,
    build_system_instruction,
    get_greetings,
)
from src.prompts.phase_guidance import (
    render_positive_feedback_guidance,
    render_request_to_talk_guidance,
)

POSITIVE_FEEDBACK = "positive_feedback"

MODE_POSITIVE_FEEDBACK = "positive_feedback"
MODE_REQUEST_TO_TALK = "request_to_talk"

# Parent language (as stored on the outreach record) → the speech code the
# engine uses for STT and TTS. Moved here from bot.py unchanged, so the
# language-coverage test enumerates the map the engine really speaks from.
LANGUAGE_CODES: dict[str, str] = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Kannada": "kn-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Gujarati": "gu-IN",
    "Punjabi": "pa-IN",
    "Odia": "en-IN",  # Odia TTS not available, fallback
}
DEFAULT_LANGUAGE_CODE = "en-IN"

# The language the model is told to speak, named from the speech code — never
# copied from the record, which is free text.
LANGUAGE_NAMES: dict[str, str] = {
    "en-IN": "English",
    "hi-IN": "Hindi",
    "kn-IN": "Kannada",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "ml-IN": "Malayalam",
    "bn-IN": "Bengali",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "pa-IN": "Punjabi",
}

LINE_KEYS = ("request_to_talk", "explain_in_person", "opt_out_noted", "goodbye", "future_calls")
CALL_LINES_PATH = Path(__file__).with_name("call_lines.json")

# The only record fields a request-to-talk call may hand to the model.
MODEL_IDENTITY_FIELDS = ("studentName", "teacherName", "schoolName")

# AI-identity guard used by CallManager. The original pattern has no word
# boundaries, so "ai" inside "explain", "again", "said" or "available" (and
# "bot" inside "both") trips it and an ordinary English sentence is thrown
# away. Every call now uses word boundaries for the Latin words (positive
# feedback did not until the final review's #8: "He said he wants to do it
# again" was a silent turn). Indic words cannot use \b (combining marks break
# it), so they stay substring matches as before. AI_REVEAL_ORIGINAL is kept
# only to document the old false hits.
AI_REVEAL_ORIGINAL = re.compile(
    r'(AI|bot|assistant|model|कृत्रिम|एआई|बॉट|सहायक|भाषा मॉडल|language model|'
    r'स्वचालित|automated|artificial|machine|गूगल|Google|OpenAI|trained)',
    re.IGNORECASE,
)
AI_REVEAL_WORD_BOUNDED = re.compile(
    r'\b(AI|bot|assistant|model|language model|automated|artificial|machine|'
    r'Google|OpenAI|trained)\b|(कृत्रिम|एआई|बॉट|सहायक|भाषा मॉडल|स्वचालित|गूगल)',
    re.IGNORECASE,
)


@dataclass(frozen=True)
class CallPlan:
    """Everything the pipeline speaks or tells the model, fixed before the call."""

    mode: str
    lang_code: str
    greeting: str
    system_instruction: str
    phase_guidance: dict[str, str]
    # Context CallManager may read names from (the full record for positive
    # feedback, exactly as before; the allowlisted identity otherwise).
    manager_context: dict[str, Any]
    # None keeps CallManager's original Hindi replacement (positive feedback).
    ai_reveal_line: str | None
    ai_reveal_pattern: re.Pattern[str]
    # Said once when the parent may have asked not to be called again: the
    # class teacher will be told. Never a promise that nobody will call.
    opt_out_noted: str
    # The fixed last sentence when the engine closes the call itself (after a
    # possible stop, or instead of a blocked last reply). Promises nothing.
    goodbye: str
    # Said in place of a model sentence about future calls; the call goes on.
    future_calls: str
    uses_parent_history: bool

    @property
    def is_positive_feedback(self) -> bool:
        return self.mode == MODE_POSITIVE_FEEDBACK


def is_positive_feedback(call_context: Mapping[str, Any]) -> bool:
    """True only for the exact enum value. Anything else is a concern call.

    The context reaches the engine two ways and both are classified here:
      * the Firestore parent_outreach record (Vobiz path), where the reason is
        present as stored;
      * the web app's /api/attendance/call-context (the /ws/call path), which
        for a concern call blanks reason and subject and sets
        `requestToTalk: true`.
    Any `requestToTalk` other than absent/False wins over the reason, so a
    contradictory record still fails closed.
    """
    if call_context.get("requestToTalk") not in (None, False):
        return False
    reason = call_context.get("reason")
    return isinstance(reason, str) and reason == POSITIVE_FEEDBACK


def lang_code_for(parent_language: object) -> str:
    """Speech code for a record's parentLanguage; unknown values speak English."""
    if isinstance(parent_language, str):
        return LANGUAGE_CODES.get(parent_language, DEFAULT_LANGUAGE_CODE)
    return DEFAULT_LANGUAGE_CODE


@lru_cache(maxsize=1)
def load_call_lines() -> dict[str, dict[str, str]]:
    """The fixed lines, keyed by speech code. Fails loudly if the file is incomplete."""
    data = json.loads(CALL_LINES_PATH.read_text(encoding="utf-8"))
    lines = data["lines"]
    for code, entry in lines.items():
        for key in LINE_KEYS:
            value = entry.get(key)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"call_lines.json: {code}.{key} is missing or empty")
    return lines


def lines_for(lang_code: str) -> dict[str, str]:
    lines = load_call_lines()
    return lines.get(lang_code) or lines[DEFAULT_LANGUAGE_CODE]


def _clean(value: object) -> str:
    return value.strip() if isinstance(value, str) else ""


def model_identity(call_context: Mapping[str, Any]) -> dict[str, str]:
    """The allowlisted names a request-to-talk call may give the model."""
    return {key: _clean(call_context.get(key)) for key in MODEL_IDENTITY_FIELDS}


def plan_call(call_context: Mapping[str, Any], parent_history: str | None = None) -> CallPlan:
    """Decide the greeting, the model's instructions and the fixed lines for a call.

    `parent_history` is the local call store's summary of earlier calls. Only the
    positive_feedback path uses it (as before); a request-to-talk call ignores it
    because it carries earlier concerns.
    """
    lang_code = lang_code_for(call_context.get("parentLanguage", "Hindi"))
    lines = lines_for(lang_code)

    if is_positive_feedback(call_context):
        # Unchanged from the engine before the request-to-talk decision: the
        # teacher's own message is the greeting, with the generic per-language
        # line only when the message is empty.
        teacher_message = call_context.get("generatedMessage", "")
        greeting = teacher_message if teacher_message else get_greetings(lang_code)["greeting"]
        return CallPlan(
            mode=MODE_POSITIVE_FEEDBACK,
            lang_code=lang_code,
            greeting=greeting,
            system_instruction=build_system_instruction(
                dict(call_context), greeting, parent_history=parent_history,
            ),
            phase_guidance=render_positive_feedback_guidance(
                call_context.get("studentName", "student"),
                call_context.get("reason", "school matters"),
            ),
            manager_context=dict(call_context),
            ai_reveal_line=None,
            ai_reveal_pattern=AI_REVEAL_WORD_BOUNDED,
            opt_out_noted=lines["opt_out_noted"],
            goodbye=lines["goodbye"],
            future_calls=lines["future_calls"],
            uses_parent_history=True,
        )

    identity = model_identity(call_context)
    language = LANGUAGE_NAMES.get(lang_code, "English")
    greeting = lines["request_to_talk"]
    return CallPlan(
        mode=MODE_REQUEST_TO_TALK,
        lang_code=lang_code,
        greeting=greeting,
        system_instruction=build_request_to_talk_instruction(
            student_name=identity["studentName"],
            teacher_name=identity["teacherName"],
            school_name=identity["schoolName"],
            language=language,
            greeting=greeting,
            explain_in_person=lines["explain_in_person"],
        ),
        phase_guidance=render_request_to_talk_guidance(language, lines["explain_in_person"]),
        manager_context=dict(identity),
        # If the model's sentence trips the identity guard, re-ask for a time
        # in the call language instead of the Hindi "I am the teacher" line,
        # which would contradict an opening spoken on the teacher's behalf.
        ai_reveal_line=greeting,
        ai_reveal_pattern=AI_REVEAL_WORD_BOUNDED,
        opt_out_noted=lines["opt_out_noted"],
        goodbye=lines["goodbye"],
        future_calls=lines["future_calls"],
        uses_parent_history=False,
    )
