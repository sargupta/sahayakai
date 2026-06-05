"""Pydantic models for worksheet wizard agent (Phase D.4).

This is the only Phase D agent with multimodal input — the wire
request carries an `imageDataUri` (base64-encoded photo of a
textbook page). The router decodes the data URI and passes the
image bytes to Gemini as a multimodal Part alongside the text prompt.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): bound list[str] elements.
# Phase 1a: bounds kept on REQUEST elements only (dispatcher hygiene).
_LearningObjective = Annotated[str, StringConstraints(max_length=300)]

# 10 MB cap on the data URI (base64-encoded image, after URL prefix).
# A typical 1024×768 JPEG is ~150 KB → ~200 KB base64. 10 MB ceiling
# accommodates high-res phone photos while bounding prompt cost.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024


WorksheetActivityType = Literal["question", "puzzle", "creative_task"]


class WorksheetActivity(BaseModel):
    """One activity in the worksheet (response model)."""

    model_config = ConfigDict(extra="forbid")

    type: WorksheetActivityType
    content: str
    explanation: str
    chalkboardNote: str | None = None


class WorksheetAnswerKeyEntry(BaseModel):
    """One answer-key entry (response model)."""

    model_config = ConfigDict(extra="forbid")

    activityIndex: int = Field(ge=0)
    answer: str


class WorksheetRequest(BaseModel):
    """Request body for `POST /v1/worksheet/generate`."""

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(min_length=20, max_length=_DATA_URI_MAX_LEN)
    prompt: str = Field(min_length=3, max_length=2000)
    language: str | None = Field(default=None, max_length=20)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    teacherContext: str | None = Field(default=None, max_length=1000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class WorksheetCore(BaseModel):
    """What the model MUST return.

    Phase 1a: bounds dropped to match Genkit Zod baseline.
    """

    model_config = ConfigDict(extra="forbid")

    title: str
    gradeLevel: str
    subject: str
    learningObjectives: list[str]
    studentInstructions: str
    activities: list[WorksheetActivity]
    answerKey: list[WorksheetAnswerKeyEntry]


class WorksheetResponse(BaseModel):
    """Response for `POST /v1/worksheet/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str
    gradeLevel: str
    subject: str
    learningObjectives: list[str]
    studentInstructions: str
    activities: list[WorksheetActivity]
    answerKey: list[WorksheetAnswerKeyEntry]

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
