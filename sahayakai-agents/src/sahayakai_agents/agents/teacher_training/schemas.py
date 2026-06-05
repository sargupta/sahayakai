"""Pydantic models for teacher-training agent (Phase D.2)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TeacherTrainingAdvicePoint(BaseModel):
    """One advice point (response model)."""

    model_config = ConfigDict(extra="forbid")

    strategy: str
    pedagogy: str
    explanation: str


class TeacherTrainingRequest(BaseModel):
    """Request body for `POST /v1/teacher-training/advise`."""

    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=5, max_length=4000)
    language: str | None = Field(default=None, max_length=20)
    subject: str | None = Field(default=None, max_length=100)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class TeacherTrainingCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    introduction: str
    advice: list[TeacherTrainingAdvicePoint]
    conclusion: str
    gradeLevel: str | None = None
    subject: str | None = None


class TeacherTrainingResponse(BaseModel):
    """Response for `POST /v1/teacher-training/advise`."""

    model_config = ConfigDict(extra="forbid")

    introduction: str
    advice: list[TeacherTrainingAdvicePoint]
    conclusion: str
    gradeLevel: str | None = None
    subject: str | None = None

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
