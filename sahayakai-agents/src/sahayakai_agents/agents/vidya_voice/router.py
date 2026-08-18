"""FastAPI sub-router for the VIDYA voice (Gemini Live) spike.

POST /v1/vidya-voice/start-session
    Returns: ephemeral session token + WSS URL + tool list +
             session config the client uses to open the WebSocket.

The sidecar mints an ephemeral token via
`google.genai.Client.aio.auth_tokens.create()` — bound to the
specific Live model + tool set + system instruction we want for
THIS teacher's session. The client then opens its own WSS
connection to Live, with audio bytes flowing browser ↔ Google
directly. The sidecar never sees audio.

Why the sidecar mints (not the browser):
- Our master Gemini API key never leaves Cloud Run.
- The minted token is short-lived (default 60s for new-session use,
  client opens the WSS within that window) and bound to a single
  configuration — leaked tokens are low-blast-radius.
- We can record the per-session metadata (teacher uid, language,
  screen) in Firestore for analytics + cost attribution, even
  though the audio itself flows direct.

Phase S (spike). Migration plan in
`spikes/gemini_live_voice/SPIKE.md`.
"""
from __future__ import annotations

import asyncio
import base64
import contextlib
import hashlib
import hmac as hmaclib
import json
import os
import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from cachetools import TTLCache  # type: ignore[import-untyped]
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ...config import get_settings
from ...shared.errors import AgentError
from .agent import (
    build_tool_definitions,
    build_vidya_voice_session,
    get_voice_model,
    get_voice_name,
)
from .schemas import (
    LiveSessionConfig,
    SessionStartRequest,
    SessionStartResponse,
    StreamSetupFrame,
    StreamSetupPayload,
)

log = structlog.get_logger(__name__)

vidya_voice_router = APIRouter(
    prefix="/v1/vidya-voice", tags=["vidya-voice", "spike"]
)

# Sidecar version pinned per release cut. `-spike` suffix flags this
# is NOT the production VIDYA path so dashboards can split metrics.
SIDECAR_VERSION = "phase-s.0.0-spike"

# Ephemeral token TTL: short enough that a leaked token can't be
# replayed for long, long enough that a slow client (hostile network,
# backgrounded tab) can still complete the WSS handshake. Live's
# default is 60s for new-session use; we keep that.
DEFAULT_TOKEN_TTL_SECONDS = 60

# Live API WSS endpoint for an EPHEMERAL-TOKEN client.
#
# Verified 2026-07-30 against a real Google Live session (matches the
# google-genai SDK's own `live.connect` code path for `auth_tokens/*`):
# an ephemeral token MUST use the `v1alpha` surface and the
# `BidiGenerateContentConstrained` method (NOT `v1beta` /
# `BidiGenerateContent` — that combination 1008s "unregistered callers").
# The client authenticates with the header `Authorization: Token <token>`,
# NOT a `?access_token=` query param (also verified: query-param auth is
# rejected as an unregistered caller).
LIVE_WSS_BASE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained"


# ---- Ephemeral token minting --------------------------------------------


async def _mint_ephemeral_token(
    *,
    api_key: str,
    session_config: dict[str, Any],
    ttl_seconds: int,
) -> str:
    """Call `auth_tokens.create()` to mint a Live-bound token.

    The token is BOUND to:
      - a single new-session window (`new_session_expire_time`)
      - a maximum of one concurrent use (`uses=1` for spike;
        production may want 2-3 to allow reconnect)
      - the exact Live model + tool surface in `live_connect_constraints`

    `live_connect_constraints` makes the token unusable for any other
    Live configuration — a leaked token can't be repurposed to call
    a different model with different system instruction. This is the
    main reason we don't just hand the master key to the browser.
    """
    from google import genai
    from google.genai import types as genai_types

    # Developer API + `v1alpha` is the ONLY combination that mints a Live auth
    # token: `auth_tokens.create()` is unavailable on Vertex and pre-`v1alpha`.
    # `build_genai_client` is bypassed here on purpose — it would route the Vertex
    # sentinel to Vertex (401/denied). Verified: this config mints an ephemeral
    # token for `gemini-2.0-flash-live-001`.
    client = genai.Client(
        api_key=api_key,
        http_options=genai_types.HttpOptions(api_version="v1alpha"),
    )

    # Bind the token to the specific model + tools we plan to use.
    # `LiveConnectConfig` accepts `system_instruction` as either a
    # string (which becomes a `Content` server-side) or an explicit
    # `Content`. For the spike we hand the string — the SDK wraps it.
    constraints = genai_types.LiveConnectConstraints(
        model=session_config["model"],
        config=genai_types.LiveConnectConfig(
            response_modalities=[genai_types.Modality.AUDIO],
            system_instruction=session_config["system_instruction"],
            # Note: tool functions themselves can't be enumerated by
            # name only on the constraint — we pin the model + system
            # instruction (which mentions the tools) and rely on the
            # client to send the matching `tools` array on connect.
        ),
    )

    # Live's `CreateAuthTokenConfig` wants timezone-aware datetimes,
    # not raw float epoch seconds. Wall-clock UTC + ttl gives the
    # correct shape and dodges Cloud Run vs developer-laptop TZ skew.
    expire_at = datetime.now(UTC) + timedelta(seconds=ttl_seconds)

    try:
        token = await client.aio.auth_tokens.create(
            config=genai_types.CreateAuthTokenConfig(
                # Token is unusable AT ALL after `expire_time` —
                # absolute upper bound regardless of session activity.
                expire_time=expire_at,
                # Specifically: a new session must START within this
                # narrow window. Once the WSS handshake completes,
                # session lifetime is governed by Live itself.
                new_session_expire_time=expire_at,
                uses=1,
                live_connect_constraints=constraints,
                # NOTE: `lock_additional_fields=["model","config"]` was rejected by
                # Live with `400 field_mask is invalid for BidiGenerateContentSetup`
                # ("config" is not a valid setup field-mask entry), which blocked
                # every mint. The token is still bound to the model + system
                # instruction via `live_connect_constraints`; re-add a lock only
                # with VALIDATED field-mask names (a follow-up) rather than an
                # invalid one that breaks minting entirely.
            )
        )
    except Exception as exc:
        # The SDK raises a generic `errors.APIError` (or a network
        # error) here. We don't know yet whether the project has
        # ephemeral-token support enabled — surface that to the
        # caller with enough detail that an SRE can debug.
        log.error(
            "vidya_voice.token_mint_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Could not mint Gemini Live ephemeral token. The Live API "
                "may not be enabled on this project, or the configured "
                "model may not support ephemeral tokens yet. See "
                "spikes/gemini_live_voice/SPIKE.md decision gate."
            ),
            http_status=502,
        ) from exc

    # The returned `AuthToken.name` is the token string the client
    # presents on the WebSocket open as `?access_token=<name>`.
    name = getattr(token, "name", None)
    if not name:
        raise AgentError(
            code="INTERNAL",
            message="Gemini Live returned an empty token",
            http_status=502,
        )
    return str(name)


