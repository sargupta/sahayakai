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
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..config import get_settings
from .audio import (
    ULAW_SILENCE,
    DecimatorState,
    pcm24k_to_ulaw8k,
    ulaw8k_to_pcm16k,
    ulaw_to_pcm16,
)
from .barge_in import Action, BargeIn, frame_level, percentile
from .cascade import CascadeConfig, cascade_enabled, open_cascade
from .dialogue import Action as Next
from .dialogue import DialogueState, Floor, Identity, Kind, Stage, classify
from .flow import (
    CLOSE,
    KICKOFF_AFTER_OPENER,
    KICKOFF_NO_OPENER,
    NO_RESPONSE_CLOSE,
    OPTOUT_CLOSE,
    POST_OPENER_NUDGE,
    SILENCE_NUDGE,
    VERIFIED_CUE,
    is_goodbye,
    is_optout,
    line,
)
from .privacy import ProtectedTerms
from .prompt import (
    CallContext,
    build_parent_call_instruction,
    spoken_message,
    stt_language_hints,
    verified_facts,
)
from .school_data import (
    TOOL_NAMES,
    CallScope,
    FirestoreSchoolData,
    SchoolDataTools,
    tool_declarations,
)
from .suppression import SUPPRESSION_COLLECTION, phone_suppression_id
from .tokens import VobizDomain, token_minted_at, verify_vobiz_token
from .vobiz_frames import InboundKind, build_clear_audio, build_play_audio, parse_inbound

if TYPE_CHECKING:
    from collections.abc import Callable

    from google.cloud.firestore import DocumentSnapshot

log = structlog.get_logger(__name__)

telephony_router = APIRouter(tags=["telephony"])

_PCM_IN_MIME = "audio/pcm;rate=16000"

# ---- Which Live model carries a phone call -------------------------------
#
# NOT the same choice as the app-facing voice route, and the difference is
# deliberate. That route uses `gemini-live-2.5-flash-native-audio`, which is
# excellent but whose VOICE DRIFTS within a session — measured across six turns
# of one session at 182-233 Hz, a 1.28x spread with 16.1 Hz of deviation. Over a
# browser session that is character; on a phone call it is heard as the person
# you are speaking to changing partway through, which is what the founder
# reported twice.
#
# `gemini-live-2.5-flash` at location `global` came in at 185-197 Hz over the
# same six turns — a 1.07x spread, 5.3 Hz deviation. Three times steadier, and
# it is the model the Suraksha agent already runs in production, whose own notes
# recorded that native audio "voice can drift" before I measured it.
#
# The two routes may diverge here: the app can prefer the newer model's
# expressiveness, while a call needs one consistent voice for ninety seconds.
# `conformance.check_voice_is_stable_across_turns` is what keeps this honest.
_LIVE_MODEL = "gemini-live-2.5-flash"
_LIVE_LOCATION = "global"

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

#: The same opener lines rendered in the cascade engine's voice (Neha). The
#: opener exists to sound like the voice that takes over; a Gemini-voice
#: greeting followed by Neha would be heard as two people.
_NEHA_OPENER_DIR = Path(__file__).parent / "openers_neha"
_NEHA_OPENERS = (
    {f.stem: f.read_bytes() for f in _NEHA_OPENER_DIR.glob("*.ulaw")}
    if _NEHA_OPENER_DIR.is_dir()
    else {}
)

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
    if cascade_enabled():
        neha = _NEHA_OPENERS.get(language) or _NEHA_OPENERS.get(_DEFAULT_OPENER_LANGUAGE)
        if neha:
            return neha
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


def disclose_ai() -> bool:
    """`VOBIZ_DISCLOSE_AI`: say in the first turn that this is an automated assistant.

    A policy switch, off by default so production keeps today's behaviour (the
    assistant says so only when a parent asks). Read per call, not at import.
    """
    return os.environ.get("VOBIZ_DISCLOSE_AI", "").strip().lower() in ("1", "true", "yes")


def is_two_way(language: str) -> bool:
    """`VOBIZ_TWO_WAY_LANGUAGES`: languages trusted for a full conversation.

    Comma-separated display names ("English,Hindi"). Unset or empty means every
    language is two-way, which is today's behaviour. A language outside the list
    gets delivery mode: the message is spoken and the call closes, rather than a
    conversation whose recognition of the parent is not yet trusted.
    """
    raw = os.environ.get("VOBIZ_TWO_WAY_LANGUAGES", "")
    allowed = {x.strip().lower() for x in raw.split(",") if x.strip()}
    return not allowed or (language or "English").strip().lower() in allowed


def school_data_tools_enabled() -> bool:
    """`VOBIZ_SCHOOL_DATA_TOOLS`: let the call look up attendance and marks.

    Off by default. Reading a child's records to a voice on the phone is a
    policy decision as much as a feature, so it is switched on per deployment.
    """
    return os.environ.get("VOBIZ_SCHOOL_DATA_TOOLS", "").strip().lower() in ("1", "true", "yes")


def local_barge_in_enabled() -> bool:
    """`VOBIZ_LOCAL_BARGE_IN`: pause on the parent's speech onset (default on)."""
    return os.environ.get("VOBIZ_LOCAL_BARGE_IN", "1").strip().lower() not in ("0", "false", "no")


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
_POST_OPENER_SILENCE = 6.0
#: If they never respond at all, stop rather than keep talking at an empty line.
_UNANSWERED_GIVE_UP = 12.0
#: A lull once the conversation is under way.
#: A parent thinking about their own child pauses longer than a stranger would.
#: Nine seconds cut across that; twelve leaves room to think without the line
#: feeling dead.
_CONVERSATION_SILENCE = 12.0
#: After this many unanswered nudges, close warmly instead of nagging.
_MAX_SILENCE_NUDGES = 1
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

#: Hard ceiling on parent turns, matching `MAX_TURNS = 6` in the shipped Twilio
#: flow. This is a short call about one message, not a meeting; past six
#: exchanges it has stopped being that. Without it the only limit was a
#: 600-second wall clock, and a real call ran to eighteen turns.
_MAX_PARENT_TURNS = 6
#: Meaningful exchanges (content, not "wait"/"what"/"repeat"/"okay"/silence)
#: before VIDYA wraps up. Replaces the 6-utterance ceiling, which on the
#: 2026-10-11 handset call ended the call after "Hello, What, Wait, Wait,
#: Repeat, Yeah" — six utterances, none of them a real exchange. The 600 s
#: wall clock (_MAX_CALL_SECONDS) remains the hard safety limit.
_MAX_MEANINGFUL_EXCHANGES = 12
#: After the parent says "wait", hold the floor this long before one gentle
#: "take your time, I'm listening".
_YIELD_PROMPT_SECONDS = 7.0
#: After a short burst paused VIDYA, wait this long for the transcript to say
#: whether it was "haan" (resume) or "wait"/a question (cancel). Without a
#: transcript by then it was noise: resume.
_VERDICT_SECONDS = 1.6

#: A question in the parent's last words vetoes an end. Deliberately broad: a
#: missed veto hangs up on someone mid-question, a spurious one merely keeps a
#: warm call alive a few seconds longer.
_ENDS_IN_QUESTION = re.compile(
    r"\?|\b(what|why|when|how|where|can|could|should|is|are|will|do)\b"
    r"|क्या|कैसे|कब|कहाँ|क्यों|चाहिए"
    r"|কি|কীভাবে|কখন|কোথায়|কেন",
    re.IGNORECASE,
)

#: App language -> the two-letter code the parent-call schemas expect.
_ISO_LANGUAGE = {
    "English": "en",
    "Hindi": "hi",
    "Kannada": "kn",
    "Tamil": "ta",
    "Telugu": "te",
    "Malayalam": "ml",
    "Bengali": "bn",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Odia": "or",
}

#: Mean absolute sample level that counts as speech rather than line noise.
#: mu-law silence decodes to zero, so a real voice clears this comfortably.
_PARENT_SPEECH_LEVEL = 400
#: Consecutive frames required, so a click or a crackle is not a conversation.
#: Five frames is 100ms.
_PARENT_SPEECH_FRAMES = 5

#: How long after the model's last audio the line counts as quiet. Covers the
#: gap between the model finishing generation and the pacer finishing playout,
#: so a nudge cannot arrive while the parent is still hearing the last sentence.
_MODEL_SETTLE_SECONDS = 1.5

#: Flush the transcript every this many turns. Small enough that a dropped call
#: loses at most a turn or two, large enough not to write on every fragment.
_TRANSCRIPT_FLUSH_EVERY = 2

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
    _log_admit_latency(outreach_id, token)
    return outreach_id


#: The carrier gives up on an answered call whose media socket has not opened
#: within a few seconds. On 2026-10-08 a cold start accepted the socket 10 s
#: after the instance started; Vobiz had hung up at 5 s and the parent heard
#: dead air. This threshold is the alert line for that failure.
_SLOW_ADMIT_MS = 3000


def _log_admit_latency(outreach_id: str, token: str | None) -> None:
    """Answer webhook -> socket accepted, in ms (second resolution, from the token)."""
    minted = token_minted_at(token)
    if minted is None:
        return
    lag_ms = max(0, round((time.time() - minted) * 1000))
    if lag_ms > _SLOW_ADMIT_MS:
        log.warning("telephony.slow_admit", outreach_id=outreach_id, answer_to_socket_ms=lag_ms)
    else:
        log.info("telephony.admitted", outreach_id=outreach_id, answer_to_socket_ms=lag_ms)


def context_from_outreach(data: dict[str, Any], language: str) -> CallContext:
    """Build the call context from a `parent_outreach` document.

    Pure, so the field names the web app writes can be pinned by a test: this
    function and `src/server/attendance.ts` / `outreach/route.ts` are two halves
    of one contract, and the half in this file once read a field (`message`)
    the other half never wrote.
    """
    # Marks, formatted the way the June flow formatted them: at most three
    # subjects, quoted only if the parent asks.
    perf = data.get("performanceContext") or {}
    breakdown = perf.get("subjectBreakdown") or []
    marks = (
        ", ".join(
            f"{a.get('subject')}: {a.get('marksObtained')}/{a.get('maxMarks')}"
            for a in breakdown[:3]
        )
        or None
    )
    if marks and isinstance(perf.get("latestPercentage"), (int, float)):
        marks = f"{marks} · overall {round(perf['latestPercentage'])}%"

    return CallContext(
        student_name=data.get("studentName"),
        teacher_name=data.get("teacherName"),
        class_name=data.get("className"),
        school_name=data.get("schoolName"),
        reason=data.get("reason"),
        subject=data.get("subject"),
        performance_summary=marks,
        language=data.get("parentLanguage") or language,
        # `spokenScript` is the phrasing written for speech; `generatedMessage`
        # is the written letter, and is what EVERY outreach record carries (see
        # `/api/attendance/outreach` and `saveOutreachRecord`). The first version
        # of this read `message`, a field nothing writes, so a call whose record
        # lacked a `spokenScript` told the model "no specific message" while the
        # letter sat unread on the same document. `message` stays as a last
        # resort for any older record that used it.
        message=(data.get("spokenScript") or data.get("generatedMessage") or data.get("message")),
    )


