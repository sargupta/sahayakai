"""FastAPI sub-router for voice-to-text (Phase I + Phase L.5).

Single multimodal Gemini call:

  Part 1 — text prompt (Handlebars-rendered transcription rubric)
  Part 2 — audio bytes wrapped via `genai_types.Part.from_bytes` with
           the original MIME type extracted from the data URI

Phase L.5: the single stage now runs through ADK's `Runner.run_async`
against a degenerate `SequentialAgent` of 1 sub-agent. The text Part +
audio Part are passed together as the `new_message` Content; ADK
forwards this to Gemini's `contents=` parameter, preserving the pre-L.5
multimodal call shape.

Returns the cleaned transcription + ISO 2-letter language code
(or `null` if the model is uncertain).
"""
from __future__ import annotations

import asyncio
import base64
import re
import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_voice_to_text_response_rules
from .agent import (
    build_voice_to_text_agent,
    get_transcriber_model,
    render_transcriber_prompt,
)
from .schemas import (
    MAX_AUDIO_BYTES,
    VoiceToTextCore,
    VoiceToTextRequest,
    VoiceToTextResponse,
)

log = structlog.get_logger(__name__)

voice_to_text_router = APIRouter(
    prefix="/v1/voice-to-text", tags=["voice-to-text"],
)

SIDECAR_VERSION = "phase-l.5"

# Speech-to-text on multi-minute audio can be slow. Cap with a hard
# 60s timeout independent of run_resiliently's telephony budget.
_TRANSCRIPTION_TIMEOUT_S = 60.0

# ADK Runner needs an app_name for the in-memory session service.
_VOICE_TO_TEXT_APP_NAME = "sahayakai-voice-to-text"

# Sub-agent name — must match `agent.py`.
_TRANSCRIBER_AGENT_NAME = "voice_to_text_transcriber"

# data:<mime>;base64,<body> — same form Genkit's `{{media url=...}}`
# helper produces. Captures `mime` and `payload` groups.
_DATA_URI_RE = re.compile(
    r"^data:(?P<mime>[a-z0-9.+/-]+)(?:;[a-z0-9-]+=[a-z0-9-]+)*"
    r";base64,(?P<payload>[A-Za-z0-9+/=]+)$",
    re.IGNORECASE,
)

# Browsers vary on the audio MIME they emit. Accept the common ones
# Gemini supports natively. `audio/webm` (Chrome / Android) and
# `audio/mp4` (Safari / iOS) cover ~99% of real clients.
_ALLOWED_AUDIO_MIME_PREFIXES = (
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/ogg",
    "audio/wav",
    "audio/x-wav",
    "audio/aac",
    "audio/flac",
)


def _decode_audio_data_uri(uri: str) -> tuple[bytes, str]:
    """Return (audio_bytes, mime_type). Raises AgentError on bad shape."""
    match = _DATA_URI_RE.match(uri)
    if not match:
        raise AgentError(
            code="INVALID_INPUT",
            message="audioDataUri is not a valid data URI",
            http_status=400,
        )
    mime = match.group("mime").lower()
    if not any(
        mime.startswith(prefix) for prefix in _ALLOWED_AUDIO_MIME_PREFIXES
    ):
        raise AgentError(
            code="INVALID_INPUT",
            message=(
                f"audioDataUri MIME {mime!r} not in supported audio set"
            ),
            http_status=400,
        )
    payload = match.group("payload")
    try:
        audio_bytes = base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise AgentError(
            code="INVALID_INPUT",
            message="audioDataUri base64 payload failed to decode",
            http_status=400,
        ) from exc
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise AgentError(
            code="INVALID_INPUT",
            message=(
                f"audioDataUri exceeds max audio size "
                f"({len(audio_bytes)} > {MAX_AUDIO_BYTES} bytes)"
            ),
            http_status=413,
        )
    return audio_bytes, mime


