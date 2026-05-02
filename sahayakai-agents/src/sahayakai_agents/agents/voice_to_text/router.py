"""FastAPI sub-router for voice-to-text (Phase I).

Single multimodal Gemini call:

  Part 1 — text prompt (Handlebars-rendered transcription rubric)
  Part 2 — audio bytes wrapped via `genai_types.Part.from_bytes` with
           the original MIME type extracted from the data URI

Returns the cleaned transcription + ISO 2-letter language code
(or `null` if the model is uncertain).
"""
from __future__ import annotations

import asyncio
import base64
import re
import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_voice_to_text_response_rules
from .agent import get_transcriber_model, render_transcriber_prompt
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

SIDECAR_VERSION = "phase-i.0"

# Speech-to-text on multi-minute audio can be slow. Cap with a hard
# 60s timeout independent of run_resiliently's telephony budget.
_TRANSCRIPTION_TIMEOUT_S = 60.0

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


async def _call_gemini_multimodal(
    *,
    api_key: str,
    model: str,
    prompt_text: str,
    audio_bytes: bytes,
    audio_mime: str,
    response_schema: type,
) -> Any:
    """Call Gemini with a 2-part contents list: text + audio bytes."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    audio_part = genai_types.Part.from_bytes(
        data=audio_bytes, mime_type=audio_mime,
    )
    return await client.aio.models.generate_content(
        model=model,
        contents=[prompt_text, audio_part],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            # Transcription is deterministic by design. Match the
            # Genkit flow's implicit low-temperature behaviour.
            temperature=0.1,
        ),
    )


def _extract_text(result: Any) -> str:
    text = getattr(result, "text", None)
    if text:
        return str(text)
    candidates = getattr(result, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            text = getattr(part, "text", None)
            if text:
                return str(text)
    raise AgentError(
        code="INTERNAL",
        message="Gemini returned empty response",
        http_status=502,
    )


async def _run_transcriber(
    payload: VoiceToTextRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VoiceToTextCore:
    audio_bytes, audio_mime = _decode_audio_data_uri(payload.audioDataUri)
    prompt_text = render_transcriber_prompt({})
    model = get_transcriber_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_multimodal(
            api_key=api_key,
            model=model,
            prompt_text=prompt_text,
            audio_bytes=audio_bytes,
            audio_mime=audio_mime,
            response_schema=VoiceToTextCore,
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

    text = _extract_text(result)
    try:
        return VoiceToTextCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "voice_to_text.transcriber.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Transcriber returned text that does not match VoiceToTextCore"
            ),
            http_status=502,
        ) from exc


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
