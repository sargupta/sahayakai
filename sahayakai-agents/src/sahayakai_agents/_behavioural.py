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
import unicodedata

# Round-2 audit P0 GUARD-1 fix (30-agent review, group A3): expanded
# forbidden-phrase coverage to catch:
# - apostrophe contractions: "I'm an AI", "I'm a bot", "I'm an assistant"
# - article-omitted variants: "I am AI" (no `a`/`an`)
# - spaced/joined forms: "Sahayak AI", "Sahayak.AI"
# - more synonyms: virtual agent, automated caller, digital helper,
#   ML model
# - Hindi transliteration variants of Sahayak: "Sahaayak", "Sahayek"
#
# Inputs are NFKC-normalized BEFORE matching to catch confusable
# Unicode variants (e.g. Cyrillic А that visually looks like Latin A).
# Round-2 audit P1 GUARD-5 fix (30-agent review, groups A3 + F6):
# Cyrillic / Greek / common-confusable letter folding so an attacker
# model can't bypass forbidden-phrase regex with visually-identical
# look-alikes (Cyrillic А = U+0410 vs Latin A = U+0041).
#
# This is the same conceptual approach as Unicode UTS #39 skeleton
# algorithm but pinned to the small set of confusables that appear in
# our forbidden phrases (mostly Latin letters). Conservative — we map
# only confusables for `[A-Za-z]` and skip the broader UTS #39 set.
#
# Build a translation table once; the regex match runs on the folded
# text but the user-visible error message preserves the original
# (so the reviewer can see the source bytes).
_CONFUSABLE_FOLD: dict[int, str] = {
    # Cyrillic uppercase that visually match Latin uppercase
    0x0410: "A", 0x0412: "B", 0x0415: "E", 0x041A: "K", 0x041C: "M",
    0x041D: "H", 0x041E: "O", 0x0420: "P", 0x0421: "C", 0x0422: "T",
    0x0425: "X", 0x0405: "S", 0x0406: "I", 0x0408: "J",
    # Cyrillic lowercase
    0x0430: "a", 0x0431: "b", 0x0435: "e", 0x043A: "k", 0x043C: "m",
    0x043D: "h", 0x043E: "o", 0x0440: "p", 0x0441: "c", 0x0442: "t",
    0x0443: "y", 0x0445: "x", 0x0455: "s", 0x0456: "i", 0x0458: "j",
    # Greek that visually match Latin
    0x0391: "A", 0x0392: "B", 0x0395: "E", 0x0396: "Z", 0x0397: "H",
    0x0399: "I", 0x039A: "K", 0x039C: "M", 0x039D: "N", 0x039F: "O",
    0x03A1: "P", 0x03A4: "T", 0x03A5: "Y", 0x03A7: "X",
    0x03B1: "a", 0x03B5: "e", 0x03B9: "i", 0x03BA: "k", 0x03BD: "v",
    0x03BF: "o", 0x03C1: "p", 0x03C4: "t", 0x03C5: "y", 0x03C7: "x",
    # Fullwidth (FF21-FF3A → A-Z, FF41-FF5A → a-z)
    **{0xFF21 + i: chr(0x41 + i) for i in range(26)},
    **{0xFF41 + i: chr(0x61 + i) for i in range(26)},
}


def _fold_confusables(text: str) -> str:
    """Replace Cyrillic / Greek / fullwidth letters that visually match
    Latin with their Latin equivalents. Idempotent."""
    return text.translate(_CONFUSABLE_FOLD)


