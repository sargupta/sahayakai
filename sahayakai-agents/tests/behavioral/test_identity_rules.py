"""Behavioral tests — the rules the parent-call agent MUST obey regardless of
wrapper or model version.

The helper implementations live in `sahayakai_agents._behavioural` so the
router can import and apply them as a fail-closed post-response guard
(G5). This file tests those helpers and parametrises over the canonical
allowed-language list so a new regression would fire immediately.

Review trace:
- P0 #5 forbidden-phrase ("never say Sahayak/AI/bot").
- P1 #17 sentence count (1-5 short sentences, telephony bound).
- P0 #6 script correctness per language.
"""
from __future__ import annotations

import pytest

from sahayakai_agents._behavioural import (
    assert_all_rules,
    assert_no_forbidden_phrases,
    assert_script_matches_language,
    assert_sentence_count_in_range,
    count_sentences,
)

pytestmark = pytest.mark.behavioral


# ---- Forbidden-phrase guard -----------------------------------------------


class TestForbiddenPhrases:
    @pytest.mark.parametrize(
        "bad",
        [
            "Main SahayakAI se bol raha hoon",
            "I am an AI assistant from your school",
            "I am a bot helping the teacher",
            "Hello, I'm Sahayak from the principal's office",
            "This is an artificial intelligence service",
        ],
    )
    def test_rejects(self, bad: str) -> None:
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases(bad)

    # Phase J §J.3 — extended attack-vector coverage. P0 #5: the
    # original confusable fold table only covered Cyrillic / Greek /
    # fullwidth. Mathematical Alphanumeric (U+1D400+) and Cherokee
    # bypassed the regex.

    def test_mathematical_bold_letters_are_caught(self) -> None:
        """Reply '𝐈 𝐚𝐦 𝐚𝐧 𝐀𝐈' — Mathematical Bold (U+1D400+)
        — should trip the forbidden-phrase scan after the extended
        fold table catches the confusables."""
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases(
                "\U0001D408 \U0001D41A\U0001D426 "
                "\U0001D41A\U0001D427 \U0001D400\U0001D408"
            )

    def test_mathematical_italic_letters_are_caught(self) -> None:
        """Reply '𝐼 𝑎𝑚 𝑎𝑛 𝐴𝐼' — Mathematical Italic block."""
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases(
                "\U0001D43C \U0001D44E\U0001D45A "
                "\U0001D44E\U0001D45B \U0001D434\U0001D43C"
            )

    def test_cherokee_letters_are_caught(self) -> None:
        """Reply that uses Cherokee S (U+13DA) to hide 'Sahayak AI'.
        Cherokee letters are NOT folded by NFKC — they bypassed the
        original fold table and only the Phase J §J.3 extension
        catches them."""
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases("\u13DAahayak AI")

    def test_split_letter_injection_is_caught(self) -> None:
        """Reply 'I  a m   A I  a s s i s t a n t' — split-letter
        injection. The compact-pattern second pass should catch this
        after the run-detection re-glues the run."""
        with pytest.raises(AssertionError):
            assert_no_forbidden_phrases("I  a m   A I  a s s i s t a n t")

    @pytest.mark.parametrize(
        "good",
        [
            "Namaste ji, main school se bol raha hoon.",
            "Hello, I'm calling from Aravindh's school about his homework.",
            "नमस्ते, मैं स्कूल से बोल रहा हूँ।",
            "বাবা, স্কুল থেকে ফোন করেছি",
        ],
    )
    def test_accepts(self, good: str) -> None:
        assert_no_forbidden_phrases(good)


# ---- Sentence-count guard -------------------------------------------------


class TestSentenceCount:
    def test_count_hindi_devanagari(self) -> None:
        assert count_sentences("नमस्ते। कैसे हैं? आज कैसा रहा।") == 3

    def test_count_english(self) -> None:
        assert count_sentences("Hello. How is Arav doing? He seems well.") == 3

    def test_bounds_pass(self) -> None:
        assert_sentence_count_in_range(
            "Namaste ji. How is Arav doing? All is well.", 1, 5
        )

    def test_bounds_reject_too_many(self) -> None:
        with pytest.raises(AssertionError):
            assert_sentence_count_in_range("a. b. c. d. e. f.", 1, 4)

    def test_ascii_ellipsis_counts_as_one_ender(self) -> None:
        # `...` is a single stylistic pause, not three sentence breaks.
        # Pre-collapse to U+2026 keeps the char-class regex honest.
        assert count_sentences("Wait... think... act.") == 3
        assert count_sentences("No way...") == 1
        assert count_sentences("I think... that works.") == 2

    def test_unicode_ellipsis_equivalent(self) -> None:
        # `…` (U+2026) and `...` should produce the same count.
        assert count_sentences("a... b") == count_sentences("a… b")
        assert count_sentences("Wait... go.") == count_sentences("Wait… go.")


# ---- Script-correctness guard ---------------------------------------------


class TestScriptCorrectness:
    """One accept + one reject per supported language. Per P0 #6, 11 codes."""

    ACCEPT: dict[str, str] = {
        "hi": "नमस्ते जी, आप कैसे हैं?",
        "bn": "নমস্কার, আপনি কেমন আছেন?",
        "ta": "வணக்கம், நீங்கள் எப்படி இருக்கிறீர்கள்?",
        "te": "నమస్కారం, మీరు ఎలా ఉన్నారు?",
        "kn": "ನಮಸ್ಕಾರ, ನೀವು ಹೇಗಿದ್ದೀರಿ?",
        "ml": "നമസ്കാരം, സുഖമാണോ?",
        "gu": "નમસ્તે, તમે કેમ છો?",
        "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ",
        "mr": "नमस्कार, तुम्ही कसे आहात?",
        "or": "ନମସ୍କାର",
        "en": "Hello, how are you today?",
    }

    @pytest.mark.parametrize("lang,text", list(ACCEPT.items()))
    def test_accepts_correct_script(self, lang: str, text: str) -> None:
        assert_script_matches_language(text, lang)

    @pytest.mark.parametrize("lang", [k for k in ACCEPT if k != "en"])
    def test_rejects_latin_in_indic_slot(self, lang: str) -> None:
        with pytest.raises(AssertionError):
            assert_script_matches_language(
                "Hello sir, how are you doing today?", lang
            )


# ---- Composite gate -------------------------------------------------------


class TestAssertAllRules:
    """The single call site used by the router post-response guard."""

    def test_happy_path_english(self) -> None:
        assert_all_rules(
            reply="Hello. How is Arav doing? All is well.",
            parent_language="en",
            turn_number=1,
        )

    def test_happy_path_hindi(self) -> None:
        assert_all_rules(
            reply="नमस्ते जी। अरव कैसा है? बताइए।",
            parent_language="hi",
            turn_number=2,
        )

    def test_rejects_identity_leak_mid_call(self) -> None:
        with pytest.raises(AssertionError):
            assert_all_rules(
                reply="I am an AI assistant from Arav's school. All is well.",
                parent_language="en",
                turn_number=3,
            )

    def test_rejects_script_drift(self) -> None:
        with pytest.raises(AssertionError):
            assert_all_rules(
                reply="Hello sir, Arav is doing well at school.",
                parent_language="hi",
                turn_number=2,
            )
