"""Behavioural guard for the parent-message-generator agent.

Phase C §C.3. Self-contained: shared rules (forbidden phrase, script
match) imported from `_behavioural.py`; agent-specific rules (length,
languageCode shape) live here.
"""
from __future__ import annotations

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)
from .agent import LANGUAGE_TO_BCP47, LANGUAGE_TO_ISO

# Per the Genkit prompt: messages MUST be under 250 words. We add a
# floor of 15 (catches "ok thanks" model failures while accepting a
# short Tamil / Hindi message that's naturally terse — Devanagari
# words are individually denser than English so a 15-word message
# still has substance) and a 50-word ceiling buffer above the
# prompt's stated 250 max for natural variance.
PARENT_MESSAGE_MIN_WORDS = 15
PARENT_MESSAGE_MAX_WORDS = 300


def assert_parent_message_length(message_text: str) -> None:
    """Cap the message at the SMS / phone-call read budget."""
    word_count = len(message_text.split())
    assert PARENT_MESSAGE_MIN_WORDS <= word_count <= PARENT_MESSAGE_MAX_WORDS, (
        f"Parent message length out of range: {word_count} words "
        f"(expected {PARENT_MESSAGE_MIN_WORDS}-{PARENT_MESSAGE_MAX_WORDS})"
    )


def assert_language_code_shape(language_code: str) -> None:
    """The model is told to return a BCP-47 code but we overwrite it
    server-side from `LANGUAGE_TO_BCP47`. This guard is the last line
    of defence — rejects clearly malformed codes (defends downstream
    TTS clients that key off the code).
    """
    assert language_code in LANGUAGE_TO_BCP47.values(), (
        f"Parent message languageCode {language_code!r} is not in the "
        f"hardcoded LANGUAGE_TO_BCP47 set; refusing to serve."
    )


def assert_parent_message_response_rules(
    *,
    message_text: str,
    parent_language_name: str,
    language_code: str,
) -> None:
    """Composite assertion. Fail-closed: any failure → 502 in the router.

    Four checks:
      - **forbidden phrases** — same hardened set as parent-call /
        lesson-plan / vidya / instant-answer.
      - **script match** — Unicode-range check against the parent's
        ISO language. Translates the language NAME (e.g. "Hindi") into
        the ISO code the shared helper expects (e.g. "hi").
      - **length** — 30-300 words.
      - **languageCode shape** — must be one of the hardcoded
        BCP-47 codes.
    """
    iso = LANGUAGE_TO_ISO.get(parent_language_name, "en")
    assert_no_forbidden_phrases(message_text)
    assert_script_matches_language(message_text, iso)
    assert_parent_message_length(message_text)
    assert_language_code_shape(language_code)


__all__ = [
    "PARENT_MESSAGE_MAX_WORDS",
    "PARENT_MESSAGE_MIN_WORDS",
    "assert_language_code_shape",
    "assert_parent_message_length",
    "assert_parent_message_response_rules",
]
