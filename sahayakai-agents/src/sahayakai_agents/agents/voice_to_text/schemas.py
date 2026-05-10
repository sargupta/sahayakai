"""Pydantic models for voice-to-text agent (Phase I)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

# Cap audio at 10 MB (matches the existing Next.js route guard). A
# 10 MB Opus file is already ~30 minutes — far longer than any
# legitimate teacher voice note.
MAX_AUDIO_BYTES = 10 * 1024 * 1024

# Cap the data URI length budget to defend against the model receiving
# a payload that triggers Gemini API token errors before our 10 MB
# byte-level check fires. ~14 MB base64 ≈ 10 MB raw + ~33% overhead.
MAX_DATA_URI_CHARS = 14 * 1024 * 1024

# Allowed ISO codes — the same 11 Indian languages we support
# elsewhere plus English. The model is asked to return one of these;
# anything else is rejected by the behavioural guard.
ALLOWED_LANGUAGE_ISO_CODES = frozenset({
    "en", "hi", "ta", "te", "kn", "bn", "mr", "gu", "pa", "ml", "or",
})


class VoiceToTextRequest(BaseModel):
    """Request body for `POST /v1/voice-to-text/transcribe`.

    `audioDataUri` is the standard `data:<mime>;base64,<body>` form.
    The router parses out the MIME + bytes, validates size, and feeds
    the bytes to Gemini via `Part.from_bytes`.
    """

    model_config = ConfigDict(extra="forbid")

    audioDataUri: str = Field(
        min_length=32, max_length=MAX_DATA_URI_CHARS,
    )
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class VoiceToTextCore(BaseModel):
    """What the model MUST return.

    No defaults on optional fields per google-genai issue #699.
    """

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=20000)
    language: str | None = Field(max_length=10)


class VoiceToTextResponse(BaseModel):
    """Response for `POST /v1/voice-to-text/transcribe`."""

    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=20000)
    language: str | None = None

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
