"""Pydantic models for the assignment-assessor agent.

Mirrors `AssessAssignmentInputSchema` / `AssessAssignmentOutputSchema`
in `sahayakai-main/src/ai/flows/assignment-assessor.ts`. The rubric
snapshot sub-types mirror `rubric-generator.ts` (the TS schema
re-imports `RubricGeneratorOutputSchema`). Python is the source of
truth — TS wire types regenerated from these models.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# 10 MB cap on the image data URI body.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024


# --- Rubric snapshot (mirrors rubric/schemas.py shape) ------------------


class RubricLevel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=2000)
    points: int = Field(ge=0, le=10)


class RubricCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=1000)
    # The TS flow allows 3-5 levels; mirrored here.
    levels: list[RubricLevel] = Field(min_length=3, max_length=5)


class RubricSnapshot(BaseModel):
    """Rubric to grade against. Optional in the wire request; the router
    falls back to `DEFAULT_RUBRIC` when omitted or when `criteria` is
    empty."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1, max_length=2000)
    criteria: list[RubricCriterion] = Field(min_length=1, max_length=8)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)


# --- Wire request --------------------------------------------------------

AssessMode = Literal["full", "transcribe", "score"]


class AssessAssignmentRequest(BaseModel):
    """Request body for `POST /v1/assignment-assessor/assess`.

    Mirrors `AssessAssignmentInputSchema` in TS verbatim. The
    `imageDataUri` pattern matches the TS regex.
    """

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(
        min_length=32,
        max_length=_DATA_URI_MAX_LEN,
        pattern=r"^data:image\/(jpeg|png|webp);base64,",
    )
    rubricSnapshot: RubricSnapshot | None = None
    language: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    gradeLevel: str | None = Field(default=None, max_length=50)
    studentId: str | None = Field(default=None, max_length=64)
    editedTranscript: str | None = Field(default=None, max_length=20_000)
    mode: AssessMode = "full"
    teacherContext: str | None = Field(default=None, max_length=2000)
    userId: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_\-]+$",
    )


# --- Output sub-types ---------------------------------------------------


_WarningTag = Annotated[str, StringConstraints(max_length=100)]


class PerCriterionScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterionName: str = Field(min_length=1, max_length=200)
    level: str = Field(min_length=1, max_length=100)
    points: float = Field(ge=0)
    maxPoints: float = Field(ge=0)
    feedback: str = Field(min_length=1, max_length=4000)
    confidence: float = Field(ge=0, le=1)


# --- Model contract -----------------------------------------------------


class AssessAssignmentCore(BaseModel):
    """What the model MUST return. The router enriches a few fields
    server-side (`assessmentId`, `createdAtIso`, `language`,
    `rubricSnapshot` echo, `studentId`, `editedTranscript`) before the
    wire response is built."""

    model_config = ConfigDict(extra="forbid")

    assessmentId: str = Field(max_length=64)
    rawTranscript: str = Field(max_length=50_000)
    editedTranscript: str | None = Field(default=None, max_length=50_000)
    language: str = Field(min_length=1, max_length=50)
    overallScore: float = Field(ge=0, le=100)
    pointsEarned: float = Field(ge=0)
    pointsPossible: float = Field(ge=0)
    perCriterionScores: list[PerCriterionScore] = Field(
        min_length=0, max_length=20,
    )
    strengths: list[str] = Field(min_length=1, max_length=5)
    improvements: list[str] = Field(min_length=1, max_length=5)
    nextSteps: list[str] = Field(min_length=1, max_length=3)
    teacherNote: str = Field(min_length=1, max_length=4000)
    confidenceOverall: float = Field(ge=0, le=1)
    warnings: list[_WarningTag] = Field(default_factory=list, max_length=20)
    rubricSnapshot: RubricSnapshot
    studentId: str | None = Field(default=None, max_length=64)
    createdAtIso: str = Field(max_length=64)


# --- Wire response ------------------------------------------------------


class AssessAssignmentResponse(BaseModel):
    """Wire response for `POST /v1/assignment-assessor/assess`.

    Parity fields match the TS `AssessAssignmentOutputSchema`; additive
    sidecar telemetry follows.
    """

    model_config = ConfigDict(extra="forbid")

    assessmentId: str = Field(min_length=1, max_length=64)
    rawTranscript: str = Field(max_length=50_000)
    editedTranscript: str | None = Field(default=None, max_length=50_000)
    language: str = Field(min_length=1, max_length=50)
    overallScore: float = Field(ge=0, le=100)
    pointsEarned: float = Field(ge=0)
    pointsPossible: float = Field(ge=0)
    perCriterionScores: list[PerCriterionScore] = Field(
        min_length=0, max_length=20,
    )
    strengths: list[str] = Field(min_length=1, max_length=5)
    improvements: list[str] = Field(min_length=1, max_length=5)
    nextSteps: list[str] = Field(min_length=1, max_length=3)
    teacherNote: str = Field(min_length=1, max_length=4000)
    confidenceOverall: float = Field(ge=0, le=1)
    warnings: list[_WarningTag] = Field(default_factory=list, max_length=20)
    rubricSnapshot: RubricSnapshot
    studentId: str | None = Field(default=None, max_length=64)
    createdAtIso: str = Field(min_length=1, max_length=64)

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