_AI_TARGETS = r"(?:AI|bot|chat\s*bot|assistant|language\s+model)"
_FORBIDDEN_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bSahaa?yak(\s*\.?\s*AI)?\b", re.IGNORECASE),
    re.compile(rf"\bI\s*[''']?m\s+(?:an?\s+)?{_AI_TARGETS}\b", re.IGNORECASE),
    re.compile(rf"\bI\s+am\s+(?:an?\s+)?{_AI_TARGETS}\b", re.IGNORECASE),
    re.compile(r"\bartificial\s+intelligence\b", re.IGNORECASE),
    re.compile(r"\bvirtual\s+(?:agent|assistant|helper)\b", re.IGNORECASE),
    re.compile(r"\bautomated\s+(?:agent|caller|system)\b", re.IGNORECASE),
    re.compile(r"\bdigital\s+(?:agent|assistant|helper)\b", re.IGNORECASE),
    re.compile(r"\b(?:ML|machine\s+learning)\s+model\b", re.IGNORECASE),
)

# Round-2 audit P0 GUARD-2 fix (group A3): include `…` (U+2026
# ellipsis) and `。` (U+3002 CJK full stop) and `፧` (U+1367 Ethiopic)
# as sentence terminators. A model could emit a 30-clause monologue
# with ellipsis-only separation and bypass the sentence-count cap.
_SENTENCE_ENDERS = re.compile(r"[\.!?।॥…。]")

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
    # Round-2 audit P0 GUARD-3 + P1 GUARD-5 fix (group A3 + F6):
    # 1. NFKC-normalize: collapse compatibility variants (full-width,
    #    ligatures).
    # 2. Strip invisibles (ZWJ, ZWNJ, BOM) that defeat naive regex.
    # 3. Fold confusables (Cyrillic А, Greek Α, fullwidth Ａ → Latin A)
    #    so a homoglyph attacker can't bypass the regex.
    normalized = unicodedata.normalize("NFKC", text)
    normalized = re.sub(r"[\u200b-\u200d\ufeff]", "", normalized)
    normalized = _fold_confusables(normalized)
    for pattern in _FORBIDDEN_PATTERNS:
        hit = pattern.search(normalized)
        assert hit is None, f"Forbidden phrase matched: {hit.group(0)!r} in reply={text!r}"


def count_sentences(text: str) -> int:
    return len([s for s in _SENTENCE_ENDERS.split(text) if s.strip()])


def assert_sentence_count_in_range(text: str, lo: int = 1, hi: int = 5) -> None:
    n = count_sentences(text)
    assert lo <= n <= hi, f"Expected {lo}-{hi} sentences, got {n} in reply={text!r}"


def _is_alpha_for_script_check(cp: int) -> bool:
    """Round-2 audit P0 GUARD-4 fix (group B5): align with TS guard's
    NARROWER definition of alpha. Original Python used `str.isalpha()`
    which counts EVERY Unicode letter (Greek, Cyrillic, CJK, Arabic).
    The TS guard counts only ASCII A-Z/a-z + Latin-1 Supplement
    (0x00C0-0x024F) + Indic 0x0900-0x0DFF.

    A reply with Cyrillic injection had different alpha-totals across
    runtimes — same input could pass TS and fail Python (or vice versa).
    Aligning Python to the TS narrower set so byte-aligned drift goes
    away.
    """
    # ASCII A-Z / a-z
    if (0x0041 <= cp <= 0x005A) or (0x0061 <= cp <= 0x007A):
        return True
    # Latin-1 Supplement + Latin Extended-A/B
    if 0x00C0 <= cp <= 0x024F:
        return True
    # Indic block (Devanagari through Sinhala)
    return 0x0900 <= cp <= 0x0DFF


def assert_script_matches_language(text: str, language: str) -> None:
    ranges = _LANGUAGE_UNICODE_RANGES.get(language)
    if not ranges:
        return
    # Normalize NFC so combining-mark variants (Devanagari nukta etc.)
    # collapse to canonical codepoints inside our Unicode ranges.
    normalized = unicodedata.normalize("NFC", text)
    in_range = 0
    alpha_total = 0
    for ch in normalized:
        cp = ord(ch)
        if not _is_alpha_for_script_check(cp):
            continue
        alpha_total += 1
        if any(lo <= cp <= hi for lo, hi in ranges):
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
