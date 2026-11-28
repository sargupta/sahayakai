"""The Exotel AgentStream (Voicebot) frame protocol, converted to the bridge's mu-law at the edge.

Exotel differs from Vobiz/Plivo in three ways that matter, each of which would produce a call
that connects and then sits in silence if open-coded at the socket:

    Vobiz / Plivo                       Exotel
    -------------                       ------
    "streamId"                          "stream_sid"
    mu-law 8 kHz                        raw PCM16, little-endian, mono, 8 kHz (base64)
    outbound "playAudio" (20 ms ok)     outbound "media", chunk 3,200..100,000 bytes in
                                        multiples of 320 (i.e. >= 200 ms at 8 kHz)
    outbound "clearAudio"               outbound "clear"
    "playedStream" checkpoint           "mark"

Inbound events: connected, start (stream_sid, call_sid, media_format), media, dtmf, mark, stop.
Docs: https://developer.exotel.com/docs/agentstream/websocket-protocol

The rest of the bridge works in mu-law 8 kHz 20 ms frames, so inbound PCM is encoded to mu-law
here and outbound mu-law is decoded back to PCM16 and gathered into Exotel-sized chunks. The
round trip through mu-law is lossless with respect to telephone-band quality (8 kHz voice).
"""

from __future__ import annotations

import base64
import json
import sys
from array import array
from typing import Any

from .audio import pcm16_to_ulaw, ulaw_to_pcm16
from .vobiz_frames import InboundFrame, InboundKind

__all__ = [
    "EXOTEL_MIN_CHUNK_BYTES",
    "EXOTEL_CHUNK_MULTIPLE",
    "ExotelCodec",
    "parse_exotel_inbound",
]

#: Exotel's smallest accepted outbound media chunk (bytes of PCM16 = 200 ms at 8 kHz).
EXOTEL_MIN_CHUNK_BYTES = 3200
#: Outbound chunks must be a multiple of this many bytes (20 ms at 8 kHz PCM16).
EXOTEL_CHUNK_MULTIPLE = 320
#: Idle empty pacer ticks (~100 ms) before padding and flushing a partial < 200 ms tail.
EXOTEL_IDLE_FLUSH_TICKS = 5

_SILENCE_PCM_SAMPLE = b"\x00\x00"


def _pcm_le_to_samples(raw: bytes) -> array[int]:
    samples = array("h")
    usable = len(raw) - (len(raw) % 2)
    samples.frombytes(raw[:usable])
    if sys.byteorder == "big":
        samples.byteswap()
    return samples


def _samples_to_pcm_le(samples: array[int]) -> bytes:
    if sys.byteorder == "big":
        samples = array("h", samples)
        samples.byteswap()
    return samples.tobytes()


def parse_exotel_inbound(raw: str | bytes) -> InboundFrame:  # noqa: PLR0911 — one return per frame shape
    """Parse one Exotel frame into the bridge's frame type (audio as mu-law). Never raises."""
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        return InboundFrame(InboundKind.INVALID)
    if not isinstance(data, dict):
        return InboundFrame(InboundKind.INVALID)

    nested = data.get("start")
    start: dict[str, Any] = nested if isinstance(nested, dict) else {}
    stream_id = data.get("stream_sid") or start.get("stream_sid")
    event = data.get("event")

    if event == "start":
        fmt = start.get("media_format")
        media_format = str(fmt) if fmt else None
        if isinstance(fmt, dict):
            media_format = json.dumps(fmt, sort_keys=True)
        return InboundFrame(
            InboundKind.START,
            stream_id=stream_id,
            media_format=media_format,
            call_id=str(start.get("call_sid") or "") or None,
        )
    if event == "stop":
        return InboundFrame(InboundKind.STOP, stream_id=stream_id)
    if event == "mark":
        mark = data.get("mark")
        name = mark.get("name") if isinstance(mark, dict) else None
        return InboundFrame(InboundKind.PLAYED, stream_id=stream_id, name=str(name or ""))
    if event == "media":
        media = data.get("media")
        payload = media.get("payload") if isinstance(media, dict) else None
        if not payload:
            return InboundFrame(InboundKind.MEDIA, stream_id=stream_id, audio=b"")
        try:
            pcm = base64.b64decode(payload)
        except (ValueError, TypeError):
            return InboundFrame(InboundKind.INVALID, stream_id=stream_id)
        ulaw = pcm16_to_ulaw(_pcm_le_to_samples(pcm))
        return InboundFrame(InboundKind.MEDIA, stream_id=stream_id, audio=ulaw)
    # connected, dtmf and anything newer: parsed, not acted on, never fatal.
    return InboundFrame(InboundKind.UNKNOWN, stream_id=stream_id)


