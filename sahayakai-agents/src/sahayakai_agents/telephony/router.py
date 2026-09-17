"""Bridge a Vobiz phone leg to a Gemini Live session.

WHAT THIS IS

The parent picks up, Vobiz opens a bidirectional media socket here, and from
that moment the parent is talking to VIDYA rather than listening to a recording.
Audio flows continuously in both directions; there is no turn button and no
"press 1".

WHY IT IS NOT THE EXISTING /stream ROUTE

`vidya_voice.router` is hardened, but it is shaped for the app: 16 kHz PCM from a
browser microphone, tokens bound to a signed-in teacher's uid, six opens per uid
per hour. None of that describes a phone call. The far end here is a parent with
no account, the wire is mu-law 8 kHz, and the natural unit of concurrency is a
call rather than a user. Re-using that endpoint would have meant loosening every
one of its guards until they stopped meaning anything, so this is a sibling with
its own limits and its own token domain.

COST

Every accepted socket bills for as long as it is open, and the caller is
unauthenticated by construction. Admission therefore happens entirely BEFORE
`ws.accept()` — a rejected call costs nothing — and the token is burned on first
use so a captured answer document cannot be replayed into a second session.
"""

from __future__ import annotations

import asyncio
import contextlib
import os
import time
from array import array
from typing import Any

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import get_settings
from .audio import ULAW_SILENCE, pcm24k_to_ulaw8k, ulaw8k_to_pcm16k
from .prompt import CallContext, build_parent_call_instruction
from .tokens import VobizDomain, verify_vobiz_token
from .vobiz_frames import InboundKind, build_clear_audio, build_play_audio, parse_inbound

log = structlog.get_logger(__name__)

telephony_router = APIRouter(tags=["telephony"])

_PCM_IN_MIME = "audio/pcm;rate=16000"

# ---- Limits -------------------------------------------------------------
#
# All per process, like the web stream's: with N instances the real ceiling is
# N times these numbers. That is a deliberate trade against a shared store on
# the hot path of a live call.

#: Concurrent phone calls this instance will carry. Each one is a metered Live
#: session plus carrier minutes, so this is a spend ceiling, not a perf tuning knob.
_MAX_CONCURRENT_CALLS = int(os.environ.get("VOBIZ_MAX_CONCURRENT_CALLS", "8"))
#: Hard stop. A call that somehow never ends would otherwise bill until the
#: instance is replaced.
_MAX_CALL_SECONDS = int(os.environ.get("VOBIZ_MAX_CALL_SECONDS", "600"))
#: Nobody has said anything for this long — treat the call as dead.
_IDLE_SECONDS = int(os.environ.get("VOBIZ_IDLE_SECONDS", "45"))

#: 20 ms of mu-law at 8 kHz. Carriers expect a steady frame cadence.
_FRAME_BYTES = 160
_FRAME_SECONDS = 0.02

_CLOSE_BAD_TOKEN = 4401
_CLOSE_AT_CAPACITY = 4503
_CLOSE_MAX_DURATION = 4410
_CLOSE_IDLE = 4408

_SESSION_SEM = asyncio.Semaphore(_MAX_CONCURRENT_CALLS)
#: Tokens already spent, with the time they were spent. Bounded by TTL sweep.
_BURNED: dict[str, float] = {}
_BURN_TTL_SECONDS = 1800


def _burn(token: str) -> bool:
    """Spend a token. False if it was already spent."""
    now = time.time()
    if len(_BURNED) > 4096:
        for spent, at in list(_BURNED.items()):
            if now - at > _BURN_TTL_SECONDS:
                _BURNED.pop(spent, None)
    if token in _BURNED:
        return False
    _BURNED[token] = now
    return True


def reset_telephony_guards() -> None:
    """Test-only: clear per-process admission state."""
    _BURNED.clear()


async def _admit(ws: WebSocket) -> str | None:
    """Decide whether to carry this call. Every rejection precedes `accept()`.

    Returns the outreach id, or None having already closed the socket.
    """
    token = ws.query_params.get("t")
    outreach_id = verify_vobiz_token(VobizDomain.STREAM, token)
    if outreach_id is None:
        await ws.close(code=_CLOSE_BAD_TOKEN)
        log.warning("telephony.rejected", reason="bad_token")
        return None
    if not _burn(token or ""):
        # A replayed answer document. The first session already exists or has run.
        await ws.close(code=_CLOSE_BAD_TOKEN)
        log.warning("telephony.rejected", reason="token_replayed", outreach_id=outreach_id)
        return None
    if _SESSION_SEM.locked():
        await ws.close(code=_CLOSE_AT_CAPACITY)
        log.warning("telephony.rejected", reason="at_capacity", outreach_id=outreach_id)
        return None
    return outreach_id


