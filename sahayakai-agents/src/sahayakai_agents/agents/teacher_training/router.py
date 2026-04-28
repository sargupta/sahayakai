"""FastAPI sub-router for teacher-training (Phase D.2)."""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import extract_cache_metrics, run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_teacher_training_response_rules
from .agent import get_advisor_model, render_advisor_prompt
from .schemas import (
    TeacherTrainingCore,
    TeacherTrainingRequest,
    TeacherTrainingResponse,
)

log = structlog.get_logger(__name__)

teacher_training_router = APIRouter(
    prefix="/v1/teacher-training", tags=["teacher-training"],
)

SIDECAR_VERSION = "phase-d.2.0"

# Per-call timeout for run_resiliently. Teacher-training advisor returns
# a structured JSON with multiple sections; 20s caps a hung Gemini call
# without truncating slow but legitimate generations.
_PER_CALL_TIMEOUT_S = 20.0


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
    *, api_key: str, model: str, prompt: str, response_schema: type
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


async def _run_advisor(
    payload: TeacherTrainingRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[TeacherTrainingCore, Any]:
    # Phase J §J.3 — sanitize user-controlled strings before render.
    context = {
        "question": sanitize(payload.question, max_length=4000),
        "language": sanitize(payload.language or "English", max_length=20),
        "subject": sanitize_optional(payload.subject, max_length=100),
    }
    prompt = render_advisor_prompt(context)
    model = get_advisor_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=TeacherTrainingCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="teacher_training.advisor",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return TeacherTrainingCore.model_validate_json(text), result
    except Exception as exc:
        log.error(
            "teacher_training.advisor.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Advisor returned text that does not match TeacherTrainingCore",
            http_status=502,
        ) from exc


@teacher_training_router.post(
    "/advise", response_model=TeacherTrainingResponse,
)
async def teacher_training_advise(
    payload: TeacherTrainingRequest,
) -> TeacherTrainingResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core, raw_result = await _run_advisor(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("teacher_training.advisor.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("teacher_training.advisor.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Teacher-training agent failed",
            http_status=502,
        ) from exc

    try:
        assert_teacher_training_response_rules(
            introduction=core.introduction,
            advice=[a.model_dump() for a in core.advice],
            conclusion=core.conclusion,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("teacher_training.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    metrics = extract_cache_metrics(raw_result)
    # Forensic fix P1 #18 — per-router event with model_used + tokens
    # so cost-per-user attribution joins via `request_id` (set in the
    # request_id middleware).
    log.info(
        "teacher_training.generated",
        latency_ms=latency_ms,
        language=payload.language,
        subject=payload.subject,
        advice_count=len(core.advice),
        model_used=get_advisor_model(),
        tokens_in=metrics.input_tokens if metrics else None,
        tokens_out=metrics.output_tokens if metrics else None,
        tokens_cached=metrics.cached_content_tokens if metrics else None,
    )
    return TeacherTrainingResponse(
        introduction=core.introduction,
        advice=core.advice,
        conclusion=core.conclusion,
        gradeLevel=core.gradeLevel,
        subject=core.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_advisor_model(),
    )
