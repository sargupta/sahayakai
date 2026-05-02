"""FastAPI sub-router for avatar generator (Phase F.2).

Single image-generation call returning a base64 PNG/JPEG wrapped as a
data URI. No metadata. Storage write happens in Next.js after this
sidecar returns.

Image generation can stall on complex prompts. We cap the call with a
hard 90s timeout, independent of `run_resiliently`'s telephony-bound
budget, mirroring the visual-aid router.
"""
from __future__ import annotations

import asyncio
import base64
import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_avatar_response_rules
from .agent import get_image_model, render_portrait_prompt
from .schemas import (
    AvatarGeneratorRequest,
    AvatarGeneratorResponse,
)

log = structlog.get_logger(__name__)

avatar_generator_router = APIRouter(
    prefix="/v1/avatar-generator", tags=["avatar-generator"],
)

SIDECAR_VERSION = "phase-f.2.0"

_IMAGE_TIMEOUT_S = 90.0


async def _call_gemini_image(
    *, api_key: str, model: str, prompt: str,
) -> tuple[bytes, str]:
    """Call Gemini with IMAGE response modality. Returns (bytes, mime).

    Mirrors the visual-aid implementation so behaviour is consistent.
    """
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    result = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            temperature=0.8,
        ),
    )

    candidates = getattr(result, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline is not None:
                data = getattr(inline, "data", None)
                mime = getattr(inline, "mime_type", None) or "image/png"
                if data:
                    if isinstance(data, str):
                        try:
                            decoded = base64.b64decode(data, validate=True)
                            return decoded, mime
                        except Exception:
                            return data.encode("utf-8"), mime
                    return data, mime
    raise AgentError(
        code="INTERNAL",
        message="Avatar generation returned no inline image data",
        http_status=502,
    )


async def _run_image(
    payload: AvatarGeneratorRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[bytes, str]:
    context = {"name": payload.name}
    prompt = render_portrait_prompt(context)
    model = get_image_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_image(
            api_key=api_key, model=model, prompt=prompt,
        )

    try:
        result: tuple[bytes, str] = await asyncio.wait_for(
            run_resiliently(
                _do,
                api_keys,
                span_name="avatar.generate",
                max_total_backoff_seconds=settings.max_total_backoff_seconds,
            ),
            timeout=_IMAGE_TIMEOUT_S,
        )
    except TimeoutError as exc:
        raise AgentError(
            code="INTERNAL",
            message=f"Avatar generation timed out after {_IMAGE_TIMEOUT_S}s",
            http_status=502,
        ) from exc
    return result


@avatar_generator_router.post(
    "/generate", response_model=AvatarGeneratorResponse,
)
async def avatar_generate(
    payload: AvatarGeneratorRequest,
) -> AvatarGeneratorResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        image_bytes, image_mime = await _run_image(
            payload, api_keys, settings,
        )
    except AISafetyBlockError as exc:
        log.warning("avatar.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("avatar.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Avatar image generation failed",
            http_status=502,
        ) from exc

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    image_data_uri = f"data:{image_mime};base64,{image_b64}"

    try:
        assert_avatar_response_rules(image_data_uri=image_data_uri)
    except AssertionError as exc:
        log.error("avatar.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "avatar.generated",
        latency_ms=latency_ms,
        image_bytes_len=len(image_bytes),
        image_mime=image_mime,
    )
    return AvatarGeneratorResponse(
        imageDataUri=image_data_uri,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_image_model(),
    )
