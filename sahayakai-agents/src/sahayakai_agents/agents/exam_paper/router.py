"""FastAPI sub-router for exam paper generator (Phase E.2)."""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_list, sanitize_optional
from ._guard import assert_exam_paper_response_rules
from .agent import get_generator_model, render_generator_prompt
from .schemas import ExamPaperCore, ExamPaperRequest, ExamPaperResponse

log = structlog.get_logger(__name__)

exam_paper_router = APIRouter(prefix="/v1/exam-paper", tags=["exam-paper"])

SIDECAR_VERSION = "phase-e.2.0"

# Per-call timeout for run_resiliently. Exam papers are large structured
# outputs (multiple sections + marking scheme), so 30s gives room while
# preventing a hung Gemini call from blocking the route.
_PER_CALL_TIMEOUT_S = 30.0

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


async def _run_generator(
    payload: ExamPaperRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> ExamPaperCore:
    # Phase J §J.3 — sanitize user-controlled strings before they
    # land in the rendered prompt. The Handlebars template wraps
    # values in `⟦…⟧` markers, but those are advisory only.
    context = {
        "board": sanitize(payload.board, max_length=100),
        "gradeLevel": sanitize(payload.gradeLevel, max_length=50),
        "subject": sanitize(payload.subject, max_length=100),
        "chapters": sanitize_list(payload.chapters, max_length=200),
        "duration": payload.duration,
        "maxMarks": payload.maxMarks,
        "language": sanitize(payload.language, max_length=20),
        "difficulty": payload.difficulty,
        "includeAnswerKey": payload.includeAnswerKey,
        "includeMarkingScheme": payload.includeMarkingScheme,
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
            response_schema=ExamPaperCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="exam_paper.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return ExamPaperCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "exam_paper.generator.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Generator returned text that does not match ExamPaperCore",
            http_status=502,
        ) from exc


@exam_paper_router.post("/generate", response_model=ExamPaperResponse)
async def exam_paper_generate(payload: ExamPaperRequest) -> ExamPaperResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_generator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("exam_paper.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("exam_paper.generator.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Exam paper generator agent failed",
            http_status=502,
        ) from exc

    try:
        assert_exam_paper_response_rules(
            title=core.title,
            general_instructions=core.generalInstructions,
            sections=[s.model_dump() for s in core.sections],
            max_marks=core.maxMarks,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("exam_paper.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "exam_paper.generated",
        latency_ms=latency_ms,
        board=payload.board,
        grade=payload.gradeLevel,
        subject=payload.subject,
        sections=len(core.sections),
    )
    return ExamPaperResponse(
        title=core.title,
        board=core.board,
        subject=core.subject,
        gradeLevel=core.gradeLevel,
        duration=core.duration,
        maxMarks=core.maxMarks,
        generalInstructions=core.generalInstructions,
        sections=core.sections,
        blueprintSummary=core.blueprintSummary,
        pyqSources=core.pyqSources,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
