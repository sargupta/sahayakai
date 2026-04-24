"""Behavioral tests — the rules the parent-call agent MUST obey regardless of
wrapper or model version.

These are PEDAGOGICAL GUARDRAILS. They run against real (mocked-model)
responses at the router level. Skipped until the agent is wired in G5.

Review trace:
- P0 #5 forbidden-phrase ("never say Sahayak/AI/bot").
- P1 #17 sentence count (2-4 short sentences).
- P1 #18 summary language = English regardless of parent language.
- P0 #8 turn-5/turn-6 wrap-up / hard-stop.
- P0 #6 script correctness per language.
"""
from __future__ import annotations

import re
from typing import Iterable

import pytest


pytestmark = pytest.mark.behavioral


# Words/phrases the agent must NEVER say. Expanded in behavioral tests.
_FORBIDDEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bSahayak(AI)?\b", re.IGNORECASE),
    re.compile(r"\bI\s+am\s+an?\s+AI\b", re.IGNORECASE),
    re.compile(r"\bI\s+am\s+a\s+(bot|chat\s*bot|assistant|language\s+model)\b", re.IGNORECASE),
    re.compile(r"\bartificial\s+intelligence\b", re.IGNORECASE),
)


# Sentence-end punctuation across Indic languages.
_SENTENCE_ENDERS = re.compile(r"[\.!?।॥]")


# Expected Unicode ranges per language. Used to assert the model wrote in the
# right script. See §Glossary in ARCHITECTURE.md.
_LANGUAGE_UNICODE_RANGES: dict[str, tuple[tuple[int, int], ...]] = {
    "hi": ((0x0900, 0x097F),),                       # Devanagari
    "bn": ((0x0980, 0x09FF),),                       # Bengali
    "te": ((0x0C00, 0x0C7F),),                       # Telugu
    "ta": ((0x0B80, 0x0BFF),),                       # Tamil
    "kn": ((0x0C80, 0x0CFF),),                       # Kannada
    "ml": ((0x0D00, 0x0D7F),),                       # Malayalam
    "gu": ((0x0A80, 0x0AFF),),                       # Gujarati
    "pa": ((0x0A00, 0x0A7F),),                       # Gurmukhi
    "mr": ((0x0900, 0x097F),),                       # Devanagari (shared with Hindi)
    "or": ((0x0B00, 0x0B7F),),                       # Odia
    "en": (                                          # Latin alphabet only
        (0x0020, 0x007F),
        (0x00A0, 0x00FF),
        (0x2000, 0x206F),  # general punctuation
    ),
}


def assert_no_forbidden_phrases(text: str) -> None:
    for pattern in _FORBIDDEN_PATTERNS:
        hit = pattern.search(text)
        assert hit is None, f"Forbidden phrase matched: {hit.group(0)!r} in reply={text!r}"


def count_sentences(text: str) -> int:
    return len([s for s in _SENTENCE_ENDERS.split(text) if s.strip()])


def assert_sentence_count_in_range(text: str, lo: int = 1, hi: int = 5) -> None:
    n = count_sentences(text)
    assert lo <= n <= hi, f"Expected {lo}-{hi} sentences, got {n} in reply={text!r}"


def assert_script_matches_language(text: str, language: str) -> None:
    ranges = _LANGUAGE_UNICODE_RANGES.get(language)
    if not ranges:
        return  # language we don't enforce script for
    in_range = 0
    alpha_total = 0
    for ch in text:
        if ch.isalpha() or 0x0900 <= ord(ch) <= 0x0DFF:
            alpha_total += 1
            if any(lo <= ord(ch) <= hi for lo, hi in ranges):
                in_range += 1
    if alpha_total == 0:
        return
    ratio = in_range / alpha_total
    # Allow up to 15% out-of-script alphabetic chars for code-switching
    # (common in Hinglish etc).
    assert ratio >= 0.85, (
        f"Script mismatch for {language!r}: only {ratio:.0%} alpha chars in expected range"
    )


# --- Placeholder tests: wire to real agent in G5 --------------------------


@pytest.mark.skip(reason="Agent wiring lands in G5; this test lives here as the gate definition.")
def test_reply_never_contains_forbidden_phrases() -> None:
    ...


@pytest.mark.skip(reason="Agent wiring lands in G5.")
def test_reply_sentence_count_within_bounds() -> None:
    ...


@pytest.mark.skip(reason="Agent wiring lands in G5.")
def test_turn_6_forces_should_end_call_true() -> None:
    ...


@pytest.mark.skip(reason="Agent wiring lands in G5.")
def test_summary_language_is_always_english() -> None:
    ...


class TestHelpersSmoke:
    """Validate the assertion helpers themselves before we rely on them."""

    def test_forbidden_catches_sahayakai(self) -> None:
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases("Main SahayakAI se bol raha hoon")

    def test_forbidden_allows_normal_warm_reply(self) -> None:
        assert_no_forbidden_phrases("Namaste ji, main school se bol raha hoon.")

    def test_sentence_count_hindi(self) -> None:
        assert_sentence_count_in_range("नमस्ते। कैसे हैं? आज कैसा रहा।", 2, 4)

    def test_sentence_count_rejects_too_many(self) -> None:
        with pytest.raises(AssertionError):
            assert_sentence_count_in_range("a. b. c. d. e. f.", 1, 4)

    def test_script_accepts_devanagari(self) -> None:
        assert_script_matches_language("नमस्ते, आप कैसे हैं?", "hi")

    def test_script_rejects_english_in_hindi_slot(self) -> None:
        with pytest.raises(AssertionError):
            assert_script_matches_language(
                "Hello sir, how are you doing today?", "hi"
            )


# Utility used by parity tests later.
def assert_all_rules(reply: str, parent_language: str, turn_number: int) -> None:
    """Aggregate assertion — a single per-reply gate.

    Callers pass in the real model output. In G5+ this is invoked by the
    router's post-response validation (fail-closed) as well as by the
    parity test suite (fail-informational).
    """
    assert_no_forbidden_phrases(reply)
    assert_sentence_count_in_range(reply, 1, 5)
    assert_script_matches_language(reply, parent_language)
