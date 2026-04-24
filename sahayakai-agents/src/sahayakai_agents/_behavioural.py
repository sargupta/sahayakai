"""Shared behavioural assertion helpers used by both the router (post-response
guard, fail-closed) and the test suite (validation, fail-open/informational).

These helpers encode the pedagogical guarantees that must hold regardless
of model or prompt version:

- Never reveal that the agent is an AI / bot / "Sahayak" / "SahayakAI".
- Keep replies to a small number of short sentences (phone call, not essay).
- Write in the correct Unicode script for the parent's language.

Review trace:
- P0 #5 forbidden-phrase scan.
- P0 #6 per-language Unicode script check.
- P1 #17 sentence-count bound.

Imported from both:
- `agents/parent_call/router.py` (production path, fail-closed on assertion)
- `tests/behavioral/test_identity_rules.py` (test path, smoke asserts)
"""
from __future__ import annotations

import re

_FORBIDDEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bSahayak(AI)?\b", re.IGNORECASE),
    re.compile(r"\bI\s+am\s+an?\s+AI\b", re.IGNORECASE),
    re.compile(r"\bI\s+am\s+a\s+(bot|chat\s*bot|assistant|language\s+model)\b", re.IGNORECASE),
    re.compile(r"\bartificial\s+intelligence\b", re.IGNORECASE),
)

_SENTENCE_ENDERS = re.compile(r"[\.!?।॥]")

# Expected Unicode ranges per supported parent language.
_LANGUAGE_UNICODE_RANGES: dict[str, tuple[tuple[int, int], ...]] = {
    "hi": ((0x0900, 0x097F),),   # Devanagari
    "bn": ((0x0980, 0x09FF),),   # Bengali
    "te": ((0x0C00, 0x0C7F),),   # Telugu
    "ta": ((0x0B80, 0x0BFF),),   # Tamil
    "kn": ((0x0C80, 0x0CFF),),   # Kannada
    "ml": ((0x0D00, 0x0D7F),),   # Malayalam
    "gu": ((0x0A80, 0x0AFF),),   # Gujarati
    "pa": ((0x0A00, 0x0A7F),),   # Gurmukhi
    "mr": ((0x0900, 0x097F),),   # Devanagari (shared with Hindi)
    "or": ((0x0B00, 0x0B7F),),   # Odia
    "en": (                      # Latin
        (0x0020, 0x007F),
        (0x00A0, 0x00FF),
        (0x2000, 0x206F),
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
        return
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
    # Allow up to 15% out-of-script alpha chars for code-switching.
    assert ratio >= 0.85, (
        f"Script mismatch for {language!r}: only {ratio:.0%} alpha chars in expected range"
    )


def assert_all_rules(*, reply: str, parent_language: str, turn_number: int) -> None:
    """Composite assertion called by the router post-response guard.

    `turn_number` is unused today but kept in the signature so we can add
    turn-specific rules (e.g. mandatory wrap-up tone at turn >= 5) without
    churning call sites.
    """
    assert_no_forbidden_phrases(reply)
    assert_sentence_count_in_range(reply, 1, 5)
    assert_script_matches_language(reply, parent_language)
