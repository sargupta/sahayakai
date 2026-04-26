"""Schema validation tests for VIDYA Pydantic models.

Phase 5 §5.6 deliverable. Verifies `extra="forbid"` rejects unknown
fields on every wire schema, and that bounded fields enforce their
limits.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.vidya.schemas import (
    ChatMessage,
    ChatMessagePart,
    IntentClassification,
    NcertChapterRef,
    ScreenContext,
    TeacherProfile,
    VidyaAction,
    VidyaActionParams,
    VidyaRequest,
    VidyaResponse,
)

pytestmark = pytest.mark.unit


# ── Helpers ───────────────────────────────────────────────────────────────


def _minimal_request_kwargs() -> dict:
    return {
        "message": "Make me a lesson plan",
        "currentScreenContext": ScreenContext(path="/dashboard"),
        "teacherProfile": TeacherProfile(),
    }


def _minimal_action() -> VidyaAction:
    return VidyaAction(
        type="NAVIGATE_AND_FILL",
        flow="lesson-plan",
        params=VidyaActionParams(),
    )


# ── extra="forbid" rejection ──────────────────────────────────────────────


class TestExtraForbidRejection:
    def test_chat_message_part_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ChatMessagePart(text="hi", color="red")  # type: ignore[call-arg]

    def test_chat_message_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ChatMessage(role="user", parts=[ChatMessagePart(text="x")], extra="bad")  # type: ignore[call-arg]

    def test_screen_context_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ScreenContext(path="/x", uiState=None, secret="leaked")  # type: ignore[call-arg]

    def test_teacher_profile_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            TeacherProfile(extra="x")  # type: ignore[call-arg]

    def test_ncert_chapter_ref_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            NcertChapterRef(number=1, title="x", learningOutcomes=[], page=10)  # type: ignore[call-arg]

    def test_vidya_action_params_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            VidyaActionParams(topic="x", difficulty="hard")  # type: ignore[call-arg]

    def test_vidya_action_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            VidyaAction(
                type="NAVIGATE_AND_FILL",
                flow="lesson-plan",
                params=VidyaActionParams(),
                priority=1,  # type: ignore[call-arg]
            )

    def test_vidya_request_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            VidyaRequest(**_minimal_request_kwargs(), extraField="x")  # type: ignore[call-arg]

    def test_vidya_response_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            VidyaResponse(
                response="ok",
                action=None,
                intent="unknown",
                sidecarVersion="phase-5",
                latencyMs=10,
                tokens=100,  # type: ignore[call-arg]
            )

    def test_intent_classification_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            IntentClassification(
                type="lesson-plan",
                topic=None,
                gradeLevel=None,
                subject=None,
                language=None,
                confidence=0.9,  # type: ignore[call-arg]
            )


# ── Bounded fields enforce limits ─────────────────────────────────────────


class TestBoundedFields:
    def test_message_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaRequest(
                **{**_minimal_request_kwargs(), "message": "x" * 2001}
            )

    def test_message_empty_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaRequest(**{**_minimal_request_kwargs(), "message": ""})

    def test_chat_history_too_long_rejects(self) -> None:
        history = [
            ChatMessage(role="user", parts=[ChatMessagePart(text=f"t{i}")])
            for i in range(51)
        ]
        with pytest.raises(ValidationError):
            VidyaRequest(**{**_minimal_request_kwargs(), "chatHistory": history})

    def test_ui_state_too_many_keys_rejects(self) -> None:
        ui_state = {f"k{i}": "v" for i in range(21)}
        with pytest.raises(ValidationError):
            ScreenContext(path="/x", uiState=ui_state)

    def test_response_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaResponse(
                response="x" * 1001,
                action=None,
                intent="unknown",
                sidecarVersion="phase-5",
                latencyMs=10,
            )

    def test_response_empty_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaResponse(
                response="",
                action=None,
                intent="unknown",
                sidecarVersion="phase-5",
                latencyMs=10,
            )


# ── AllowedFlow enforcement on action ─────────────────────────────────────


class TestActionFlowEnum:
    def test_invalid_flow_string_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaAction(
                type="NAVIGATE_AND_FILL",
                flow="some-invalid-flow",  # type: ignore[arg-type]
                params=VidyaActionParams(),
            )

    def test_each_allowed_flow_accepts(self) -> None:
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
            action = VidyaAction(
                type="NAVIGATE_AND_FILL",
                flow=flow,  # type: ignore[arg-type]
                params=VidyaActionParams(),
            )
            assert action.flow == flow

    def test_invalid_action_type_rejects(self) -> None:
        with pytest.raises(ValidationError):
            VidyaAction(
                type="DIALOG_OPEN",  # type: ignore[arg-type]
                flow="lesson-plan",
                params=VidyaActionParams(),
            )


# ── Round-trip through model_dump ─────────────────────────────────────────


class TestRoundTrip:
    def test_full_request_round_trips(self) -> None:
        request = VidyaRequest(
            **_minimal_request_kwargs(),
            chatHistory=[
                ChatMessage(role="user", parts=[ChatMessagePart(text="hi")]),
            ],
            detectedLanguage="hi-IN",
        )
        dumped = request.model_dump()
        restored = VidyaRequest.model_validate(dumped)
        assert restored == request

    def test_full_response_with_action_round_trips(self) -> None:
        response = VidyaResponse(
            response="Opening lesson plan",
            action=_minimal_action(),
            intent="lesson-plan",
            sidecarVersion="phase-5.4.0",
            latencyMs=234,
        )
        dumped = response.model_dump()
        restored = VidyaResponse.model_validate(dumped)
        assert restored == response
