"""Pydantic models for the assignment-assessor agent.

Mirrors `AssessAssignmentInputSchema` / `AssessAssignmentOutputSchema`
in `sahayakai-main/src/ai/flows/assignment-assessor.ts`. The rubric
snapshot sub-types mirror `rubric-generator.ts` (the TS schema
re-imports `RubricGeneratorOutputSchema`). Python is the source of
truth — TS wire types regenerated from these models.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# 10 MB cap on the image data URI body.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024


# --- Rubric snapshot (mirrors rubric/schemas.py shape) ------------------
# Phase 1a: this snapshot is BOTH echoed in the response AND accepted
# in the request. To avoid leaking maxLength/maxItems into the
# response_schema we relax it (matches rubric agent baseline).


class RubricLevel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    points: int = Field(ge=0)


class RubricCriterion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    levels: list[RubricLevel]


class RubricSnapshot(BaseModel):
    """Rubric to grade against."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    criteria: list[RubricCriterion]
    gradeLevel: str | None = None
    subject: str | None = None


# --- Wire request --------------------------------------------------------

AssessMode = Literal["full", "transcribe", "score"]


class AssessAssignmentRequest(BaseModel):
    """Request body for `POST /v1/assignment-assessor/assess`."""

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
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


# --- Output sub-types ---------------------------------------------------


class PerCriterionScore(BaseModel):
    model_config = ConfigDict(extra="forbid")

    criterionName: str
    level: str
    points: float = Field(ge=0)
    maxPoints: float = Field(ge=0)
    feedback: str
    confidence: float = Field(ge=0, le=1)


# --- Model contract -----------------------------------------------------


class AssessAssignmentCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    assessmentId: str
    rawTranscript: str
    editedTranscript: str | None = None
    language: str
    overallScore: float = Field(ge=0, le=100)
    pointsEarned: float
    pointsPossible: float
    perCriterionScores: list[PerCriterionScore]
    # Genkit Zod baseline keeps min/max on these arrays — match exactly.
    strengths: list[str] = Field(min_length=1, max_length=5)
    improvements: list[str] = Field(min_length=1, max_length=5)
    nextSteps: list[str] = Field(min_length=1, max_length=3)
    teacherNote: str
    confidenceOverall: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)
    rubricSnapshot: RubricSnapshot
    studentId: str | None = None
    createdAtIso: str


# --- Wire response ------------------------------------------------------


class AssessAssignmentResponse(BaseModel):
    """Wire response for `POST /v1/assignment-assessor/assess`."""

    model_config = ConfigDict(extra="forbid")

    assessmentId: str
    rawTranscript: str
    editedTranscript: str | None = None
    language: str
    overallScore: float = Field(ge=0, le=100)
    pointsEarned: float
    pointsPossible: float
    perCriterionScores: list[PerCriterionScore]
    strengths: list[str] = Field(min_length=1, max_length=5)
    improvements: list[str] = Field(min_length=1, max_length=5)
    nextSteps: list[str] = Field(min_length=1, max_length=3)
    teacherNote: str
    confidenceOverall: float = Field(ge=0, le=1)
    warnings: list[str] = Field(default_factory=list)
    rubricSnapshot: RubricSnapshot
    studentId: str | None = None
    createdAtIso: str

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