class ExotelCodec:
    """One call's outbound side for Exotel: mu-law frames in, Exotel-sized PCM16 chunks out.

    Stateful (holds the part of a chunk not yet sent), so the bridge makes one per call.
    """

    name = "exotel"

    def __init__(self) -> None:
        self._pending = bytearray()
        self._idle_ticks = 0

    @staticmethod
    def parse(raw: str | bytes) -> InboundFrame:
        return parse_exotel_inbound(raw)

    def _media(self, stream_id: str, pcm: bytes) -> str:
        payload = base64.b64encode(pcm).decode()
        msg = {"event": "media", "stream_sid": stream_id, "media": {"payload": payload}}
        return json.dumps(msg)

    def _emit_ready_chunks(self, stream_id: str) -> str | None:
        if len(self._pending) < EXOTEL_MIN_CHUNK_BYTES:
            return None
        size = len(self._pending) - (len(self._pending) % EXOTEL_CHUNK_MULTIPLE)
        chunk = bytes(self._pending[:size])
        del self._pending[:size]
        return self._media(stream_id, chunk)

    def play(self, stream_id: str, ulaw: bytes) -> str | None:
        """Queue one mu-law frame; return a media message once a full Exotel chunk is ready."""
        self._idle_ticks = 0
        self._pending.extend(_samples_to_pcm_le(ulaw_to_pcm16(ulaw)))
        return self._emit_ready_chunks(stream_id)

    def play_pcm8k_le(self, stream_id: str, pcm8k_le: bytes) -> str | None:
        """Queue 8 kHz PCM16 LE directly, skipping mu-law quantization round-trip."""
        self._idle_ticks = 0
        self._pending.extend(pcm8k_le)
        return self._emit_ready_chunks(stream_id)

    def flush(self, stream_id: str) -> str | None:
        """Send what is held, padded with silence to Exotel's minimum chunk (utterance end)."""
        self._idle_ticks = 0
        if not self._pending:
            return None
        chunk = bytes(self._pending)
        self._pending.clear()
        if len(chunk) < EXOTEL_MIN_CHUNK_BYTES:
            chunk += _SILENCE_PCM_SAMPLE * ((EXOTEL_MIN_CHUNK_BYTES - len(chunk)) // 2)
        remainder = len(chunk) % EXOTEL_CHUNK_MULTIPLE
        if remainder:
            chunk += b"\x00" * (EXOTEL_CHUNK_MULTIPLE - remainder)
        return self._media(stream_id, chunk)

    def flush_idle(self, stream_id: str) -> str | None:
        """On empty pacer ticks, wait EXOTEL_IDLE_FLUSH_TICKS before zero-padding a short tail."""
        if not self._pending:
            self._idle_ticks = 0
            return None
        self._idle_ticks += 1
        if len(self._pending) < EXOTEL_MIN_CHUNK_BYTES and self._idle_ticks < EXOTEL_IDLE_FLUSH_TICKS:
            return None
        return self.flush(stream_id)

    def clear(self, stream_id: str) -> str:
        """Barge-in: drop what we hold AND what Exotel has buffered."""
        self._pending.clear()
        self._idle_ticks = 0
        return json.dumps({"event": "clear", "stream_sid": stream_id})
