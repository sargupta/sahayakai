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
import re
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..agents.vidya_voice.router import get_vertex_live_location, get_vertex_live_model
from ..config import get_settings
from .audio import ULAW_SILENCE, DecimatorState, pcm24k_to_ulaw8k, ulaw8k_to_pcm16k
from .flow import (
    CLOSE,
    KICKOFF_AFTER_OPENER,
    KICKOFF_NO_OPENER,
    NO_RESPONSE_CLOSE,
    OPTOUT_CLOSE,
    POST_OPENER_NUDGE,
    SILENCE_NUDGE,
    is_optout,
)
from .prompt import CallContext, build_parent_call_instruction, stt_language_hints
from .tokens import VobizDomain, verify_vobiz_token
from .vobiz_frames import InboundKind, build_clear_audio, build_play_audio, parse_inbound

if TYPE_CHECKING:
    from google.cloud.firestore import DocumentSnapshot

log = structlog.get_logger(__name__)

telephony_router = APIRouter(tags=["telephony"])

_PCM_IN_MIME = "audio/pcm;rate=16000"

# ---- The recorded opener --------------------------------------------------
#
# Measured on the deployed bridge, first audio from the Live model lands ~3.4s
# after the socket opens: Firestore context ~490ms, client construction ~345ms,
# the Vertex handshake ~1.7s, the first token ~840ms. Overlapping everything
# that can overlap still leaves ~2.5s, because the handshake and the first token
# dominate and neither is ours to speed up.
#
# Two and a half seconds of silence after a parent says "hello" is how a call
# gets hung up on. So VIDYA greets them from a recording at ~0ms while the live
# session warms behind it. Same voice, so the handover is not audible.
#
# Stored as raw mu-law 8 kHz — the carrier's own wire format — so the most
# latency-critical bytes on the route need no conversion at all.
_OPENER_DIR = Path(__file__).parent / "openers"
_DEFAULT_OPENER_LANGUAGE = "English"


def _load_openers() -> dict[str, bytes]:
    """Read every rendered opener once, at import."""
    if not _OPENER_DIR.is_dir():
        return {}
    return {f.stem: f.read_bytes() for f in _OPENER_DIR.glob("*.ulaw")}


_OPENERS = _load_openers()

if not _OPENERS:
    # Loud on purpose. If the recordings do not ship with the image, every call
    # silently reverts to ~3.4s of dead air before the model speaks — the exact
    # failure they exist to prevent, and one that looks like a slow model rather
    # than like a packaging mistake.
    log.error(
        "telephony.openers_missing",
        directory=str(_OPENER_DIR),
        detail="no recorded openers found; every call will open with silence",
    )
else:
    log.info("telephony.openers_loaded", count=len(_OPENERS), languages=sorted(_OPENERS))


def opener_for(language: str) -> bytes:
    """The recording for this language, falling back rather than to silence.

    A missing language must never mean dead air: an English greeting a parent
    does not speak is still better than nothing, and it is recoverable — they
    hear a human-sounding voice and stay on the line long enough for the model
    to take over in their own language.
    """
    return _OPENERS.get(language) or _OPENERS.get(_DEFAULT_OPENER_LANGUAGE, b"")

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

#: One frame of silence, sent to hold the cadence when the model has not
#: produced audio yet. Built once: it is emitted on most idle ticks.
_SILENCE_FRAME = bytes([ULAW_SILENCE]) * _FRAME_BYTES

#: Keep the cadence for this long after the model stops producing (1s). Long
#: enough to bridge the gaps between bursts inside one utterance, short enough
#: that a quiet line is not flooded with silence frames.
_COMFORT_TICKS = 50