async def _load_context(outreach_id: str, language: str) -> tuple[CallContext, CallScope | None]:
    """Read the teacher's message and the child's details for this call.

    Also returns the call's data scope (teacher, class, student), taken from the
    same record the signed token names; the school-data tools can read nothing
    outside it.

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
            return CallContext(language=language), None
        return context_from_outreach(data, language), CallScope.from_outreach(outreach_id, data)
    except Exception as exc:  # noqa: BLE001
        log.warning("telephony.context_unavailable", outreach_id=outreach_id, error=str(exc))
        return CallContext(language=language), None


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


class InboundStats:
    """Aggregates of the parent's audio for one call. Never audio, never words.

    Exists because the handset call that logged zero barge-in pauses left no
    evidence of why: no chunk sizes, no levels, no format. Bounded: levels are
    kept in fixed-size reservoirs, chunk sizes as a small histogram.
    """

    _CAP = 3000

    def __init__(self) -> None:
        self.chunks = 0
        self.chunk_sizes: dict[int, int] = {}
        self.levels_audible: list[float] = []
        self.levels_quiet: list[float] = []
        self.clear_ms: list[float] = []

    def chunk(self, size: int) -> None:
        self.chunks += 1
        if size in self.chunk_sizes or len(self.chunk_sizes) < 16:
            self.chunk_sizes[size] = self.chunk_sizes.get(size, 0) + 1

    def level(self, value: float, *, ai_audible: bool) -> None:
        bucket = self.levels_audible if ai_audible else self.levels_quiet
        if len(bucket) < self._CAP:
            bucket.append(value)

    def carrier_cleared(self, ms: float) -> None:
        self.clear_ms.append(ms)

    def summary(self) -> dict[str, Any]:
        def pct(values: list[float], p: float) -> int | None:
            v = percentile(values, p)
            return None if v is None else round(v)

        top = sorted(self.chunk_sizes.items(), key=lambda kv: -kv[1])[:4]
        return {
            "inbound_chunks": self.chunks,
            "inbound_chunk_sizes": {str(k): v for k, v in top},
            "level_quiet_p50": pct(self.levels_quiet, 50),
            "level_quiet_p90": pct(self.levels_quiet, 90),
            "level_quiet_p99": pct(self.levels_quiet, 99),
            "level_audible_p50": pct(self.levels_audible, 50),
            "level_audible_p90": pct(self.levels_audible, 90),
            "level_audible_p99": pct(self.levels_audible, 99),
            "carrier_clear_p50_ms": pct(self.clear_ms, 50),
            "carrier_clear_p95_ms": pct(self.clear_ms, 95),
        }


class _Bridge:
    """Mutable state for one call. Small enough to read in one sitting."""

    def __init__(self, ws: WebSocket, outreach_id: str, call_uuid: str) -> None:  # noqa: PLR0915 — one line per piece of call state
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
        #: What the parent said, ONE ENTRY PER UTTERANCE (their turn), for the
        #: turn limits, the question veto and goodbye detection. Transcription
        #: fragments are merged into the current entry until VIDYA speaks again.
        self.parent_said: list[str] = []
        #: VIDYA has spoken since the parent's last fragment, so the parent's
        #: next fragment starts a new utterance.
        self.agent_spoke_since_parent = True
        #: Fire-and-forget tasks this call started. The event loop keeps only a
        #: WEAK reference to a task, so an unreferenced one can be collected
        #: mid-flight — the close-after-goodbye would then silently never run
        #: and the call would hold until the idle or max-duration guard.
        self.background: set[asyncio.Task[Any]] = set()
        #: Delivery mode (see `is_two_way`): the message is spoken and the call
        #: may end straight after it, without the two-turn minimum.
        self.delivery_only = False
        #: The conversation, in the shape the rest of the app already stores.
        #: Kept for BOTH sides: a transcript with only one voice in it cannot be
        #: reviewed, and reviewing calls is the whole point of keeping one.
        self.transcript: list[dict[str, str]] = []
        self.transcript_saved_at = 0
        self.context: CallContext | None = None
        #: The model has produced audio at least once. Until then it is still
        #: composing its opening, and nudging it is nudging mid-sentence.
        self.model_has_spoken = False
        #: When the model last produced audio, so "quiet" means the LINE is
        #: quiet, not merely that the parent has not interrupted.
        self.model_last_audio = 0.0
        #: Consecutive inbound frames above the noise floor.
        self.loud_frames = 0
        self.opted_out = False
        #: Rolling tail of what the parent said, for phrase detection across
        #: transcription fragments.
        self.recent_speech = ""
        self.opener_queued_at: float | None = None
        #: When the parent would first have heard the model. Measured, not
        #: assumed — this is the number that decides whether the call feels
        #: like a person picking up or like a robocall.
        self.first_audio_at: float | None = None

        # ---- barge-in (see barge_in.py) ----
        self.barge = BargeIn()
        self.local_barge_in = local_barge_in_enabled()
        #: The response playing when the parent cut in was cancelled before the
        #: model itself noticed. Its remaining audio and transcription are still
        #: in flight and must not play; this holds until the model's turn ends.
        self.discard_model_audio = False
        #: The pacer owes the carrier a clearAudio (it is the only writer).
        self.clear_pending = False
        #: Last time a frame of VIDYA's speech (not comfort silence) was sent.
        self.last_speech_frame_at = 0.0
        #: (onset_at, detected_at) of a stop the pacer has yet to measure.
        self.stop_to_measure: tuple[float, float] | None = None
        self.measured_detection: float | None = None
        #: Speech onset -> last VIDYA frame sent, and decision -> last frame, ms.
        self.onset_to_stop_ms: list[float] = []
        self.detect_to_stop_ms: list[float] = []
        self.stale_chunks_dropped = 0

        # ---- dialogue and tools ----
        self.dialogue = DialogueState()
        #: VIDYA's words for the turn in progress. Committed to the transcript
        #: when the turn ends, so the parent's words — whose transcription
        #: arrives late — are filed BEFORE the reply they prompted.
        self.agent_turn_text = ""
        self.tools: SchoolDataTools | None = None
        #: Lookups in flight, by function-call id, so a cancellation can find them.
        self.tool_tasks: dict[str, asyncio.Task[Any]] = {}
        self.tool_calls = 0
        #: Last time the parent's audio cleared the speech threshold.
        self.last_parent_voice_at = 0.0
        #: The goodbye safety net is waiting to see whether the model closes.
        self.goodbye_net_armed = False
        #: Speech frames generated vs. actually sent for the turn in progress,
        #: so an interrupted turn is transcribed as far as the parent heard it.
        self.turn_frames_generated = 0
        self.turn_frames_played = 0
        #: The model is mid-turn (audio arrived, no turn_complete/interrupt yet).
        self.model_turn_open = False
        #: Parent audio not yet making a whole 20 ms frame (see _feed_barge_in).
        self.inbound_pending = b""
        self.inbound = InboundStats()
        #: What Vobiz reported in start.mediaFormat.
        self.media_format: str | None = None
        #: When the last clearAudio was sent, for carrier clear latency.
        self.clear_sent_at: float | None = None
        #: The conversation engine session (Gemini Live or the cascade).
        self.engine: Any = None
        #: The last agent turn filed was cut off by the parent.
        self.last_turn_interrupted = False
        # ---- the call state machine and the privacy gate (dialogue/privacy) ----
        #: Child-specific words that must not be spoken before verification.
        self.protected: ProtectedTerms | None = None
        #: The full (child) instruction, for the engine once the caller is verified.
        self.unlocked_instruction = ""
        self.unlocked = False
        #: The next agent turn is one of the bridge's fixed lines.
        self.next_turn_scripted = False
        #: Playback held after a short burst, awaiting the transcript's verdict.
        self.verdict_hold_until = 0.0
        #: Parent gave the floor ("wait"): when, and whether we have prompted.
        self.yielded_at = 0.0
        self.wait_prompted = False
        self.decisions: dict[str, int] = {}
        self.privacy_blocks = 0
        self.end_call_declined = 0
        # ---- lifecycle timings ----
        #: Parent end-of-speech -> transcript, and -> first reply audio sent.
        self.eos_to_final_ms: list[float] = []
        self.eos_to_first_audio_ms: list[float] = []
        self.awaiting_reply_since = 0.0
        self.max_queue_frames = 0
        self.stale_frames_dropped = 0
        self.lateness_samples: list[float] = []


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
    bridge.max_queue_frames = max(bridge.max_queue_frames, bridge.out.qsize())


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
        if frame.media_format:
            bridge.media_format = frame.media_format
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
    bridge.dialogue.begin_closing()
    log.info("telephony.closing", outreach_id=bridge.outreach_id, reason=reason)
    cue = {
        "opt_out": OPTOUT_CLOSE,
        # A parent who never spoke has still HEARD the teacher's message; the
        # shipped flow closes by saying exactly that rather than apologising.
        "never_engaged": NO_RESPONSE_CLOSE,
    }.get(reason, CLOSE)
    with contextlib.suppress(Exception):
        await _send_director(session, cue + bridge.dialogue.cue_context())

    async def _end_after_goodbye() -> None:
        """Let the closing line actually reach the parent before hanging up.

        The obvious loop — wait until the queue is empty — is wrong, and it is a
        race we won only by luck on a real call. The cue has just been SENT; the
        model has not generated the closing line yet, so the queue is empty at
        the first check and the hangup fires about a second later, cutting the
        goodbye off before it is spoken.

        So wait for audio to APPEAR after the cue first, and only then wait for
        it to drain. If nothing ever appears the grace period still ends the
        call, because a silent line is worse than a missing goodbye.
        """
        cue_sent = time.monotonic()
        deadline = cue_sent + _CLOSING_GRACE_SECONDS

        # Phase one: the model starts speaking the closing line.
        while time.monotonic() < deadline:
            if bridge.model_last_audio > cue_sent or not bridge.out.empty():
                break
            await asyncio.sleep(0.1)

        # Phase two: it finishes, and the carrier finishes playing it.
        while time.monotonic() < deadline:
            await asyncio.sleep(0.25)
            if bridge.out.empty() and not bridge.pending:
                await asyncio.sleep(_PREBUFFER_SECONDS + 0.5)
                break
        bridge.stop = True

    _spawn(bridge, _end_after_goodbye())


async def _conversation_watchdog(bridge: _Bridge, session: Any) -> None:
    """Keep the call from dying of silence.

    Two different silences. Before the parent has spoken at all, the recording's
    "do you have a minute?" is still unanswered, so we check in gently rather
    than assume consent. Afterwards, a long lull usually means they are waiting
    for us, or are done.
    """
    nudged_after_opener = False
    nudges = 0
    silence = {"nudges": 0}
    while not bridge.stop and not bridge.closing:
        await asyncio.sleep(0.5)
        quiet_for = time.monotonic() - bridge.last_activity

        # Never nudge while the school is still talking.
        #
        # The nudge is a director turn, so if it lands mid-utterance the model
        # simply continues into it — on a live call the parent heard a 55-word
        # monologue that ended "...Please go ahead, I am listening", which is
        # this cue's own words welded onto the end of the opening. The line is
        # only quiet when the model has actually spoken, has stopped, and has
        # nothing queued to play.
        # A lookup in flight or a paused response is not silence either: the
        # parent is waiting for an answer, or is mid-sentence.
        speaking = (
            not bridge.model_has_spoken
            or not bridge.out.empty()
            or (time.monotonic() - bridge.model_last_audio) < _MODEL_SETTLE_SECONDS
            or bool(bridge.tool_tasks)
            or bridge.barge.paused
            # An engine still composing or looking something up is not a quiet
            # line. Staging run 2: a 6.3 s model reply after a lookup drew a
            # silence nudge, and the nudge cancelled the attendance answer.
            or bool(getattr(bridge.engine, "busy", False))
            or bool(bridge.verdict_hold_until)
        )
        if speaking:
            continue

        if _scripted(bridge):
            if await _scripted_silence(bridge, session, quiet_for, silence):
                break
            continue

        if not bridge.engaged:
            if not nudged_after_opener and quiet_for > _POST_OPENER_SILENCE:
                nudged_after_opener = True
                bridge.last_activity = time.monotonic()
                with contextlib.suppress(Exception):
                    await _send_director(session, POST_OPENER_NUDGE + bridge.dialogue.cue_context())
                log.info("telephony.nudge", outreach_id=bridge.outreach_id, kind="post_opener")
            elif nudged_after_opener and quiet_for > _UNANSWERED_GIVE_UP:
                # Nobody is there, or they cannot hear us. Ending quietly is
                # kinder than talking at an empty line.
                await _begin_close(bridge, session, "never_engaged")
            continue

        if _must_end_now(bridge):
            await _begin_close(bridge, session, "max_turns")
            break

        if quiet_for > _CONVERSATION_SILENCE:
            nudges += 1
            bridge.last_activity = time.monotonic()
            if nudges > _MAX_SILENCE_NUDGES:
                await _begin_close(bridge, session, "silence")
                break
            with contextlib.suppress(Exception):
                await _send_director(session, SILENCE_NUDGE + bridge.dialogue.cue_context())
            log.info("telephony.nudge", outreach_id=bridge.outreach_id, kind="silence", n=nudges)

    # A close has begun (here, on a goodbye, on opt-out, or by the model). Stay
    # alive until `_end_after_goodbye` sets `stop`. `_run_call` ends the call as
    # soon as ANY of its tasks finishes, so returning here hung up the line the
    # instant the closing cue was sent — the goodbye was never spoken. Seen in
    # local verification 2026-10-08: hangup 65 ms after `telephony.closing`.
    while not bridge.stop:
        await asyncio.sleep(0.1)


async def _scripted_silence(
    bridge: _Bridge, session: Any, quiet_for: float, state: dict[str, int]
) -> bool:
    """Silence, as the state machine sees it (Neha cascade). True = closing.

    - After "wait": one "take your time, I'm listening" after a while, never
      a resumed monologue.
    - Before verification: ask the neutral identity question again; after the
      last attempt, close politely without sharing anything.
    - After verification: ONE natural follow-up, then a polite close; and a
      long call wraps up only when the line is idle and no question is open.
    """
    d = bridge.dialogue
    now = time.monotonic()
    if d.floor is Floor.WAITING_FOR_PARENT and not bridge.wait_prompted:
        if now - max(bridge.yielded_at, bridge.last_activity) > _YIELD_PROMPT_SECONDS:
            bridge.wait_prompted = True
            bridge.last_activity = now
            await _say(bridge, session, _fixed(bridge, "wait_prompt"))
        return False
    if not d.may_share_student_data:
        if quiet_for > _POST_OPENER_SILENCE:
            bridge.last_activity = now
            if d.identity_questions >= d.max_identity_attempts:
                await _close_call(
                    bridge, session, "unverified" if bridge.engaged else "never_engaged"
                )
                return True
            await _say(bridge, session, _fixed(bridge, "identity_retry"))
            d.on_identity_question_asked()
        return False
    if _must_end_now(bridge) and not d.open_question:
        await _close_call(bridge, session, "limit")
        return True
    if quiet_for > _CONVERSATION_SILENCE:
        state["nudges"] += 1
        bridge.last_activity = now
        if state["nudges"] > _MAX_SILENCE_NUDGES:
            await _close_call(bridge, session, "silence")
            return True
        await _say(bridge, session, _fixed(bridge, "follow_up"))
    return False


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
            bridge.media_format = frame.media_format or bridge.media_format
            log.info(
                "telephony.stream_start",
                outreach_id=bridge.outreach_id,
                stream_id=frame.stream_id,
            )
        elif frame.kind is InboundKind.MEDIA and frame.audio:
            bridge.stream_id = bridge.stream_id or frame.stream_id
            bridge.bytes_up += len(frame.audio)
            bridge.last_voice = time.monotonic()
            _note_parent_audio(bridge, frame.audio)
            await session.send_realtime_input(
                audio=genai_types.Blob(data=ulaw8k_to_pcm16k(frame.audio), mime_type=_PCM_IN_MIME)
            )
        elif frame.kind is InboundKind.CLEARED and bridge.clear_sent_at is not None:
            bridge.inbound.carrier_cleared((time.monotonic() - bridge.clear_sent_at) * 1000)
            bridge.clear_sent_at = None
        elif frame.kind is InboundKind.STOP:
            return "carrier_stop"
    return "stopped"


def _record_turn(bridge: _Bridge, role: str, text: str) -> None:
    """Append to the running transcript, merging consecutive fragments.

    Transcription arrives in pieces, so appending each one would produce a
    transcript of broken half-sentences that nobody can read. Consecutive
    fragments from the same speaker are joined into one turn, which is the shape
    the rest of the app already stores and the shape a teacher can actually
    review.

    Only the PARENT's fragments are merged. VIDYA's turns arrive whole (see
    `_commit_agent_turn`), and merging two of them filed a question and the
    goodbye said after the parent's silence as one entry, as if glued together.
    """
    if bridge.transcript and bridge.transcript[-1]["role"] == role == "parent":
        bridge.transcript[-1]["text"] = f"{bridge.transcript[-1]['text']} {text}".strip()
        return
    bridge.transcript.append(
        {
            "role": role,
            "text": text,
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        }
    )
    # Write as we go, not only at hangup.
    #
    # The June flow appended every turn as it happened, transaction-safe, so a
    # crash cost nothing. Writing once at the end meant a dropped call took the
    # whole conversation with it — including a message the founder spoke
    # specifically so it would be read back afterwards.
    if len(bridge.transcript) - bridge.transcript_saved_at >= _TRANSCRIPT_FLUSH_EVERY:
        bridge.transcript_saved_at = len(bridge.transcript)
        _spawn(bridge, _persist_transcript(bridge))


_SPACES = re.compile(r"\s+")


def _agent_said(bridge: _Bridge, fragment: str) -> None:
    """Collect VIDYA's transcription for the turn in progress.

    Joined RAW, not stripped-and-spaced: the model's transcription arrives in
    sub-word pieces that already carry their own leading spaces. Stripping each
    one and re-joining with a space is what produced "Sah ayak" and "Ms ." in
    the 2026-10-10 live transcript.
    """
    bridge.agent_turn_text += fragment


def _heard_text(bridge: _Bridge) -> str:
    """The cut-off reply as the parent heard it (the transcript's heard share)."""
    if bridge.transcript and bridge.transcript[-1]["role"] == "agent":
        return bridge.transcript[-1]["text"].removesuffix("…").strip()
    return ""


def _tell_engine_the_state(bridge: _Bridge) -> None:
    """An engine that takes per-reply notes (the cascade) gets the call state.

    Gemini Live only hears the state inside director cues; the cascade hears it
    before every reply, which is what stops a second introduction after the
    parent's "yes" and brings the conversation back to an unfinished message.
    """
    note = getattr(bridge.engine, "set_context_note", None)
    if callable(note):
        note(bridge.dialogue.cue_context().strip(" []").removeprefix("Call state: "))


def _heard_so_far(bridge: _Bridge, text: str) -> str:
    """`text` cut to the share of this turn's audio that has been sent."""
    if bridge.turn_frames_generated <= 0:
        return text
    return _heard_part(text, bridge.turn_frames_played / bridge.turn_frames_generated)


def _truncate_last_agent_entry(bridge: _Bridge) -> None:
    """The turn was already filed (generation ended) but was still PLAYING when
    the parent cut in: rewrite its entry to what they heard."""
    if not bridge.transcript or bridge.transcript[-1]["role"] != "agent":
        return
    heard = _heard_so_far(bridge, bridge.transcript[-1]["text"])
    bridge.transcript[-1]["text"] = f"{heard} …" if heard else "…"


def _heard_part(text: str, fraction: float) -> str:
    """The words of a cut-off turn the parent actually heard, approximately.

    The model's transcription runs ahead of playout: on the staging run a turn
    interrupted 1.5 s in was transcribed in full, so the record said the
    parent heard a message they never did. Keep the share of words matching
    the share of the turn's audio that was sent.
    """
    words = text.split()
    keep = round(len(words) * min(1.0, max(0.0, fraction)))
    return " ".join(words[:keep])


def _commit_agent_turn(bridge: _Bridge, *, interrupted: bool = False) -> None:
    """File VIDYA's finished (or cut-off) turn in the transcript.

    Done at the END of her turn rather than per fragment. The parent's words
    are transcribed late — often after VIDYA has begun replying — and filing
    fragments as they came put the first word of each reply at the end of the
    previous one ("…discuss this further? I" / parent / "don't have…").
    """
    text = _SPACES.sub(" ", bridge.agent_turn_text).strip()
    bridge.agent_turn_text = ""
    if interrupted:
        text = _heard_so_far(bridge, text)
    if not text:
        return
    before = bridge.dialogue.repeat_intros
    bridge.dialogue.on_agent_turn(text, scripted=bridge.next_turn_scripted)
    bridge.next_turn_scripted = False
    if bridge.dialogue.repeat_intros > before:
        log.warning(
            "telephony.repeat_intro",
            outreach_id=bridge.outreach_id,
            count=bridge.dialogue.repeat_intros,
        )
    _record_turn(bridge, "agent", f"{text} …" if interrupted else text)
    bridge.last_turn_interrupted = interrupted
    _tell_engine_the_state(bridge)
    # Gemini Live only: on the cascade a model "goodbye" must not end the call;
    # closings there are the bridge's own decision and fixed line.
    live_farewell = not _scripted(bridge) and _is_agent_farewell(text)
    if live_farewell and not interrupted and not bridge.closing:
        _spawn(bridge, _end_if_model_forgets(bridge, time.monotonic()))


#: VIDYA's turn ends in an explicit goodbye.
_AGENT_FAREWELL = re.compile(
    r"(\b(good ?bye|bye|take care)\b|अलविदा|नमस्ते|नमस्कार|ಬಾಯ್|பை|বিদায়)[\W\s]*$",
    re.IGNORECASE,
)
#: How long after VIDYA's goodbye to wait for the model's own end_call.
_FAREWELL_GRACE_SECONDS = 2.5


def _is_agent_farewell(text: str) -> bool:
    return bool(_AGENT_FAREWELL.search(text.strip()[-60:]))


async def _end_if_model_forgets(bridge: _Bridge, said_at: float) -> None:
    """VIDYA said goodbye but the model did not call end_call. End it anyway.

    Against the real model, a wrong-number call ended "...I'll make a note of
    this. Goodbye." with no end_call, which would have left a stranger holding
    an open line until the silence nudges ran out. If the parent speaks after
    the goodbye, they are not done, and the call carries on.
    """
    await asyncio.sleep(_FAREWELL_GRACE_SECONDS)
    if bridge.closing or bridge.stop or bridge.last_parent_voice_at > said_at:
        return
    log.info("telephony.agent_farewell_close", outreach_id=bridge.outreach_id)
    bridge.closing = True
    bridge.dialogue.begin_closing()
    await _drain_then_stop(bridge)


def _spawn(bridge: _Bridge, coro: Any) -> asyncio.Task[Any]:
    """Start a fire-and-forget task that cannot be garbage-collected mid-flight."""
    task = asyncio.create_task(coro)
    bridge.background.add(task)
    task.add_done_callback(bridge.background.discard)
    return task


async def _persist_engine_failure(bridge: _Bridge, error_type: str) -> None:
    """Record that the conversation engine never came up for this call.

    The carrier still reports the call as answered and completed, so without
    this the record reads as a normal finished call while the parent heard only
    the opener and then a hangup. Never fatal; the log line is the alert source.
    """
    try:
        from google.cloud import firestore

        client = firestore.Client(
            project=get_settings().gcp_project,
            database=get_settings().firestore_database,
        )
        now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        ref = client.collection("parent_outreach").document(bridge.outreach_id)
        await asyncio.to_thread(
            ref.update,
            {"engineFailure": {"at": now, "errorType": error_type}, "updatedAt": now},
        )
    except Exception as exc:  # noqa: BLE001
        log.error(
            "telephony.engine_failure_not_saved",
            outreach_id=bridge.outreach_id,
            error=str(exc),
        )


async def _persist_opt_out(bridge: _Bridge) -> bool:
    """Record that this parent asked not to be called again.

    Two writes: `optedOut`/`optedOutAt` on the outreach doc (what the teacher's
    UI reads) and a durable `call_suppressions/{sha256(E.164)}` record that
    survives new outreach docs and covers siblings sharing the number. The web
    routes refuse with 409 PARENT_OPTED_OUT when that record exists.

    Never fatal, but loud: a lost opt-out means a parent who was told "it has
    been noted" gets called again. Returns True when the suppression record was
    written.
    """
    try:
        from google.cloud import firestore

        client = firestore.Client(
            project=get_settings().gcp_project,
            database=get_settings().firestore_database,
        )
        ref = client.collection("parent_outreach").document(bridge.outreach_id)
        snap = await asyncio.to_thread(ref.get)
        data = (snap.to_dict() if snap.exists else None) or {}
        now = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        await asyncio.to_thread(ref.update, {"optedOut": True, "optedOutAt": now, "updatedAt": now})
        phone = data.get("parentPhone")
        if not isinstance(phone, str) or not phone.strip():
            log.error("telephony.opt_out_no_phone", outreach_id=bridge.outreach_id)
            return False
        suppression = client.collection(SUPPRESSION_COLLECTION).document(
            phone_suppression_id(phone)
        )
        await asyncio.to_thread(
            suppression.set,
            {
                "teacherUid": data.get("teacherUid"),
                "classId": data.get("classId"),
                "studentId": data.get("studentId"),
                "outreachId": bridge.outreach_id,
                "reason": "opt_out",
                "createdAt": now,
            },
        )
        log.info("telephony.opt_out_saved", outreach_id=bridge.outreach_id)
        return True
    except Exception as exc:  # noqa: BLE001
        log.error("telephony.opt_out_lost", outreach_id=bridge.outreach_id, error=str(exc))
        return False


async def _persist_transcript(bridge: _Bridge) -> None:
    """Write the conversation to the outreach record.

    The Twilio path has always done this — `transcript` is a field the rest of
    the app reads, and a call nobody can review is a call nobody can improve.
    This route kept its turns in memory and dropped them at hangup, so a
    125-second conversation left nothing behind at all.

    Never fatal: losing the record must not also lose the call.
    """
    if not bridge.transcript:
        return
    try:
        from google.cloud import firestore

        client = firestore.Client(
            project=get_settings().gcp_project,
            database=get_settings().firestore_database,
        )
        ref = client.collection("parent_outreach").document(bridge.outreach_id)
        await asyncio.to_thread(
            ref.update,
            {
                "transcript": bridge.transcript,
                "turnCount": len(bridge.transcript),
                "voicePipelineMode": "vobiz_live",
                "updatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        )
        log.info(
            "telephony.transcript_saved",
            outreach_id=bridge.outreach_id,
            turns=len(bridge.transcript),
        )
    except Exception as exc:  # noqa: BLE001
        log.error(
            "telephony.transcript_lost",
            outreach_id=bridge.outreach_id,
            turns=len(bridge.transcript),
            error=str(exc),
        )


async def _generate_call_summary(bridge: _Bridge, context: CallContext, seconds: int) -> None:
    """Produce the structured post-call summary a teacher actually reads.

    The Twilio flow has generated one after every completed call since before
    June, using `prompts/parent-call/summary.handlebars`. This route produced
    none at all, so a teacher learned nothing about what the parent said beyond
    a raw transcript.

    The SAME prompt and the SAME output schema are used here, rather than a
    second summariser written for this path — the point of the shipped prompt is
    that it has already been tuned on real calls.

    Never fatal. A missing summary is a gap; a failed call is a parent who was
    phoned for nothing.
    """
    if len(bridge.transcript) < 2:
        return
    try:
        from google import genai
        from google.genai import types as genai_types

        from ..agents.parent_call.agent import (
            CallSummaryCore,
            build_summary_context,
            render_summary_prompt,
        )
        from ..agents.parent_call.schemas import TranscriptTurn

        prompt = render_summary_prompt(
            build_summary_context(
                student_name=context.student_name or "the student",
                class_name=context.class_name or "",
                subject=context.subject or "",
                reason=context.reason or "",
                teacher_message=context.message or "",
                teacher_name=context.teacher_name,
                school_name=context.school_name,
                parent_language=cast("Any", _ISO_LANGUAGE.get(context.language, "en")),
                transcript=[
                    TranscriptTurn(role=cast("Any", t["role"]), text=t["text"])
                    for t in bridge.transcript
                ],
                call_duration_seconds=seconds,
            )
        )
        # Primary region, then `global`: on 2026-10-11 asia-south1 answered 429
        # RESOURCE_EXHAUSTED for minutes and a summary was lost.
        primary = os.environ.get("VOBIZ_SUMMARY_LOCATION", "asia-south1")
        resp = None
        for location in dict.fromkeys([primary, "global"]):
            client = genai.Client(
                vertexai=True, project=get_settings().gcp_project, location=location
            )
            try:
                resp = await client.aio.models.generate_content(
                    model=os.environ.get("VOBIZ_SUMMARY_MODEL", "gemini-2.5-flash"),
                    contents=prompt,
                    config=genai_types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=CallSummaryCore,
                    ),
                )
                break
            except Exception as exc:  # noqa: BLE001 — try the next region, then give up
                log.warning(
                    "telephony.summary_fallback", location=location, error_type=type(exc).__name__
                )
        if resp is None:
            raise RuntimeError("summary model unavailable in every region")
        summary = CallSummaryCore.model_validate_json(resp.text or "{}")

        from google.cloud import firestore

        fs = firestore.Client(
            project=get_settings().gcp_project, database=get_settings().firestore_database
        )
        await asyncio.to_thread(
            fs.collection("parent_outreach").document(bridge.outreach_id).update,
            {
                "callSummary": summary.model_dump(),
                "callSummaryGeneratedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            },
        )
        log.info(
            "telephony.summary_saved",
            outreach_id=bridge.outreach_id,
            sentiment=summary.parentSentiment,
            follow_up=summary.followUpNeeded,
        )
    except Exception as exc:  # noqa: BLE001
        log.error("telephony.summary_failed", outreach_id=bridge.outreach_id, error=str(exc))


def _note_parent_audio(bridge: _Bridge, ulaw: bytes) -> None:
    """Notice the parent is talking from the AUDIO, not from the transcript.

    Transcription lags speech by a second or two. Waiting for it to decide
    whether anyone is there meant the line looked silent while the parent was
    mid-sentence: on a probe the parent spoke at 7.0s and the post-opener nudge
    still fired at 9.5s, so the school told a talking parent "please go ahead,
    I am listening".

    The carrier is already sending us their audio. A frame or two above the
    noise floor is all the evidence needed, and it costs a table lookup.
    """
    pcm = ulaw_to_pcm16(ulaw)
    if not pcm:
        return
    level = sum(abs(s) for s in pcm) / len(pcm)
    if bridge.local_barge_in:
        _feed_barge_in(bridge, ulaw)
    if level < _PARENT_SPEECH_LEVEL:
        bridge.loud_frames = 0
        return
    bridge.loud_frames += 1
    if bridge.loud_frames >= _PARENT_SPEECH_FRAMES:
        bridge.engaged = True
        bridge.last_activity = time.monotonic()
        bridge.last_parent_voice_at = bridge.last_activity


#: VIDYA counts as audible for this long after her last frame was sent: the
#: carrier's playout buffer is still draining it.
_AUDIBLE_TAIL_SECONDS = 0.2


#: While the engine's turn is still open, a gap this short between two of
#: VIDYA's sentences is still "VIDYA talking". The cascade synthesises sentence
#: by sentence; on staging a parent who began in such a gap was not treated as
#: interrupting until she started her next sentence over them (537 ms p95).
_SENTENCE_GAP_SECONDS = 1.5


def _ai_audible(bridge: _Bridge, now: float) -> bool:
    since = now - bridge.last_speech_frame_at
    return since < _AUDIBLE_TAIL_SECONDS or (
        bridge.model_turn_open and bridge.last_speech_frame_at > 0 and since < _SENTENCE_GAP_SECONDS
    )


def _feed_barge_in(bridge: _Bridge, ulaw: bytes) -> None:
    """Run each 20 ms of the parent's audio through the barge-in detector.

    Re-framed from whatever chunk size the carrier sends. The first version
    stepped through each payload in whole 160-byte frames and silently looked
    at NOTHING in a shorter one; Vobiz documents no inbound chunk size, and on
    the 2026-10-11 handset call the detector logged zero pauses while the
    payload-level engagement check (which reads any size) fired.
    """
    bridge.inbound.chunk(len(ulaw))
    data = bridge.inbound_pending + ulaw
    complete = len(data) - (len(data) % _FRAME_BYTES)
    for start in range(0, complete, _FRAME_BYTES):
        now = time.monotonic()
        audible = _ai_audible(bridge, now)
        level = frame_level(ulaw_to_pcm16(data[start : start + _FRAME_BYTES]))
        bridge.inbound.level(level, ai_audible=audible)
        action = bridge.barge.on_frame(level, now, ai_audible=audible)
        _apply_barge_action(bridge, action, by_model=False)
    bridge.inbound_pending = data[complete:]


def _apply_barge_action(bridge: _Bridge, action: Action, *, by_model: bool) -> None:
    """Make playback follow the detector. Synchronous: the pacer does the I/O."""
    if action is Action.NONE:
        return
    if action is Action.RESUME:
        # Playback stopped at the pause, whether or not the pacer has ticked
        # since; record that stop before frames flow again.
        _measure_stop(bridge)
        if _scripted(bridge):
            # Do NOT resume on silence alone. On the handset call a "Wait." was
            # resumed over after 0.5 s of quiet; the transcript decides instead
            # ("haan" resumes, anything else cancels), or noise times out.
            bridge.verdict_hold_until = time.monotonic() + _VERDICT_SECONDS
            log.info("telephony.barge_in", outreach_id=bridge.outreach_id, action="hold")
            return
        log.info("telephony.barge_in", outreach_id=bridge.outreach_id, action="resume")
        return
    if action is Action.PAUSE:
        # Stop now; keep the frames in case this is only "haan".
        bridge.clear_pending = True
        _arm_stop_measurement(bridge)
        log.info("telephony.barge_in", outreach_id=bridge.outreach_id, action="pause")
        return
    _cancel_response(bridge, by_model=by_model)


def _arm_stop_measurement(bridge: _Bridge) -> None:
    """Remember a local detection so the pacer can time how fast VIDYA stopped.

    Only local detections are timed: when the model's detector fires first we
    do not know when the parent actually began, so any number would be made up.
    """
    onset, detected = bridge.barge.onset_at, bridge.barge.detected_at
    if onset is None or detected is None or bridge.stop_to_measure is not None:
        return
    # A pause that later becomes a cancel is ONE stop, measured once.
    if detected == bridge.measured_detection or not _ai_audible(bridge, detected):
        return
    bridge.measured_detection = detected
    bridge.stop_to_measure = (onset, detected)


def _measure_stop(bridge: _Bridge) -> None:
    """Record onset->silence and decision->silence for the armed detection.

    "Silence" is the end of the last VIDYA frame we sent (sent time + 20 ms).
    What the carrier still had buffered is not visible to us; clearAudio asks
    it to drop that, and how promptly it does is the carrier's contract.
    """
    armed = bridge.stop_to_measure
    if armed is None:
        return
    bridge.stop_to_measure = None
    onset, detected = armed
    end = bridge.last_speech_frame_at + _FRAME_SECONDS
    bridge.onset_to_stop_ms.append(max(0.0, end - onset) * 1000)
    bridge.detect_to_stop_ms.append(max(0.0, end - detected) * 1000)


def _silence_current_reply(bridge: _Bridge, *, model_still_sending: bool) -> None:
    """Empty every place the current reply's audio can be, and file it as cut off."""
    was_playing = bool(bridge.pending) or not bridge.out.empty() or bridge.barge.paused
    bridge.generation += 1
    bridge.pending = b""
    bridge.decimator = None
    while not bridge.out.empty():
        with contextlib.suppress(asyncio.QueueEmpty):
            bridge.out.get_nowait()
    bridge.clear_pending = True
    if model_still_sending:
        # Whatever the model is still streaming for this reply is stale.
        bridge.discard_model_audio = True
    if bridge.agent_turn_text.strip():
        _commit_agent_turn(bridge, interrupted=was_playing)
    elif was_playing:
        _truncate_last_agent_entry(bridge)
    bridge.model_turn_open = False


def _cancel_response(bridge: _Bridge, *, by_model: bool) -> None:
    """Abandon the response the parent talked over, completely.

    Every place its audio can still be is emptied: the pacer queue, the
    half-frame carry-over, the resampler's filter tail and — via clearAudio —
    the carrier's own playout buffer. The generation bump makes any frame
    already handed to the queue unplayable, and `discard_model_audio` drops the
    chunks the model is still streaming for the abandoned turn.
    """
    # Discard what the engine is still streaming ONLY if its turn is still
    # open. A reply that had finished generating but was still PLAYING gets no
    # `interrupted` or `turn_complete` afterwards, so the discard never lifted
    # and silently swallowed the NEXT reply (Neha staging run 4: the attendance
    # answer was generated and thrown away; the silence nudge spoke instead).
    _silence_current_reply(bridge, model_still_sending=not by_model and bridge.model_turn_open)
    if not by_model:
        _arm_stop_measurement(bridge)
        # An engine that can abandon a reply (the cascade) is told to, so it
        # stops generating and synthesising rather than finishing into the void.
        stop = getattr(bridge.engine, "cancel_response", None)
        if callable(stop):
            stop(_heard_text(bridge))
    else:
        note = getattr(bridge.engine, "note_heard", None)
        if callable(note):
            note(_heard_text(bridge))
    bridge.dialogue.on_interrupted()
    log.info(
        "telephony.barge_in",
        outreach_id=bridge.outreach_id,
        action="cancel",
        by_model=by_model,
    )


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
    # One entry per UTTERANCE, not per fragment. Live transcription arrives in
    # pieces ("theek hai", "thank", "you so much"), so appending each piece made
    # one long sentence count as several turns: it tripped the 6-turn ceiling
    # and ended calls mid-conversation, satisfied the 2-turn minimum on a single
    # "haan", and showed the question veto only the last fragment of a question.
    if bridge.agent_spoke_since_parent or not bridge.parent_said:
        bridge.parent_said.append(said)
        bridge.agent_spoke_since_parent = False
    else:
        bridge.parent_said[-1] = f"{bridge.parent_said[-1]} {said}"
    _record_turn(bridge, "parent", said)

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

    if bridge.last_parent_voice_at:
        bridge.eos_to_final_ms.append((time.monotonic() - bridge.last_parent_voice_at) * 1000)

    if _scripted(bridge):
        # The cascade delivers ONE final transcript per utterance: the state
        # machine decides what happens; the model is only asked when it says so.
        await _act_on(bridge, session, said)
        return
    await _live_identity(bridge, session)

    # SAFETY NET. The model ending the call itself is still the main mechanism,
    # but it cannot be the only one: on a live call the parent said "theek hai,
    # thank you so much, namaskar" and the model replied "is there anything else
    # I can help with?", only ending 35 seconds later after two silence nudges.
    # Being asked another question after you have said goodbye is exactly the
    # thing that makes a call feel like a machine.
    #
    # A false positive here would hang up on someone mid-sentence, so this runs
    # ONLY through `_may_end_yet`: at least two parent turns, and their latest
    # utterance must not be a question.


#: How long the goodbye safety net waits for the model to START replying.
_GOODBYE_NET_GRACE_SECONDS = 3.0
#: ...and the longest it waits for that reply to finish.
_GOODBYE_NET_MAX_WAIT_SECONDS = 10.0


async def _close_unless_model_does(bridge: _Bridge, session: Any) -> None:
    """The parent said goodbye: give the MODEL the first chance to close.

    Sending the closing cue at once raced the model's own goodbye: on the
    staging run the cue went out 86 ms before the model's end_call, and the
    parent heard two goodbyes. A fixed wait was not enough either — the
    model's closing line can take longer than any grace period to finish.

    So: wait for the model's reply to the goodbye to FINISH. A reply that is
    not a question is the closing line — end after it plays, with no second
    cue. Only a reply that ignores the goodbye (a question) or no reply at
    all gets the closing cue.
    """
    armed_turns = bridge.dialogue.agent_turns
    started = time.monotonic()
    while time.monotonic() - started < _GOODBYE_NET_MAX_WAIT_SECONDS:
        if bridge.closing or bridge.stop:
            bridge.goodbye_net_armed = False
            return
        replied = bridge.dialogue.agent_turns > armed_turns
        if replied and not bridge.model_turn_open:
            break
        if (
            not replied
            and not bridge.model_turn_open
            and time.monotonic() - started >= _GOODBYE_NET_GRACE_SECONDS
        ):
            break  # the model has said nothing at all
        await asyncio.sleep(0.1)
    bridge.goodbye_net_armed = False
    if bridge.closing or bridge.stop:
        return
    last = bridge.transcript[-1] if bridge.transcript else None
    if (
        bridge.dialogue.agent_turns > armed_turns
        and last is not None
        and last["role"] == "agent"
        and not bridge.last_turn_interrupted
        and not last["text"].rstrip(" .…").endswith("?")
    ):
        log.info("telephony.goodbye_net", outreach_id=bridge.outreach_id, action="model_closed")
        bridge.closing = True
        bridge.dialogue.begin_closing()
        await _drain_then_stop(bridge)
        return
    log.info("telephony.goodbye_net", outreach_id=bridge.outreach_id, action="cue")
    await _begin_close(bridge, session, "goodbye")


def _meaningful(bridge: _Bridge) -> int:
    """Parent utterances that carried content: not wait/what/repeat/okay."""
    return sum(1 for u in bridge.parent_said if classify(u) is Kind.SUBSTANTIVE)


def _must_end_now(bridge: _Bridge) -> bool:
    """A long call wraps up after this many REAL exchanges, never on a count of
    "wait", "what?" and "okay" (the old 6-utterance ceiling)."""
    return _meaningful(bridge) >= _MAX_MEANINGFUL_EXCHANGES


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
    """Answer the model's function calls.

    `end_call` and `confirm_parent_identity` are answered at once. School-data
    lookups run as their own tasks so the receive loop keeps flowing — a
    barge-in or a cancellation must still be seen while a read is in flight —
    and each answers for itself when done.
    """
    if tool_call is None or not getattr(tool_call, "function_calls", None):
        return
    from google.genai import types as genai_types

    immediate: list[Any] = []
    for fc in tool_call.function_calls:
        if fc.name in TOOL_NAMES:
            bridge.tool_calls += 1
            task = _spawn(bridge, _run_lookup(bridge, session, fc))
            if fc.id:
                bridge.tool_tasks[fc.id] = task
            continue
        if fc.name != "end_call":
            immediate.append(
                genai_types.FunctionResponse(
                    id=fc.id, name=fc.name, response={"error": "unknown_tool"}
                )
            )
            continue
        reason = str((dict(fc.args or {})).get("reason") or "parent_finished")
        if not _end_call_allowed(bridge, reason):
            # The model may ask; the state machine decides. A model that ends
            # the call on its own reading of the conversation hung up on parents
            # mid-question in earlier tests.
            bridge.end_call_declined += 1
            log.info(
                "telephony.end_call_declined",
                outreach_id=bridge.outreach_id,
                reason=reason,
                stage=bridge.dialogue.stage.value,
            )
            immediate.append(
                genai_types.FunctionResponse(
                    id=fc.id,
                    name=fc.name,
                    response={
                        "status": "declined",
                        "say": "The call is not over. Carry on listening to the parent.",
                    },
                )
            )
            continue
        immediate.append(
            genai_types.FunctionResponse(id=fc.id, name=fc.name, response={"status": "ok"})
        )

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
        # A parent asking to stop, or a voicemail, is honoured at once. On this
        # carrier DTMF is not delivered inside a bidirectional <Stream> — only a
        # separate <Gather> verb carries it — so the "press 2 to end" escape
        # hatch of the Twilio flow does not exist here. Spoken words are the
        # ONLY way a parent can end this call, which makes refusing one a
        # much more serious thing than it was in June.
        honour_immediately = reason in (
            "opt_out",
            "call_back_later",
            "wrong_number",
            "voicemail",
        ) or (reason == "message_delivered" and bridge.delivery_only)
        if not honour_immediately and not _may_end_yet(bridge):
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
        bridge.dialogue.begin_closing()
        _spawn(bridge, _drain_then_stop(bridge))

    if immediate:
        with contextlib.suppress(Exception):
            await session.send_tool_response(function_responses=immediate)


def _end_call_allowed(bridge: _Bridge, reason: str) -> bool:
    """May the model end the call now? Only where the state machine agrees."""
    if bridge.dialogue.stage is Stage.GOODBYE:
        return True
    if _scripted(bridge):
        # The cascade's closings are the bridge's own fixed lines.
        return False
    last = bridge.parent_said[-1] if bridge.parent_said else ""
    # Each reason is honoured only on the evidence for it.
    evidence: dict[str, Callable[[], bool]] = {
        "voicemail": lambda: not bridge.engaged,
        "wrong_number": lambda: bridge.dialogue.identity is Identity.DENIED,
        "opt_out": lambda: is_optout(bridge.recent_speech),
        "call_back_later": lambda: classify(last) is Kind.BUSY,
        "message_delivered": lambda: (
            bridge.delivery_only and bridge.dialogue.may_share_student_data
        ),
    }
    check = evidence.get(reason)
    if check is not None:
        return check()
    return _may_end_yet(bridge) and is_goodbye(last)


async def _run_lookup(bridge: _Bridge, session: Any, fc: Any) -> None:
    """Run one school-data lookup and answer the model with its result.

    Cancelled (by the model's tool_call_cancellation, or the call ending) means
    no answer is sent: the model has moved on, and a late answer would make it
    talk about a question the parent abandoned.
    """
    from google.genai import types as genai_types

    try:
        if bridge.tools is None:
            result: dict[str, Any] = {
                "available": False,
                "reason": "lookups_disabled",
                "say": "Say you do not have that to hand and offer a teacher callback.",
            }
        else:
            result = await bridge.tools.run(
                fc.name,
                dict(fc.args or {}),
                may_share=bridge.dialogue.may_share_student_data,
            )
        with contextlib.suppress(Exception):
            await session.send_tool_response(
                function_responses=[
                    genai_types.FunctionResponse(id=fc.id, name=fc.name, response=result)
                ]
            )
    finally:
        if fc.id:
            bridge.tool_tasks.pop(fc.id, None)


# ---- the conversation manager: executes the state machine's decisions --------


def _scripted(bridge: _Bridge) -> bool:
    """The engine takes direct orders (respond / say): the Neha cascade."""
    return callable(getattr(bridge.engine, "say", None)) and callable(
        getattr(bridge.engine, "respond", None)
    )


def _leaks(bridge: _Bridge, text: str) -> bool:
    """Would saying `text` disclose child data before verification?"""
    if bridge.dialogue.may_share_student_data or bridge.protected is None:
        return False
    return bool(bridge.protected.leaks(text))


def _vidya_speaking(bridge: _Bridge) -> bool:
    return (
        not bridge.out.empty()
        or bool(bridge.pending)
        or bridge.barge.paused
        or bool(bridge.verdict_hold_until)
        or bool(getattr(bridge.engine, "busy", False))
    )


def _language(bridge: _Bridge) -> str:
    lang = getattr(bridge.engine, "language", None)
    if isinstance(lang, str) and lang:
        return lang
    return bridge.context.language if bridge.context else "English"


def _fixed(bridge: _Bridge, key: str) -> str:
    ctx = bridge.context
    return line(
        key,
        _language(bridge),
        school=(ctx.school_name if ctx else "") or "",
        teacher=(ctx.teacher_name if ctx else "") or "",
        ai=disclose_ai(),
    )


async def _say(bridge: _Bridge, session: Any, text: str) -> None:
    """Speak a fixed line verbatim (cascade) or have the model say it (Live)."""
    if _leaks(bridge, text):
        # A fixed line is never child-specific before verification; if one ever
        # is, that is a bug and it is not spoken.
        bridge.privacy_blocks += 1
        log.warning("telephony.privacy_block", outreach_id=bridge.outreach_id, where="fixed_line")
        return
    bridge.next_turn_scripted = True
    if _scripted(bridge):
        await bridge.engine.say(text)
    else:
        with contextlib.suppress(Exception):
            await _send_director(session, f'(Say exactly this, and nothing else: "{text}")')


def _stop_current(bridge: _Bridge) -> bool:
    """Silence whatever VIDYA is saying (or holding) and drop it for good.

    Returns whether anything was cut off. Leaves the dialogue's floor alone:
    this runs AFTER the state machine has decided ("wait" -> waiting for the
    parent), and marking the floor "interrupted" here overwrote that decision.
    """
    held = bool(bridge.verdict_hold_until)
    bridge.verdict_hold_until = 0.0
    if not (held or _vidya_speaking(bridge)):
        return False
    _silence_current_reply(bridge, model_still_sending=bridge.model_turn_open)
    stop = getattr(bridge.engine, "cancel_response", None)
    if callable(stop):
        stop(_heard_text(bridge))
    return True


def _unlock(bridge: _Bridge) -> None:
    """Verified: from now on the engine may know (and say) the child's context."""
    if bridge.unlocked:
        return
    bridge.unlocked = True
    unlock = getattr(bridge.engine, "unlock", None)
    if callable(unlock):
        unlock(bridge.unlocked_instruction)
    log.info("telephony.identity", outreach_id=bridge.outreach_id, outcome="verified")


async def _act_on(bridge: _Bridge, session: Any, said: str) -> None:  # noqa: PLR0912 — one branch per decision
    """Execute the state machine's decision for one parent utterance."""
    decision = bridge.dialogue.on_parent(said, vidya_speaking=_vidya_speaking(bridge))
    action = decision.action
    bridge.decisions[action.value] = bridge.decisions.get(action.value, 0) + 1
    log.info(
        "telephony.decision",
        outreach_id=bridge.outreach_id,
        action=action.value,
        kind=decision.kind.value,
        detail=decision.detail or None,
        stage=bridge.dialogue.stage.value,
    )
    if action in (Next.IGNORE, Next.RESUME):
        bridge.verdict_hold_until = 0.0  # "haan": carry on from where she paused
        return
    if _stop_current(bridge):
        bridge.dialogue.interruptions += 1
    expects_reply = action is not Next.YIELD_FLOOR
    if expects_reply:
        bridge.awaiting_reply_since = bridge.last_parent_voice_at or time.monotonic()
    if action is Next.YIELD_FLOOR:
        bridge.yielded_at = time.monotonic()
        bridge.wait_prompted = False
    elif action is Next.ASK_IDENTITY:
        await _say(bridge, session, _fixed(bridge, f"identity_{decision.detail or 'retry'}"))
        bridge.dialogue.on_identity_question_asked()
    elif action is Next.DELIVER_MESSAGE:
        _unlock(bridge)
        _tell_engine_the_state(bridge)
        await _say(bridge, session, _delivery_text(bridge))
        bridge.dialogue.on_message_delivered()
        if bridge.delivery_only:
            await _close_call(bridge, session, "goodbye")
    elif action is Next.REPEAT_MESSAGE:
        await _say(
            bridge, session, spoken_message(bridge.context.message if bridge.context else "")
        )
    elif action is Next.REPEAT_LAST:
        await _say(bridge, session, bridge.dialogue.last_agent_text)
    elif action is Next.RESPOND:
        bridge.dialogue.last_reply_was_to_ack = decision.kind is Kind.ACK
        _tell_engine_the_state(bridge)
        await bridge.engine.respond(said)
    elif action is Next.CLOSE:
        await _close_call(bridge, session, decision.detail or "goodbye")


def _delivery_text(bridge: _Bridge) -> str:
    message = spoken_message(bridge.context.message if bridge.context else "")
    if not message:
        message = "The teacher asked me to check in with you about your child."
    return f"{_fixed(bridge, 'deliver_lead')} {message} {_fixed(bridge, 'deliver_invite')}"


async def _close_call(bridge: _Bridge, session: Any, why: str) -> None:
    """One complete goodbye (a fixed line), then hang up once it has played."""
    if bridge.closing or bridge.stop:
        return
    if why == "opt_out":
        bridge.opted_out = True
    if not _scripted(bridge):
        await _begin_close(bridge, session, {"opt_out": "opt_out"}.get(why, why))
        return
    bridge.closing = True
    bridge.dialogue.begin_closing()
    log.info("telephony.closing", outreach_id=bridge.outreach_id, reason=why)
    _stop_current(bridge)
    key = {
        "goodbye": "close_goodbye",
        "busy": "close_busy",
        "opt_out": "close_opt_out",
        "wrong_person": "close_wrong_person",
        "unverified": "close_unverified",
        "silence": "close_silence",
        "never_engaged": "close_silence",
        "limit": "close_goodbye",
    }.get(why, "close_goodbye")
    await _say(bridge, session, _fixed(bridge, key))
    _spawn(bridge, _end_after_fixed_line(bridge))


async def _end_after_fixed_line(bridge: _Bridge) -> None:
    """Hang up only after the goodbye has been synthesised AND played."""
    deadline = time.monotonic() + _CLOSING_GRACE_SECONDS + 6.0
    while time.monotonic() < deadline:
        if not getattr(bridge.engine, "busy", False) and bridge.out.empty() and not bridge.pending:
            await asyncio.sleep(0.6)  # the carrier's own buffer
            break
        await asyncio.sleep(0.1)
    bridge.stop = True


async def _live_identity(bridge: _Bridge, session: Any) -> None:
    """Gemini Live: verify from the transcript; unlock with a context turn.

    Live answers the audio itself, so here the bridge only owns the gate: the
    session starts locked (no child context), and the child's context is sent
    only once the caller has said the child's name.
    """
    last = bridge.parent_said[-1] if bridge.parent_said else ""
    if is_optout(bridge.recent_speech):
        bridge.opted_out = True
        await _begin_close(bridge, session, "opt_out")
        return
    if not bridge.dialogue.may_share_student_data:
        decision = bridge.dialogue.check_identity(last)
        if decision is Identity.CONFIRMED:
            _unlock(bridge)
            from google.genai import types as genai_types

            facts = verified_facts(bridge.context) if bridge.context else ""
            with contextlib.suppress(Exception):
                await session.send_client_content(
                    turns=genai_types.Content(
                        role="user",
                        parts=[genai_types.Part(text=f"{VERIFIED_CUE}\n{facts}")],
                    ),
                    turn_complete=True,
                )
            bridge.dialogue.on_message_delivered()
        elif decision is Identity.DENIED:
            await _begin_close(bridge, session, "goodbye")
            return
    # A goodbye ends the call whether or not the caller was verified.
    if is_goodbye(last) and _may_end_yet(bridge) and not bridge.goodbye_net_armed:
        bridge.goodbye_net_armed = True
        _spawn(bridge, _close_unless_model_does(bridge, session))


def _cancel_lookups(bridge: _Bridge, ids: list[str] | None) -> None:
    for call_id in ids or []:
        task = bridge.tool_tasks.pop(call_id, None)
        if task is not None:
            task.cancel()
            log.info("telephony.tool_cancelled", outreach_id=bridge.outreach_id)


async def _drain_then_stop(bridge: _Bridge) -> None:
    """Let whatever is queued reach the parent, then end the call."""
    deadline = time.monotonic() + _CLOSING_GRACE_SECONDS
    while time.monotonic() < deadline:
        await asyncio.sleep(0.25)
        if bridge.out.empty() and not bridge.pending:
            await asyncio.sleep(_PREBUFFER_SECONDS + 0.3)
            break
    bridge.stop = True


def _on_model_interrupted(bridge: _Bridge, server: Any) -> None:
    if server is None or not getattr(server, "interrupted", False):
        return
    if bridge.discard_model_audio:
        # We cancelled this response already, on the parent's onset; the model
        # has now caught up. Its next audio is the reply.
        bridge.discard_model_audio = False
        return
    # The model heard the parent first. Drop everything queued and have the
    # carrier discard what it has buffered; doing only the first still leaves
    # stale speech in their ear.
    _apply_barge_action(bridge, bridge.barge.on_model_interrupted(time.monotonic()), by_model=True)


def _on_agent_transcription(bridge: _Bridge, server: Any) -> None:
    if server is None:
        return
    spoken = getattr(server, "output_transcription", None)
    text = (getattr(spoken, "text", "") or "") if spoken else ""
    if text.strip() and not bridge.discard_model_audio:
        _open_model_turn(bridge)
        _agent_said(bridge, text)
        bridge.agent_spoke_since_parent = True
        if _leaks(bridge, bridge.agent_turn_text):
            # Defence in depth for an engine whose output we cannot pre-check
            # (Gemini Live): stop it the moment its transcript shows it.
            bridge.privacy_blocks += 1
            log.warning("telephony.privacy_block", outreach_id=bridge.outreach_id, where="live")
            bridge.agent_turn_text = ""
            _silence_current_reply(bridge, model_still_sending=bridge.model_turn_open)


def _open_model_turn(bridge: _Bridge) -> None:
    """A new model turn starts at its first audio OR its first transcription;
    what was played before belongs to the previous turn."""
    if not bridge.model_turn_open:
        bridge.model_turn_open = True
        bridge.turn_frames_generated = bridge.turn_frames_played = 0


def _on_model_audio(bridge: _Bridge, data: bytes | None, *, ulaw: bytes | None = None) -> None:
    """Model speech for the parent: PCM16 24 kHz (Live), or ready mu-law (cascade).

    The cascade sends mu-law it has already resampled in 40 ms slices, off the
    pacer's critical path; resampling whole TTS chunks here held the event loop
    ~28 ms per second of audio and made the 20 ms pacer late.
    """
    if not data and not ulaw:
        return
    if bridge.discard_model_audio:
        # Still streaming for the response the parent talked over.
        bridge.stale_chunks_dropped += 1
        return
    bridge.last_activity = time.monotonic()
    bridge.model_has_spoken = True
    bridge.agent_spoke_since_parent = True
    bridge.model_last_audio = bridge.last_activity
    if bridge.first_audio_at is None:
        bridge.first_audio_at = time.monotonic()
    _open_model_turn(bridge)
    if ulaw is None:
        ulaw, bridge.decimator = pcm24k_to_ulaw8k(data or b"", bridge.decimator)
    bridge.turn_frames_generated += len(ulaw) // _FRAME_BYTES
    _queue_ulaw(bridge, ulaw)


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
            _on_model_interrupted(bridge, server)

            cancelled = getattr(resp, "tool_call_cancellation", None)
            if cancelled is not None:
                _cancel_lookups(bridge, getattr(cancelled, "ids", None))

            await _handle_parent_speech(bridge, session, server)
            _on_agent_transcription(bridge, server)
            await _handle_tool_call(bridge, session, getattr(resp, "tool_call", None))

            if server is not None and getattr(server, "turn_complete", False):
                # The abandoned response is over even if the model never
                # flagged it as interrupted; what follows is new speech.
                bridge.discard_model_audio = False
                bridge.model_turn_open = False
                _commit_agent_turn(bridge)

            _on_model_audio(bridge, getattr(resp, "data", None), ulaw=getattr(resp, "ulaw", None))
        # The turn is over: the carry-over is a true tail now, not a chunk seam.
        _flush_ulaw(bridge)
        _commit_agent_turn(bridge)
        if not turn_had_output:
            # The generator returned without yielding anything. That is the
            # session really being gone, not a completed turn; re-entering it
            # would spin.
            break
    return "live_stream_end"


async def _barge_in_tick(bridge: _Bridge) -> bool:
    """The pacer's barge-in duties for one tick. False if the carrier is gone.

    - A clearAudio is owed: send it, so the carrier drops its buffer too.
    - Playback is paused: hold VIDYA's frames (they play on if this was only
      "haan") and keep the line fed with one frame of silence.
    """
    if not bridge.stream_id:
        return True
    try:
        if bridge.clear_pending:
            bridge.clear_pending = False
            await bridge.ws.send_text(build_clear_audio(bridge.stream_id))
            bridge.clear_sent_at = time.monotonic()
        if bridge.verdict_hold_until and time.monotonic() > bridge.verdict_hold_until:
            # No transcript came: it was noise, not the parent. Carry on.
            bridge.verdict_hold_until = 0.0
        if bridge.barge.paused or bridge.verdict_hold_until:
            _measure_stop(bridge)
            await bridge.ws.send_text(build_play_audio(bridge.stream_id, _SILENCE_FRAME))
    except Exception:  # noqa: BLE001 — the carrier is gone; the handler decides what that means
        bridge.stop = True
        return False
    return True


def _next_current_frame(bridge: _Bridge) -> bytes | None:
    """Take the first queued frame that is still current.

    Frames from a superseded generation are dropped here rather than played,
    and dropping them costs no time.
    """
    while True:
        try:
            generation, candidate = bridge.out.get_nowait()
        except asyncio.QueueEmpty:
            return None
        if generation == bridge.generation:
            return candidate
        bridge.stale_frames_dropped += 1


def _after_tick(bridge: _Bridge, *, is_speech: bool) -> None:
    """Bookkeeping for one pacer tick: what was played, and when."""
    if not is_speech:
        # A cancel empties the queue; the first tick with nothing to play
        # is when VIDYA actually went quiet.
        _measure_stop(bridge)
        return
    bridge.last_speech_frame_at = time.monotonic()
    bridge.turn_frames_played += 1
    if bridge.awaiting_reply_since:
        # The parent stopped speaking -> the first frame of the reply left.
        bridge.eos_to_first_audio_ms.append(
            (bridge.last_speech_frame_at - bridge.awaiting_reply_since) * 1000
        )
        bridge.awaiting_reply_since = 0.0


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

        if not await _barge_in_tick(bridge):
            return
        if bridge.barge.paused or bridge.verdict_hold_until:
            now = time.monotonic()
            if next_at < now - _MAX_PACING_LAG:
                next_at = now
            await asyncio.sleep(max(0.0, next_at - now))
            continue

        chunk = _next_current_frame(bridge)
        is_speech = chunk is not None
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
        _after_tick(bridge, is_speech=is_speech and bool(bridge.stream_id))

        now = time.monotonic()
        # Self-measurement. Client-observed jitter mixes our pacing with the
        # internet path to the carrier; this is the part we actually own, so it
        # is the part worth reporting.
        lateness = now - next_at
        if len(bridge.lateness_samples) < 30000:
            bridge.lateness_samples.append(max(0.0, lateness * 1000))
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
) -> tuple[Any, Any, str, CallContext, CallScope | None]:
    """Load the call's context and build the Live client, config and model.

    Split out of the handler so the handler reads as the shape of a call rather
    than as a setup script, and so the warm-up timings sit next to the work they
    measure.
    """
    from google import genai
    from google.genai import types as genai_types

    t_accept = time.monotonic()
    context, scope = await _load_context(outreach_id, language)
    t_context = time.monotonic()
    lookups = school_data_tools_enabled() and scope is not None

    settings = get_settings()
    # Model and location come from the app-facing voice route rather than from
    # constants of our own. The first version hardcoded the model name the
    # Suraksha agent uses, which does not exist on Vertex — every call died with
    # "Publisher model ... was not found". One source of truth for which Live
    # model actually exists is worth the import.
    client = genai.Client(
        vertexai=True,
        project=settings.gcp_project,
        location=os.environ.get("VOBIZ_LIVE_LOCATION") or _LIVE_LOCATION,
    )
    config = genai_types.LiveConnectConfig(
        response_modalities=[genai_types.Modality.AUDIO],
        system_instruction=genai_types.Content(
            parts=[
                genai_types.Part(
                    # LOCKED: nothing about the child until the bridge verifies
                    # the caller (privacy.py). The full context is handed over
                    # by _unlock / _live_identity, never before.
                    text=_instruction(context, lookups=lookups, verified=False)
                )
            ]
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
                                        "call_back_later, voicemail, message_delivered"
                                    ),
                                ),
                            },
                            required=["reason"],
                        ),
                    ),
                    *(_identity_and_lookup_declarations() if lookups else []),
                ]
            )
        ],
    )
    model = os.environ.get("VOBIZ_LIVE_MODEL") or _LIVE_MODEL

    # The gap between a parent saying "hello" and hearing a voice is the single
    # most important number on this route, and it is made of separable pieces.
    # Logging them apart is the difference between optimising the right one and
    # guessing which one is slow.
    log.info(
        "telephony.warmup",
        outreach_id=outreach_id,
        model="cascade" if cascade_enabled() else model,
        language=context.language,
        context_ms=round((t_context - t_accept) * 1000),
        client_ms=round((time.monotonic() - t_context) * 1000),
        since_open_ms=round((time.monotonic() - started) * 1000),
        lookups=lookups,
    )
    return client, config, model, context, (scope if lookups else None)


