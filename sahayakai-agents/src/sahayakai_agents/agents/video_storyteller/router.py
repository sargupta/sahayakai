"""FastAPI sub-router for video storyteller (Phase F.1).

Single Gemini call returns 5 categories of YouTube search-query strings
plus a personalised teacher message. Downstream YouTube ranking +
playlist building stays in the Next.js Genkit flow — this sidecar only
replaces the LLM call that produces the search queries.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_video_storyteller_response_rules
from .agent import get_recommender_model, render_recommender_prompt
from .schemas import (
    VideoStorytellerCore,
    VideoStorytellerRequest,
    VideoStorytellerResponse,
)

log = structlog.get_logger(__name__)

video_storyteller_router = APIRouter(
    prefix="/v1/video-storyteller", tags=["video-storyteller"],
)

SIDECAR_VERSION = "phase-f.1.0"

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


async def _call_gemini_structured(
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
            temperature=0.6,
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


async def _run_recommender(
    payload: VideoStorytellerRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VideoStorytellerCore:
    context = {
        "subject": payload.subject,
        "gradeLevel": payload.gradeLevel,
        "topic": payload.topic or "",
        "language": payload.language or "English",
        "state": payload.state or "",
        "educationBoard": payload.educationBoard or "",
    }
    prompt = render_recommender_prompt(context)
    model = get_recommender_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=VideoStorytellerCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="video_storyteller.recommender",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
    )
    text = _extract_text(result)
    try:
        return VideoStorytellerCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "video_storyteller.recommender.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Recommender returned text that does not match "
                "VideoStorytellerCore"
            ),
            http_status=502,
        ) from exc


@video_storyteller_router.post(
    "/recommend-queries", response_model=VideoStorytellerResponse,
)
async def video_storyteller_recommend(
    payload: VideoStorytellerRequest,
) -> VideoStorytellerResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_recommender(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("video_storyteller.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("video_storyteller.recommender.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Video storyteller agent failed",
            http_status=502,
        ) from exc

    try:
        assert_video_storyteller_response_rules(
            pedagogy=list(core.categories.pedagogy),
            storytelling=list(core.categories.storytelling),
            govtUpdates=list(core.categories.govtUpdates),
            courses=list(core.categories.courses),
            topRecommended=list(core.categories.topRecommended),
            personalized_message=core.personalizedMessage,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("video_storyteller.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "video_storyteller.generated",
        latency_ms=latency_ms,
        subject=payload.subject,
        grade_level=payload.gradeLevel,
        language=payload.language,
        state=payload.state,
        education_board=payload.educationBoard,
        query_counts={
            "pedagogy": len(core.categories.pedagogy),
            "storytelling": len(core.categories.storytelling),
            "govtUpdates": len(core.categories.govtUpdates),
            "courses": len(core.categories.courses),
            "topRecommended": len(core.categories.topRecommended),
        },
    )
    return VideoStorytellerResponse(
        categories=core.categories,
        personalizedMessage=core.personalizedMessage,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_recommender_model(),
    )
