"""Schema tests for rubric Pydantic models (Phase D.1)."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.rubric.schemas import (
    RubricCriterion,
    RubricGeneratorCore,
    RubricGeneratorRequest,
    RubricGeneratorResponse,
    RubricLevel,
)

pytestmark = pytest.mark.unit


def _level(name: str, points: int) -> RubricLevel:
    return RubricLevel(
        name=name,
        description=(
            f"Detailed description for the {name} performance level on this criterion."
        ),
        points=points,
    )


def _criterion(name: str = "Research and Content") -> RubricCriterion:
    return RubricCriterion(
        name=name,
        description="Evaluates depth of research and accuracy of cited content.",
        levels=[
            _level("Exemplary", 4),
            _level("Proficient", 3),
            _level("Developing", 2),
            _level("Beginning", 1),
        ],
    )


class TestExtraForbid:
    def test_request_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            RubricGeneratorRequest(
                assignmentDescription="A grade 5 project on energy.",
                userId="teacher-uid-1",
                debug=True,  # type: ignore[call-arg]
            )

    def test_level_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            RubricLevel(
                name="Exemplary",
                description="A reasonably long description.",
                points=4,
                color="gold",  # type: ignore[call-arg]
            )

    def test_criterion_rejects_unknown(self) -> None:
        with pytest.raises(ValidationError, match="extra"):
            RubricCriterion(
                name="X",
                description="A reasonably long description.",
                levels=[_level("L1", 1), _level("L2", 2), _level("L3", 3)],
                weight=0.5,  # type: ignore[call-arg]
            )


class TestBoundedFields:
    def test_userId_pattern_rejects_path_injection(self) -> None:
        with pytest.raises(ValidationError):
            RubricGeneratorRequest(
                assignmentDescription="A reasonably described project.",
                userId="../../etc/passwd",
            )

    def test_assignmentDescription_too_short_rejects(self) -> None:
        with pytest.raises(ValidationError):
            RubricGeneratorRequest(
                assignmentDescription="ab",
                userId="teacher-uid-1",
            )

    def test_levels_too_few_rejects(self) -> None:
        with pytest.raises(ValidationError):
            RubricCriterion(
                name="X",
                description="A reasonably long description.",
                levels=[_level("Only", 1), _level("Two", 2)],
            )

    def test_levels_too_many_rejects(self) -> None:
        with pytest.raises(ValidationError):
            RubricCriterion(
                name="X",
                description="A reasonably long description.",
                levels=[_level(f"L{i}", i) for i in range(1, 7)],
            )

    def test_criteria_too_few_rejects(self) -> None:
        with pytest.raises(ValidationError):
            RubricGeneratorCore(
                title="Title",
                description="A reasonably long description here.",
                criteria=[_criterion(), _criterion("X2")],
                gradeLevel=None,
                subject=None,
            )


class TestRoundTrip:
    def test_full_request_round_trips(self) -> None:
        request = RubricGeneratorRequest(
            assignmentDescription="A grade 5 project on renewable energy.",
            gradeLevel="Class 5",
            subject="Science",
            language="English",
            userId="teacher-uid-1",
        )
        dumped = request.model_dump()
        restored = RubricGeneratorRequest.model_validate(dumped)
        assert restored == request

    def test_full_response_round_trips(self) -> None:
        response = RubricGeneratorResponse(
            title="Renewable Energy Project Rubric",
            description="Evaluates a Class 5 project on renewable energy.",
            criteria=[
                _criterion("Research and Content"),
                _criterion("Presentation"),
                _criterion("Originality"),
                _criterion("Group Collaboration"),
            ],
            gradeLevel="Class 5",
            subject="Science",
            sidecarVersion="phase-d.1.0",
            latencyMs=300,
            modelUsed="gemini-2.0-flash",
        )
        dumped = response.model_dump()
        restored = RubricGeneratorResponse.model_validate(dumped)
        assert restored == response
