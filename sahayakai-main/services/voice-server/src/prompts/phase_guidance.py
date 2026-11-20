"""
Per-phase guidance the PhaseInstructor appends to the model's context.

Pure on purpose: no pipecat, no SDKs. conversation_state.PhaseInstructor (which
needs pipecat) only looks rendered strings up by phase; everything that decides
WHAT the model is told lives here, where the tests can read it.

Two tables, chosen per call by call_policy.plan_call:

  POSITIVE_FEEDBACK_GUIDANCE  the engine's original table, byte for byte. Only a
                              positive_feedback call still uses it.
  REQUEST_TO_TALK_GUIDANCE    every other call. It has no placeholder for the
                              student, the reason or anything else from the
                              outreach record, so nothing about the concern can
                              reach the model through it.
"""

from __future__ import annotations

# Prefix for phase instructions — used to filter them out of transcripts.
PHASE_INSTRUCTION_PREFIX = "[Guide"

# Phase keys are ConversationPhase values (conversation_state.py).
PHASES = ("opening", "explore", "advise", "close")

# Soft guidance per phase. These are hints, not scripts.
# The LLM's system prompt already has the persona and rules —
# these just nudge "what to focus on THIS turn."
#
# Key design: every instruction includes "If parent brings up something
# else, address THAT instead" — so the LLM never ignores real concerns
# to follow a script.
POSITIVE_FEEDBACK_GUIDANCE: dict[str, str] = {
    "opening": (
        "{prefix}: Parent just responded to your greeting. "
        "Your greeting ALREADY mentioned {student_name} and the reason ({reason}). "
        "STAY ON TOPIC — do NOT change subject or ask unrelated questions like "
        "'ghar pe sab theek hai'. Follow up DIRECTLY on the topic you introduced. "
        "For attendance: ask if the child was ill or when they'll return. "
        "For exam/studies: ask whether studying happens at home, frame as 'difficulty', never state the exact score. "
        "For behavior: ask how the child is at home, frame as 'I wanted to discuss', never say 'complaint'. "
        "For homework/fees: address homework first; fees as a separate, gentle mention. "
        "Speak in the parent's language. If parent already started sharing something, respond to THAT. "
        "NEVER ask 'how can I help' — you called them.]"
    ),
    "explore": (
        "{prefix}: You're understanding the situation. "
        "STAY ON TOPIC — keep discussing {reason}. "
        "Listen and acknowledge warmly in the parent's language. "
        "If they shared a real problem (health, money, family), show empathy first. "
        "If defensive, don't argue — say you want to work together. "
        "If embarrassed, reassure gently. "
        "Ask ONE follow-up about {student_name} if needed, or move to suggestion. "
        "If parent brings up something unrelated, briefly acknowledge, then return to {reason}.]"
    ),
    "advise": (
        "{prefix}: You understand the situation now. "
        "Give ONE practical suggestion connected to {reason}. "
        "Academic: offer extra class or a home routine. "
        "Behavior: suggest a short meeting at school to work together. "
        "Fees: offer to speak with the principal, reassure. "
        "Homework: suggest a daily routine or offer to check in. "
        "If parent raised a concern, address it. Then ask if there's anything else. "
        "If parent says no or sounds ready to end, wrap up next turn.]"
    ),
    "close": (
        "{prefix}: Wrap up the call NOW in ONE short sentence in parent's language. "
        "Thank them warmly, mention {student_name} positively, say goodbye naturally. "
        "Do NOT ask any more questions. Do NOT start a new topic. "
        "If parent raises a NEW concern, briefly acknowledge, then STILL close.]"
    ),
}

# Request-to-talk calls. The only placeholders are the prefix, the call
# language and the fixed "explain in person" sentence from call_lines.json.
REQUEST_TO_TALK_GUIDANCE: dict[str, str] = {
    "opening": (
        "{prefix}: The parent just answered your request. Reply in {language}, ONE short sentence. "
        "If they gave a time, thank them and repeat the time back. "
        "If now is not good, ask when this week would suit them. "
        "If they ask why or guess a reason, do not confirm or deny anything; say exactly: \"{explain_in_person}\"]"
    ),
    "explore": (
        "{prefix}: Settle on a time this week for the class teacher to call. Reply in {language}, ONE short sentence. "
        "Never talk about what the teacher wants to discuss; if asked, say exactly: \"{explain_in_person}\"]"
    ),
    "advise": (
        "{prefix}: If a time is agreed, confirm it and say the class teacher will call then. "
        "If no time is agreed, say the class teacher will try again this week. Reply in {language}, ONE short sentence. "
        "Do not discuss the reason for the call.]"
    ),
    "close": (
        "{prefix}: Wrap up NOW in ONE short sentence in {language}: thank them and say goodbye. "
        "Do NOT ask any more questions. Do NOT start a new topic.]"
    ),
}


def render_positive_feedback_guidance(student_name: object, reason: object) -> dict[str, str]:
    """The original table, rendered exactly as PhaseInstructor used to per frame."""
    return {
        phase: template.format(
            prefix=PHASE_INSTRUCTION_PREFIX,
            student_name=student_name,
            reason=reason,
        )
        for phase, template in POSITIVE_FEEDBACK_GUIDANCE.items()
    }


def render_request_to_talk_guidance(language: str, explain_in_person: str) -> dict[str, str]:
    """Request-to-talk table. Takes no call-record field at all."""
    return {
        phase: template.format(
            prefix=PHASE_INSTRUCTION_PREFIX,
            language=language,
            explain_in_person=explain_in_person,
        )
        for phase, template in REQUEST_TO_TALK_GUIDANCE.items()
    }
