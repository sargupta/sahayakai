"""FastAPI sub-router for the rubric-generator agent (Phase D.1).

Single-stage flow: render prompt → Gemini structured call → parse →
behavioural guard → wire response.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import extract_cache_metrics, run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_rubric_response_rules
from .agent import get_generator_model, render_generator_prompt
from .schemas import (
    RubricGeneratorCore,
    RubricGeneratorRequest,
    RubricGeneratorResponse,
)

log = structlog.get_logger(__name__)

rubric_router = APIRouter(prefix="/v1/rubric", tags=["rubric"])

SIDECAR_VERSION = "phase-d.1.0"

# Per-call timeout for run_resiliently. Rubric generation produces a
# multi-criteria structured JSON; 20s caps a hung Gemini call without
# truncating slow but legitimate generations.
_PER_CALL_TIMEOUT_S = 20.0


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
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
            temperature=0.3,
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


async def _run_generator(
    payload: RubricGeneratorRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[RubricGeneratorCore, Any]:
    """Run the generator and return `(parsed_core, raw_result)`.

    The raw result is bubbled up so the route handler can call
    `extract_cache_metrics(result)` and stamp tokens onto the
    `rubric.generated` log line — forensic fix P1 #18 (telemetry
    split-brain).
    """
    # Phase J §J.3 — sanitize user-controlled strings before render.
    context = {
        "assignmentDescription": sanitize(
            payload.assignmentDescription, max_length=4000,
        ),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "subject": sanitize_optional(payload.subject, max_length=100),
        "language": sanitize(payload.language or "English", max_length=20),
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=1000,
        ),
    }
    prompt = render_generator_prompt(context)
    model = get_generator_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=RubricGeneratorCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="rubric.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return RubricGeneratorCore.model_validate_json(text), result
    except Exception as exc:
        log.error(
            "rubric.generator.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Generator returned text that does not match RubricGeneratorCore",
            http_status=502,
        ) from exc


@rubric_router.post("/generate", response_model=RubricGeneratorResponse)
async def rubric_generate(
    payload: RubricGeneratorRequest,
) -> RubricGeneratorResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core, raw_result = await _run_generator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("rubric.generator.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("rubric.generator.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Rubric generator agent failed",
            http_status=502,
        ) from exc

    # Behavioural guard. Fail-closed.
    try:
        assert_rubric_response_rules(
            title=core.title,
            description=core.description,
            criteria=[c.model_dump() for c in core.criteria],
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("rubric.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    metrics = extract_cache_metrics(raw_result)
    log.info(
        "rubric.generated",
        latency_ms=latency_ms,
        language=payload.language,
        criteria_count=len(core.criteria),
        model_used=get_generator_model(),
        tokens_in=metrics.input_tokens if metrics else None,
        tokens_out=metrics.output_tokens if metrics else None,
        tokens_cached=metrics.cached_content_tokens if metrics else None,
    )
    return RubricGeneratorResponse(
        title=core.title,
        description=core.description,
        criteria=core.criteria,
        gradeLevel=core.gradeLevel,
        subject=core.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )


# Map free-text language names from the request to the ISO code the
# shared `_behavioural.assert_script_matches_language` helper expects.
_LANGUAGE_NAME_TO_ISO: dict[str, str] = {
    "english": "en",
    "hindi": "hi",
    "tamil": "ta",
    "telugu": "te",
    "kannada": "kn",
    "malayalam": "ml",
    "bengali": "bn",
    "marathi": "mr",
    "gujarati": "gu",
    "punjabi": "pa",
    "odia": "or",
}


def _iso_for_lang(language: str | None) -> str:
    if not language:
        return "en"
    key = language.strip().lower()
    return _LANGUAGE_NAME_TO_ISO.get(key, key[:2] if len(key) >= 2 else "en")
