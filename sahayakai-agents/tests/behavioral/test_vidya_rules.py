"""Behavioural tests for `assert_vidya_response_rules`.

Phase 5 §5.5. Tests the post-classification guard that runs on the
VIDYA response text + action just before it lands in the wire response.
"""
from __future__ import annotations

import pytest

from sahayakai_agents._behavioural import (
    VIDYA_RESPONSE_MAX_WORDS,
    VIDYA_RESPONSE_MIN_WORDS,
    assert_vidya_action_shape,
    assert_vidya_response_length,
    assert_vidya_response_rules,
)
from sahayakai_agents.agents.vidya.schemas import (
    VidyaAction,
    VidyaActionParams,
)

pytestmark = pytest.mark.behavioral


# ── Helpers ───────────────────────────────────────────────────────────────


def _good_action(flow: str = "lesson-plan") -> VidyaAction:
    return VidyaAction(
        type="NAVIGATE_AND_FILL",
        flow=flow,  # type: ignore[arg-type]
        params=VidyaActionParams(topic="Photosynthesis", gradeLevel="Class 5"),
    )


# ── Length bounds ─────────────────────────────────────────────────────────


class TestVidyaResponseLength:
    def test_minimum_length_passes(self) -> None:
        assert_vidya_response_length(" ".join(["word"] * VIDYA_RESPONSE_MIN_WORDS))

    def test_maximum_length_passes(self) -> None:
        assert_vidya_response_length(" ".join(["word"] * VIDYA_RESPONSE_MAX_WORDS))

    def test_above_maximum_rejects(self) -> None:
        text = " ".join(["word"] * (VIDYA_RESPONSE_MAX_WORDS + 10))
        with pytest.raises(AssertionError, match="out of range"):
            assert_vidya_response_length(text)

    def test_empty_string_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_vidya_response_length("")


# ── Action shape ──────────────────────────────────────────────────────────


class TestVidyaActionShape:
    def test_none_action_passes(self) -> None:
        # instantAnswer / unknown legitimately have no action
        assert_vidya_action_shape(None)

    def test_valid_routable_flow_passes(self) -> None:
        for flow in [
            "lesson-plan",
            "quiz-generator",
            "visual-aid-designer",
            "worksheet-wizard",
            "virtual-field-trip",
            "teacher-training",
            "rubric-generator",
            "exam-paper",
            "video-storyteller",
        ]:
            assert_vidya_action_shape(_good_action(flow))

    def test_invalid_flow_via_attr_setattr_rejects(self) -> None:
        # Schema rejects construction of an invalid flow, so simulate
        # a corrupted action with a duck-typed object.
        class _FakeAction:
            type = "NAVIGATE_AND_FILL"
            flow = "deleted-flow"
            params = VidyaActionParams()

        with pytest.raises(AssertionError, match="ALLOWED_FLOWS"):
            assert_vidya_action_shape(_FakeAction())

    def test_unexpected_action_type_rejects(self) -> None:
        class _FakeAction:
            type = "DIALOG_OPEN"
            flow = "lesson-plan"
            params = VidyaActionParams()

        with pytest.raises(AssertionError, match="NAVIGATE_AND_FILL"):
            assert_vidya_action_shape(_FakeAction())

    def test_missing_params_rejects(self) -> None:
        class _FakeAction:
            type = "NAVIGATE_AND_FILL"
            flow = "lesson-plan"
            params = None

        with pytest.raises(AssertionError, match="params"):
            assert_vidya_action_shape(_FakeAction())


# ── Composite assert_vidya_response_rules ─────────────────────────────────


class TestVidyaResponseRules:
    def test_clean_english_response_with_action_passes(self) -> None:
        assert_vidya_response_rules(
            response_text="Opening the lesson plan tool now",
            language="en",
            action=_good_action(),
        )

    def test_clean_english_response_no_action_passes(self) -> None:
        # instantAnswer / unknown path
        assert_vidya_response_rules(
            response_text=(
                "Photosynthesis is the process plants use to make food from "
                "sunlight water and carbon dioxide."
            ),
            language="en",
            action=None,
        )

    def test_forbidden_phrase_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_vidya_response_rules(
                response_text="I am an AI assistant. Let me help.",
                language="en",
                action=None,
            )

    def test_apostrophe_contraction_caught(self) -> None:
        # Same hardened forbidden-phrase set as parent-call / lesson-plan
        with pytest.raises(AssertionError):
            assert_vidya_response_rules(
                response_text="I'm an AI tutor here for you.",
                language="en",
                action=None,
            )

    def test_too_long_response_rejects(self) -> None:
        text = " ".join(["word"] * (VIDYA_RESPONSE_MAX_WORDS + 50))
        with pytest.raises(AssertionError, match="out of range"):
            assert_vidya_response_rules(
                response_text=text,
                language="en",
                action=None,
            )

    def test_empty_response_rejects(self) -> None:
        with pytest.raises(AssertionError, match="out of range"):
            assert_vidya_response_rules(
                response_text="",
                language="en",
                action=None,
            )

    def test_hindi_devanagari_response_passes(self) -> None:
        # Hindi response in Devanagari script — should pass script-match
        assert_vidya_response_rules(
            response_text="मैं आपकी पाठ योजना खोल रहा हूँ",
            language="hi",
            action=_good_action(),
        )

    def test_hindi_response_in_english_script_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Script mismatch"):
            assert_vidya_response_rules(
                response_text="Opening lesson plan now for you",
                language="hi",
                action=_good_action(),
            )

    def test_unsupported_language_skips_script_check(self) -> None:
        # Unknown language code → script check no-op (same as parent-call)
        assert_vidya_response_rules(
            response_text="Opening the lesson plan tool",
            language="xyz",
            action=_good_action(),
        )

    def test_invalid_action_flow_rejects(self) -> None:
        class _FakeAction:
            type = "NAVIGATE_AND_FILL"
            flow = "removed-flow"
            params = VidyaActionParams()

        with pytest.raises(AssertionError, match="ALLOWED_FLOWS"):
            assert_vidya_response_rules(
                response_text="Opening the tool now",
                language="en",
                action=_FakeAction(),
            )
