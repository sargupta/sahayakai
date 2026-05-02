"""Behavioural tests for the parent-message post-generation guard.

Phase C §C.3.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.parent_message._guard import (
    PARENT_MESSAGE_MAX_WORDS,
    PARENT_MESSAGE_MIN_WORDS,
    assert_language_code_shape,
    assert_parent_message_length,
    assert_parent_message_response_rules,
)

pytestmark = pytest.mark.behavioral


class TestParentMessageLength:
    def test_minimum_passes(self) -> None:
        assert_parent_message_length(" ".join(["word"] * PARENT_MESSAGE_MIN_WORDS))

    def test_maximum_passes(self) -> None:
        assert_parent_message_length(" ".join(["word"] * PARENT_MESSAGE_MAX_WORDS))

    def test_below_minimum_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_parent_message_length("hi")

    def test_above_maximum_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_parent_message_length(
                " ".join(["word"] * (PARENT_MESSAGE_MAX_WORDS + 50)),
            )


class TestLanguageCodeShape:
    def test_each_valid_code_passes(self) -> None:
        for code in [
            "en-IN", "hi-IN", "ta-IN", "te-IN", "kn-IN", "ml-IN",
            "bn-IN", "mr-IN", "gu-IN", "pa-IN", "or-IN",
        ]:
            assert_language_code_shape(code)

    def test_invalid_code_rejects(self) -> None:
        with pytest.raises(AssertionError, match="LANGUAGE_TO_BCP47"):
            assert_language_code_shape("xx-XX")

    def test_empty_rejects(self) -> None:
        with pytest.raises(AssertionError):
            assert_language_code_shape("")


class TestParentMessageResponseRules:
    def test_clean_english_passes(self) -> None:
        assert_parent_message_response_rules(
            message_text=(
                "Dear parent, I am writing to share that Arav has been "
                "absent for four days this week. We hope everything is "
                "fine at home and would love to support you in any way "
                "we can. Please feel free to reach out. Warm regards, "
                "Mrs. Sharma."
            ),
            parent_language_name="English",
            language_code="en-IN",
        )

    def test_clean_hindi_devanagari_passes(self) -> None:
        assert_parent_message_response_rules(
            message_text=(
                "नमस्ते। आपके बेटे आरव की पिछले चार दिनों से कक्षा में "
                "अनुपस्थिति की वजह से हम चिंतित हैं। कृपया स्कूल से "
                "संपर्क करें। आपकी बच्चे की शिक्षिका श्रीमती शर्मा।"
            ),
            parent_language_name="Hindi",
            language_code="hi-IN",
        )

    def test_forbidden_phrase_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_parent_message_response_rules(
                message_text=(
                    "Dear parent, I am an AI assistant writing about your "
                    "child Arav. He has been absent for four days. "
                    "Please reach out if you need any help. Best regards, "
                    "Mrs. Sharma."
                ),
                parent_language_name="English",
                language_code="en-IN",
            )

    def test_apostrophe_contraction_caught(self) -> None:
        with pytest.raises(AssertionError):
            assert_parent_message_response_rules(
                message_text=(
                    "Dear parent, hello from your child's school. "
                    "I'm an AI tutor here to share that Arav has been "
                    "absent for four days this week."
                ),
                parent_language_name="English",
                language_code="en-IN",
            )

    def test_too_short_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_parent_message_response_rules(
                message_text="hi parent",
                parent_language_name="English",
                language_code="en-IN",
            )

    def test_too_long_rejects(self) -> None:
        text = " ".join(["word"] * (PARENT_MESSAGE_MAX_WORDS + 50))
        with pytest.raises(AssertionError, match="out of range"):
            assert_parent_message_response_rules(
                message_text=text,
                parent_language_name="English",
                language_code="en-IN",
            )

    def test_hindi_in_english_script_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Script mismatch"):
            assert_parent_message_response_rules(
                message_text=(
                    "Namaste. Aapke bete Arav ki anupasthiti ki vajah "
                    "se hum chinta mein hain. Kripya school se sampark "
                    "karein. Mrs. Sharma."
                ),
                parent_language_name="Hindi",
                language_code="hi-IN",
            )

    def test_invalid_language_code_rejects(self) -> None:
        with pytest.raises(AssertionError, match="LANGUAGE_TO_BCP47"):
            assert_parent_message_response_rules(
                message_text=(
                    "Dear parent, I want to share that Arav has been "
                    "absent for four days this week. Please reach out "
                    "if any support is needed. Mrs. Sharma."
                ),
                parent_language_name="English",
                language_code="xx-XX",  # not in the hardcoded map
            )
