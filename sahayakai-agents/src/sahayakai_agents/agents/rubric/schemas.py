"""Pydantic models for the rubric-generator agent.

Phase D.1. Mirrors the existing Genkit shape in
`sahayakai-main/src/ai/flows/rubric-generator.ts`. Python is the
source of truth.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# --- Output sub-types ---------------------------------------------------


class RubricLevel(BaseModel):
    """One performance level for a criterion (e.g. Exemplary / 4 pts)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=10, max_length=2000)
    points: int = Field(ge=0, le=10)


class RubricCriterion(BaseModel):
    """One evaluation criterion + its 4 performance levels."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=10, max_length=1000)
    # Prompt mandates exactly 4 levels (Exemplary / Proficient / Developing
    # / Beginning) but we accept 3-5 for forward-compatibility (e.g. a
    # finer-grained 5-band rubric).
    levels: list[RubricLevel] = Field(min_length=3, max_length=5)


# --- Wire request -------------------------------------------------------


class RubricGeneratorRequest(BaseModel):
    """Request body for `POST /v1/rubric/generate`."""

    model_config = ConfigDict(extra="forbid")

    assignmentDescription: str = Field(min_length=5, max_length=4000)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=20)
    teacherContext: str | None = Field(default=None, max_length=1000)
    userId: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_\-]+$",
    )


# --- Output (model contract) --------------------------------------------


class RubricGeneratorCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=10, max_length=1000)
    criteria: list[RubricCriterion] = Field(min_length=3, max_length=8)
    gradeLevel: str | None = Field(max_length=50)
    subject: str | None = Field(max_length=100)


# --- Wire response ------------------------------------------------------


class RubricGeneratorResponse(BaseModel):
    """Response for `POST /v1/rubric/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    description: str = Field(min_length=10, max_length=1000)
    criteria: list[RubricCriterion] = Field(min_length=3, max_length=8)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
