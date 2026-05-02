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

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): bound the elements of every
# list[str] field. Without this, a 1MB string × 20 entries on
# `parentConcerns` would clear the per-list 20-entry cap but blow
# Firestore's 1 MB document limit (the call summary is persisted to
# `agent_sessions/{callSid}` after every call).
_SummaryItem = Annotated[str, StringConstraints(max_length=1000)]

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
    # Round-2 audit P1 SCHEMA-1 fix (30-agent review, group A6):
    # Twilio call SIDs follow the pattern `CA[a-f0-9]{32}` exactly.
    # Without pattern validation, a malformed SID can break the
    # Firestore composite-key path (`{turn:04d}_{role}` under
    # `agent_sessions/{callSid}/turns/`) — Firestore rejects doc IDs
    # containing `/`, but accepts most other shapes silently.
    # Tightening at the schema layer catches malformed SIDs before
    # any side-effect lands. Test harnesses that need a different SID
    # shape (e.g. `CAtest1234`) ARE supported because the regex is
    # lenient on length + alphabet.
    callSid: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")
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

    # Round-2 audit P1 SCHEMA-1 fix (group A6): callSid pattern
    # consistent with AgentReplyRequest above.
    callSid: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_-]+$")

    # Round-2 audit P1 SCHEMA-2 fix (group A6): bound every text
    # field. Original schema accepted unbounded strings — a 1MB payload
    # on `studentName` would DoS the prompt-render path (pybars3
    # template), drive Gemini token cost up, and risk silent
    # truncation downstream.
    studentName: str = Field(min_length=1, max_length=200)
    className: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    reason: str = Field(min_length=1, max_length=2000)
    teacherMessage: str = Field(min_length=0, max_length=4000)
    teacherName: str | None = Field(default=None, max_length=200)
    schoolName: str | None = Field(default=None, max_length=200)
    parentLanguage: ParentLanguage

    transcript: list[TranscriptTurn] = Field(min_length=1, max_length=24)
    callDurationSeconds: int | None = Field(default=None, ge=0, le=3600)


class CallSummaryResponse(BaseModel):
    """Summary output. Every text field is English regardless of `parentLanguage`
    (the review's P1 #18 test enforces this).
    """

    model_config = ConfigDict(extra="forbid")

    # Round-2 audit P1 SCHEMA-2 fix (group A6): bound every output
    # field. Without bounds, a model could emit a 1MB summary or a
    # 1000-item list per axis, blowing through Firestore doc size
    # limits + Cloud Logging quotas + the Next.js JSON parse budget.
    parentResponse: str = Field(min_length=0, max_length=4000)
    parentConcerns: list[_SummaryItem] = Field(default_factory=list, max_length=20)
    parentCommitments: list[_SummaryItem] = Field(default_factory=list, max_length=20)
    actionItemsForTeacher: list[_SummaryItem] = Field(
        default_factory=list, max_length=20,
    )
    guidanceGiven: list[_SummaryItem] = Field(default_factory=list, max_length=20)
    parentSentiment: ParentSentiment
    callQuality: CallQuality
    followUpNeeded: bool
    followUpSuggestion: str | None = Field(default=None, max_length=2000)

    sessionId: str = Field(max_length=128)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(max_length=200)
    cacheHitRatio: float | None = Field(default=None, ge=0.0, le=1.0)


# --- Error wire format ------------------------------------------------------


class WireError(BaseModel):
    """All sidecar errors return this shape."""

    model_config = ConfigDict(extra="forbid")

    # Round-2 audit P1 SCHEMA-2 fix: bound error fields too — a
    # reflected upstream error message could be 1MB if echoed verbatim.
    code: str = Field(max_length=64)
    message: str = Field(max_length=2000)
    retryAfterSeconds: int | None = Field(default=None, ge=0, le=86400)
    traceId: str | None = Field(default=None, max_length=200)


class WireErrorEnvelope(BaseModel):
    model_config = ConfigDict(extra="forbid")
    error: WireError