def _identity_and_lookup_declarations() -> list[Any]:
    """The read-only school-data allowlist.

    There is deliberately no identity tool any more: verification is the
    bridge's (dialogue.check_identity), from what the caller actually said, not
    something the model reports.
    """
    return list(tool_declarations())


def _instruction(context: CallContext, *, lookups: bool, verified: bool) -> str:
    return build_parent_call_instruction(
        context,
        disclose_ai=disclose_ai(),
        two_way=is_two_way(context.language),
        lookups=lookups,
        switch_to_hindi=cascade_enabled() and CascadeConfig.from_env().hindi,
        verified=verified,
    )


def _connect_engine(client: Any, model: str, config: Any) -> Any:
    """Gemini Live (default) or, on `VOBIZ_ENGINE=cascade`, the Neha cascade.

    Both are async context managers yielding the same session surface
    (engine.ConversationSession), so nothing downstream knows which it got.
    """
    if cascade_enabled():
        return open_cascade(
            CascadeConfig.from_env(),
            project=get_settings().gcp_project,
            system_instruction=config.system_instruction,
            tools=config.tools,
        )
    return client.aio.live.connect(model=model, config=config)


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


async def _settle_call(bridge: _Bridge, engine_error: str | None, started: float) -> None:
    """End the carrier call, then write the record."""
    # HANG UP FIRST. Everything else is bookkeeping and the parent must
    # not be held on the line for it.
    #
    # This used to run transcript-write then LLM summary then hangup,
    # with a comment claiming the summary "runs after the parent is off
    # the line". It did not: measured on a real call, the line stayed
    # open and silent for 5.3 seconds after the goodbye while Firestore
    # was written and a summary was generated. From the parent's side
    # that is a call that would not end.
    await _hangup(bridge.call_uuid)

    # A lookup still running has nobody to answer; a turn still being spoken
    # when the call ended belongs in the transcript.
    _cancel_lookups(bridge, list(bridge.tool_tasks))
    _commit_agent_turn(bridge)

    # Now the record, with the parent already gone. The opt-out goes
    # first: it is the one write whose loss re-dials someone who said no.
    if bridge.opted_out:
        await _persist_opt_out(bridge)
    if engine_error is not None:
        await _persist_engine_failure(bridge, engine_error)
    await _persist_transcript(bridge)
    if bridge.context is not None:
        await _generate_call_summary(bridge, bridge.context, int(time.monotonic() - started))


