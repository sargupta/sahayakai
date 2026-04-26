"""Behavioural tests for `assert_lesson_plan_rules`.

Phase 3 §3.5c. Tests the post-orchestration guard that runs on the
final plan text just before it lands in the wire response.
"""
from __future__ import annotations

import pytest

from sahayakai_agents._behavioural import (
    LESSON_PLAN_MAX_WORDS,
    LESSON_PLAN_MIN_WORDS,
    assert_lesson_plan_length,
    assert_lesson_plan_rules,
)

pytestmark = pytest.mark.behavioral


# A reference plan blob — > 200 words to pass the length minimum.
_REFERENCE_PLAN_EN = (
    "Title Introduction to Photosynthesis Grade level Class 5 "
    "Duration forty five minutes Subject Science Objectives are clear "
    "Students will be able to identify the parts of a plant involved "
    "in photosynthesis Students will be able to explain how plants "
    "make their food using sunlight water and carbon dioxide "
    "Students will be able to describe the role of chlorophyll in "
    "the leaf and connect it to the green colour they observe "
    "Materials needed include a small potted plant a glass jar "
    "leaves paper pens and a chart paper for drawing the equation "
    "Activity one Engage phase Begin with a riddle about how plants "
    "eat without a mouth Show a healthy plant and a yellowing one "
    "Ask students to compare and write down what they notice "
    "Activity two Explore phase Students examine leaves under a "
    "magnifying glass and notice the texture and pattern Discuss "
    "the green pigment they observe and connect it to chlorophyll "
    "Activity three Explain phase Use the chart paper to draw the "
    "photosynthesis equation Sunlight plus water plus carbon dioxide "
    "gives glucose plus oxygen Show how each input enters the leaf "
    "Activity four Elaborate phase Connect to local farming and "
    "Indian rural context Discuss why farmers prefer green leafy "
    "crops in monsoon and why neem trees stay green even in summer "
    "Activity five Evaluate phase Quiz with five questions covering "
    "the key terms Assessment is the quiz score plus participation "
    "and the worksheet output Homework is to draw and label a plant "
    "at home and bring it tomorrow for class discussion and review"
)


class TestLessonPlanLength:
    def test_too_short_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_lesson_plan_length("hello world")  # 2 words

    def test_minimum_length_passes(self) -> None:
        plan = " ".join(["word"] * LESSON_PLAN_MIN_WORDS)
        assert_lesson_plan_length(plan)  # exactly the minimum, should not raise

    def test_below_minimum_rejects(self) -> None:
        plan = " ".join(["word"] * (LESSON_PLAN_MIN_WORDS - 1))
        with pytest.raises(AssertionError):
            assert_lesson_plan_length(plan)

    def test_maximum_length_passes(self) -> None:
        plan = " ".join(["word"] * LESSON_PLAN_MAX_WORDS)
        assert_lesson_plan_length(plan)

    def test_above_maximum_rejects(self) -> None:
        plan = " ".join(["word"] * (LESSON_PLAN_MAX_WORDS + 100))
        with pytest.raises(AssertionError):
            assert_lesson_plan_length(plan)


class TestLessonPlanRules:
    def test_clean_english_plan_passes(self) -> None:
        assert_lesson_plan_rules(plan_text=_REFERENCE_PLAN_EN, language="en")

    def test_forbidden_phrase_rejects(self) -> None:
        # Same hardened forbidden-phrase set as parent-call.
        bad = _REFERENCE_PLAN_EN + " I am an AI tutor and this is my plan."
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_lesson_plan_rules(plan_text=bad, language="en")

    def test_apostrophe_contraction_caught(self) -> None:
        bad = _REFERENCE_PLAN_EN + " I'm an AI assistant from school."
        with pytest.raises(AssertionError):
            assert_lesson_plan_rules(plan_text=bad, language="en")

    def test_cyrillic_confusable_caught(self) -> None:
        # Wave 4 fix 5 regression: Cyrillic А folds to Latin A
        # before regex match.
        bad = _REFERENCE_PLAN_EN + " I am an \u0410I helper."
        with pytest.raises(AssertionError):
            assert_lesson_plan_rules(plan_text=bad, language="en")

    def test_too_short_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_lesson_plan_rules(plan_text="short", language="en")

    def test_unsupported_language_skips_script_check(self) -> None:
        # Unknown language code → script check is a no-op (same shape
        # as parent-call's `assert_script_matches_language`).
        # The plan still must pass forbidden-phrase + length.
        assert_lesson_plan_rules(plan_text=_REFERENCE_PLAN_EN, language="xyz")

    def test_hindi_plan_in_devanagari_passes(self) -> None:
        # Build a Hindi plan that's long enough.
        hindi_word = "पाठ"
        plan = " ".join([hindi_word] * 250)
        assert_lesson_plan_rules(plan_text=plan, language="hi")

    def test_hindi_plan_in_english_script_rejects(self) -> None:
        # An English-script reply for a Hindi-language request must fail
        # the script-match check.
        with pytest.raises(AssertionError, match="Script mismatch"):
            assert_lesson_plan_rules(plan_text=_REFERENCE_PLAN_EN, language="hi")
