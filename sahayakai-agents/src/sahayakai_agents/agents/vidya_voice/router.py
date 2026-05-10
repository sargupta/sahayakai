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

from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter

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

# Live API WSS endpoint. The SDK's own `client.aio.live.connect()`
# resolves this internally; we surface it explicitly so the browser
# client can open the same socket. URL pinned per Live region rollout.
LIVE_WSS_BASE_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"


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

    client = genai.Client(api_key=api_key)

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
                # Lock the bound config so a malicious client can't
                # try to override system_instruction or tools at
                # `live.connect()` time.
                lock_additional_fields=[
                    "model",
                    "config",
                ],
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
    api_keys = settings.genai_keys
    if not api_keys:
        raise AgentError(
            code="INTERNAL",
            message="No Gemini API key configured (GOOGLE_GENAI_API_KEY).",
            http_status=502,
        )
    # Spike: just use the first key. Production migration will route
    # through `run_resiliently` for key rotation parity.
    api_key = api_keys[0]

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
        api_key=api_key,
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