#: The recording asked "do you have a minute?" — wait this long for an answer
#: before checking in. Long enough not to talk over a parent who is drawing
#: breath, short enough that the line does not feel dead.
_POST_OPENER_SILENCE = 5.0
#: If they never respond at all, stop rather than keep talking at an empty line.
_UNANSWERED_GIVE_UP = 12.0
#: A lull once the conversation is under way.
_CONVERSATION_SILENCE = 9.0
#: After this many unanswered nudges, close warmly instead of nagging.
_MAX_SILENCE_NUDGES = 2
#: The parent must have spoken at least this many times before the model is
#: allowed to end the call. One turn is not a conversation — ending there is a
#: delivery that hangs up, which is what people resent about robocalls.
#:
#: Two, not three. Three was wrong on a real call: the parent said "haan,
#: boliye", heard the message, said "achha, theek hai, thank you" — a complete
#: and satisfied call in two turns — and the guard refused to let it end, so the
#: school kept talking and THEY had to hang up. Being talked at after you have
#: said goodbye is precisely the rudeness this was meant to prevent.
#:
#: The real protection against ending early is the question veto below, not this
#: count: the premature end it caught came after a question, not after a short
#: call.
_MIN_PARENT_TURNS_BEFORE_END = 2

#: A question in the parent's last words vetoes an end. Deliberately broad: a
#: missed veto hangs up on someone mid-question, a spurious one merely keeps a
#: warm call alive a few seconds longer.
_ENDS_IN_QUESTION = re.compile(
    r"\?|\b(what|why|when|how|where|can|could|should|is|are|will|do)\b"
    r"|क्या|कैसे|कब|कहाँ|क्यों|चाहिए"
    r"|কি|কীভাবে|কখন|কোথায়|কেন",
    re.IGNORECASE,
)

#: How much of the parent's recent speech to keep for phrase matching. Long
#: enough to span a sentence split across fragments, short enough that a
#: goodbye said five minutes ago cannot fire now.
_SPEECH_TAIL_CHARS = 160

#: Log the parent's transcript. Debug only — it is their speech about their
#: child, so it stays off unless someone is actively diagnosing a call.
_TRANSCRIPT_DEBUG = os.environ.get("VOBIZ_LOG_TRANSCRIPT", "").strip().lower() in (
    "1",
    "true",
    "yes",
    "on",
)

#: How long to let a closing line play before hanging up.
_CLOSING_GRACE_SECONDS = 12.0

#: Resync rather than burst-catch-up beyond this much lag.
#:
#: With no deliberate lead, this is purely about recovering from a real stall.
#: Catching up by more than this would mean dumping a burst into the carrier,
#: which is the same fast-playback problem the lead caused.
_MAX_PACING_LAG = 0.3

