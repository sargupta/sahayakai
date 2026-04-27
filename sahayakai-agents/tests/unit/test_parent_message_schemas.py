"""Schema validation tests for parent-message Pydantic models.

Phase C §C.3.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.parent_message.schemas import (
    ParentMessageCore,
    ParentMessageRequest,
    ParentMessageResponse,
    PerformanceContext,
    SubjectAssessment,
)

pytestmark = pytest.mark.unit


def _minimal_request_kwargs() -> dict:
    return {
        "studentName": "Arav",
        "className": "Class 5",
        "subject": "Mathematics",
        "reason": "consecutive_absences",
        "parentLanguage": "Hindi",
        "userId": "teacher-uid-1",
    }


class TestExtraForbidRejection:
    def test_request_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ParentMessageRequest(
                **_minimal_request_kwargs(), unknown="field",
            )  # type: ignore[call-arg]

    def test_core_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ParentMessageCore(
                message="A short polite parent message under the cap.",
                languageCode="hi-IN",
                wordCount=10,
                debug=True,  # type: ignore[call-arg]
            )

    def test_response_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            ParentMessageResponse(
                message="Sample message of sufficient length okay sure good.",
                languageCode="en-IN",
                wordCount=10,
                sidecarVersion="phase-c",
                latencyMs=100,
                modelUsed="gemini-2.0-flash",
                tokens=100,  # type: ignore[call-arg]
            )

    def test_subject_assessment_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            SubjectAssessment(
                subject="Math",
                name="Unit Test",
                marksObtained=18,
                maxMarks=25,
                percentage=72,
                date="2026-04-15",
                comment="x",  # type: ignore[call-arg]
            )

    def test_performance_context_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            PerformanceContext(latestPercentage=72, debug=True)  # type: ignore[call-arg]


class TestEnumValidation:
    def test_invalid_reason_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "reason": "made_up_reason"},
            )

    def test_each_valid_reason_accepts(self) -> None:
        for reason in [
            "consecutive_absences",
            "poor_performance",
            "behavioral_concern",
            "positive_feedback",
        ]:
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "reason": reason},
            )

    def test_invalid_parent_language_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "parentLanguage": "Klingon"},
            )

    def test_each_valid_language_accepts(self) -> None:
        for lang in [
            "English",
            "Hindi",
            "Tamil",
            "Telugu",
            "Kannada",
            "Malayalam",
            "Bengali",
            "Marathi",
            "Gujarati",
            "Punjabi",
            "Odia",
        ]:
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "parentLanguage": lang},
            )


class TestBoundedFields:
    def test_userId_pattern_rejects_path_injection(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "userId": "../../etc/passwd"},
            )

    def test_studentName_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "studentName": "x" * 201},
            )

    def test_consecutiveAbsentDays_negative_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageRequest(
                **{**_minimal_request_kwargs(), "consecutiveAbsentDays": -1},
            )

    def test_message_too_long_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageCore(
                message="x" * 2501,
                languageCode="en-IN",
                wordCount=400,
            )

    def test_message_too_short_rejects(self) -> None:
        with pytest.raises(ValidationError):
            ParentMessageCore(
                message="hi",
                languageCode="en-IN",
                wordCount=1,
            )


class TestRoundTrip:
    def test_full_request_round_trips(self) -> None:
        request = ParentMessageRequest(
            **_minimal_request_kwargs(),
            consecutiveAbsentDays=4,
            teacherName="Mrs. Sharma",
            schoolName="Sunrise Public",
            performanceSummary="Math Unit Test: 18/25 (72%)",
        )
        dumped = request.model_dump()
        restored = ParentMessageRequest.model_validate(dumped)
        assert restored == request

    def test_full_response_round_trips(self) -> None:
        response = ParentMessageResponse(
            message=(
                "नमस्ते। आपके बेटे आरव की पिछले चार दिनों से कक्षा में "
                "अनुपस्थिति की वजह से हम चिंतित हैं। कृपया स्कूल से संपर्क करें। "
                "आपकी बच्चे की शिक्षिका, श्रीमती शर्मा।"
            ),
            languageCode="hi-IN",
            wordCount=22,
            sidecarVersion="phase-c.1.0",
            latencyMs=234,
            modelUsed="gemini-2.0-flash",
        )
        dumped = response.model_dump()
        restored = ParentMessageResponse.model_validate(dumped)
        assert restored == response
