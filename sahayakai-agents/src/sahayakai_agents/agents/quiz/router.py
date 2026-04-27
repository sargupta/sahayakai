"""FastAPI sub-router for quiz generator (Phase E.1).

3-variant parallel pattern: spawn one Gemini call per difficulty and
gather results with `asyncio.gather`. Optional multimodal — a textbook
page image can be supplied as `imageDataUri`.
"""
from __future__ import annotations

import asyncio
import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_quiz_response_rules
from .agent import (
    InvalidDataURIError,
    get_generator_model,
    parse_data_uri_optional,
    render_generator_prompt,
)
from .schemas import (
    QuizDifficulty,
    QuizGeneratorCore,
    QuizGeneratorRequest,
    QuizGeneratorResponse,
    QuizVariantsResponse,
)

log = structlog.get_logger(__name__)

quiz_router = APIRouter(prefix="/v1/quiz", tags=["quiz"])

SIDECAR_VERSION = "phase-e.1.0"

# Per-call timeout for run_resiliently. Quiz variants generate
# multimodal-aware structured JSON; 30s gives a slow attempt enough
# room while preventing a hung Gemini call from blocking the route.
_PER_CALL_TIMEOUT_S = 30.0

_LANGUAGE_NAME_TO_ISO: dict[str, str] = {
    "english": "en", "hindi": "hi", "tamil": "ta", "telugu": "te",
    "kannada": "kn", "malayalam": "ml", "bengali": "bn", "marathi": "mr",
    "gujarati": "gu", "punjabi": "pa", "odia": "or",
}

_DIFFICULTIES: tuple[QuizDifficulty, ...] = ("easy", "medium", "hard")


def _iso_for_lang(language: str | None) -> str:
    if not language:
        return "en"
    key = language.strip().lower()
    return _LANGUAGE_NAME_TO_ISO.get(key, key[:2] if len(key) >= 2 else "en")


async def _call_gemini(
    *,
    api_key: str,
    model: str,
    prompt: str,
    image_bytes: bytes | None,
    image_mime: str | None,
    response_schema: type,
) -> Any:
    """Multimodal-or-text Gemini call. Returns parsed structured output."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    parts: list[Any] = []
    if image_bytes is not None and image_mime is not None:
        parts.append(
            genai_types.Part.from_bytes(
                data=image_bytes, mime_type=image_mime,
            ),
        )
    parts.append(prompt)
    return await client.aio.models.generate_content(
        model=model,
        contents=parts if len(parts) > 1 else parts[0],
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


async def _run_one_variant(
    payload: QuizGeneratorRequest,
    difficulty: QuizDifficulty,
    image_bytes: bytes | None,
    image_mime: str | None,
    api_keys: tuple[str, ...],
    settings: Any,
) -> QuizGeneratorCore | None:
    """Run a single Gemini call for one difficulty variant.

    Returns None on any failure — matches the existing Genkit
    Promise.allSettled semantics so a single-difficulty failure
    doesn't doom the whole request.
    """
    # Phase J §J.3 — sanitize user-controlled string fields before
    # they land in the rendered prompt. The Handlebars template wraps
    # values in `⟦…⟧` markers, but those are advisory only.
    context = {
        "topic": sanitize(payload.topic, max_length=500),
        "numQuestions": payload.numQuestions,
        "questionTypes": payload.questionTypes,
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "language": sanitize(payload.language or "English", max_length=20),
        "bloomsTaxonomyLevels": payload.bloomsTaxonomyLevels,
        "targetDifficulty": difficulty,
        "subject": sanitize_optional(payload.subject, max_length=100),
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=1000,
        ),
        "hasImage": image_bytes is not None,
    }
    prompt = render_generator_prompt(context)
    model = get_generator_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini(
            api_key=api_key,
            model=model,
            prompt=prompt,
            image_bytes=image_bytes,
            image_mime=image_mime,
            response_schema=QuizGeneratorCore,
        )

    try:
        result = await run_resiliently(
            _do,
            api_keys,
            span_name=f"quiz.generator.{difficulty}",
            max_total_backoff_seconds=settings.max_total_backoff_seconds,
            per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
        )
        text = _extract_text(result)
        return QuizGeneratorCore.model_validate_json(text)
    except Exception as exc:
        log.warning(
            "quiz.variant.failed",
            difficulty=difficulty,
            error=str(exc),
            error_type=type(exc).__name__,
        )
        return None


@quiz_router.post("/generate", response_model=QuizVariantsResponse)
async def quiz_generate(payload: QuizGeneratorRequest) -> QuizVariantsResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    # Decode the optional image once (avoid re-parsing per variant).
    try:
        parsed = parse_data_uri_optional(payload.imageDataUri)
    except InvalidDataURIError as exc:
        raise AgentError(
            code="INVALID_INPUT",
            message=f"Invalid imageDataUri: {exc}",
            http_status=400,
        ) from exc

    image_mime, image_bytes = (None, None)
    if parsed is not None:
        image_mime, image_bytes = parsed

    try:
        # Three parallel Gemini calls — one per difficulty.
        results = await asyncio.gather(
            *(
                _run_one_variant(
                    payload, diff, image_bytes, image_mime, api_keys, settings,
                )
                for diff in _DIFFICULTIES
            ),
            return_exceptions=False,  # _run_one_variant returns None on failure
        )
    except AISafetyBlockError as exc:
        log.warning("quiz.safety_block", reason=str(exc))
        raise

    easy_core, medium_core, hard_core = results
    variants_generated = sum(1 for v in results if v is not None)

    if variants_generated == 0:
        raise AgentError(
            code="INTERNAL",
            message="All three quiz variants failed to generate",
            http_status=502,
        )

    # Behavioural guard runs across whichever variants succeeded.
    try:
        assert_quiz_response_rules(
            easy=easy_core.model_dump() if easy_core else None,
            medium=medium_core.model_dump() if medium_core else None,
            hard=hard_core.model_dump() if hard_core else None,
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("quiz.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    def _to_response(
        core: QuizGeneratorCore | None,
    ) -> QuizGeneratorResponse | None:
        if core is None:
            return None
        return QuizGeneratorResponse(
            title=core.title,
            questions=core.questions,
            teacherInstructions=core.teacherInstructions,
            gradeLevel=core.gradeLevel,
            subject=core.subject,
        )

    # Pull metadata from any successful variant (prefer medium → easy → hard).
    metadata_source = medium_core or easy_core or hard_core
    grade_level = metadata_source.gradeLevel if metadata_source else None
    subject = metadata_source.subject if metadata_source else None

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "quiz.generated",
        latency_ms=latency_ms,
        variants_generated=variants_generated,
        easy_ok=easy_core is not None,
        medium_ok=medium_core is not None,
        hard_ok=hard_core is not None,
    )
    return QuizVariantsResponse(
        easy=_to_response(easy_core),
        medium=_to_response(medium_core),
        hard=_to_response(hard_core),
        gradeLevel=grade_level,
        subject=subject,
        topic=payload.topic,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
        variantsGenerated=variants_generated,
    )
