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
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

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

# A CURRENT Vertex Live model that accepts bidiGenerateContent (verified live
# in us-central1). Override with SAHAYAKAI_VIDYA_VOICE_MODEL.
VERTEX_LIVE_MODEL = "gemini-live-2.5-flash-native-audio"
VERTEX_LIVE_LOCATION = "us-central1"
_PCM_IN_MIME = "audio/pcm;rate=16000"


def mint_stream_token(uid: str, ttl_seconds: int = 120) -> str:
    """Mint a short-lived token authorising `uid` to open a /stream socket.

    Format: `<uid>.<exp_unix>.<b64url_hmac_sha256(key, "uid.exp")>`, signed
    with the shared `SAHAYAKAI_REQUEST_SIGNING_KEY` (same secret both the web
    runtime and this sidecar mount). The web start-session route mints it; the
    sidecar verifies it before opening a (billable) Vertex session. The client
    never sees a Google credential — only this opaque, expiring token.
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


async def _pump_client_to_vertex(ws: WebSocket, session: Any) -> None:
    """Relay client frames (mic audio / text turns) up to Vertex Live."""
    from google.genai import types as genai_types

    while True:
        frame = json.loads(await ws.receive_text())
        if frame.get("end"):
            return
        if frame.get("audio"):
            await session.send_realtime_input(
                audio=genai_types.Blob(
                    data=base64.b64decode(frame["audio"]), mime_type=_PCM_IN_MIME
                )
            )
        elif frame.get("text"):
            await session.send_client_content(
                turns=genai_types.Content(
                    role="user", parts=[genai_types.Part(text=frame["text"])]
                ),
                turn_complete=True,
            )


async def _pump_vertex_to_client(ws: WebSocket, session: Any) -> None:
    """Relay Vertex responses (audio / tool-calls / turn markers) down to client."""
    from google.genai import types as genai_types

    async for resp in session.receive():
        if getattr(resp, "data", None):
            await ws.send_text(
                json.dumps({"audio": base64.b64encode(resp.data).decode()})
            )
        tc = getattr(resp, "tool_call", None)
        if tc and tc.function_calls:
            for fc in tc.function_calls:
                await ws.send_text(
                    json.dumps({
                        "toolCall": {
                            "name": fc.name,
                            "args": dict(fc.args or {}),
                            "id": fc.id,
                        }
                    })
                )
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
            await ws.send_text(json.dumps({"interrupted": True}))
        if sc and getattr(sc, "turn_complete", False):
            await ws.send_text(json.dumps({"turnComplete": True}))


@vidya_voice_router.websocket("/stream")
async def vidya_voice_stream(ws: WebSocket) -> None:
    """Full-duplex bridge: OmniOrb client <-> sidecar <-> Vertex Live.

    Client -> sidecar frames (JSON text):
        {"audio": "<base64 PCM16LE 16kHz mono>"}   one mic chunk
        {"text": "<utterance>"}                     a text turn (testing / fallback)
        {"end": true}                               end the session
    Sidecar -> client frames (JSON text):
        {"audio": "<base64 PCM16LE 24kHz>"}         one model-audio chunk
        {"toolCall": {"name","args","id"}}          a routed VIDYA flow (client navigates)
        {"turnComplete": true} | {"interrupted": true} | {"error": "..."}

    Auth: the client presents a short-lived signed token (query param `?t=`)
    minted by the web `/api/vidya-voice/start-session` route. The socket is
    rejected (4401) before any billable Vertex session opens if the token is
    missing, malformed, expired, or fails the HMAC check.
    """
    from google import genai

    await ws.accept()
    settings = get_settings()

    # Reject unauthenticated / expired sockets BEFORE opening a billable session.
    uid = verify_stream_token(ws.query_params.get("t"))
    if not uid:
        await ws.close(code=4401)
        return

    detected_language = ws.query_params.get("lang") or "en"
    screen_path = ws.query_params.get("screen") or "/dashboard"
    session_config = build_vidya_voice_session(
        language=detected_language,
        screen_path=screen_path,
        grade=None,
        subject=None,
        school_context=None,
    )
    # Vertex uses its OWN model naming (`gemini-live-2.5-flash-native-audio`),
    # distinct from the Developer-API names `get_voice_model()` returns
    # (`…-native-audio-latest`). Always use the Vertex name for this path.
    model = VERTEX_LIVE_MODEL

    client = genai.Client(
        vertexai=True,
        project=settings.gcp_project,
        location=VERTEX_LIVE_LOCATION,
    )
    config = _build_vertex_live_config(session_config)
    log.info(
        "vidya_voice.stream_open", uid=uid, model=model, language=detected_language
    )

    try:
        async with client.aio.live.connect(model=model, config=config) as session:
            up = asyncio.create_task(_pump_client_to_vertex(ws, session))
            down = asyncio.create_task(_pump_vertex_to_client(ws, session))
            _done, pending = await asyncio.wait(
                {up, down}, return_when=asyncio.FIRST_COMPLETED
            )
            for task in pending:
                task.cancel()
    except WebSocketDisconnect:
        return
    except Exception as exc:  # noqa: BLE001
        log.error(
            "vidya_voice.stream_failed",
            error=str(exc),
            error_type=type(exc).__name__,
        )
        with contextlib.suppress(Exception):
            await ws.send_text(json.dumps({"error": "live session failed"}))
    finally:
        with contextlib.suppress(Exception):
            await ws.close()