#: How far ahead of real time to run. ZERO, deliberately.
#:
#: I added a 400ms, then 600ms, lead so the carrier would hold a jitter buffer
#: that could absorb our occasional stall. It made things worse in the only way
#: that counts: the founder reported the voice "fast and weird" and "changing",
#: on the build that introduced it, having reported holes on the build before.
#:
#: The lead is sent as a burst — about thirty frames back to back at call start,
#: which is exactly the recorded greeting. A carrier that plays frames at the
#: rate they arrive, rather than to its own clock, plays that greeting FAST and
#: then plays the conversation at normal speed. One voice that sounds rushed and
#: high followed by one that does not is heard as the voice changing, which is
#: precisely the complaint.
#:
#: The proven reference agrees: the Suraksha sender has no lead at all and paces
#: strictly. Holes are handled by the comfort silence below, which keeps the
#: carrier fed continuously WITHOUT ever sending faster than real time — that is
#: the right tool for the job, and the lead was never needed once it existed.
_PREBUFFER_SECONDS = 0.0

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
        # `google.cloud.firestore`, matching `session_store` — NOT firebase_admin,
        # which nothing in this service initialises. The first version used
        # firebase_admin and every call silently fell back to a generic prompt
        # with "The default Firebase app does not exist" in the logs.
        from google.cloud import firestore

        client = firestore.Client(
            project=get_settings().gcp_project,
            database=get_settings().firestore_database,
        )
        # `to_thread` keeps the blocking Firestore read off the event loop, which
        # is relaying audio. The cast is because the sync and async clients share
        # a return annotation; this is the sync client, so the snapshot is not
        # awaitable.
        snap = cast(
            "DocumentSnapshot",
            await asyncio.to_thread(
                lambda: client.collection("parent_outreach").document(outreach_id).get()
            ),
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
        self.decimator: DecimatorState | None = None
        self.last_voice = time.monotonic()
        self.bytes_up = 0
        self.bytes_down = 0
        self.t_ready: float | None = None
        #: How often the sender fell so far behind that it had to resync. Any
        #: non-zero value here is audible, so it is worth a log field.
        self.pacing_resyncs = 0
        self.ticks = 0
        self.ticks_late = 0
        self.worst_lateness_ms = 0.0
        #: Carry-over audio that did not fill a whole frame. Padding it per
        #: chunk instead would put silence inside words.
        self.pending = b""
        #: The parent has spoken at least once. Until then we must not assume
        #: they agreed to talk — the recording only asked.
        self.engaged = False
        #: A closing line has been sent; nothing further should be said.
        self.closing = False
        #: Last time either side made a sound, for the silence watchdog.
        self.last_activity = time.monotonic()
        #: What the parent said, for the record and for goodbye detection.
        self.parent_said: list[str] = []
        self.opted_out = False
        #: Rolling tail of what the parent said, for phrase detection across
        #: transcription fragments.
        self.recent_speech = ""
        self.opener_queued_at: float | None = None
        #: When the parent would first have heard the model. Measured, not
        #: assumed — this is the number that decides whether the call feels
        #: like a person picking up or like a robocall.
        self.first_audio_at: float | None = None


def _kickoff_text(opener_played: bool) -> str:
    """The first stage direction of the call.

    When the recording has already introduced VIDYA, the model is joining a
    conversation in progress. Saying so is what stops it introducing itself a
    second time, which is the most obviously robotic thing this call could do.
    """
    return KICKOFF_AFTER_OPENER if opener_played else KICKOFF_NO_OPENER


def _queue_ulaw(bridge: _Bridge, ulaw: bytes) -> None:
    """Split carrier-ready audio into 20 ms frames and hand them to the pacer.

    A model chunk is almost never an exact multiple of 160 bytes, and the first
    version zero-padded every chunk up to a frame boundary. That injected up to
    19ms of silence into the middle of continuous speech at EVERY chunk
    boundary — a rasp through the vowels rather than an obvious break, which is
    the kind of defect that gets described as "it sounds a bit off" and never
    diagnosed.

    The remainder is carried instead, so padding happens once per utterance
    rather than once per chunk. `_flush_ulaw` pads the true tail.
    """
    data = bridge.pending + ulaw
    complete = len(data) - (len(data) % _FRAME_BYTES)
    for start in range(0, complete, _FRAME_BYTES):
        bridge.out.put_nowait((bridge.generation, data[start : start + _FRAME_BYTES]))
    bridge.pending = data[complete:]


def _flush_ulaw(bridge: _Bridge) -> None:
    """Emit the final partial frame of an utterance, padded to the frame size."""
    if not bridge.pending:
        return
    tail = bridge.pending + bytes([ULAW_SILENCE]) * (_FRAME_BYTES - len(bridge.pending))
    bridge.out.put_nowait((bridge.generation, tail))
    bridge.pending = b""


async def _greet_and_drain(bridge: _Bridge, language: str) -> None:
    """Play the recorded opener, then hold the socket until the model is ready.

    Runs CONCURRENTLY with the Live connect, which is the whole point: the
    greeting has to be queued before the thing it exists to cover.

    It also keeps reading from the carrier and discarding what it reads. The
    socket would otherwise buffer the parent's first words and replay them into
    the model the instant the real pump starts — the model would answer
    something said several seconds earlier, over its own greeting.
    """
    greeted = False
    while True:
        try:
            raw = await bridge.ws.receive_text()
        except Exception:  # noqa: BLE001 — the caller owns the socket's lifetime
            return
        frame = parse_inbound(raw)
        if frame.stream_id and not bridge.stream_id:
            bridge.stream_id = frame.stream_id
        if not greeted and bridge.stream_id:
            opener = opener_for(language)
            if opener:
                _queue_ulaw(bridge, opener)
                bridge.opener_queued_at = time.monotonic()
            greeted = True


async def _send_director(session: Any, text: str) -> None:
    """Give the model a stage direction and let it speak.

    Never spoken verbatim: the model renders it in the parent's language, in its
    own words. This is the mechanism that gives the call a shape instead of
    leaving the model waiting for something to react to.
    """
    from google.genai import types as genai_types

    await session.send_client_content(
        turns=genai_types.Content(role="user", parts=[genai_types.Part(text=text)]),
        turn_complete=True,
    )


async def _begin_close(bridge: _Bridge, session: Any, reason: str) -> None:
    """Say one warm closing line, then end the call for real.

    Ending matters as much as starting. Without this the parent says goodbye,
    VIDYA says nothing, and the line stays open until a timeout kills it —
    which from their side is a call that died for no reason.
    """
    if bridge.closing or bridge.stop:
        return
    bridge.closing = True
    log.info("telephony.closing", outreach_id=bridge.outreach_id, reason=reason)
    cue = {
        "opt_out": OPTOUT_CLOSE,
        # A parent who never spoke has still HEARD the teacher's message; the
        # shipped flow closes by saying exactly that rather than apologising.
        "never_engaged": NO_RESPONSE_CLOSE,
    }.get(reason, CLOSE)
    with contextlib.suppress(Exception):
        await _send_director(session, cue)

    async def _end_after_goodbye() -> None:
        # Let the closing line actually reach the parent before hanging up.
        # Cutting the line mid-goodbye is its own small rudeness.
        deadline = time.monotonic() + _CLOSING_GRACE_SECONDS
        while time.monotonic() < deadline:
            await asyncio.sleep(0.25)
            if bridge.out.empty() and not bridge.pending:
                # Queue drained; give the carrier its buffered audio time to play.
                await asyncio.sleep(_PREBUFFER_SECONDS + 0.3)
                break
        bridge.stop = True

    asyncio.create_task(_end_after_goodbye())


async def _conversation_watchdog(bridge: _Bridge, session: Any) -> None:
    """Keep the call from dying of silence.

    Two different silences. Before the parent has spoken at all, the recording's
    "do you have a minute?" is still unanswered, so we check in gently rather
    than assume consent. Afterwards, a long lull usually means they are waiting
    for us, or are done.
    """
    nudged_after_opener = False
    nudges = 0
    while not bridge.stop and not bridge.closing:
        await asyncio.sleep(0.5)
        quiet_for = time.monotonic() - bridge.last_activity

        if not bridge.engaged:
            if not nudged_after_opener and quiet_for > _POST_OPENER_SILENCE:
                nudged_after_opener = True
                bridge.last_activity = time.monotonic()
                with contextlib.suppress(Exception):
                    await _send_director(session, POST_OPENER_NUDGE)
                log.info("telephony.nudge", outreach_id=bridge.outreach_id, kind="post_opener")
            elif nudged_after_opener and quiet_for > _UNANSWERED_GIVE_UP:
                # Nobody is there, or they cannot hear us. Ending quietly is
                # kinder than talking at an empty line.
                await _begin_close(bridge, session, "never_engaged")
            continue

        if quiet_for > _CONVERSATION_SILENCE:
            nudges += 1
            bridge.last_activity = time.monotonic()
            if nudges > _MAX_SILENCE_NUDGES:
                await _begin_close(bridge, session, "silence")
                return
            with contextlib.suppress(Exception):
                await _send_director(session, SILENCE_NUDGE)
            log.info("telephony.nudge", outreach_id=bridge.outreach_id, kind="silence", n=nudges)


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


async def _handle_parent_speech(bridge: _Bridge, session: Any, server: Any) -> None:
    """React to what the parent just said.

    Their transcript is the only signal we have for whether they are engaged,
    finished, or asking not to be called. Without reading it the call cannot
    respond to any of those, which is why the first version simply talked until
    a timeout stopped it.
    """
    if server is None:
        return
    heard = getattr(server, "input_transcription", None)
    said = (getattr(heard, "text", "") or "").strip() if heard else ""
    if not said:
        return

    bridge.engaged = True
    bridge.last_activity = time.monotonic()
    bridge.parent_said.append(said)

    # Match on the ACCUMULATED tail, not on this fragment.
    #
    # Input transcription arrives in pieces — "theek hai", "thank", "you so
    # much" — so a phrase almost never lands inside one fragment. Matching per
    # fragment silently never fires: the first live test said "thank you so
    # much, namaskar" and the call did not close, because no single fragment
    # contained a goodbye. Keeping a short rolling tail is what makes detection
    # work on speech as people actually produce it.
    bridge.recent_speech = f"{bridge.recent_speech} {said}".strip()[-_SPEECH_TAIL_CHARS:]

    if _TRANSCRIPT_DEBUG:
        # Off by default and must stay off in production: this is a parent's
        # own speech about their child.
        log.info("telephony.heard", outreach_id=bridge.outreach_id, text=said)

    # SAFETY NET ONLY. The model ending the call itself (the `end_call` tool) is
    # the real mechanism, because it understands the audio regardless of which
    # script the recogniser transliterates it into. These patterns catch the case
    # where the model misses an explicit opt-out, which is the one refusal we
    # must never sit through — so opt-out is checked and a plain goodbye is left
    # to the model, where a false positive cannot hang up on a parent mid-question.
    if is_optout(bridge.recent_speech):
        bridge.opted_out = True
        await _begin_close(bridge, session, "opt_out")


def _may_end_yet(bridge: _Bridge) -> bool:
    """Has the call actually run its course?

    Two conditions, both about not cutting a parent off. They must have spoken
    enough for this to have been a conversation rather than a delivery, and they
    must not have just asked something — a question is the clearest possible
    signal that they are not finished.
    """
    if len(bridge.parent_said) < _MIN_PARENT_TURNS_BEFORE_END:
        return False
    # The veto looks at the LAST thing they said, not the rolling window.
    #
    # Checking the whole window was wrong in a way that only showed up live: a
    # parent asked "is there anything I should do at home?", got an answer, then
    # said "theek hai, thank you so much, namaskar" — and the end was declined
    # three times, because their earlier question was still inside the buffer.
    # A question they have already had answered is not a reason to keep them on
    # the phone.
    latest = bridge.parent_said[-1] if bridge.parent_said else ""
    return not _ENDS_IN_QUESTION.search(latest)


async def _handle_tool_call(bridge: _Bridge, session: Any, tool_call: Any) -> None:
    """The model has decided the call is over."""
    if tool_call is None or not getattr(tool_call, "function_calls", None):
        return
    from google.genai import types as genai_types

    for fc in tool_call.function_calls:
        if fc.name != "end_call":
            continue
        reason = str((dict(fc.args or {})).get("reason") or "parent_finished")

        # The model proposes; we dispose.
        #
        # Left unchecked it ends calls too eagerly: in testing it hung up 16
        # seconds in, immediately after the parent asked "is there anything I
        # should do at home?" — reading their "achha, that's good to hear" as a
        # sign-off. Hanging up on a parent who has just asked a question about
        # their child is worse than staying on the line too long, so an early
        # `parent_finished` is declined and the model simply carries on.
        #
        # A refusal is NEVER declined. If a parent asks not to be called again,
        # that is honoured immediately, whatever turn it arrives on.
        if reason != "opt_out" and not _may_end_yet(bridge):
            log.info(
                "telephony.end_call_declined",
                outreach_id=bridge.outreach_id,
                reason=reason,
                parent_turns=len(bridge.parent_said),
            )
            continue

        if reason == "opt_out":
            bridge.opted_out = True
        log.info("telephony.end_call_tool", outreach_id=bridge.outreach_id, reason=reason)
        # The model says its closing line BEFORE calling this, so there is
        # nothing left to say — end without sending another closing cue.
        bridge.closing = True
        asyncio.create_task(_drain_then_stop(bridge))

    with contextlib.suppress(Exception):
        await session.send_tool_response(
            function_responses=[
                genai_types.FunctionResponse(id=fc.id, name=fc.name, response={"status": "ok"})
                for fc in tool_call.function_calls
            ]
        )


async def _drain_then_stop(bridge: _Bridge) -> None:
    """Let whatever is queued reach the parent, then end the call."""
    deadline = time.monotonic() + _CLOSING_GRACE_SECONDS
    while time.monotonic() < deadline:
        await asyncio.sleep(0.25)
        if bridge.out.empty() and not bridge.pending:
            await asyncio.sleep(_PREBUFFER_SECONDS + 0.3)
            break
    bridge.stop = True


async def _pump_live_to_carrier(bridge: _Bridge, session: Any) -> str:
    """The model's audio -> the parent, plus interruption handling.

    `session.receive()` is a PER-TURN generator: it ends when the model finishes
    speaking, not when the session closes. Treating it as the lifetime of the
    call — which the obvious `async for resp in session.receive()` does — hangs
    up as soon as the greeting finishes. A real parent would hear one sentence
    and then a dead line, and the logs would say `live_stream_end`, which reads
    like the model quit rather than like we stopped listening.

    So the generator is re-entered for each subsequent turn, and only the
    caller's own guards (parent hung up, idle, max duration) end the call.
    """
    while not bridge.stop:
        turn_had_output = False
        async for resp in session.receive():
            if bridge.stop:
                break
            turn_had_output = True
            server = getattr(resp, "server_content", None)
            if server is not None and getattr(server, "interrupted", False):
                # The parent started speaking. Drop everything already queued AND
                # tell the carrier to discard what it has buffered; doing only the
                # first still leaves a second of stale speech in the parent's ear.
                bridge.generation += 1
                # Half a frame of abandoned speech must not be prepended to the
                # next thing VIDYA says.
                bridge.pending = b""
                while not bridge.out.empty():
                    with contextlib.suppress(asyncio.QueueEmpty):
                        bridge.out.get_nowait()
                if bridge.stream_id:
                    with contextlib.suppress(Exception):
                        await bridge.ws.send_text(build_clear_audio(bridge.stream_id))

            await _handle_parent_speech(bridge, session, server)
            await _handle_tool_call(bridge, session, getattr(resp, "tool_call", None))

            data = getattr(resp, "data", None)
            if data:
                bridge.last_activity = time.monotonic()
                if bridge.first_audio_at is None:
                    bridge.first_audio_at = time.monotonic()
                ulaw, bridge.decimator = pcm24k_to_ulaw8k(data, bridge.decimator)
                _queue_ulaw(bridge, ulaw)
        # The turn is over: the carry-over is a true tail now, not a chunk seam.
        _flush_ulaw(bridge)
        if not turn_had_output:
            # The generator returned without yielding anything. That is the
            # session really being gone, not a completed turn; re-entering it
            # would spin.
            break
    return "live_stream_end"


async def _pace_outbound(bridge: _Bridge) -> None:
    """The single writer to the carrier. Emits one 20 ms frame every 20 ms.

    WHY THIS IS NOT JUST `await queue.get()` THEN `sleep(20ms)`

    That is the obvious shape, and it is what the Suraksha agent does, but it
    produces audibly broken speech for two separate reasons. Measured against
    the deployed service before this rewrite: p99 inter-frame gap 110ms, eleven
    frames more than 100ms late, and 15% of frames arriving less than 5ms apart.

    1. Blocking on an empty queue puts HOLES in the middle of an utterance. The
       model streams in bursts, so the queue empties between them; a sender that
       simply waits sends nothing, the carrier's playout buffer drains, and the
       parent hears a break inside a word. Telephony is constant-bitrate by
       nature: the fix is to keep the cadence and send silence, not to stop.

    2. Sleeping a fixed period AFTER the send makes the true period
       `send_time + 20ms`, so the stream runs slower than real time and drifts
       further behind for the length of the call. The deadline below is absolute,
       so a slow send is absorbed rather than accumulated.

    Frames from a superseded generation are discarded WITHOUT spending a tick,
    which is what makes barge-in feel immediate instead of merely queued.
    """
    #: How long to keep the cadence going once the model stops producing. Covers
    #: the gaps between bursts inside a turn without emitting silence forever on
    #: a call where nobody is speaking.
    comfort_ticks_remaining = 0
    # Start in the past so the first frames go out as fast as they are produced,
    # filling the carrier's jitter buffer before steady-state pacing begins.
    next_at = time.monotonic() - _PREBUFFER_SECONDS

    while not bridge.stop:
        next_at += _FRAME_SECONDS

        # Take the first frame that is still current. Stale ones are dropped
        # here rather than played, and dropping them costs no time.
        chunk: bytes | None = None
        while True:
            try:
                generation, candidate = bridge.out.get_nowait()
            except asyncio.QueueEmpty:
                break
            if generation == bridge.generation:
                chunk = candidate
                break

        if chunk is not None:
            comfort_ticks_remaining = _COMFORT_TICKS
        elif comfort_ticks_remaining > 0:
            # Mid-utterance gap: hold the line with silence so the carrier's
            # buffer never runs dry.
            comfort_ticks_remaining -= 1
            chunk = _SILENCE_FRAME

        if chunk is not None and bridge.stream_id:
            try:
                await bridge.ws.send_text(build_play_audio(bridge.stream_id, chunk))
                bridge.bytes_down += len(chunk)
            except Exception:  # noqa: BLE001 — the carrier is gone; the handler decides what that means
                bridge.stop = True
                return

        now = time.monotonic()
        # Self-measurement. Client-observed jitter mixes our pacing with the
        # internet path to the carrier; this is the part we actually own, so it
        # is the part worth reporting.
        lateness = now - next_at
        if lateness > 0:
            bridge.ticks_late += 1
            bridge.worst_lateness_ms = max(bridge.worst_lateness_ms, lateness * 1000)
        bridge.ticks += 1
        if next_at < now - _MAX_PACING_LAG:
            # So far behind that catching up would mean dumping a burst into the
            # carrier, which is its own kind of stutter. Resync instead and take
            # the loss once.
            bridge.pacing_resyncs += 1
            next_at = now
        await asyncio.sleep(max(0.0, next_at - now))


async def _prepare_live_session(
    outreach_id: str, language: str, started: float
) -> tuple[Any, Any, str, CallContext]:
    """Load the call's context and build the Live client, config and model.

    Split out of the handler so the handler reads as the shape of a call rather
    than as a setup script, and so the warm-up timings sit next to the work they
    measure.
    """
    from google import genai
    from google.genai import types as genai_types

    t_accept = time.monotonic()
    context = await _load_context(outreach_id, language)
    t_context = time.monotonic()

    settings = get_settings()
    # Model and location come from the app-facing voice route rather than from
    # constants of our own. The first version hardcoded the model name the
    # Suraksha agent uses, which does not exist on Vertex — every call died with
    # "Publisher model ... was not found". One source of truth for which Live
    # model actually exists is worth the import.
    client = genai.Client(
        vertexai=True,
        project=settings.gcp_project,
        location=os.environ.get("VOBIZ_LIVE_LOCATION") or get_vertex_live_location(),
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
        # Tell the recogniser what to expect. Without this the model decodes
        # short code-mixed speech over an 8 kHz line as more or less arbitrary
        # languages, and the parent gets answered as though they said something
        # else — heard as the agent being broken, not as a recognition problem.
        input_audio_transcription=genai_types.AudioTranscriptionConfig(
            language_codes=stt_language_hints(context.language),
        ),
        # What the school actually said, so a call can be reviewed afterwards
        # without storing the audio.
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
        # Let the MODEL decide the call is over.
        #
        # The first version matched regexes against the parent's transcript, and
        # it could not work: the recogniser returns speech transliterated into
        # the hinted script, so "thank you so much" comes back as
        # "थैंक यू सो मच" and an English pattern never fires. Chasing that with
        # more patterns means maintaining goodbye spellings for eleven languages
        # times every script they might be transliterated into.
        #
        # The model already understands the audio directly, in any language and
        # any mixture of them. This mirrors `shouldEndCall` in the shipped
        # parent-call prompt, which is how this decision has always been made
        # here — it was only ever the mechanism that was missing.
        tools=[
            genai_types.Tool(
                function_declarations=[
                    genai_types.FunctionDeclaration(
                        name="end_call",
                        description=(
                            "Call this the moment the parent has finished: they say goodbye or "
                            "thank you as a sign-off, say they have nothing more, ask not to be "
                            "called again, or the conversation has naturally run its course. "
                            "Say your one short closing line FIRST, then call this."
                        ),
                        parameters=genai_types.Schema(
                            type=genai_types.Type.OBJECT,
                            properties={
                                "reason": genai_types.Schema(
                                    type=genai_types.Type.STRING,
                                    description=(
                                        "One of: parent_finished, opt_out, wrong_number, "
                                        "call_back_later"
                                    ),
                                ),
                            },
                            required=["reason"],
                        ),
                    )
                ]
            )
        ],
    )
    model = os.environ.get("VOBIZ_LIVE_MODEL") or get_vertex_live_model()

    # The gap between a parent saying "hello" and hearing a voice is the single
    # most important number on this route, and it is made of separable pieces.
    # Logging them apart is the difference between optimising the right one and
    # guessing which one is slow.
    log.info(
        "telephony.warmup",
        outreach_id=outreach_id,
        model=model,
        language=context.language,
        context_ms=round((t_context - t_accept) * 1000),
        client_ms=round((time.monotonic() - t_context) * 1000),
        since_open_ms=round((time.monotonic() - started) * 1000),
    )
    return client, config, model, context


async def _run_call(bridge: _Bridge, session: Any, pacer: asyncio.Task[None]) -> str:
    """Run the four concurrent halves of a call until one of them ends it.

    Returns the reason the call ended, for the closing log line.
    """
    tasks = [
        asyncio.create_task(_pump_carrier_to_live(bridge, session)),
        asyncio.create_task(_pump_live_to_carrier(bridge, session)),
        asyncio.create_task(_conversation_watchdog(bridge, session)),
        pacer,
    ]
    guard = asyncio.create_task(asyncio.sleep(_MAX_CALL_SECONDS))
    done, pending = await asyncio.wait({*tasks, guard}, return_when=asyncio.FIRST_COMPLETED)

    bridge.stop = True
    if guard in done:
        reason = "max_duration"
    elif bridge.closing:
        # A warm goodbye was said and the call ended on purpose. Reporting that
        # as "carrier_disconnect" would make a good call look like a dropped one.
        reason = "opt_out" if bridge.opted_out else "closed"
    else:
        finished = next(iter(done))
        result = finished.result() if not finished.cancelled() else None
        reason = result if isinstance(result, str) else "ended"

    for task in pending:
        task.cancel()
    with contextlib.suppress(Exception):
        await asyncio.gather(*pending, return_exceptions=True)
    return reason


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
        language = ws.query_params.get("lang", "English")

        # The pacer and the greeting start FIRST, before anything that blocks.
        # The recorded opener exists to cover the Live warm-up, so queueing it
        # after that warm-up would be pointless — the parent would hear the
        # silence anyway and then be greeted twice.
        pacer = asyncio.create_task(_pace_outbound(bridge))
        greeter = asyncio.create_task(_greet_and_drain(bridge, language))

        client, config, model, context = await _prepare_live_session(
            outreach_id, language, started
        )

        from google.genai import types as genai_types

        async with client.aio.live.connect(model=model, config=config) as session:
            bridge.t_ready = time.monotonic()
            log.info(
                "telephony.live_connected",
                outreach_id=outreach_id,
                connect_ms=round((bridge.t_ready - started) * 1000),
                opener_lead_ms=(
                    round((bridge.t_ready - bridge.opener_queued_at) * 1000)
                    if bridge.opener_queued_at
                    else None
                ),
            )

            # Hand the socket over: the greeter has been draining it so the
            # parent's first words could not pile up and be replayed into a
            # model that was not listening yet.
            greeter.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await greeter

            # The model takes over mid-conversation. Telling it the recording
            # already played is what stops it introducing itself a second time,
            # which is the single most obviously robotic thing this call could do.
            await session.send_client_content(
                turns=genai_types.Content(
                    role="user",
                    parts=[genai_types.Part(text=_kickoff_text(bool(bridge.opener_queued_at)))],
                ),
                turn_complete=True,
            )

            bridge.last_activity = time.monotonic()
            reason = await _run_call(bridge, session, pacer)
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
            pacing_resyncs=bridge.pacing_resyncs if bridge else 0,
            ticks=bridge.ticks if bridge else 0,
            ticks_late_pct=(
                round(100 * bridge.ticks_late / bridge.ticks, 1)
                if bridge and bridge.ticks
                else None
            ),
            worst_lateness_ms=round(bridge.worst_lateness_ms) if bridge else None,
            engaged=bridge.engaged if bridge else False,
            parent_turns=len(bridge.parent_said) if bridge else 0,
            opted_out=bridge.opted_out if bridge else False,
            # Two different numbers, and conflating them hides the fix. The
            # opener is what the PARENT hears first; the model's own first audio
            # lands seconds later and is what the recording exists to cover.
            opener_ms=(
                round((bridge.opener_queued_at - started) * 1000)
                if bridge and bridge.opener_queued_at
                else None
            ),
            first_model_audio_ms=(
                round((bridge.first_audio_at - started) * 1000)
                if bridge and bridge.first_audio_at
                else None
            ),
        )
        with contextlib.suppress(Exception):
            code = {
                "max_duration": _CLOSE_MAX_DURATION,
                "idle_timeout": _CLOSE_IDLE,
            }.get(reason, 1000)
            await ws.close(code=code)