# ---- Endpoint ------------------------------------------------------------


@vidya_voice_router.post(
    "/start-session", response_model=SessionStartResponse
)
async def start_session(payload: SessionStartRequest) -> SessionStartResponse:
    """Mint an ephemeral Live session token and return everything the
    OmniOrb client needs to open its own WSS connection.

    Flow:
        1. Build the per-teacher Live config (model, voice, system
           instruction, tools).
        2. Mint an ephemeral token bound to that config.
        3. Return token + WSS URL + tool definitions + config metadata.

    The browser client then:
        4. Opens WSS to LIVE_WSS_BASE_URL with `?access_token=<token>`
        5. Sends the `setup` frame with the tools array on first message
        6. Streams mic audio in, plays response audio out, dispatches
           tool-call events to the existing NAVIGATE_AND_FILL handler.
    """
    settings = get_settings()
    # Live token minting REQUIRES the Developer API (auth_tokens.create is not a
    # Vertex operation) + the v1alpha surface, so use the real developer key
    # directly — NOT settings.genai_keys, which returns the Vertex sentinel when
    # GOOGLE_GENAI_USE_VERTEXAI is on. Other agents may run on Vertex; the Live
    # mint may not. (Verified: this key mints a token for the Live model.)
    dev_api_key = settings.genai_api_key.get_secret_value()
    if not dev_api_key:
        raise AgentError(
            code="INTERNAL",
            message=(
                "No Gemini Developer API key (GOOGLE_GENAI_API_KEY) configured — "
                "required to mint a Live session token."
            ),
            http_status=502,
        )

    # 1. Build the per-teacher session config.
    session_config = build_vidya_voice_session(
        language=payload.detectedLanguage
        or payload.teacherProfile.preferredLanguage
        or "en",
        screen_path=payload.currentScreenContext.path,
        grade=payload.teacherProfile.preferredGrade,
        subject=payload.teacherProfile.preferredSubject,
        school_context=payload.teacherProfile.schoolContext,
    )

    # 2. Mint the ephemeral token.
    ttl = DEFAULT_TOKEN_TTL_SECONDS
    token = await _mint_ephemeral_token(
        api_key=dev_api_key,
        session_config=session_config,
        ttl_seconds=ttl,
    )

    # 3. Hand back everything the client needs.
    response = SessionStartResponse(
        sessionToken=token,
        wssUrl=LIVE_WSS_BASE_URL,
        expiresInSeconds=ttl,
        sessionConfig=LiveSessionConfig(
            model=get_voice_model(),
            voice=get_voice_name(),
            responseModalities=["AUDIO"],
            languageCode=session_config["language_code"],
        ),
        tools=build_tool_definitions(),
        sidecarVersion=SIDECAR_VERSION,
        spike=True,
    )
    log.info(
        "vidya_voice.session_started",
        model=response.sessionConfig.model,
        voice=response.sessionConfig.voice,
        language=response.sessionConfig.languageCode,
        screen_path=payload.currentScreenContext.path,
        ttl_seconds=ttl,
        tool_count=len(response.tools),
    )
    return response


# ---- Vertex Live WebSocket proxy -----------------------------------------
#
# Why a PROXY (client <-> sidecar <-> Vertex) and not the client-direct
# ephemeral-token path above: Gemini Live on the Developer API runs on a
# prepaid credit tier that Cloud/startup credits do NOT fund. Vertex AI Live
# IS funded by Cloud Billing (verified 2026-07-30: a real session returned
# audio). Vertex authenticates with the sidecar's own ADC — there is no
# client-facing ephemeral token — so the sidecar terminates the client socket
# and relays PCM frames to Vertex. The master credentials never leave Cloud Run.

# A CURRENT Vertex Live model that accepts bidiGenerateContent, and the region
# it was verified working in. These are the DEFAULTS, not the values: Live
# model availability moves per region on Google's schedule, not ours, so
# needing a code change + build + deploy to point at a different model or move
# out of a degraded region turns a five-minute mitigation into an hour.
#
# Unset behaviour is exactly the pre-existing behaviour — these two strings are
# the ones proven working in production.
_DEFAULT_VERTEX_LIVE_MODEL = "gemini-live-2.5-flash-native-audio"
_DEFAULT_VERTEX_LIVE_LOCATION = "us-central1"
_PCM_IN_MIME = "audio/pcm;rate=16000"


