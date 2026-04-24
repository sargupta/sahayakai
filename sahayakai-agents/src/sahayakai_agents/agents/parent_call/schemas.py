"""Pydantic models — source of truth for the parent-call contract.

Every field from the TypeScript Zod schemas in
`sahayakai-main/src/ai/flows/parent-call-agent.ts` is mirrored here with
equivalent types. **When TS and Python disagree, Python wins.** TypeScript
types are regenerated from these models via `datamodel-codegen` in CI.

Review trace:
- P1 #14 single source of truth.
- P0 #10 `callSid` + `turnNumber` composite key; `turnNumber` is required for writes.
- Round-2 fix: `parentLanguage` is now an explicit Literal over the 11
  supported language codes rather than an open 2-5 char string. A typo like
  `"sw"` now fails validation at the edge instead of hitting the model and
  drifting the parent-facing reply.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# The 11 languages SahayakAI actually supports. Keep in sync with the
# SAHAYAK_SOUL_PROMPT language mapping and with the client-side language
# picker in sahayakai-main.
ParentLanguage = Literal[
    "en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "pa", "ml", "or"
]


class TranscriptTurn(BaseModel):
    """One utterance inside a call transcript."""

    model_config = ConfigDict(extra="forbid")

    role: Literal["agent", "parent"]
    text: str = Field(min_length=0, max_length=4000)


# --- Reply (per-turn) -------------------------------------------------------


class AgentReplyRequest(BaseModel):
    """Request body for POST /v1/parent-call/reply."""

    model_config = ConfigDict(extra="forbid")

    # P0 #10: callSid is the session key root; turnNumber is the OCC token.
    callSid: str = Field(min_length=1, max_length=128)
    turnNumber: int = Field(ge=1, le=12)

    studentName: str = Field(min_length=1, max_length=200)
    className: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=2000)
    teacherMessage: str = Field(min_length=0, max_length=4000)
    teacherName: str | None = Field(default=None, max_length=200)
    schoolName: str | None = Field(default=None, max_length=200)

    parentLanguage: ParentLanguage

    # What the parent said this turn (already transcribed).
    parentSpeech: str = Field(min_length=0, max_length=4000)

    # Optional. If present, the agent may quote ONLY when parent asks about marks.
    performanceSummary: str | None = Field(default=None, max_length=2000)

    # Optional. During shadow mode Next.js can still pass the full transcript
    # defensively. Sidecar otherwise loads from Firestore. Bounded to 24
    # turns so a malformed or malicious payload can't drive sidecar memory
    # pressure past its cap on any single call.
    transcript: list[TranscriptTurn] | None = Field(default=None, max_length=24)


class AgentReplyResponse(BaseModel):
    """Response for POST /v1/parent-call/reply. Superset of the TS contract.

    New (additive, non-breaking) fields:
    - `sessionId` — echoes callSid for observability.
    - `latencyMs` — end-to-end sidecar latency.
    - `modelUsed` — e.g. "gemini-2.5-flash".
    - `cacheHitRatio` — implicit-cache observability.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity fields — MUST match TS AgentReplyOutputSchema exactly.
    reply: str = Field(min_length=1, max_length=4000)
    shouldEndCall: bool
    followUpQuestion: str | None = Field(default=None, max_length=500)

    # Additive telemetry.
    sessionId: str
    turnNumber: int
    latencyMs: int = Field(ge=0)
    modelUsed: str
    cacheHitRatio: float | None = Field(default=None, ge=0.0, le=1.0)


# --- Summary (post-call) ----------------------------------------------------


ParentSentiment = Literal[
    "cooperative", "concerned", "grateful", "upset", "indifferent", "confused"
]
CallQuality = Literal["productive", "brief", "difficult", "unanswered"]


class CallSummaryRequest(BaseModel):
    """Request body for POST /v1/parent-call/summary."""

    model_config = ConfigDict(extra="forbid")

    callSid: str = Field(min_length=1, max_length=128)
    studentName: str
    className: str
    subject: str
    reason: str
    teacherMessage: str
    teacherName: str | None = None
    schoolName: str | None = None
    parentLanguage: ParentLanguage

    transcript: list[TranscriptTurn] = Field(max_length=24)
    callDurationSeconds: int | None = None


class CallSummaryResponse(BaseModel):
    """Summary output. Every text field is English regardless of `parentLanguage`
    (the review's P1 #18 test enforces this).
    """

    model_config = ConfigDict(extra="forbid")

    parentResponse: str
    parentConcerns: list[str]
    parentCommitments: list[str]
    actionItemsForTeacher: list[str]
    guidanceGiven: list[str]
    parentSentiment: ParentSentiment
    callQuality: CallQuality
    followUpNeeded: bool
    followUpSuggestion: str | None = None

    sessionId: str
    latencyMs: int
    modelUsed: str
    cacheHitRatio: float | None = None


# --- Error wire format ------------------------------------------------------


class WireError(BaseModel):
    """All sidecar errors return this shape."""

    model_config = ConfigDict(extra="forbid")

    code: str
    message: str
    retryAfterSeconds: int | None = None
    traceId: str | None = None


class WireErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: WireError
