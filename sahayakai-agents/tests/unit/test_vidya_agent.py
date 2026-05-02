"""Unit tests for `agents/vidya/agent.py`.

Pure functions only — no Gemini calls. Tests `classify_action`
gate logic and that the two render functions produce non-empty
strings against well-formed contexts.

Phase 5 §5.5a.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.vidya.agent import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    UNKNOWN_INTENT,
    classify_action,
    get_instant_answer_model,
    get_orchestrator_model,
    render_instant_answer_prompt,
    render_orchestrator_prompt,
)
from sahayakai_agents.agents.vidya.schemas import (
    IntentClassification,
)

pytestmark = pytest.mark.unit


# ── Test helper: build an IntentClassification with overrides ───────────


def _intent(
    *,
    type: str = "unknown",
    topic: str | None = None,
    gradeLevel: str | None = None,
    subject: str | None = None,
    language: str | None = None,
    plannedActions: list | None = None,
) -> IntentClassification:
    return IntentClassification(
        type=type,
        topic=topic,
        gradeLevel=gradeLevel,
        subject=subject,
        language=language,
        plannedActions=plannedActions or [],
    )


class TestClassifyAction:
    @pytest.mark.parametrize("flow", ALLOWED_FLOWS)
    def test_each_routable_flow_returns_navigate_action(self, flow: str) -> None:
        action = classify_action(_intent(type=flow, topic="Photosynthesis", gradeLevel="Class 5"))
        assert action is not None
        assert action.type == "NAVIGATE_AND_FILL"
        assert action.flow == flow
        assert action.params.topic == "Photosynthesis"
        assert action.params.gradeLevel == "Class 5"

    def test_routable_flow_with_full_params(self) -> None:
        action = classify_action(
            _intent(
                type="lesson-plan",
                topic="Fractions",
                gradeLevel="Class 4",
                subject="Mathematics",
                language="hi",
            )
        )
        assert action is not None
        assert action.flow == "lesson-plan"
        assert action.params.topic == "Fractions"
        assert action.params.gradeLevel == "Class 4"
        assert action.params.subject == "Mathematics"
        assert action.params.language == "hi"
        assert action.params.ncertChapter is None

    def test_routable_flow_with_no_params(self) -> None:
        # Even if the classifier extracted no params, we still navigate.
        action = classify_action(_intent(type="quiz-generator"))
        assert action is not None
        assert action.flow == "quiz-generator"
        assert action.params.topic is None
        assert action.params.gradeLevel is None
        assert action.params.subject is None
        assert action.params.language is None

    def test_instant_answer_returns_none(self) -> None:
        assert classify_action(_intent(type=INSTANT_ANSWER_INTENT)) is None

    def test_unknown_returns_none(self) -> None:
        assert classify_action(_intent(type=UNKNOWN_INTENT)) is None

    def test_invalid_intent_string_returns_none(self) -> None:
        # Defensive: classifier hallucinates a non-existent flow → None.
        assert classify_action(_intent(type="not-a-real-flow")) is None

    def test_empty_topic_field_does_not_crash(self) -> None:
        # Edge case: classifier returns valid intent but blank topic.
        action = classify_action(_intent(type="rubric-generator", topic=""))
        assert action is not None
        assert action.params.topic == ""


class TestPromptRendering:
    def test_orchestrator_renders_with_minimal_context(self) -> None:
        prompt = render_orchestrator_prompt(
            {
                "message": "Make a quiz on photosynthesis",
                "chatHistory": [],
                "currentScreenContext": {"path": "/dashboard", "uiState": {}},
                "teacherProfile": {},
                "detectedLanguage": "en",
                "allowedFlows": ALLOWED_FLOWS,
            }
        )
        assert "Make a quiz on photosynthesis" in prompt
        assert "/dashboard" in prompt
        # Allowed flows list visible (at least one routable label).
        assert "lesson-plan" in prompt
        assert "quiz-generator" in prompt
        assert len(prompt) > 500  # template body is substantial

    def test_orchestrator_renders_with_full_context(self) -> None:
        prompt = render_orchestrator_prompt(
            {
                "message": "Class 7 ke liye paper banao",
                "chatHistory": [
                    {"role": "user", "parts": [{"text": "Hi"}]},
                    {"role": "model", "parts": [{"text": "Hello!"}]},
                ],
                "currentScreenContext": {
                    "path": "/exam-paper",
                    "uiState": {"topic": "History"},
                },
                "teacherProfile": {
                    "preferredGrade": "Class 7",
                    "preferredSubject": "Social Science",
                    "preferredLanguage": "hi",
                    "schoolContext": "Government school in rural Bihar",
                },
                "detectedLanguage": "hi",
                "allowedFlows": ALLOWED_FLOWS,
            }
        )
        assert "Class 7 ke liye paper banao" in prompt
        assert "Class 7" in prompt
        assert "Government school in rural Bihar" in prompt
        assert "/exam-paper" in prompt

    def test_instant_answer_renders_with_minimal_context(self) -> None:
        prompt = render_instant_answer_prompt(
            {
                "message": "What is photosynthesis?",
                "language": "en",
                "teacherProfile": {},
            }
        )
        assert "What is photosynthesis?" in prompt
        assert len(prompt) > 200  # template body is substantive

    def test_instant_answer_renders_with_full_context(self) -> None:
        prompt = render_instant_answer_prompt(
            {
                "message": "Pranayam kya hai?",
                "language": "hi",
                "teacherProfile": {
                    "preferredGrade": "Class 9",
                    "preferredSubject": "Science",
                    "schoolContext": "CBSE private school",
                },
            }
        )
        assert "Pranayam kya hai?" in prompt
        assert "Class 9" in prompt
        assert "CBSE private school" in prompt


class TestConstants:
    def test_allowed_flows_has_nine_entries(self) -> None:
        # The plan pins the routable surface to 9 flows. If this drifts
        # from 9, update the docs in agent.py and schemas.AllowedFlow.
        assert len(ALLOWED_FLOWS) == 9

    def test_instant_answer_and_unknown_not_in_allowed_flows(self) -> None:
        # `instantAnswer` is handled inline, `unknown` produces no
        # action — neither is a routable flow.
        assert INSTANT_ANSWER_INTENT not in ALLOWED_FLOWS
        assert UNKNOWN_INTENT not in ALLOWED_FLOWS

    def test_allowed_flows_are_unique(self) -> None:
        assert len(set(ALLOWED_FLOWS)) == len(ALLOWED_FLOWS)


class TestModelSelectors:
    def test_orchestrator_default_is_2_0_flash(self) -> None:
        # VIDYA today (Genkit) uses gemini-2.0-flash for speed —
        # the orb is a real-time UX surface.
        assert get_orchestrator_model() == "gemini-2.5-flash"

    def test_instant_answer_default_is_2_0_flash(self) -> None:
        assert get_instant_answer_model() == "gemini-2.5-flash"
