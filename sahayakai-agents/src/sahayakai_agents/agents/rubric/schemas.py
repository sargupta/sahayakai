"""Pydantic models for the rubric-generator agent.

Phase D.1. Mirrors the existing Genkit shape in
`sahayakai-main/src/ai/flows/rubric-generator.ts`. Python is the
source of truth.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# --- Output sub-types ---------------------------------------------------


class RubricLevel(BaseModel):
    """One performance level for a criterion (response model)."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    points: int = Field(ge=0)


class RubricCriterion(BaseModel):
    """One evaluation criterion + its performance levels (response model)."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    levels: list[RubricLevel]


# --- Wire request -------------------------------------------------------


class RubricGeneratorRequest(BaseModel):
    """Request body for `POST /v1/rubric/generate`."""

    model_config = ConfigDict(extra="forbid")

    assignmentDescription: str = Field(min_length=5, max_length=4000)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=20)
    teacherContext: str | None = Field(default=None, max_length=1000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


# --- Output (model contract) --------------------------------------------


class RubricGeneratorCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    criteria: list[RubricCriterion]
    gradeLevel: str | None = None
    subject: str | None = None


# --- Wire response ------------------------------------------------------


class RubricGeneratorResponse(BaseModel):
    """Response for `POST /v1/rubric/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str
    description: str
    criteria: list[RubricCriterion]
    gradeLevel: str | None = None
    subject: str | None = None

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
