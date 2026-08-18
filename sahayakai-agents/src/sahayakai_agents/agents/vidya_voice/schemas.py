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

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# ---- Shared field bounds -------------------------------------------------
#
# Teacher personalisation reaches the Live model by TWO routes: the
# `start-session` HTTP body (`SessionStartRequest`, below) and the `setup`
# first frame on the `/stream` websocket (`StreamSetupFrame`, below). Both
# end up as `build_vidya_voice_session(...)` arguments and therefore as text
# inside the same system instruction, so they must be bounded IDENTICALLY —
# otherwise the websocket becomes the soft way in for a `schoolContext` that
# the HTTP route would have refused.
#
# The bounds live here once and are referenced by both. Re-declaring
# `max_length=2000` in the second model would work today and drift the first
# time either number is tuned. These aliases are exactly equivalent to the
# `Field(max_length=...)` spellings they replace — the emitted JSON Schema
# (and so `dist/types.generated.ts`) is byte-identical.
Grade = Annotated[str, StringConstraints(max_length=50)]
Subject = Annotated[str, StringConstraints(max_length=100)]
LanguageCode = Annotated[str, StringConstraints(max_length=10)]
SchoolContext = Annotated[str, StringConstraints(max_length=2000)]
ScreenPath = Annotated[str, StringConstraints(min_length=1, max_length=500)]


# ---- Allowed flow enum (must stay in sync with vidya/schemas.py) ---------

# The Live API's tool definitions surface the same routable flows as
# the typed VIDYA path. Re-declared here (not imported) so this package
# can ship as a self-contained spike — if/when the migration lands the
# two enums become a single shared module.
#
# `instant-answer` is included to match `vidya.schemas.AllowedFlow`
# (the wire contract the TS client validates against). The Live tool
# surface itself does NOT register an `instant-answer` tool today —
# `_TOOL_DEFINITIONS` in `agent.py` only lists the 9 navigation flows
# — but keeping the Literal union aligned avoids drift between the
# two `flow` validators when generated TS types are consumed by
# `LiveToolDefinition` and `VidyaAction` simultaneously.
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
    "instant-answer",
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

    preferredGrade: Grade | None = None
    preferredSubject: Subject | None = None
    preferredLanguage: LanguageCode | None = None
    schoolContext: SchoolContext | None = None


class ScreenContextLite(BaseModel):
    """Where the teacher currently is in the app.

    Same shape as `vidya.schemas.ScreenContext` — mirrored locally so
    this package has no inbound dependency on the typed-VIDYA module.
    Bounded `uiState` for the same prompt-injection reason.
    """

    model_config = ConfigDict(extra="forbid")

    path: ScreenPath
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
    detectedLanguage: LanguageCode | None = None


# ---- Stream setup frame --------------------------------------------------


class StreamSetupPayload(BaseModel):
    """Teacher context for a `/v1/vidya-voice/stream` session.

    The websocket proxy is the Vertex-funded sibling of `start-session`, and
    until this model existed it had no way to receive a teacher profile at
    all: the handler called `build_vidya_voice_session(grade=None,
    subject=None, school_context=None)`, so the flagship voice path answered
    a Class 8 science teacher exactly as it answered everyone. The HTTP route
    had the profile all along.

    Field names are the websocket's own (`grade`, not `preferredGrade`)
    because this frame is not a teacher profile — it is the per-session
    context, flattened, the shape the client already holds. The BOUNDS are
    the `SessionStartRequest` bounds, shared not copied (see `Grade` &c.
    above), so neither route can become the lenient one.

    Every field is optional: this frame is an ENRICHMENT. A client that
    sends nothing, or sends only a language, gets the same unpersonalised
    session it got before, never an error.
    """

    model_config = ConfigDict(extra="forbid")

    grade: Grade | None = None
    subject: Subject | None = None
    schoolContext: SchoolContext | None = None
    language: LanguageCode | None = None
    screenPath: ScreenPath | None = None


class StreamSetupFrame(BaseModel):
    """The optional first client frame: `{"setup": {...}}`.

    Wrapped rather than bare so the frame is self-describing on a socket
    that also carries `{"audio": ...}`, `{"text": ...}` and `{"end": true}`
    — the handler dispatches on the `setup` key alone and never has to guess.

    `extra="forbid"` on the wrapper is deliberate: a frame carrying both
    `setup` and audio is a client bug, and accepting it would silently drop
    one half of it.
    """

    model_config = ConfigDict(extra="forbid")

    setup: StreamSetupPayload


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
