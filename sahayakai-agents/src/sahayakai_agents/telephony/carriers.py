"""The phone carriers the Riya bridge can carry a call for, and what differs between them.

Everything about a call — Riya's workflow, Gemini Live, pacing, barge-in, the Sampark context
and result — is carrier-independent and stays in router.py. Only four things differ per carrier:

    stream token domain   which signed token opens this carrier's socket (tokens.py)
    frame codec           parse inbound frames; build play / clear messages (mu-law in the bridge)
    hangup                how the bridge ends the call when Riya is done
    route                 /telephony/<carrier>/stream

    carrier  frames                     audio on the wire        hangup
    -------  ------                     -----------------        ------
    vobiz    vobiz_frames (Plivo-like)  mu-law 8 kHz             Vobiz REST (X-Auth-ID/Token)
    plivo    vobiz_frames (same shape)  mu-law 8 kHz             Plivo REST (HTTP Basic)
    exotel   exotel_frames              PCM16 LE 8 kHz, chunked  close the stream (no REST verb)

Plivo stream protocol: https://www.plivo.com/docs/voice/xml/audio-streaming (start/media/dtmf/
playedStream/clearedAudio in; playAudio/clearAudio/checkpoint out) — the shape Vobiz mirrors.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Protocol

import structlog

from .exotel_frames import ExotelCodec
from .tokens import VobizDomain
from .vobiz_frames import InboundFrame, build_clear_audio, build_play_audio, parse_inbound

__all__ = ["Carrier", "CarrierCodec", "CARRIERS", "hangup_call", "new_codec"]

log = structlog.get_logger(__name__)


class CarrierCodec(Protocol):
    name: str

    def parse(self, raw: str | bytes) -> InboundFrame: ...

    def play(self, stream_id: str, ulaw: bytes) -> str | None: ...

    def flush(self, stream_id: str) -> str | None: ...

    def clear(self, stream_id: str) -> str: ...


class PlivoStyleCodec:
    """Vobiz and Plivo frames (playAudio / clearAudio, mu-law 8 kHz).

    `frames_per_message`: Vobiz keeps 1 (20 ms, unchanged). Plivo gets 5 (100 ms per playAudio):
    50 tiny messages a second through a tunnel arrived with enough jitter to break Riya's words up
    on a real Plivo call (2026-11-24); Plivo queues what it is sent, so 100 ms chunks play smoothly.
    """

    def __init__(self, name: str, frames_per_message: int = 1) -> None:
        self.name = name
        self._batch = max(1, frames_per_message)
        self._pending = bytearray()

    @staticmethod
    def parse(raw: str | bytes) -> InboundFrame:
        return parse_inbound(raw)

    def play(self, stream_id: str, ulaw: bytes) -> str | None:
        if self._batch == 1:
            return build_play_audio(stream_id, ulaw)
        self._pending.extend(ulaw)
        if len(self._pending) < 160 * self._batch:
            return None
        chunk = bytes(self._pending)
        self._pending.clear()
        return build_play_audio(stream_id, chunk)

    def flush(self, stream_id: str) -> str | None:
        if not self._pending:
            return None
        chunk = bytes(self._pending)
        self._pending.clear()
        return build_play_audio(stream_id, chunk)

    def clear(self, stream_id: str) -> str:
        self._pending.clear()
        return build_clear_audio(stream_id)


@dataclass(frozen=True)
class Carrier:
    name: str
    stream_domain: VobizDomain


CARRIERS: dict[str, Carrier] = {
    "vobiz": Carrier("vobiz", VobizDomain.STREAM),
    "plivo": Carrier("plivo", VobizDomain.PLIVO_STREAM),
    "exotel": Carrier("exotel", VobizDomain.EXOTEL_STREAM),
}


def new_codec(carrier: Carrier) -> CarrierCodec:
    """One codec per call (Exotel's holds a partial chunk)."""
    if carrier.name == "exotel":
        return ExotelCodec()
    return PlivoStyleCodec(carrier.name, frames_per_message=5 if carrier.name == "plivo" else 1)


async def hangup_call(carrier: Carrier, call_uuid: str) -> None:
    """End the carrier leg when Riya is done. Never raises.

    Vobiz and Plivo: the answer XML sets keepCallAlive, so closing the socket does NOT end the
    call; an explicit REST hangup does. Exotel: the stream belongs to the call itself (Connect
    Voice AI, no flow after it), so closing the socket ends it, and Exotel's TimeLimit caps it
    regardless; there is nothing to call here.
    """
    # Vobiz keeps its original, unchanged hangup (router._hangup); this covers the new carriers.
    if carrier.name != "plivo" or not call_uuid:
        return
    try:
        import httpx

        auth_id = os.environ.get("PLIVO_AUTH_ID", "").strip()
        auth_token = os.environ.get("PLIVO_AUTH_TOKEN", "").strip()
        base = os.environ.get("PLIVO_BASE_URL", "https://api.plivo.com/v1").strip().rstrip("/")
        if not (auth_id and auth_token):
            log.warning("telephony.hangup_unconfigured", carrier="plivo")
            return
        url = f"{base}/Account/{auth_id}/Call/{call_uuid}/"
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.delete(url, auth=(auth_id, auth_token))
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.hangup_failed", carrier=carrier.name, error=str(exc))
