"""Localised VIDYA acknowledgements (root cause 1).

The bug: three hardcoded English sentences were returned regardless of the
teacher's language. `assert_script_matches_language` requires >=85% of letters
in the target Unicode block and is fail-closed, so every non-English request
returned HTTP 502 — 60 of 99 parity cells.

The load-bearing test here is `test_every_string_passes_the_script_guard`. A
test asserting only "returns a non-empty string" would have passed with the bug
fully present, which is exactly how this survived to production.
"""

from __future__ import annotations

import unicodedata

import pytest

from sahayakai_agents._behavioural import assert_script_matches_language
from sahayakai_agents.agents.vidya.acknowledgements import (
    ACKNOWLEDGEMENTS,
    SUPPORTED_LANGUAGES,
    get_acknowledgement,
)

pytestmark = pytest.mark.unit

KINDS = ("routing", "route_failed", "unknown")

# Same blocks the behavioural guard uses.
SCRIPT_RANGES = {
    "en": [(0x0041, 0x005A), (0x0061, 0x007A)],
    "hi": [(0x0900, 0x097F)],
    "mr": [(0x0900, 0x097F)],
    "bn": [(0x0980, 0x09FF)],
    "pa": [(0x0A00, 0x0A7F)],
    "gu": [(0x0A80, 0x0AFF)],
    "or": [(0x0B00, 0x0B7F)],
    "ta": [(0x0B80, 0x0BFF)],
    "te": [(0x0C00, 0x0C7F)],
    "kn": [(0x0C80, 0x0CFF)],
    "ml": [(0x0D00, 0x0D7F)],
}


def script_ratio(text: str, lang: str) -> float:
    ranges = SCRIPT_RANGES[lang]
    letters = [c for c in text if unicodedata.category(c).startswith("L")]
    assert letters, f"no letters in {lang!r} string: {text!r}"
    return sum(1 for c in letters if any(lo <= ord(c) <= hi for lo, hi in ranges)) / len(letters)


class TestCoverage:
    def test_all_eleven_languages_present(self) -> None:
        assert set(SUPPORTED_LANGUAGES) == {
            "en",
            "hi",
            "bn",
            "ta",
            "te",
            "mr",
            "gu",
            "kn",
            "ml",
            "pa",
            "or",
        }

    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    def test_every_language_has_every_kind(self, lang: str) -> None:
        for kind in KINDS:
            text = ACKNOWLEDGEMENTS[lang][kind]
            assert text.strip(), f"{lang}/{kind} is empty"


class TestScriptCorrectness:
    """The actual bug. Everything else is hygiene."""

    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    @pytest.mark.parametrize("kind", KINDS)
    def test_every_string_is_in_its_own_script(self, lang: str, kind: str) -> None:
        text = ACKNOWLEDGEMENTS[lang][kind]
        ratio = script_ratio(text, lang)
        assert ratio >= 0.85, (
            f"{lang}/{kind} is only {ratio:.0%} {lang} script — the behavioural "
            f"guard will reject it and the request will 502. Text: {text!r}"
        )

    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    @pytest.mark.parametrize("kind", KINDS)
    def test_every_string_passes_the_script_guard(self, lang: str, kind: str) -> None:
        """Run the production guard itself, not a reimplementation of it."""
        assert_script_matches_language(ACKNOWLEDGEMENTS[lang][kind], lang)

    def test_hindi_and_marathi_differ(self) -> None:
        """Both are Devanagari, so a copy-paste slip would pass the script check.
        They are different languages and must read differently."""
        for kind in KINDS:
            assert ACKNOWLEDGEMENTS["hi"][kind] != ACKNOWLEDGEMENTS["mr"][kind]


class TestLength:
    @pytest.mark.parametrize("lang", SUPPORTED_LANGUAGES)
    @pytest.mark.parametrize("kind", KINDS)
    def test_within_the_guard_word_bounds(self, lang: str, kind: str) -> None:
        words = len(ACKNOWLEDGEMENTS[lang][kind].split())
        assert 1 <= words <= 250, f"{lang}/{kind} has {words} words"


class TestLookup:
    def test_exact_code(self) -> None:
        assert get_acknowledgement("routing", "hi") == ACKNOWLEDGEMENTS["hi"]["routing"]

    def test_none_falls_back_to_english(self) -> None:
        """`detectedLanguage` is genuinely optional on the wire."""
        assert get_acknowledgement("routing", None) == ACKNOWLEDGEMENTS["en"]["routing"]

    @pytest.mark.parametrize("bad", ["", "   ", "zz", "klingon", "xx-YY"])
    def test_unknown_code_falls_back_to_english_and_never_raises(self, bad: str) -> None:
        """English is wrong-but-safe; wrong-script would 502."""
        assert get_acknowledgement("routing", bad) == ACKNOWLEDGEMENTS["en"]["routing"]

    @pytest.mark.parametrize(
        "tag,expected", [("hi-IN", "hi"), ("bn_IN", "bn"), ("TA-in", "ta"), ("  or  ", "or")]
    )
    def test_bcp47_and_messy_input_normalise(self, tag: str, expected: str) -> None:
        assert get_acknowledgement("routing", tag) == ACKNOWLEDGEMENTS[expected]["routing"]
