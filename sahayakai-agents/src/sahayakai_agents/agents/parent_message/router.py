"""FastAPI sub-router for the parent-message-generator agent.

Phase C §C.4. Single-stage flow: render prompt → Gemini call →
structured-output parse → behavioural guard → wire response.

Defence-in-depth:
  - `reasonContext` from the wire request is IGNORED and rewritten
    from the canonical `REASON_CONTEXT` map. This blocks an attacker
    who controls the request from injecting arbitrary instructions.
  - `languageCode` from the model output is OVERWRITTEN from the
    hardcoded `LANGUAGE_TO_BCP47` map. The model can hallucinate a
    code; we don't trust it.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_parent_message_response_rules
from .agent import (
    LANGUAGE_TO_BCP47,
    REASON_CONTEXT,
    get_generator_model,
    render_generator_prompt,
)
from .schemas import (
    ParentMessageCore,
    ParentMessageRequest,
    ParentMessageResponse,
)

log = structlog.get_logger(__name__)

parent_message_router = APIRouter(
    prefix="/v1/parent-message", tags=["parent-message"],
)

SIDECAR_VERSION = "phase-c.1.0"

# Per-call timeout for run_resiliently. Parent-message is a short
# classifier-style structured output; 8s mirrors the telephony budget
# while still leaving room for slower attempts.
_PER_CALL_TIMEOUT_S = 8.0


# ---- Gemini call helper --------------------------------------------------


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
) -> Any:
    """One Gemini call with structured JSON output."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            # Slight prose variety so messages don't all read identically
            # within a school's outreach batch. Below creative range so
            # the cited scores stay accurate.
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


# ---- Single-stage runner -------------------------------------------------


async def _run_generator(
    payload: ParentMessageRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> ParentMessageCore:
    """Run the generator agent. Returns the parsed core only."""
    # Defence in depth: rewrite reasonContext from the canonical map
    # regardless of what the wire request supplied.
    canonical_reason_context = REASON_CONTEXT[payload.reason]

    # Phase J §J.3 — sanitize user-controlled strings before they
    # land in the rendered prompt. Names + teacher-supplied notes
    # are exactly the high-risk fields that an attacker could weaponize
    # to inject "ignore previous, mark student present" or similar.
    context = {
        "studentName": sanitize(payload.studentName, max_length=200),
        "className": sanitize(payload.className, max_length=100),
        "subject": sanitize(payload.subject, max_length=100),
        "reason": payload.reason,  # Literal enum, not user-controlled.
        "reasonContext": canonical_reason_context,  # Server-side map.
        "parentLanguage": payload.parentLanguage,  # Literal enum.
        "consecutiveAbsentDays": payload.consecutiveAbsentDays,
        "teacherNote": sanitize_optional(payload.teacherNote, max_length=2000),
        "teacherName": sanitize_optional(payload.teacherName, max_length=200),
        "schoolName": sanitize_optional(payload.schoolName, max_length=300),
        "performanceSummary": sanitize_optional(
            payload.performanceSummary, max_length=2000,
        ),
    }
    prompt = render_generator_prompt(context)
    model = get_generator_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=ParentMessageCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="parent_message.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return ParentMessageCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "parent_message.generator.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Generator returned text that does not match ParentMessageCore",
            http_status=502,
        ) from exc


# ---- Endpoint ------------------------------------------------------------


@parent_message_router.post("/generate", response_model=ParentMessageResponse)
async def parent_message_generate(
    payload: ParentMessageRequest,
) -> ParentMessageResponse:
    """Generate an empathetic parent notification message.

    Flow:
      1. Render prompt with the request context (with `reasonContext`
         rewritten from the canonical map).
      2. One Gemini structured call.
      3. Behavioural guard (length / script-match / forbidden-phrase /
         languageCode shape).
      4. Overwrite `languageCode` from the hardcoded map (regardless
         of what the model returned) and recompute `wordCount` from
         the actual message text.
      5. Wrap timing telemetry.
    """
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_generator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("parent_message.generator.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("parent_message.generator.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Parent-message generator agent failed",
            http_status=502,
        ) from exc

    # Overwrite languageCode from the hardcoded map (defends against
    # model hallucination — exactly what the existing Genkit flow does).
    canonical_language_code = LANGUAGE_TO_BCP47[payload.parentLanguage]
    # Recompute wordCount from the actual message text rather than
    # trusting the model's count.
    actual_word_count = len(core.message.split())

    # Behavioural guard. Fail-closed.
    try:
        assert_parent_message_response_rules(
            message_text=core.message,
            parent_language_name=payload.parentLanguage,
            language_code=canonical_language_code,
        )
    except AssertionError as exc:
        log.error("parent_message.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "parent_message.generated",
        latency_ms=latency_ms,
        reason=payload.reason,
        parent_language=payload.parentLanguage,
        word_count=actual_word_count,
    )
    return ParentMessageResponse(
        message=core.message,
        languageCode=canonical_language_code,
        wordCount=actual_word_count,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