async def _stop_side_tasks(bridge: _Bridge | None, *tasks: asyncio.Task[None] | None) -> None:
    """Stop the pacer and the greeter on EVERY exit.

    `_run_call` stops them on the normal path, but a Live connect or setup
    failure skipped it and left the pacer ticking at 50 Hz for the life of the
    process.
    """
    if bridge is not None:
        bridge.stop = True
    for task in tasks:
        if task is not None and not task.done():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task


def _equip_bridge(bridge: _Bridge, context: CallContext, scope: CallScope | None) -> None:
    """Give the call what it learned from its outreach record."""
    bridge.context = context
    bridge.delivery_only = not is_two_way(context.language)
    bridge.dialogue = DialogueState(
        student_name=context.student_name,
        school_name=context.school_name,
        message=context.message,
    )
    bridge.protected = ProtectedTerms.build(
        student_name=context.student_name,
        class_name=context.class_name,
        message=context.message,
        extra=context.performance_summary,
        allowed=f"{context.school_name or ''} {context.teacher_name or ''}",
    )
    bridge.unlocked_instruction = _instruction(context, lookups=scope is not None, verified=True)
    if scope is not None:
        settings = get_settings()
        bridge.tools = SchoolDataTools(
            scope,
            lambda: FirestoreSchoolData(settings.gcp_project, settings.firestore_database),
        )
        # While VIDYA introduces herself, so the first question is answered warm.
        _spawn(bridge, bridge.tools.warm())


