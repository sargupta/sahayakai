"""Pydantic models for the parent-message-generator agent.

Phase C §C.1. Mirrors the existing Genkit shape in
`sahayakai-main/src/ai/flows/parent-message-generator.ts`. **When TS
and Python disagree, Python wins** — the TS Zod schema is regenerated
from these models in CI (same drift check as the other ADK agents).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Enums (kept in sync with the existing TS contract) -----------------

ParentMessageReason = Literal[
    "consecutive_absences",
    "poor_performance",
    "behavioral_concern",
    "positive_feedback",
]

# 11 supported parent-language names (matches the existing
# LANGUAGE_TO_BCP47 map in parent-message-generator.ts).
ParentLanguageName = Literal[
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
]


# --- Optional performance context ---------------------------------------


class SubjectAssessment(BaseModel):
    """One row of the recent-assessments breakdown."""

    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    marksObtained: float = Field(ge=0)
    maxMarks: float = Field(gt=0)
    percentage: float = Field(ge=0, le=100)
    date: str = Field(min_length=1, max_length=50)


class PerformanceContext(BaseModel):
    """Snapshot of recent academic performance — populated by the
    Contact-Parent modal so the model can cite specific scores when
    `reason == 'poor_performance'` or `'positive_feedback'`."""

    model_config = ConfigDict(extra="forbid")

    latestPercentage: float | None = Field(default=None, ge=0, le=100)
    isAtRisk: bool | None = None
    subjectBreakdown: list[SubjectAssessment] | None = Field(
        default=None, max_length=10,
    )


# --- Wire request -------------------------------------------------------


class ParentMessageRequest(BaseModel):
    """Request body for `POST /v1/parent-message/generate`.

    Mirrors `ParentMessageInputSchema` in TS verbatim. Bounded fields
    so a hostile client can't exhaust prompt budget.
    """

    model_config = ConfigDict(extra="forbid")

    studentName: str = Field(min_length=1, max_length=200)
    className: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=100)
    reason: ParentMessageReason
    # `reasonContext` is computed server-side from `reason` in the
    # existing Genkit flow; we keep it in the schema for parity but
    # the sidecar will overwrite it from a canonical map (preventing
    # injection-via-reasonContext-string).
    reasonContext: str | None = Field(default=None, max_length=2000)
    teacherNote: str | None = Field(default=None, max_length=2000)
    parentLanguage: ParentLanguageName
    consecutiveAbsentDays: int | None = Field(default=None, ge=0, le=365)
    teacherName: str | None = Field(default=None, max_length=200)
    schoolName: str | None = Field(default=None, max_length=300)
    performanceContext: PerformanceContext | None = None
    performanceSummary: str | None = Field(default=None, max_length=2000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


# --- Output (model contract) --------------------------------------------


class ParentMessageCore(BaseModel):
    """What the model MUST return.

    Same shape as `ParentMessageOutputSchema` in TS. No defaults on
    optional fields per google-genai issue #699.
    """

    model_config = ConfigDict(extra="forbid")

    message: str
    languageCode: str
    wordCount: int = Field(ge=1)


# --- Wire response ------------------------------------------------------


class ParentMessageResponse(BaseModel):
    """Response for `POST /v1/parent-message/generate`.

    Parity fields match the TS `ParentMessageOutputSchema` exactly;
    additive sidecar telemetry follows.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity fields — MUST match TS shape.
    message: str
    languageCode: str = Field(min_length=5, max_length=12)
    wordCount: int = Field(ge=1, le=500)

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
