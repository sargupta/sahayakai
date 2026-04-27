"""FastAPI sub-router for visual aid designer (Phase E.3).

Two-stage flow:
  1. Image generation → base64 PNG/JPEG bytes wrapped as data URI
  2. Metadata text generation → JSON {pedagogicalContext, discussionSpark, subject}

Stages run sequentially (image first, then metadata). Image generation
has its own ~90s budget — too long for parallel execution against a
typical Twilio / API budget.
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
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_visual_aid_response_rules
from .agent import (
    get_image_model,
    get_metadata_model,
    render_image_prompt,
    render_metadata_prompt,
)
from .schemas import (
    VisualAidMetadata,
    VisualAidRequest,
    VisualAidResponse,
)

log = structlog.get_logger(__name__)

visual_aid_router = APIRouter(prefix="/v1/visual-aid", tags=["visual-aid"])

SIDECAR_VERSION = "phase-e.3.0"

# Per the existing Genkit flow, image generation can stall on complex
# prompts. Cap with a hard 90s timeout independent of run_resiliently's
# budget (which is tuned for telephony-bound replies).
_IMAGE_TIMEOUT_S = 90.0

# Metadata is a small structured JSON call. 20s aligns with the other
# text-only flows; passed through to run_resiliently as the per-call cap.
_METADATA_TIMEOUT_S = 20.0

_LANGUAGE_NAME_TO_ISO: dict[str, str] = {
    "english": "en", "hindi": "hi", "tamil": "ta", "telugu": "te",
    "kannada": "kn", "malayalam": "ml", "bengali": "bn", "marathi": "mr",
    "gujarati": "gu", "punjabi": "pa", "odia": "or",
}


def _iso_for_lang(language: str | None) -> str:
    if not language:
        return "en"
    key = language.strip().lower()
    return _LANGUAGE_NAME_TO_ISO.get(key, key[:2] if len(key) >= 2 else "en")


async def _call_gemini_image(
    *, api_key: str, model: str, prompt: str,
) -> tuple[bytes, str]:
    """Call Gemini with IMAGE response modality. Returns (bytes, mime).

    Raises if the response has no inline image data.
    """
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    result = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            temperature=0.4,
        ),
    )

    # Walk candidates → content.parts → first part with inline_data.
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
                    # google-genai returns either base64-encoded bytes
                    # OR raw bytes depending on SDK version. Normalise
                    # to raw bytes.
                    if isinstance(data, str):
                        try:
                            decoded = base64.b64decode(data, validate=True)
                            return decoded, mime
                        except Exception:
                            return data.encode("utf-8"), mime
                    return data, mime
    raise AgentError(
        code="INTERNAL",
        message="Image generation returned no inline image data",
        http_status=502,
    )


async def _call_gemini_structured_text(
    *, api_key: str, model: str, prompt: str, response_schema: type,
) -> Any:
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.4,
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


async def _run_image(
    payload: VisualAidRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[bytes, str]:
    """Run the image-generation stage. Returns (bytes, mime_type).

    Phase J §J.3 — sanitize the user-controlled image prompt before
    rendering. Image-gen prompts are particularly vulnerable: an
    attacker could try to push the model toward generating
    inappropriate content via injected instructions.
    """
    context = {
        "prompt": sanitize(payload.prompt, max_length=2000),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "language": sanitize_optional(payload.language, max_length=20),
    }
    prompt = render_image_prompt(context)
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
                span_name="visual_aid.image",
                max_total_backoff_seconds=settings.max_total_backoff_seconds,
                per_call_timeout_seconds=_IMAGE_TIMEOUT_S,
            ),
            timeout=_IMAGE_TIMEOUT_S,
        )
    except TimeoutError as exc:
        raise AgentError(
            code="INTERNAL",
            message=f"Image generation timed out after {_IMAGE_TIMEOUT_S}s",
            http_status=502,
        ) from exc
    return result


async def _run_metadata(
    payload: VisualAidRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VisualAidMetadata:
    """Phase J §J.3 — sanitize input before rendering."""
    context = {
        "prompt": sanitize(payload.prompt, max_length=2000),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "language": sanitize_optional(payload.language, max_length=20),
    }
    prompt = render_metadata_prompt(context)
    model = get_metadata_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured_text(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=VisualAidMetadata,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="visual_aid.metadata",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_METADATA_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return VisualAidMetadata.model_validate_json(text)
    except Exception as exc:
        log.error(
            "visual_aid.metadata.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Metadata returned text that does not match VisualAidMetadata",
            http_status=502,
        ) from exc


@visual_aid_router.post("/generate", response_model=VisualAidResponse)
async def visual_aid_generate(
    payload: VisualAidRequest,
) -> VisualAidResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    # Stage 1: image
    try:
        image_bytes, image_mime = await _run_image(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("visual_aid.image.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("visual_aid.image.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Visual aid image generation failed",
            http_status=502,
        ) from exc

    # Stage 2: metadata
    try:
        metadata = await _run_metadata(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("visual_aid.metadata.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("visual_aid.metadata.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Visual aid metadata generation failed",
            http_status=502,
        ) from exc

    # Build the data URI from raw image bytes.
    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    image_data_uri = f"data:{image_mime};base64,{image_b64}"

    # Behavioural guard.
    try:
        assert_visual_aid_response_rules(
            image_data_uri=image_data_uri,
            pedagogical_context=metadata.pedagogicalContext,
            discussion_spark=metadata.discussionSpark,
            subject=metadata.subject,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("visual_aid.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "visual_aid.generated",
        latency_ms=latency_ms,
        image_bytes_len=len(image_bytes),
        image_mime=image_mime,
        language=payload.language,
        grade_level=payload.gradeLevel,
    )
    return VisualAidResponse(
        imageDataUri=image_data_uri,
        pedagogicalContext=metadata.pedagogicalContext,
        discussionSpark=metadata.discussionSpark,
        subject=metadata.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        imageModelUsed=get_image_model(),
        metadataModelUsed=get_metadata_model(),
    )
