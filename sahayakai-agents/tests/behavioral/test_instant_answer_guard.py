"""Behavioural tests for the instant-answer post-generation guard.

Phase B §B.2.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.instant_answer._guard import (
    INSTANT_ANSWER_MAX_WORDS,
    INSTANT_ANSWER_MIN_WORDS,
    assert_instant_answer_length,
    assert_instant_answer_response_rules,
    assert_instant_answer_video_url_shape,
)

pytestmark = pytest.mark.behavioral


# ── Length bounds ─────────────────────────────────────────────────────────


class TestInstantAnswerLength:
    def test_minimum_length_passes(self) -> None:
        assert_instant_answer_length(
            " ".join(["word"] * INSTANT_ANSWER_MIN_WORDS),
        )

    def test_maximum_length_passes(self) -> None:
        assert_instant_answer_length(
            " ".join(["word"] * INSTANT_ANSWER_MAX_WORDS),
        )

    def test_below_minimum_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_instant_answer_length("ok")

    def test_above_maximum_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_instant_answer_length(
                " ".join(["word"] * (INSTANT_ANSWER_MAX_WORDS + 50)),
            )


# ── YouTube search URL shape ──────────────────────────────────────────────


class TestVideoUrlShape:
    def test_none_passes(self) -> None:
        assert_instant_answer_video_url_shape(None)

    def test_valid_search_url_passes(self) -> None:
        assert_instant_answer_video_url_shape(
            "https://www.youtube.com/results?search_query=photosynthesis+for+class+5",
        )

    def test_specific_video_id_rejects(self) -> None:
        # Gemini sometimes hallucinates video IDs that don't exist —
        # reject the watch?v=... form on principle.
        with pytest.raises(AssertionError, match="search-results URL form"):
            assert_instant_answer_video_url_shape(
                "https://www.youtube.com/watch?v=fakeId123",
            )

    def test_empty_search_query_rejects(self) -> None:
        with pytest.raises(AssertionError, match="empty search query"):
            assert_instant_answer_video_url_shape(
                "https://www.youtube.com/results?search_query=",
            )

    def test_too_long_rejects(self) -> None:
        long_url = (
            "https://www.youtube.com/results?search_query=" + ("x" * 500)
        )
        with pytest.raises(AssertionError, match="too long"):
            assert_instant_answer_video_url_shape(long_url)

    def test_non_youtube_url_rejects(self) -> None:
        with pytest.raises(AssertionError, match="search-results URL form"):
            assert_instant_answer_video_url_shape(
                "https://example.com/search?q=photosynthesis",
            )


# ── Composite assert_instant_answer_response_rules ───────────────────────


class TestInstantAnswerResponseRules:
    def test_clean_english_with_video_passes(self) -> None:
        assert_instant_answer_response_rules(
            answer_text=(
                "Photosynthesis is the process plants use to make food "
                "from sunlight, water, and carbon dioxide. The leaves "
                "capture sunlight using chlorophyll, the green pigment."
            ),
            language="en",
            video_suggestion_url=(
                "https://www.youtube.com/results?search_query=photosynthesis+for+class+5"
            ),
        )

    def test_clean_english_without_video_passes(self) -> None:
        assert_instant_answer_response_rules(
            answer_text=(
                "Mathematics is the study of numbers, shapes, and patterns. "
                "It helps us understand the world."
            ),
            language="en",
            video_suggestion_url=None,
        )

    def test_forbidden_phrase_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_instant_answer_response_rules(
                answer_text=(
                    "I am an AI assistant. Let me explain photosynthesis to you."
                ),
                language="en",
                video_suggestion_url=None,
            )

    def test_apostrophe_contraction_caught(self) -> None:
        with pytest.raises(AssertionError):
            assert_instant_answer_response_rules(
                answer_text=(
                    "I'm an AI tutor here to help. Photosynthesis is a "
                    "process plants use to grow."
                ),
                language="en",
                video_suggestion_url=None,
            )

    def test_too_short_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_instant_answer_response_rules(
                answer_text="Yes.",
                language="en",
                video_suggestion_url=None,
            )

    def test_too_long_rejects(self) -> None:
        text = " ".join(["word"] * (INSTANT_ANSWER_MAX_WORDS + 100))
        with pytest.raises(AssertionError, match="out of range"):
            assert_instant_answer_response_rules(
                answer_text=text,
                language="en",
                video_suggestion_url=None,
            )

    def test_hindi_devanagari_passes(self) -> None:
        # Hindi response in Devanagari script — script-match passes
        assert_instant_answer_response_rules(
            answer_text=(
                "प्रकाश संश्लेषण वह प्रक्रिया है जिसके द्वारा "
                "हरे पौधे सूर्य के प्रकाश पानी और कार्बन डाइऑक्साइड "
                "का उपयोग करके अपना भोजन बनाते हैं।"
            ),
            language="hi",
            video_suggestion_url=None,
        )

    def test_hindi_response_in_english_script_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Script mismatch"):
            assert_instant_answer_response_rules(
                answer_text=(
                    "Photosynthesis is the process plants use to make food. "
                    "The leaves capture sunlight using chlorophyll pigment."
                ),
                language="hi",
                video_suggestion_url=None,
            )

    def test_unsupported_language_skips_script_check(self) -> None:
        # Unknown language code → script check no-op (same as siblings)
        assert_instant_answer_response_rules(
            answer_text=(
                "Mathematics is the study of patterns and numbers. "
                "It is fundamental to science."
            ),
            language="xyz",
            video_suggestion_url=None,
        )

    def test_invalid_video_url_rejects(self) -> None:
        with pytest.raises(AssertionError, match="search-results URL form"):
            assert_instant_answer_response_rules(
                answer_text=(
                    "Photosynthesis is how plants make food. Green leaves "
                    "use sunlight to convert water into glucose."
                ),
                language="en",
                video_suggestion_url="https://example.com/totally-real-video",
            )