async def _kickoff(bridge: _Bridge, session: Any) -> None:
    """Open the conversation with the neutral identity question.

    The model takes over mid-conversation. Telling it the recording already
    played is what stops it introducing itself a second time, which is the
    single most obviously robotic thing this call could do.
    """
    if _scripted(bridge):
        # The guard runs before synthesis: before verification nothing
        # child-specific can be spoken, whoever composed it.
        session.set_guard(lambda sentence: not _leaks(bridge, sentence))
        await _say(bridge, session, _fixed(bridge, "identity_first"))
    else:
        from google.genai import types as genai_types

        await session.send_client_content(
            turns=genai_types.Content(
                role="user",
                parts=[genai_types.Part(text=_kickoff_text(bool(bridge.opener_queued_at)))],
            ),
            turn_complete=True,
        )
    bridge.dialogue.on_identity_question_asked()
    bridge.last_activity = time.monotonic()


def _conversation_metrics(bridge: _Bridge) -> dict[str, Any]:
    """Barge-in latency and dialogue quality, for the call_closed line."""

    def _ms(values: list[float], pct: float) -> int | None:
        v = percentile(values, pct)
        return None if v is None else round(v)

    return {
        "barge_pauses": bridge.barge.pauses,
        "barge_cancels": bridge.barge.cancels,
        "barge_false_triggers": bridge.barge.false_triggers,
        "barge_model_first": bridge.barge.model_first,
        "stale_chunks_dropped": bridge.stale_chunks_dropped,
        "onset_to_stop_p50_ms": _ms(bridge.onset_to_stop_ms, 50),
        "onset_to_stop_p95_ms": _ms(bridge.onset_to_stop_ms, 95),
        "detect_to_stop_p95_ms": _ms(bridge.detect_to_stop_ms, 95),
        "media_format": bridge.media_format,
        **bridge.inbound.summary(),
        **{f"barge_{k}": v for k, v in bridge.barge.diagnostics().items()},
        "eos_to_final_p50_ms": _ms(bridge.eos_to_final_ms, 50),
        "eos_to_final_p95_ms": _ms(bridge.eos_to_final_ms, 95),
        "eos_to_first_audio_p50_ms": _ms(bridge.eos_to_first_audio_ms, 50),
        "eos_to_first_audio_p95_ms": _ms(bridge.eos_to_first_audio_ms, 95),
        "frame_lateness_p50_ms": _ms(bridge.lateness_samples, 50),
        "frame_lateness_p95_ms": _ms(bridge.lateness_samples, 95),
        "max_queue_frames": bridge.max_queue_frames,
        "stale_frames_dropped": bridge.stale_frames_dropped,
        "stage": bridge.dialogue.stage.value,
        "identity_questions": bridge.dialogue.identity_questions,
        "meaningful_exchanges": _meaningful(bridge),
        "decisions": bridge.decisions,
        "privacy_blocks": bridge.privacy_blocks
        + int(getattr(bridge.engine, "privacy_blocks", 0) or 0),
        "end_call_declined": bridge.end_call_declined,
        "refused_transitions": bridge.dialogue.refused_transitions,
        "repeat_intros": bridge.dialogue.repeat_intros,
        "identity": bridge.dialogue.identity.value,
        "message_delivered": bridge.dialogue.message_delivered,
        "tool_calls": bridge.tool_calls,
    }


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
    pacer: asyncio.Task[None] | None = None
    greeter: asyncio.Task[None] | None = None
    live_connected = False
    engine_error: str | None = None
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

        client, config, model, context, scope = await _prepare_live_session(
            outreach_id, language, started
        )
        _equip_bridge(bridge, context, scope)

        async with _connect_engine(client, model, config) as session:
            live_connected = True
            bridge.engine = session
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

            await _kickoff(bridge, session)
            reason = await _run_call(bridge, session, pacer)
    except WebSocketDisconnect:
        reason = "carrier_disconnect"
    except Exception as exc:  # noqa: BLE001
        # Before Live is connected, a failure means the parent heard the opener
        # and then nothing: the conversation engine never came up. That is a
        # different incident from a mid-call error and is alerted on separately.
        reason = "error" if live_connected else "live_unavailable"
        if not live_connected:
            engine_error = type(exc).__name__
        log.error(
            "telephony.call_failed",
            outreach_id=outreach_id,
            reason=reason,
            error=str(exc),
            error_type=type(exc).__name__,
        )
    finally:
        # Release capacity before anything that can raise, so a failure on the
        # way out cannot strand a slot for the life of the process.
        _SESSION_SEM.release()
        await _stop_side_tasks(bridge, greeter, pacer)
        if bridge is not None:
            await _settle_call(bridge, engine_error, started)
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
            transcript_turns=len(bridge.transcript) if bridge else 0,
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
            **(_conversation_metrics(bridge) if bridge else {}),
        )
        with contextlib.suppress(Exception):
            code = {
                "max_duration": _CLOSE_MAX_DURATION,
                "idle_timeout": _CLOSE_IDLE,
            }.get(reason, 1000)
            await ws.close(code=code)