def _build_pinned_pipeline(api_key: str) -> Any:
    """Build a per-call SequentialAgent with the sub-agent's `.model`
    swapped to a `Gemini` instance pinned to `api_key`."""
    from google.adk.agents import LlmAgent  # noqa: PLC0415

    template = build_voice_to_text_agent()
    pinned_subs = []
    for sub in template.sub_agents:
        assert isinstance(sub, LlmAgent), (
            f"voice-to-text sub-agents must be LlmAgents; got "
            f"{type(sub).__name__}"
        )
        sub_model = sub.model
        model_name = (
            sub_model if isinstance(sub_model, str) else sub_model.model
        )
        pinned_subs.append(
            sub.clone(
                update={
                    "model": build_keyed_gemini(
                        model_name=model_name, api_key=api_key,
                    ),
                }
            )
        )
    return template.clone(update={"sub_agents": pinned_subs})


async def _run_pipeline_via_runner(
    *,
    prompt_text: str,
    audio_bytes: bytes,
    audio_mime: str,
    api_key: str,
) -> VoiceToTextCore:
    """One ADK Runner invocation against the voice-to-text SequentialAgent.

    Builds a multipart `new_message` Content with:
      - Part 1: the rendered rubric text (transcriber prompt)
      - Part 2: the audio bytes via `Part.from_bytes(...)`

    ADK forwards this Content to Gemini's `contents=` parameter, which
    is exactly the pre-L.5 multimodal call shape (`contents=[prompt_text,
    audio_part]`). The sub-agent's `output_schema=VoiceToTextCore`
    triggers structured JSON output.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    pipeline = _build_pinned_pipeline(api_key)
    runner = InMemoryRunner(agent=pipeline, app_name=_VOICE_TO_TEXT_APP_NAME)

    user_id = "voice-to-text-pipeline"
    session_id = f"voice-to-text-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_VOICE_TO_TEXT_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    audio_part = genai_types.Part.from_bytes(
        data=audio_bytes, mime_type=audio_mime,
    )
    new_message = genai_types.Content(
        role="user",
        parts=[
            genai_types.Part(text=prompt_text),
            audio_part,
        ],
    )

    final_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        author = getattr(event, "author", None) or ""
        if author != _TRANSCRIBER_AGENT_NAME:
            continue
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            text = getattr(part, "text", None)
            if text and not getattr(part, "thought", False):
                final_text += str(text)

    if not final_text.strip():
        raise AgentError(
            code="INTERNAL",
            message="Voice-to-text returned empty response",
            http_status=502,
        )

    try:
        return VoiceToTextCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "voice_to_text.transcriber.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Transcriber returned text that does not match VoiceToTextCore"
            ),
            http_status=502,
        ) from exc


async def _run_transcriber(
    payload: VoiceToTextRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VoiceToTextCore:
    audio_bytes, audio_mime = _decode_audio_data_uri(payload.audioDataUri)
    prompt_text = render_transcriber_prompt({})

    async def _do(api_key: str) -> VoiceToTextCore:
        return await _run_pipeline_via_runner(
            prompt_text=prompt_text,
            audio_bytes=audio_bytes,
            audio_mime=audio_mime,
            api_key=api_key,
        )

    try:
        result = await asyncio.wait_for(
            run_resiliently(
                _do,
                api_keys,
                span_name="voice_to_text.transcriber",
                max_total_backoff_seconds=settings.max_total_backoff_seconds,
                per_call_timeout_seconds=_TRANSCRIPTION_TIMEOUT_S,
            ),
            timeout=_TRANSCRIPTION_TIMEOUT_S,
        )
    except TimeoutError as exc:
        raise AgentError(
            code="INTERNAL",
            message=(
                f"Voice-to-text timed out after {_TRANSCRIPTION_TIMEOUT_S}s"
            ),
            http_status=502,
        ) from exc

    return result


@voice_to_text_router.post(
    "/transcribe", response_model=VoiceToTextResponse,
)
async def voice_to_text_transcribe(
    payload: VoiceToTextRequest,
) -> VoiceToTextResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_transcriber(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("voice_to_text.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("voice_to_text.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Voice-to-text agent failed",
            http_status=502,
        ) from exc

    try:
        assert_voice_to_text_response_rules(
            text=core.text,
            language=core.language,
        )
    except AssertionError as exc:
        log.error("voice_to_text.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "voice_to_text.transcribed",
        latency_ms=latency_ms,
        text_chars=len(core.text),
        language=core.language,
    )
    return VoiceToTextResponse(
        text=core.text,
        language=core.language,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_transcriber_model(),
    )
