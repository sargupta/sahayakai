"""Pydantic models for worksheet wizard agent (Phase D.4).

This is the only Phase D agent with multimodal input — the wire
request carries an `imageDataUri` (base64-encoded photo of a
textbook page). The router decodes the data URI and passes the
image bytes to Gemini as a multimodal Part alongside the text prompt.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# 10 MB cap on the data URI (base64-encoded image, after URL prefix).
# A typical 1024×768 JPEG is ~150 KB → ~200 KB base64. 10 MB ceiling
# accommodates high-res phone photos while bounding prompt cost.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024


WorksheetActivityType = Literal["question", "puzzle", "creative_task"]


class WorksheetActivity(BaseModel):
    """One activity in the worksheet."""

    model_config = ConfigDict(extra="forbid")

    type: WorksheetActivityType
    content: str = Field(min_length=1, max_length=4000)
    explanation: str = Field(min_length=10, max_length=2000)
    chalkboardNote: str | None = Field(default=None, max_length=1000)


class WorksheetAnswerKeyEntry(BaseModel):
    """One answer-key entry."""

    model_config = ConfigDict(extra="forbid")

    activityIndex: int = Field(ge=0, le=50)
    answer: str = Field(min_length=1, max_length=2000)


class WorksheetRequest(BaseModel):
    """Request body for `POST /v1/worksheet/generate`."""

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(min_length=20, max_length=_DATA_URI_MAX_LEN)
    prompt: str = Field(min_length=3, max_length=2000)
    language: str | None = Field(default=None, max_length=20)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    teacherContext: str | None = Field(default=None, max_length=1000)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class WorksheetCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    learningObjectives: list[str] = Field(min_length=1, max_length=10)
    studentInstructions: str = Field(min_length=10, max_length=2000)
    activities: list[WorksheetActivity] = Field(min_length=1, max_length=20)
    answerKey: list[WorksheetAnswerKeyEntry] = Field(min_length=1, max_length=20)


class WorksheetResponse(BaseModel):
    """Response for `POST /v1/worksheet/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    learningObjectives: list[str] = Field(min_length=1, max_length=10)
    studentInstructions: str = Field(min_length=10, max_length=2000)
    activities: list[WorksheetActivity] = Field(min_length=1, max_length=20)
    answerKey: list[WorksheetAnswerKeyEntry] = Field(min_length=1, max_length=20)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
