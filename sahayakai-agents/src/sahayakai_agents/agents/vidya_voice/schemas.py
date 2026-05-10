"""Pydantic models for the VIDYA voice (Gemini Live) session-start contract.

The sidecar acts as a session-MANAGER, not an audio proxy. The browser
client (OmniOrb) opens a direct WebSocket to Gemini Live using the
ephemeral token we mint here. Audio bytes never traverse the sidecar —
this is critical for the ~500ms latency target (every extra hop adds
~50-100ms RTT).

Wire shape mirrors the lesson-plan / vidya routers: bounded strings,
`extra="forbid"` everywhere, no defaults on optional fields per
google-genai issue #699.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ---- Allowed flow enum (must stay in sync with vidya/schemas.py) ---------

# The Live API's tool definitions surface the same 9 routable flows as
# the typed VIDYA path. Re-declared here (not imported) so this package
# can ship as a self-contained spike — if/when the migration lands the
# two enums become a single shared module.
LiveAllowedFlow = Literal[
    "lesson-plan",
    "quiz-generator",
    "visual-aid-designer",
    "worksheet-wizard",
    "virtual-field-trip",
    "teacher-training",
    "rubric-generator",
    "exam-paper",
    "video-storyteller",
]


# ---- Request -------------------------------------------------------------


class TeacherProfileLite(BaseModel):
    """Subset of teacher profile injected into the Live system instruction.

    Mirrors `vidya.schemas.TeacherProfile` but flattened for the spike —
    the Live system instruction is a single string template, not a
    handlebars render. Bounded so a hostile schoolContext can't blow
    out the prompt budget on the Live session.
    """

    model_config = ConfigDict(extra="forbid")

    preferredGrade: str | None = Field(default=None, max_length=50)
    preferredSubject: str | None = Field(default=None, max_length=100)
    preferredLanguage: str | None = Field(default=None, max_length=10)
    schoolContext: str | None = Field(default=None, max_length=2000)


class ScreenContextLite(BaseModel):
    """Where the teacher currently is in the app.

    Same shape as `vidya.schemas.ScreenContext` — mirrored locally so
    this package has no inbound dependency on the typed-VIDYA module.
    Bounded `uiState` for the same prompt-injection reason.
    """

    model_config = ConfigDict(extra="forbid")

    path: str = Field(min_length=1, max_length=500)
    uiState: dict[str, str] | None = Field(default=None, max_length=20)


class SessionStartRequest(BaseModel):
    """Body for POST /v1/vidya-voice/start-session.

    The OmniOrb client posts this with a Firebase ID token in the
    Authorization header (the same auth path as /v1/vidya/orchestrate).
    The sidecar mints a short-lived Live API token and returns it plus
    the WSS URL the client should connect to directly.
    """

    model_config = ConfigDict(extra="forbid")

    teacherProfile: TeacherProfileLite
    currentScreenContext: ScreenContextLite
    detectedLanguage: str | None = Field(default=None, max_length=10)


# ---- Response ------------------------------------------------------------


class LiveSessionConfig(BaseModel):
    """Fields the client uses to open the Live API connection.

    `model` and `voice` are echoed back so the client doesn't need to
    hardcode them — keeps server-side A/B testing decoupled from a
    front-end deploy.

    `responseModalities` is `["AUDIO"]` for the spike (mic in, audio
    out). Future variants might add `["AUDIO", "TEXT"]` for a
    captioned mode, but the spike keeps the surface minimal.
    """

    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=100)
    voice: str = Field(min_length=1, max_length=50)
    responseModalities: list[Literal["AUDIO", "TEXT"]] = Field(
        min_length=1, max_length=2
    )
    languageCode: str | None = Field(default=None, max_length=10)


class LiveToolDefinition(BaseModel):
    """One tool the Live session can call inline.

    Each of the 9 NAVIGATE_AND_FILL flows surfaces as a separate Live
    tool — when the model decides the teacher wants a quiz, it emits
    a `quiz_generator` tool call with extracted params. The OmniOrb
    client maps tool calls 1:1 to the existing `VidyaAction` shape.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=64)
    description: str = Field(min_length=1, max_length=500)
    flow: LiveAllowedFlow


class SessionStartResponse(BaseModel):
    """Body for the start-session response.

    `sessionToken` is opaque — the client passes it as the API key on
    the WebSocket open. It expires after `expiresInSeconds` and is
    single-use for a single new session (subsequent reconnects within
    the session use Live's own resumption tokens).
    """

    model_config = ConfigDict(extra="forbid")

    sessionToken: str = Field(min_length=1, max_length=2000)
    wssUrl: str = Field(min_length=1, max_length=500)
    expiresInSeconds: int = Field(ge=10, le=900)
    sessionConfig: LiveSessionConfig
    tools: list[LiveToolDefinition] = Field(min_length=1, max_length=20)
    sidecarVersion: str = Field(min_length=1, max_length=64)
    spike: bool = Field(default=True)
