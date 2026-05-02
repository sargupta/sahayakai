"""Pydantic models for teacher-training agent (Phase D.2)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class TeacherTrainingAdvicePoint(BaseModel):
    """One advice point with explicit pedagogical grounding."""

    model_config = ConfigDict(extra="forbid")

    strategy: str = Field(min_length=10, max_length=1000)
    pedagogy: str = Field(min_length=2, max_length=200)
    explanation: str = Field(min_length=20, max_length=2000)


class TeacherTrainingRequest(BaseModel):
    """Request body for `POST /v1/teacher-training/advise`."""

    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=5, max_length=4000)
    language: str | None = Field(default=None, max_length=20)
    subject: str | None = Field(default=None, max_length=100)
    userId: str = Field(
        min_length=1,
        max_length=128,
        pattern=r"^[A-Za-z0-9_\-]+$",
    )


class TeacherTrainingCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    introduction: str = Field(min_length=20, max_length=1500)
    advice: list[TeacherTrainingAdvicePoint] = Field(min_length=2, max_length=8)
    conclusion: str = Field(min_length=10, max_length=1500)
    gradeLevel: str | None = Field(max_length=50)
    subject: str | None = Field(max_length=100)


class TeacherTrainingResponse(BaseModel):
    """Response for `POST /v1/teacher-training/advise`."""

    model_config = ConfigDict(extra="forbid")

    introduction: str = Field(min_length=20, max_length=1500)
    advice: list[TeacherTrainingAdvicePoint] = Field(min_length=2, max_length=8)
    conclusion: str = Field(min_length=10, max_length=1500)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
