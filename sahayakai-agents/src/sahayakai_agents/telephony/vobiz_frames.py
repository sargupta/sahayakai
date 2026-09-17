"""The Vobiz media-stream frame protocol.

Close to Twilio's, and different in the two places that matter. Getting either
wrong produces a call that connects and then sits in silence, with nothing in
any log to say why — so the differences are encoded here once, with tests, and
never open-coded at the socket.

    Twilio                      Vobiz
    ------                      -----
    "streamSid"                 "streamId"
    outbound event "media"      outbound event "playAudio"
    outbound event "clear"      outbound event "clearAudio"

Inbound events are `start`, `media` and `stop`, and the stream id may arrive
either at the top level or nested under `start` depending on the leg.
"""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass
from enum import StrEnum
from typing import Any

__all__ = [
    "InboundKind",
    "InboundFrame",
    "parse_inbound",
    "build_play_audio",
    "build_clear_audio",
    "MULAW_CONTENT_TYPE",
    "MULAW_SAMPLE_RATE",
]

MULAW_CONTENT_TYPE = "audio/x-mulaw"
MULAW_SAMPLE_RATE = 8000


class InboundKind(StrEnum):
    START = "start"
    MEDIA = "media"
    STOP = "stop"
    #: Parsed fine, but not a frame we act on. Ignored rather than treated as an
    #: error: carriers add events over time and an unknown one must never drop a
    #: live call.
    UNKNOWN = "unknown"
    #: Could not be parsed at all.
    INVALID = "invalid"


@dataclass(frozen=True)
class InboundFrame:
    kind: InboundKind
    stream_id: str | None = None
    #: Decoded mu-law bytes for MEDIA frames.
    audio: bytes | None = None


def parse_inbound(raw: str | bytes) -> InboundFrame:  # noqa: PLR0911 — one return per frame shape; the enumeration is the parser
    """Parse one carrier frame. Never raises."""
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return InboundFrame(InboundKind.INVALID)
    if not isinstance(data, dict):
        return InboundFrame(InboundKind.INVALID)

    # The id may be top-level or nested under `start`.
    nested = data.get("start")
    start: dict[str, Any] = nested if isinstance(nested, dict) else {}
    stream_id = data.get("streamId") or start.get("streamId")

    event = data.get("event") or data.get("type")
    if event == "start":
        return InboundFrame(InboundKind.START, stream_id=stream_id)
    if event == "stop":
        return InboundFrame(InboundKind.STOP, stream_id=stream_id)
    if event == "media":
        media = data.get("media")
        payload = media.get("payload") if isinstance(media, dict) else None
        if not payload:
            # A media frame with no audio is not an error worth closing over;
            # treat it as nothing to play.
            return InboundFrame(InboundKind.MEDIA, stream_id=stream_id, audio=b"")
        try:
            audio = base64.b64decode(payload)
        except (ValueError, TypeError):
            return InboundFrame(InboundKind.INVALID, stream_id=stream_id)
        return InboundFrame(InboundKind.MEDIA, stream_id=stream_id, audio=audio)
    return InboundFrame(InboundKind.UNKNOWN, stream_id=stream_id)


def build_play_audio(stream_id: str, ulaw: bytes) -> str:
    """One frame of mu-law audio for the carrier to play to the parent."""
    return json.dumps(
        {
            "event": "playAudio",
            "streamId": stream_id,
            "media": {
                "contentType": MULAW_CONTENT_TYPE,
                "sampleRate": MULAW_SAMPLE_RATE,
                "payload": base64.b64encode(ulaw).decode(),
            },
        }
    )


def build_clear_audio(stream_id: str) -> str:
    """Drop whatever the carrier has buffered.

    This is what makes interruption work. Without it, a parent who cuts in keeps
    hearing the rest of a sentence the model has already abandoned, which is the
    single most robot-like thing a voice agent can do.
    """
    return json.dumps({"event": "clearAudio", "streamId": stream_id})