def get_vertex_live_model() -> str:
    """Vertex Live model for the `/stream` proxy.

    Vertex uses its OWN model naming (`gemini-live-2.5-flash-native-audio`),
    distinct from the Developer-API names `agent.get_voice_model()` returns
    (`…-native-audio-latest`) and configured by a DIFFERENT variable — the two
    routes talk to two different APIs and must be able to move independently.

    Deliberately NOT `lru_cache`d, unlike `get_voice_model()`: the read is once
    per socket, nowhere near hot, and a cache only buys a stale value plus a
    `cache_clear()` every test has to remember.
    """
    return os.environ.get(
        "SAHAYAKAI_VERTEX_LIVE_MODEL", _DEFAULT_VERTEX_LIVE_MODEL
    )


def get_vertex_live_location() -> str:
    """Vertex region for the `/stream` proxy.

    Not `settings.vertex_location` (`asia-south1`): that is where the turn-based
    agents run, and Live is not offered in every region that serves
    `generateContent`. Coupling them would silently break voice the next time
    the turn-based fleet moves closer to its users.
    """
    return os.environ.get(
        "SAHAYAKAI_VERTEX_LIVE_LOCATION", _DEFAULT_VERTEX_LIVE_LOCATION
    )


def mint_stream_token(uid: str, ttl_seconds: int = 120) -> str:
    """Mint a short-lived token authorising `uid` to open a /stream socket.

    Format: `<uid>.<exp_unix>.<b64url_hmac_sha256(key, "uid.exp")>`, signed
    with the shared `SAHAYAKAI_REQUEST_SIGNING_KEY` (same secret both the web
    runtime and this sidecar mount). The web start-session route mints it; the
    sidecar verifies it before opening a (billable) Vertex session. The client
    never sees a Google credential — only this opaque, expiring token.

    The token is DETERMINISTIC in `(uid, exp)`: two mints for the same uid inside
    one wall-clock second (same `ttl_seconds`) produce byte-identical strings.
    That matters now that `/stream` burns tokens on first use — the second such
    token is refused as a replay. It is not a regression: the per-uid concurrency
    gate of 1 would refuse that second socket anyway, so a double-clicked "start
    voice" is rejected either way and the client simply re-mints. Callers that
    genuinely need two distinct live tokens (tests, any future multi-device
    support) must vary the TTL or wait out the second.
    """
    exp = int((datetime.now(UTC) + timedelta(seconds=ttl_seconds)).timestamp())
    key = get_settings().request_signing_key.get_secret_value().strip().encode()
    sig = base64.urlsafe_b64encode(
        hmaclib.new(key, f"{uid}.{exp}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{uid}.{exp}.{sig}"


def verify_stream_token(token: str | None) -> str | None:
    """Return the uid if `token` is a valid, unexpired stream token, else None."""
    if not token:
        return None
    try:
        uid, exp_raw, sig = token.split(".", 2)
        exp = int(exp_raw)
    except (ValueError, AttributeError):
        return None
    if exp < int(datetime.now(UTC).timestamp()):
        return None
    key = get_settings().request_signing_key.get_secret_value().strip().encode()
    expected = base64.urlsafe_b64encode(
        hmaclib.new(key, f"{uid}.{exp}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    if not hmaclib.compare_digest(expected, sig):
        return None
    return uid


# ---- Cost + abuse controls ----------------------------------------------
#
# The billable unit on this route is the per-audio-token Vertex Live session,
# and it is metered for as long as the socket is open. A valid token alone is
# therefore not a sufficient gate: before this block, one token was replayable
# for its whole TTL, a single uid could hold unlimited concurrent sessions, and
# nothing bounded either the per-user open rate or the total across users. One
# leaked token — or one client stuck in a reconnect loop — was an unbounded bill.
#
# Every guard below runs BEFORE `ws.accept()` and before `genai.Client` is
# constructed, so no reject path costs anything. All state is PER PROCESS: with
# N Cloud Run instances the real global ceiling is N × `_GLOBAL_MAX_LIVE_SESSIONS`
# and the per-uid guards hold only insofar as a uid's sockets land on one
# instance. That is a deliberate trade (no Redis round-trip on the hot path);
# a shared store is the follow-up if a single instance stops being the norm.
#
# Close codes, all in the application-private 4000-4999 range:
#
#   4401  token missing / malformed / expired / bad HMAC        (pre-existing)
#   4409  conflict — token already burned, OR uid already live
#   4429  per-uid hourly open limit exhausted
#   4503  process at its global concurrent-session ceiling
#   4408  idle-input timeout (no client frame within the window)
#   4410  maximum session wall clock reached
#
# 4409 covers both conflict cases on purpose: the client's remedy is identical
# (stop the other session, re-mint, retry), and `reason=` on the structlog line
# splits them for dashboards. 4429/4503/4408 mirror HTTP 429/503/408.
_CLOSE_BAD_TOKEN = 4401
_CLOSE_CONFLICT = 4409
_CLOSE_IDLE_TIMEOUT = 4408
_CLOSE_MAX_DURATION = 4410
_CLOSE_RATE_LIMITED = 4429
_CLOSE_AT_CAPACITY = 4503

# Single-use tokens. A token is burned on first PRESENTATION (after the HMAC
# verifies — an invalid token must never be able to poison the cache, same rule
# as the `auth._REPLAY_GUARD` nonce store this mirrors).
#
# The burn entry only has to outlive the token itself, since `verify_stream_token`
# independently rejects anything expired. 900s is 7.5× the 120s default mint TTL,
# so the mint TTL can grow a long way before the two windows can cross. 10k
# entries is far above our concurrent-teacher count; the bound only exists so a
# token flood cannot grow the process indefinitely.
_TOKEN_BURN_TTL_SECONDS = 900

# Per-uid hourly open limit. 6 was chosen against the session cap, not picked
# round: `_MAX_SESSION_SECONDS` is 600s, so 6 opens × 10 minutes = 60 minutes,
# i.e. a teacher can stay live for a solid unbroken hour and still not hit it.
# Any 7th open in the window is therefore reconnect-looping or sharing a uid,
# never a person talking. Sliding window, so it cannot be gamed on the hour edge.
_MAX_OPENS_PER_UID_PER_HOUR = 6
_RATE_LIMIT_WINDOW_SECONDS = 3600

# Global ceiling on concurrent Vertex Live sessions in THIS process. At 24 the
# worst case is 24 simultaneously metered audio streams per instance, which is
# the most we are willing to have in flight before shedding load — and well
# inside what one Cloud Run instance can relay. Exceeding it fails closed
# (4503) rather than queueing: a queued client keeps its socket open, retries,
# and converts a capacity problem into a thundering herd.
_GLOBAL_MAX_LIVE_SESSIONS = 24

# Session caps. Both exist because a live socket bills while it is open, and
# neither the browser nor the network reliably tells us the teacher walked away:
# a backgrounded tab holds the socket open indefinitely.
_MAX_SESSION_SECONDS = 600
_IDLE_INPUT_TIMEOUT_SECONDS = 30

# How long the accepted socket waits for the optional `setup` first frame.
#
# Short on purpose. The frame is the client echoing state it already has in
# memory, so a well-behaved client sends it in the same tick as the open and
# never approaches this. The deadline exists only so a client that sends
# NOTHING — old build, crashed mid-handshake, hostile — degrades to the
# unpersonalised session it would have got anyway instead of hanging. Waiting
# here costs nothing billable: the Vertex session is not opened until after it.
_SETUP_FRAME_TIMEOUT_SECONDS = 5.0

# Largest client frame we will parse. The frames are base64 PCM16LE 16kHz mono:
# a full SECOND of audio is 32000 bytes raw, ~42.7 KiB base64, so 64 KiB leaves
# generous headroom over any sane chunk size while keeping a hostile client from
# handing us an arbitrarily large string to decode and forward to a metered API.
# Oversized frames are dropped, not fatal — one bad frame must not end a lesson.
_MAX_CLIENT_FRAME_BYTES = 64 * 1024

# `_receive_client_frame` outcomes. An enum of four rather than exceptions
# because three of the four are ordinary traffic, not errors.
_FRAME_JSON = "json"
_FRAME_TIMEOUT = "timeout"
_FRAME_DISCONNECT = "disconnect"
_FRAME_DROPPED = "dropped"

_STREAM_TOKEN_BURN: TTLCache[str, bool] = TTLCache(
    maxsize=10_000, ttl=_TOKEN_BURN_TTL_SECONDS
)
_UID_OPEN_HISTORY: TTLCache[str, list[float]] = TTLCache(
    maxsize=10_000, ttl=_RATE_LIMIT_WINDOW_SECONDS
)
_ACTIVE_UIDS: set[str] = set()
_GLOBAL_SESSION_SEM = asyncio.Semaphore(_GLOBAL_MAX_LIVE_SESSIONS)


def reset_stream_guards(*, max_global_sessions: int | None = None) -> None:
    """Drop all per-process stream guard state. Test-support only.

    The guards are module-level by design (they must outlive any single socket),
    which makes them leak across tests in one process: one test's successful open
    would spend another's hourly budget. Every test that opens `/stream` resets
    first — wired as an autouse fixture in `tests/conftest.py`.
    """
    global _GLOBAL_SESSION_SEM
    _STREAM_TOKEN_BURN.clear()
    _UID_OPEN_HISTORY.clear()
    _ACTIVE_UIDS.clear()
    _GLOBAL_SESSION_SEM = asyncio.Semaphore(
        _GLOBAL_MAX_LIVE_SESSIONS if max_global_sessions is None else max_global_sessions
    )


def _extract_stream_token(ws: WebSocket) -> tuple[str | None, bool]:
    """Return `(token, came_from_query_string)`.

    `Authorization: Bearer <token>` is the supported form. A credential in a
    query string is written verbatim into every access log between the device
    and this process — the browser's, every intermediate proxy's, the load
    balancer's, Cloud Run's request log — none of which are treated as secret
    stores. The header is not logged by any of them.

    `?t=` is still accepted for EXACTLY ONE RELEASE because the shipped Flutter
    client sends it and would otherwise break on deploy. Each use emits a
    deprecation warning so the remaining callers are visible in logs before the
    branch is deleted.
    """
    header = ws.headers.get("authorization")
    if header:
        scheme, _, value = header.partition(" ")
        if scheme.lower() == "bearer" and value.strip():
            return value.strip(), False
    query_token = ws.query_params.get("t")
    if query_token:
        return query_token, True
    return None, False


def _burn_stream_token(token: str) -> bool:
    """Consume `token`. False if it was already spent.

    Called only after the HMAC has verified, so a forged token can never
    displace a real entry from the bounded cache.
    """
    if token in _STREAM_TOKEN_BURN:
        return False
    _STREAM_TOKEN_BURN[token] = True
    return True


def _reserve_uid_slot(uid: str) -> int | None:
    """Take this uid's concurrency slot and hourly budget, or return a close code.

    Deliberately SYNCHRONOUS. There is no `await` anywhere between each check and
    the matching mutation, so on a single-threaded event loop no second socket can
    interleave between "is there room" and "take the slot". Making this a coroutine
    would reintroduce exactly that race.
    """
    if uid in _ACTIVE_UIDS:
        return _CLOSE_CONFLICT

    now = time.monotonic()
    history = [
        t
        for t in _UID_OPEN_HISTORY.get(uid, ())
        if now - t < _RATE_LIMIT_WINDOW_SECONDS
    ]
    if len(history) >= _MAX_OPENS_PER_UID_PER_HOUR:
        # Write the pruned list back so the window keeps sliding even for a uid
        # that only ever gets rejected.
        _UID_OPEN_HISTORY[uid] = history
        return _CLOSE_RATE_LIMITED

    history.append(now)
    _UID_OPEN_HISTORY[uid] = history
    _ACTIVE_UIDS.add(uid)
    return None


async def _admit_stream(ws: WebSocket) -> str | None:
    """Run the full admission ladder for a `/stream` handshake.

    Returns the authenticated uid, having reserved BOTH the caller's per-uid slot
    and one global permit — the handler's `finally` owns releasing them. Returns
    None if the socket was refused, in which case this function has already sent
    the close frame and holds nothing.

    Every rejection happens before `ws.accept()`, so no reject path constructs a
    Vertex client. The ladder is ordered so the cheapest and most specific checks
    come first, and so a rejection never charges the caller for something that was
    not their fault.
    """
    token, from_query = _extract_stream_token(ws)
    uid = verify_stream_token(token)
    if uid is None or token is None:
        log.warning("vidya_voice.stream_rejected", reason="invalid_stream_token")
        await ws.close(code=_CLOSE_BAD_TOKEN)
        return None

    if from_query:
        log.warning(
            "vidya_voice.stream_token_in_query_string",
            uid=uid,
            detail=(
                "?t= is deprecated and removed next release; send "
                "'Authorization: Bearer <token>'"
            ),
        )

    # Single use. Burned on PRESENTATION rather than on success: a token that got
    # far enough to be checked must never be presentable twice, whatever the gates
    # below decide. Burning only on success would leave a token replayable for its
    # whole TTL every time a later gate rejected it.
    if not _burn_stream_token(token):
        log.warning("vidya_voice.stream_rejected", reason="token_replayed", uid=uid)
        await ws.close(code=_CLOSE_CONFLICT)
        return None

    # Global ceiling before the per-uid gates, so a process that is already full
    # does not spend the teacher's hourly budget on a socket it was never going to
    # serve — shedding load is our failure, not theirs.
    #
    # `locked()` followed by `acquire()` is atomic here: `acquire()` returns
    # without ever suspending while the semaphore is free (it only awaits when it
    # has to queue), so no other task can interleave between the test and the take.
    # Fails closed — it never waits, because a queued client holds its socket open
    # and retries, turning a capacity problem into a thundering herd.
    if _GLOBAL_SESSION_SEM.locked():
        log.warning("vidya_voice.stream_rejected", reason="global_capacity", uid=uid)
        await ws.close(code=_CLOSE_AT_CAPACITY)
        return None
    await _GLOBAL_SESSION_SEM.acquire()

    reject_code = _reserve_uid_slot(uid)
    if reject_code is not None:
        _GLOBAL_SESSION_SEM.release()
        log.warning(
            "vidya_voice.stream_rejected",
            reason=(
                "uid_already_streaming"
                if reject_code == _CLOSE_CONFLICT
                else "uid_hourly_rate_limit"
            ),
            uid=uid,
        )
        await ws.close(code=reject_code)
        return None

    return uid


@dataclass
class _StreamCounters:
    """Per-session byte + frame tallies, logged at close for cost attribution."""

    bytes_up: int = 0
    bytes_down: int = 0
    frames_up: int = 0
    frames_down: int = 0
    # Frames received but never forwarded upstream: binary, malformed JSON,
    # over the size bound, or not a JSON object. Counted separately from
    # `frames_up` (which is everything that arrived) so a client quietly
    # sending garbage is visible as a ratio rather than as silence.
    frames_dropped: int = 0


async def _receive_client_frame(  # noqa: PLR0911 — one return per way a frame can be bad; collapsing them hides the enumeration, which IS the function
    ws: WebSocket, counters: _StreamCounters, *, timeout: float
) -> tuple[str, Any]:
    """Read and tally exactly one client frame. Returns `(outcome, payload)`.

    The single place the client's bytes are trusted, and deliberately TOTAL:
    every hostile or malformed shape a socket can produce leaves by one of the
    four outcomes, never by an exception. That matters because the caller is
    holding an open Vertex session — anything raised past the pumps unwinds
    through `_relay_session`, and a leg that dies on a stray binary frame takes
    a paid-for session with it and shows the teacher a hard error for a frame
    the browser sent by accident.

      `_FRAME_JSON`        payload is a parsed JSON object, size-checked
      `_FRAME_TIMEOUT`     nothing arrived inside `timeout`
      `_FRAME_DISCONNECT`  payload is the close code (may be None)
      `_FRAME_DROPPED`     something arrived that we refuse to parse

    `ws.receive()` rather than `ws.receive_text()`: the latter reaches straight
    into `message["text"]`, so a client sending one BINARY frame raises KeyError
    from inside the pump. Reading the raw ASGI message lets binary be a dropped
    frame, which is what it is.

    Bytes are tallied for everything that arrived, including dropped frames —
    they crossed the wire and the reason for the tally is attribution, not
    approval.
    """
    try:
        message = await asyncio.wait_for(ws.receive(), timeout=timeout)
    except TimeoutError:
        return _FRAME_TIMEOUT, None
    except WebSocketDisconnect as exc:
        return _FRAME_DISCONNECT, exc.code
    except RuntimeError:
        # Starlette raises this ("Cannot call 'receive' once a disconnect
        # message has been received") when a leg reads after the peer is gone.
        # Same event, different spelling.
        return _FRAME_DISCONNECT, None

    if message["type"] != "websocket.receive":
        return _FRAME_DISCONNECT, message.get("code")

    raw = message.get("text")
    if raw is None:
        blob = message.get("bytes") or b""
        counters.bytes_up += len(blob)
        counters.frames_up += 1
        counters.frames_dropped += 1
        log.warning(
            "vidya_voice.frame_dropped", reason="binary_frame", frame_bytes=len(blob)
        )
        return _FRAME_DROPPED, None

    size = len(raw.encode("utf-8"))
    counters.bytes_up += size
    counters.frames_up += 1

    if size > _MAX_CLIENT_FRAME_BYTES:
        counters.frames_dropped += 1
        log.warning(
            "vidya_voice.frame_dropped", reason="frame_too_large", frame_bytes=size
        )
        return _FRAME_DROPPED, None

    try:
        frame = json.loads(raw)
    except ValueError:
        # `json.JSONDecodeError` subclasses `ValueError`; catching the parent
        # also covers the recursion/NaN cases that raise plain ValueError.
        counters.frames_dropped += 1
        log.warning(
            "vidya_voice.frame_dropped", reason="malformed_json", frame_bytes=size
        )
        return _FRAME_DROPPED, None

    if not isinstance(frame, dict):
        # `"null"`, `"[]"` and `"7"` are all valid JSON and none of them are a
        # frame. Without this every `frame.get(...)` below is an AttributeError.
        counters.frames_dropped += 1
        log.warning(
            "vidya_voice.frame_dropped", reason="not_an_object", frame_bytes=size
        )
        return _FRAME_DROPPED, None

    return _FRAME_JSON, frame


async def _await_setup_frame(
    ws: WebSocket, counters: _StreamCounters
) -> tuple[StreamSetupPayload | None, dict[str, Any] | None]:
    """Read the optional `{"setup": {...}}` first frame.

    Returns `(setup, pushback)`. `pushback` is a non-setup frame that arrived
    first and must still be relayed — the teacher's opening audio chunk is not
    ours to discard just because we were listening for something else.

    Runs AFTER admission and BEFORE the Vertex session is opened. Both halves
    matter: after admission means the frame cannot be used to slip past a limit
    (every gate has already run on the token, and this frame carries no
    identity); before the connect means the system instruction is built once,
    with the profile in it, and the 5s worst-case wait is unbilled.

    Never raises for a bad frame. A `setup` that fails validation is logged and
    dropped, leaving the session unpersonalised — the same outcome as a client
    that stayed silent, which is the right failure for an enrichment. Raising
    would let a stale client field name take voice mode down entirely.
    """
    outcome, payload = await _receive_client_frame(
        ws, counters, timeout=_SETUP_FRAME_TIMEOUT_SECONDS
    )
    if outcome == _FRAME_DISCONNECT:
        # Bail before the Vertex session exists. Returning normally here would
        # open — and bill — a live session for a socket that is already gone.
        raise WebSocketDisconnect(code=payload or 1005)
    if outcome in (_FRAME_TIMEOUT, _FRAME_DROPPED):
        log.info("vidya_voice.setup_frame_absent", reason=outcome)
        return None, None

    frame: dict[str, Any] = payload
    if "setup" not in frame:
        return None, frame

    try:
        return StreamSetupFrame.model_validate(frame).setup, None
    except ValidationError as exc:
        # Field names/values only — `schoolContext` is teacher-authored text
        # and has no business in a log line.
        log.warning(
            "vidya_voice.setup_frame_invalid",
            error_count=exc.error_count(),
            fields=sorted({str(e["loc"][-1]) for e in exc.errors() if e["loc"]}),
        )
        return None, None


def _build_vertex_live_config(session_config: dict[str, Any]) -> Any:
    """Build the `LiveConnectConfig` for the proxied Vertex session."""
    from google.genai import types as genai_types

    tools = [
        genai_types.Tool(
            function_declarations=[
                genai_types.FunctionDeclaration(
                    name=d.name,
                    description=d.description,
                    parameters=genai_types.Schema(
                        type=genai_types.Type.OBJECT,
                        properties={
                            "topic": genai_types.Schema(type=genai_types.Type.STRING),
                            "gradeLevel": genai_types.Schema(type=genai_types.Type.STRING),
                            "subject": genai_types.Schema(type=genai_types.Type.STRING),
                            "language": genai_types.Schema(type=genai_types.Type.STRING),
                        },
                    ),
                )
                for d in build_tool_definitions()
            ]
        )
    ]
    return genai_types.LiveConnectConfig(
        response_modalities=[genai_types.Modality.AUDIO],
        system_instruction=genai_types.Content(
            parts=[genai_types.Part(text=session_config["system_instruction"])]
        ),
        speech_config=genai_types.SpeechConfig(
            voice_config=genai_types.VoiceConfig(
                prebuilt_voice_config=genai_types.PrebuiltVoiceConfig(
                    voice_name=get_voice_name()
                )
            )
        ),
        tools=tools,
    )


async def _pump_client_to_vertex(
    ws: WebSocket,
    session: Any,
    counters: _StreamCounters,
    *,
    first_frame: dict[str, Any] | None = None,
) -> str:
    """Relay client frames (mic audio / text turns) up to Vertex Live.

    Returns the reason the upstream leg ended, which the handler turns into a
    close code. Reading is bounded by `_IDLE_INPUT_TIMEOUT_SECONDS`: a client
    that stops sending (backgrounded tab, teacher walked away, half-open TCP
    that never produced a FIN) keeps a metered Vertex session alive otherwise.

    `first_frame` is the frame the setup handshake read off the wire and found
    was not a setup frame. It is replayed here, already tallied, so a client
    that starts talking immediately does not lose its opening chunk.

    Every frame arrives via `_receive_client_frame`, so binary frames, junk
    JSON, oversized frames and a mid-read disconnect are all ordinary control
    flow here rather than exceptions escaping into `_relay_session`.
    """
    from google.genai import types as genai_types

    pending = first_frame
    while True:
        if pending is not None:
            frame, pending = pending, None
        else:
            outcome, payload = await _receive_client_frame(
                ws, counters, timeout=_IDLE_INPUT_TIMEOUT_SECONDS
            )
            if outcome == _FRAME_TIMEOUT:
                return "idle_timeout"
            if outcome == _FRAME_DISCONNECT:
                return "client_disconnect"
            if outcome == _FRAME_DROPPED:
                # Already counted and logged. One malformed frame is not a
                # reason to end a lesson.
                continue
            frame = payload

        if frame.get("end"):
            return "client_end"
        if frame.get("audio"):
            try:
                audio = base64.b64decode(frame["audio"])
            except (ValueError, TypeError):
                # Well-formed JSON carrying a non-base64 payload. Same verdict
                # as malformed JSON: drop it, keep the session.
                counters.frames_dropped += 1
                log.warning("vidya_voice.frame_dropped", reason="bad_base64_audio")
                continue
            await session.send_realtime_input(
                audio=genai_types.Blob(data=audio, mime_type=_PCM_IN_MIME)
            )
        elif frame.get("text"):
            await session.send_client_content(
                turns=genai_types.Content(
                    role="user", parts=[genai_types.Part(text=str(frame["text"]))]
                ),
                turn_complete=True,
            )


async def _pump_vertex_to_client(
    ws: WebSocket, session: Any, counters: _StreamCounters
) -> str:
    """Relay Vertex responses (audio / tool-calls / turn markers) down to client."""
    from google.genai import types as genai_types

    async def send(payload: dict[str, Any]) -> None:
        text = json.dumps(payload)
        counters.bytes_down += len(text.encode("utf-8"))
        counters.frames_down += 1
        await ws.send_text(text)

    async for resp in session.receive():
        if getattr(resp, "data", None):
            await send({"audio": base64.b64encode(resp.data).decode()})
        tc = getattr(resp, "tool_call", None)
        if tc and tc.function_calls:
            for fc in tc.function_calls:
                await send({
                    "toolCall": {
                        "name": fc.name,
                        "args": dict(fc.args or {}),
                        "id": fc.id,
                    }
                })
            await session.send_tool_response(
                function_responses=[
                    genai_types.FunctionResponse(
                        id=fc.id, name=fc.name, response={"status": "dispatched"}
                    )
                    for fc in tc.function_calls
                ]
            )
        sc = getattr(resp, "server_content", None)
        if sc and getattr(sc, "interrupted", False):
            await send({"interrupted": True})
        if sc and getattr(sc, "turn_complete", False):
            await send({"turnComplete": True})
    return "vertex_stream_end"


async def _relay_session(
    ws: WebSocket,
    session: Any,
    counters: _StreamCounters,
    *,
    first_frame: dict[str, Any] | None = None,
) -> tuple[int, str]:
    """Run both pumps until one leg ends or a session cap fires.

    Returns `(close_code, end_reason)`. Anything the pumps raise other than a
    client disconnect is re-raised for the handler's error path.
    """
    up = asyncio.create_task(
        _pump_client_to_vertex(ws, session, counters, first_frame=first_frame)
    )
    down = asyncio.create_task(_pump_vertex_to_client(ws, session, counters))
    # The wall clock rides on `asyncio.wait` itself: an empty `done` set means
    # neither leg finished inside the budget.
    done, pending = await asyncio.wait(
        {up, down},
        timeout=_MAX_SESSION_SECONDS,
        return_when=asyncio.FIRST_COMPLETED,
    )
    for task in pending:
        task.cancel()
    # Settle the cancellations before returning, so the caller's `async with`
    # cannot tear the Vertex session down underneath a pump still mid-write.
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)

    if not done:
        return _CLOSE_MAX_DURATION, "max_session_duration"

    finished = next(iter(done))
    exc = finished.exception()
    if exc is None:
        reason = str(finished.result())
        code = _CLOSE_IDLE_TIMEOUT if reason == "idle_timeout" else 1000
        return code, reason
    if isinstance(exc, WebSocketDisconnect):
        return 1000, "client_disconnect"
    raise exc


@vidya_voice_router.websocket("/stream")
async def vidya_voice_stream(ws: WebSocket) -> None:
    """Full-duplex bridge: OmniOrb client <-> sidecar <-> Vertex Live.

    Client -> sidecar frames (JSON text):
        {"setup": {...}}                            OPTIONAL first frame; see below
        {"audio": "<base64 PCM16LE 16kHz mono>"}   one mic chunk
        {"text": "<utterance>"}                     a text turn (testing / fallback)
        {"end": true}                               end the session
    Sidecar -> client frames (JSON text):
        {"audio": "<base64 PCM16LE 24kHz>"}         one model-audio chunk
        {"toolCall": {"name","args","id"}}          a routed VIDYA flow (client navigates)
        {"turnComplete": true} | {"interrupted": true} | {"error": "..."}

    Auth: the client presents a short-lived signed token minted by the web
    `/api/vidya-voice/start-session` route, as `Authorization: Bearer <token>`
    (`?t=` still accepted for one release — see `_extract_stream_token`). The
    socket is rejected (4401) before any billable Vertex session opens if the
    token is missing, malformed, expired, or fails the HMAC check.

    The token check runs BEFORE `ws.accept()` and is the ONLY authentication
    gate on this route: Starlette's `BaseHTTPMiddleware` never wraps websocket
    scopes, so the OIDC + HMAC + App Check chain in `auth.py` does not run here.
    ASGI lets a `websocket.close` answer the handshake while the socket is still
    CONNECTING, so an unauthenticated caller is refused outright — nothing
    billable (not even the google-genai import) is constructed on that path.

    Authentication is necessary but not sufficient, because the session bills
    per audio token for as long as it is open. The admission ladder below adds
    single-use tokens (4409), per-uid concurrency of 1 (4409), a per-uid hourly
    open limit (4429) and a process-wide concurrency ceiling (4503); once open,
    the session is bounded by an idle-input timeout (4408) and a wall clock
    (4410). See the `Cost + abuse controls` block for the numbers and why.

    Personalisation: the accepted socket waits up to
    `_SETUP_FRAME_TIMEOUT_SECONDS` for an optional first frame

        {"setup": {"grade","subject","schoolContext","language","screenPath"}}

    bounded by the SAME limits as the `start-session` HTTP body (see
    `schemas.Grade` and friends). Without it this route built its system
    instruction with `grade=None, subject=None, school_context=None` while the
    turn-based path had the teacher's real profile — voice mode, the flagship,
    answered a Class 8 science teacher exactly as it answered everyone.

    The frame arrives strictly AFTER admission, so it can neither carry
    identity nor move any limit; and strictly BEFORE the Vertex connect, so the
    profile is in the system instruction from the first token and the wait
    itself is unbilled.
    """
    uid = await _admit_stream(ws)
    if uid is None:
        return

    counters = _StreamCounters()
    started_at = time.monotonic()
    close_code = 1000
    end_reason = "unknown"

    # The `try` opens HERE, immediately after the ladder handed us the uid slot
    # and the global permit, so that every path out of this handler goes through
    # the `finally` that gives them back. Anything raised between the reservation
    # and the `try` — a failed `accept()`, a client that vanished during the
    # setup wait, a `genai.Client` that could not be constructed — would
    # otherwise strand a permit for the life of the process, and 24 of those
    # bricks the instance.
    try:
        await ws.accept()

        setup, pushback = await _await_setup_frame(ws, counters)

        # Query params stay the fallback: the shipped Flutter client sends
        # `?lang=`/`?screen=` and no setup frame, and must keep working exactly
        # as before until it is updated.
        detected_language = (
            (setup.language if setup else None) or ws.query_params.get("lang") or "en"
        )
        screen_path = (
            (setup.screenPath if setup else None)
            or ws.query_params.get("screen")
            or "/dashboard"
        )
        session_config = build_vidya_voice_session(
            language=detected_language,
            screen_path=screen_path,
            grade=setup.grade if setup else None,
            subject=setup.subject if setup else None,
            school_context=setup.schoolContext if setup else None,
        )

        model = get_vertex_live_model()
        from google import genai

        client = genai.Client(
            vertexai=True,
            project=get_settings().gcp_project,
            location=get_vertex_live_location(),
        )
        config = _build_vertex_live_config(session_config)
        log.info(
            "vidya_voice.stream_open",
            uid=uid,
            model=model,
            language=detected_language,
            # Whether the regression is actually fixed in production is not
            # answerable from the code — it depends on clients sending the
            # frame. This field is how we find out.
            personalised=setup is not None,
        )

        async with client.aio.live.connect(model=model, config=config) as session:
            close_code, end_reason = await _relay_session(
                ws, session, counters, first_frame=pushback
            )
    except WebSocketDisconnect:
        end_reason = "client_disconnect"
    except Exception as exc:  # noqa: BLE001
        end_reason = "error"
        log.error(
            "vidya_voice.stream_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        with contextlib.suppress(Exception):
            await ws.send_text(json.dumps({"error": "live session failed"}))
    finally:
        # Release the slots before anything that can raise, so a failure on the
        # way out cannot strand capacity for the life of the process.
        _ACTIVE_UIDS.discard(uid)
        _GLOBAL_SESSION_SEM.release()
        # Byte telemetry: the bill is per audio token and these are the only
        # numbers that attribute it to a uid, since the audio itself is relayed
        # and never stored.
        log.info(
            "vidya_voice.stream_closed",
            uid=uid,
            reason=end_reason,
            close_code=close_code,
            duration_seconds=round(time.monotonic() - started_at, 3),
            bytes_up=counters.bytes_up,
            bytes_down=counters.bytes_down,
            frames_up=counters.frames_up,
            frames_down=counters.frames_down,
            frames_dropped=counters.frames_dropped,
        )
        with contextlib.suppress(Exception):
            await ws.close(code=close_code)
