"""Pydantic models — source of truth for the instant-answer contract.

Mirrors the existing Genkit shape in
`sahayakai-main/src/ai/flows/instant-answer.ts` and the wire shape
the `/api/ai/instant-answer` route accepts today. **When TS and
Python disagree, Python wins** — the TS Zod schema will be regenerated
from these models in CI (same drift check pattern as parent-call /
lesson-plan / vidya).

Phase 6 §6.1 deliverable.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# --- Wire request -------------------------------------------------------


class InstantAnswerRequest(BaseModel):
    """Request body for POST /v1/instant-answer/answer.

    The Next.js route handler does the auth, rate-limit, safety-check,
    profile lookup, and length cap BEFORE the dispatcher forwards to
    the sidecar. By the time this body lands here:

    - `question` is bounded to 4000 chars (Wave 2 cap)
    - `userId` is the authenticated teacher (always present on the
      sidecar wire — anonymous calls are rejected upstream)
    - `language` and `gradeLevel` are normalised (`hi` not `Hindi`,
      `Class 5` not `5th`)
    """

    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=4000)
    language: str | None = Field(default=None, max_length=10)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    userId: str = Field(
        min_length=1,
        max_length=128,
        # Same userId pattern as parent-call / lesson-plan: alphanumeric
        # plus underscore / hyphen. Defends against path-injection in
        # any downstream Firestore document IDs.
        pattern=r"^[A-Za-z0-9_\-]+$",
    )


# --- Wire response ------------------------------------------------------


class InstantAnswerCore(BaseModel):
    """Model output schema — what the answerer agent MUST return.

    Same field set as `InstantAnswerOutputSchema` in TS. No defaults
    on optional fields per google-genai issue #699 workaround.
    """

    model_config = ConfigDict(extra="forbid")

    answer: str = Field(min_length=1, max_length=8000)
    videoSuggestionUrl: str | None = Field(max_length=500)
    gradeLevel: str | None = Field(max_length=50)
    subject: str | None = Field(max_length=100)


class InstantAnswerResponse(BaseModel):
    """Response for POST /v1/instant-answer/answer.

    Parity fields match the TS `InstantAnswerOutputSchema` verbatim;
    additive sidecar telemetry follows.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity fields — MUST match TS InstantAnswerOutputSchema.
    answer: str = Field(min_length=1, max_length=8000)
    videoSuggestionUrl: str | None = Field(default=None, max_length=500)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
    # Whether Gemini's Google Search grounding was used during this
    # answer. Surfaced for observability — operators can break
    # answer-quality dashboards down by grounded vs un-grounded.
    groundingUsed: bool
