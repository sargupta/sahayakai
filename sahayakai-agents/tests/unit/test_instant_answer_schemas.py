"""Schema validation tests for instant-answer Pydantic models.

Phase B §B.2. Verifies `extra="forbid"` rejection on every wire schema
and that bounded fields enforce their limits.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.instant_answer.schemas import (
    InstantAnswerCore,
    InstantAnswerRequest,
    InstantAnswerResponse,
)

pytestmark = pytest.mark.unit


def _minimal_request_kwargs() -> dict:
    return {
        "question": "What is photosynthesis?",
        "userId": "teacher-uid-1",
    }


# ── extra="forbid" rejection ──────────────────────────────────────────────


class TestExtraForbidRejection:
    def test_request_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            InstantAnswerRequest(
                **_minimal_request_kwargs(), unknown="field"
            )  # type: ignore[call-arg]

    def test_core_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            InstantAnswerCore(
                answer="ok",
                videoSuggestionUrl=None,
                gradeLevel=None,
                subject=None,
                debug=True,  # type: ignore[call-arg]
            )

    def test_response_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            InstantAnswerResponse(
                answer="ok",
                videoSuggestionUrl=None,
                gradeLevel=None,
                subject=None,
                sidecarVersion="phase-6",
                latencyMs=10,
                modelUsed="gemini-2.5-flash",
                groundingUsed=True,
                tokens=100,  # type: ignore[call-arg]
            )


# ── Bounded field limits ──────────────────────────────────────────────────


class TestBoundedFields:
    def test_question_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerRequest(
                **{**_minimal_request_kwargs(), "question": "x" * 4001}
            )

    def test_question_empty_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerRequest(**{**_minimal_request_kwargs(), "question": ""})

    def test_answer_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerCore(
                answer="x" * 8001,
                videoSuggestionUrl=None,
                gradeLevel=None,
                subject=None,
            )

    def test_answer_empty_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerCore(
                answer="",
                videoSuggestionUrl=None,
                gradeLevel=None,
                subject=None,
            )

    def test_user_id_pattern_rejects_path_injection(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerRequest(
                **{**_minimal_request_kwargs(), "userId": "../../etc/passwd"}
            )

    def test_user_id_alphanumeric_accepts(self) -> None:
        InstantAnswerRequest(
            **{**_minimal_request_kwargs(), "userId": "User_123-abc"}
        )

    def test_grade_level_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerRequest(
                **{**_minimal_request_kwargs(), "gradeLevel": "x" * 51}
            )

    def test_video_url_too_long_in_core_rejects(self) -> None:
        with pytest.raises(ValidationError):
            InstantAnswerCore(
                answer="ok",
                videoSuggestionUrl="x" * 501,
                gradeLevel=None,
                subject=None,
            )


# ── Round-trip ───────────────────────────────────────────────────────────


class TestRoundTrip:
    def test_full_request_round_trips(self) -> None:
        request = InstantAnswerRequest(
            question="What is photosynthesis?",
            language="en",
            gradeLevel="Class 5",
            subject="Science",
            userId="teacher_uid_1",
        )
        dumped = request.model_dump()
        restored = InstantAnswerRequest.model_validate(dumped)
        assert restored == request

    def test_full_response_round_trips(self) -> None:
        response = InstantAnswerResponse(
            answer="Photosynthesis is the process by which green plants make food.",
            videoSuggestionUrl="https://www.youtube.com/results?search_query=photosynthesis+for+class+5",
            gradeLevel="Class 5",
            subject="Science",
            sidecarVersion="phase-6.1.0",
            latencyMs=234,
            modelUsed="gemini-2.5-flash",
            groundingUsed=True,
        )
        dumped = response.model_dump()
        restored = InstantAnswerResponse.model_validate(dumped)
        assert restored == response

    def test_response_with_no_video_round_trips(self) -> None:
        response = InstantAnswerResponse(
            answer="Mathematics is the study of numbers and patterns.",
            videoSuggestionUrl=None,
            gradeLevel=None,
            subject="Mathematics",
            sidecarVersion="phase-6.1.0",
            latencyMs=120,
            modelUsed="gemini-2.5-flash",
            groundingUsed=False,
        )
        dumped = response.model_dump()
        restored = InstantAnswerResponse.model_validate(dumped)
        assert restored == response
