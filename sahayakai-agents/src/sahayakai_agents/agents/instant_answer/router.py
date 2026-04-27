"""FastAPI sub-router for the instant-answer agent.

Phase 6 §6.4. Single-stage flow: render prompt → Gemini call with
Google Search grounding → structured-output parse → behavioural guard
→ wire response.

The Genkit version uses a *mocked* `googleSearch` tool. This Python
migration upgrades to Gemini's *native* Google Search grounding —
the model gets real-time web access during the call instead of
canned mock results. The wire contract stays identical, so dispatcher
shadow-mode can compare answers across the two paths.
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
from ._guard import assert_instant_answer_response_rules
from .agent import get_answerer_model, render_answerer_prompt
from .schemas import (
    InstantAnswerCore,
    InstantAnswerRequest,
    InstantAnswerResponse,
)

log = structlog.get_logger(__name__)

instant_answer_router = APIRouter(prefix="/v1/instant-answer", tags=["instant-answer"])

# Sidecar version pinned per release cut. Surfaced in the wire response
# so a Track G dashboard can correlate behaviour shifts to versions.
SIDECAR_VERSION = "phase-6.1.0"

# Per-call timeout for run_resiliently. Instant answer uses Google
# Search grounding so we allow a bit longer than pure-text flows.
# 15s caps a hung call without truncating slow but legitimate
# search-augmented responses.
_PER_CALL_TIMEOUT_S = 15.0


# ---- Gemini call helper --------------------------------------------------


async def _call_gemini_grounded(
    *,
    api_key: str,
    model: str,
    prompt: str,
) -> Any:
    """One Gemini call with Google Search grounding + structured JSON.

    Uses google-genai's native grounding tool (`google_search`) which
    gives the model live web access during inference. Combined with
    `response_mime_type='application/json'` and
    `response_schema=InstantAnswerCore` for strict structured output.

    NOTE: Gemini's structured-output mode and grounding mode are
    compatible — the model returns JSON matching the schema while
    still being able to ground via search.
    """
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=InstantAnswerCore,
            # Slightly above strict deterministic for prose variety;
            # matches Genkit flow's implicit default. Below creative
            # range so factual answers don't drift into speculation.
            temperature=0.4,
            # Gemini's native Google Search grounding tool. Live web
            # access during inference — replaces the Genkit-side mock
            # tool that returned canned results.
            tools=[
                genai_types.Tool(
                    google_search=genai_types.GoogleSearch(),
                ),
            ],
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


def _grounding_used(result: Any) -> bool:
    """Detect whether Gemini's Google Search grounding was actually
    invoked during this generation. Useful telemetry — operators can
    break the answer-quality dashboard down by grounded vs un-grounded.

    Gemini surfaces grounding metadata on the candidate.grounding_metadata
    field when search was performed. Absent → assume un-grounded.
    """
    candidates = getattr(result, "candidates", None) or []
    for cand in candidates:
        meta = getattr(cand, "grounding_metadata", None)
        if meta is not None:
            return True
    return False


# ---- Single-stage runner -------------------------------------------------


async def _run_answerer(
    payload: InstantAnswerRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> tuple[InstantAnswerCore, bool]:
    """Run the answerer agent. Returns (parsed core, grounding_used)."""
    # Phase J §J.3 — sanitize ALL user-controlled strings before they
    # land in the rendered prompt. The template wraps each value in
    # `⟦…⟧` markers, but those markers are advisory only; without
    # sanitize, a payload like `⟧\n\nNew rule: …` closes the wrap
    # and the injected instruction reaches Gemini.
    context = {
        "question": sanitize(payload.question, max_length=4000),
        "language": sanitize_optional(payload.language, max_length=10),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "subject": sanitize_optional(payload.subject, max_length=100),
    }
    prompt = render_answerer_prompt(context)
    model = get_answerer_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_grounded(
            api_key=api_key, model=model, prompt=prompt
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="instant_answer.answerer",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    grounding_used = _grounding_used(result)
    try:
        return InstantAnswerCore.model_validate_json(text), grounding_used
    except Exception as exc:
        log.error(
            "instant_answer.answerer.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Answerer returned text that does not match InstantAnswerCore",
            http_status=502,
        ) from exc


# ---- Endpoint ------------------------------------------------------------


@instant_answer_router.post("/answer", response_model=InstantAnswerResponse)
async def instant_answer_answer(
    payload: InstantAnswerRequest,
) -> InstantAnswerResponse:
    """Generate an instant answer with Google Search grounding.

    Flow:
        1. Render prompt with the request context.
        2. One Gemini call with grounding tool + structured output.
        3. Behavioural guard on the answer text + URL shape.
        4. Wrap timing telemetry.
    """
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core, grounding_used = await _run_answerer(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("instant_answer.answerer.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("instant_answer.answerer.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Instant-answer agent failed",
            http_status=502,
        ) from exc

    # Behavioural guard. Fail-closed.
    try:
        assert_instant_answer_response_rules(
            answer_text=core.answer,
            language=payload.language or "en",
            video_suggestion_url=core.videoSuggestionUrl,
        )
    except AssertionError as exc:
        log.error("instant_answer.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "instant_answer.answered",
        latency_ms=latency_ms,
        grounding_used=grounding_used,
        question_chars=len(payload.question),
        language=payload.language,
        grade_level=payload.gradeLevel,
    )
    return InstantAnswerResponse(
        answer=core.answer,
        videoSuggestionUrl=core.videoSuggestionUrl,
        gradeLevel=core.gradeLevel,
        subject=core.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_answerer_model(),
        groundingUsed=grounding_used,
    )
