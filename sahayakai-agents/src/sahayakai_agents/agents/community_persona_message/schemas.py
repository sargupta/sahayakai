"""Pydantic models for the community-persona-message agent.

Mirrors `PersonaMessageInputSchema` / `PersonaMessageOutputSchema` in
`sahayakai-main/src/ai/flows/community-persona-message.ts`. Python is
the source of truth — TS wire types are regenerated from these models.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# --- Wire request --------------------------------------------------------

PersonaMode = Literal["reply", "fresh", "auto"]


class RecentMessage(BaseModel):
    """One of the last-N messages in the room, for context."""

    model_config = ConfigDict(extra="forbid")

    authorName: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=2000)


class CommunityPersonaMessageRequest(BaseModel):
    """Request body for `POST /v1/community-persona-message/generate`.

    Mirrors `PersonaMessageInputSchema` in TS verbatim. Bounded fields
    so a hostile client cannot exhaust prompt budget.
    """

    model_config = ConfigDict(extra="forbid")

    personaName: str = Field(min_length=1, max_length=200)
    personaState: str = Field(min_length=1, max_length=100)
    personaSubject: str = Field(min_length=1, max_length=100)
    personaGradeLevel: str = Field(min_length=1, max_length=50)
    personaVoiceTone: str = Field(min_length=1, max_length=500)
    preferredLanguage: str = Field(min_length=1, max_length=50)
    yearsExperience: int = Field(ge=0, le=80)
    recentMessages: list[RecentMessage] = Field(
        default_factory=list, max_length=5,
    )
    mode: PersonaMode = "auto"
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


# --- Wire response -------------------------------------------------------


class CommunityPersonaMessageResponse(BaseModel):
    """Response for `POST /v1/community-persona-message/generate`.

    Parity field (`message`) matches the TS `PersonaMessageOutputSchema`;
    additive sidecar telemetry follows.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity field — MUST match TS shape.
    message: str

    # Additive telemetry.
    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