async def _load_context(outreach_id: str, language: str) -> CallContext:
    """Read the teacher's message and the child's details for this call.

    Never fatal. A call that connects with a generic instruction is far better
    than a parent hearing dead air because a read timed out.
    """
    try:
        from firebase_admin import firestore  # imported lazily: not needed to serve other agents

        client = firestore.client()
        snap = await asyncio.to_thread(
            lambda: client.collection("parent_outreach").document(outreach_id).get()
        )
        data = snap.to_dict() if snap.exists else None
        if not data:
            return CallContext(language=language)
        return CallContext(
            student_name=data.get("studentName"),
            teacher_name=data.get("teacherName"),
            class_name=data.get("className"),
            language=data.get("parentLanguage") or language,
            # `spokenScript` is the phrasing written for speech; `message` is the
            # written form. Prefer the spoken one when it exists.
            message=data.get("spokenScript") or data.get("message"),
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.context_unavailable", outreach_id=outreach_id, error=str(exc))
        return CallContext(language=language)


async def _hangup(call_uuid: str) -> None:
    """End the leg through the carrier's REST API.

    Closing this socket does NOT end the call: the answer document sets
    `keepCallAlive="true"`, without which Vobiz drops the leg a second after
    handing off the verb. The consequence is that finishing a conversation
    requires an explicit hangup, or the parent is left holding an open line.
    """
    auth_id = os.environ.get("VOBIZ_AUTH_ID", "").strip()
    auth_token = os.environ.get("VOBIZ_AUTH_TOKEN", "").strip()
    base = os.environ.get("VOBIZ_BASE_URL", "https://api.vobiz.ai/api/v1").strip().rstrip("/")
    if not (call_uuid and auth_id and auth_token):
        return
    try:
        import httpx

        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.delete(
                f"{base}/Account/{auth_id}/Call/{call_uuid}/",
                headers={"X-Auth-ID": auth_id, "X-Auth-Token": auth_token},
            )
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.hangup_failed", error=str(exc))


class _Bridge:
    """Mutable state for one call. Small enough to read in one sitting."""

    def __init__(self, ws: WebSocket, outreach_id: str, call_uuid: str) -> None:
        self.ws = ws
        self.outreach_id = outreach_id
        self.call_uuid = call_uuid
        self.stream_id: str | None = None
        self.stop = False
        #: Bumped on every interruption. Frames queued under an older generation
        #: are dropped rather than played, which is what makes barge-in feel
        #: instant instead of "it finishes its sentence first".
        self.generation = 0
        self.out: asyncio.Queue[tuple[int, bytes | None]] = asyncio.Queue()
        self.tail: array[int] | None = None
        self.last_voice = time.monotonic()
        self.bytes_up = 0
        self.bytes_down = 0


async def _pump_carrier_to_live(bridge: _Bridge, session: Any) -> str:
    """Parent's audio -> the model."""
    from google.genai import types as genai_types

    while not bridge.stop:
        try:
            raw = await asyncio.wait_for(bridge.ws.receive_text(), timeout=_IDLE_SECONDS)
        except TimeoutError:
            return "idle_timeout"
        except (WebSocketDisconnect, RuntimeError):
            return "carrier_disconnect"

        frame = parse_inbound(raw)
        if frame.kind is InboundKind.START:
            bridge.stream_id = frame.stream_id
            log.info(
                "telephony.stream_start",
                outreach_id=bridge.outreach_id,
                stream_id=frame.stream_id,
            )
        elif frame.kind is InboundKind.MEDIA and frame.audio:
            bridge.stream_id = bridge.stream_id or frame.stream_id
            bridge.bytes_up += len(frame.audio)
            bridge.last_voice = time.monotonic()
            await session.send_realtime_input(
                audio=genai_types.Blob(
                    data=ulaw8k_to_pcm16k(frame.audio), mime_type=_PCM_IN_MIME
                )
            )
        elif frame.kind is InboundKind.STOP:
            return "carrier_stop"
    return "stopped"


async def _pump_live_to_carrier(bridge: _Bridge, session: Any) -> str:
    """The model's audio -> the parent, plus interruption handling."""
    async for resp in session.receive():
        if bridge.stop:
            break
        server = getattr(resp, "server_content", None)
        if server is not None and getattr(server, "interrupted", False):
            # The parent started speaking. Drop everything already queued AND
            # tell the carrier to discard what it has buffered; doing only the
            # first still leaves a second of stale speech in the parent's ear.
            bridge.generation += 1
            while not bridge.out.empty():
                with contextlib.suppress(asyncio.QueueEmpty):
                    bridge.out.get_nowait()
            if bridge.stream_id:
                with contextlib.suppress(Exception):
                    await bridge.ws.send_text(build_clear_audio(bridge.stream_id))

        data = getattr(resp, "data", None)
        if data:
            ulaw, bridge.tail = pcm24k_to_ulaw8k(data, bridge.tail)
            # Split into carrier-sized frames here so the sender only paces.
            for start in range(0, len(ulaw), _FRAME_BYTES):
                chunk = ulaw[start : start + _FRAME_BYTES]
                if len(chunk) < _FRAME_BYTES:
                    chunk = chunk + bytes([ULAW_SILENCE]) * (_FRAME_BYTES - len(chunk))
                bridge.out.put_nowait((bridge.generation, chunk))
    return "live_stream_end"


async def _pace_outbound(bridge: _Bridge) -> None:
    """Emit one 20 ms frame every 20 ms.

    A single sender task, never concurrent writes. Dumping the model's audio as
    fast as it arrives overruns the carrier's jitter buffer and the parent hears
    speech that speeds up and then stutters.
    """
    next_at = time.monotonic()
    while not bridge.stop:
        generation, chunk = await bridge.out.get()
        if chunk is None:
            return
        # Queued before the parent interrupted: no longer wanted.
        if generation != bridge.generation or not bridge.stream_id:
            continue
        now = time.monotonic()
        next_at = max(next_at, now)
        await asyncio.sleep(max(0.0, next_at - now))
        next_at += _FRAME_SECONDS
        try:
            await bridge.ws.send_text(build_play_audio(bridge.stream_id, chunk))
            bridge.bytes_down += len(chunk)
        except Exception:  # noqa: BLE001
            bridge.stop = True
            return


@telephony_router.websocket("/telephony/vobiz/stream")
async def vobiz_stream(ws: WebSocket) -> None:
    """One phone call, bridged to one Live session."""
    outreach_id = await _admit(ws)
    if outreach_id is None:
        return

    await _SESSION_SEM.acquire()
    started = time.monotonic()
    reason = "unknown"
    bridge: _Bridge | None = None
    try:
        await ws.accept()
        bridge = _Bridge(
            ws,
            outreach_id,
            call_uuid=ws.query_params.get("cuid", ""),
        )
        context = await _load_context(outreach_id, ws.query_params.get("lang", "English"))

        from google import genai
        from google.genai import types as genai_types

        settings = get_settings()
        client = genai.Client(
            vertexai=True,
            project=settings.gcp_project,
            location=os.environ.get("VOBIZ_LIVE_LOCATION", "us-central1"),
        )
        config = genai_types.LiveConnectConfig(
            response_modalities=[genai_types.Modality.AUDIO],
            system_instruction=genai_types.Content(
                parts=[genai_types.Part(text=build_parent_call_instruction(context))]
            ),
            speech_config=genai_types.SpeechConfig(
                voice_config=genai_types.VoiceConfig(
                    prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                        voice_name=os.environ.get("VOBIZ_LIVE_VOICE", "Aoede")
                    )
                )
            ),
        )
        model = os.environ.get("VOBIZ_LIVE_MODEL", "gemini-live-2.5-flash")

        log.info(
            "telephony.call_open",
            outreach_id=outreach_id,
            model=model,
            language=context.language,
        )

        async with client.aio.live.connect(model=model, config=config) as session:
            # VIDYA speaks first: the parent answered an unknown number and is
            # waiting. Silence here reads as a spam call and they hang up.
            await session.send_client_content(
                turns=genai_types.Content(
                    role="user",
                    parts=[
                        genai_types.Part(
                            text="(The parent has just answered. Greet them now.)"
                        )
                    ],
                ),
                turn_complete=True,
            )

            tasks = [
                asyncio.create_task(_pump_carrier_to_live(bridge, session)),
                asyncio.create_task(_pump_live_to_carrier(bridge, session)),
                asyncio.create_task(_pace_outbound(bridge)),
            ]
            guard = asyncio.create_task(asyncio.sleep(_MAX_CALL_SECONDS))
            done, pending = await asyncio.wait({*tasks, guard}, return_when=asyncio.FIRST_COMPLETED)

            bridge.stop = True
            if guard in done:
                reason = "max_duration"
            else:
                finished = next(iter(done))
                result = finished.result() if not finished.cancelled() else None
                reason = result if isinstance(result, str) else "ended"
            for task in pending:
                task.cancel()
            with contextlib.suppress(Exception):
                await asyncio.gather(*pending, return_exceptions=True)
    except WebSocketDisconnect:
        reason = "carrier_disconnect"
    except Exception as exc:  # noqa: BLE001
        reason = "error"
        log.error(
            "telephony.call_failed",
            outreach_id=outreach_id,
            error=str(exc),
            error_type=type(exc).__name__,
        )
    finally:
        # Release capacity before anything that can raise, so a failure on the
        # way out cannot strand a slot for the life of the process.
        _SESSION_SEM.release()
        if bridge is not None:
            # The leg outlives this socket by design; end it explicitly.
            await _hangup(bridge.call_uuid)
        log.info(
            "telephony.call_closed",
            outreach_id=outreach_id,
            reason=reason,
            seconds=round(time.monotonic() - started, 1),
            bytes_up=bridge.bytes_up if bridge else 0,
            bytes_down=bridge.bytes_down if bridge else 0,
        )
        with contextlib.suppress(Exception):
            code = {
                "max_duration": _CLOSE_MAX_DURATION,
                "idle_timeout": _CLOSE_IDLE,
            }.get(reason, 1000)
            await ws.close(code=code)
