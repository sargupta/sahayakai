"""FastAPI sub-router for worksheet wizard (Phase D.4).

Multimodal: image bytes + text prompt → structured JSON.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_worksheet_response_rules
from .agent import (
    InvalidDataURIError,
    get_wizard_model,
    parse_data_uri,
    render_wizard_prompt,
)
from .schemas import WorksheetCore, WorksheetRequest, WorksheetResponse

log = structlog.get_logger(__name__)

worksheet_router = APIRouter(prefix="/v1/worksheet", tags=["worksheet"])

SIDECAR_VERSION = "phase-d.4.0"

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


async def _call_gemini_multimodal(
    *,
    api_key: str,
    model: str,
    prompt: str,
    image_bytes: bytes,
    image_mime: str,
    response_schema: type,
) -> Any:
    """Multimodal Gemini call. Image bytes + text prompt → JSON output."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    image_part = genai_types.Part.from_bytes(
        data=image_bytes, mime_type=image_mime,
    )
    return await client.aio.models.generate_content(
        model=model,
        contents=[image_part, prompt],
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


async def _run_wizard(
    payload: WorksheetRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> WorksheetCore:
    # Decode the data URI before any model call.
    try:
        image_mime, image_bytes = parse_data_uri(payload.imageDataUri)
    except InvalidDataURIError as exc:
        raise AgentError(
            code="INVALID_INPUT",
            message=f"Invalid imageDataUri: {exc}",
            http_status=400,
        ) from exc

    context = {
        "prompt": payload.prompt,
        "language": payload.language or "English",
        "gradeLevel": payload.gradeLevel,
        "subject": payload.subject,
        "teacherContext": payload.teacherContext,
    }
    prompt = render_wizard_prompt(context)
    model = get_wizard_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_multimodal(
            api_key=api_key,
            model=model,
            prompt=prompt,
            image_bytes=image_bytes,
            image_mime=image_mime,
            response_schema=WorksheetCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="worksheet.wizard",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
    )
    text = _extract_text(result)
    try:
        return WorksheetCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "worksheet.wizard.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Wizard returned text that does not match WorksheetCore",
            http_status=502,
        ) from exc


@worksheet_router.post("/generate", response_model=WorksheetResponse)
async def worksheet_generate(payload: WorksheetRequest) -> WorksheetResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_wizard(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("worksheet.wizard.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("worksheet.wizard.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Worksheet wizard agent failed",
            http_status=502,
        ) from exc

    try:
        assert_worksheet_response_rules(
            title=core.title,
            instructions=core.studentInstructions,
            learning_objectives=core.learningObjectives,
            activities=[a.model_dump() for a in core.activities],
            answer_key=[k.model_dump() for k in core.answerKey],
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("worksheet.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    return WorksheetResponse(
        title=core.title,
        gradeLevel=core.gradeLevel,
        subject=core.subject,
        learningObjectives=core.learningObjectives,
        studentInstructions=core.studentInstructions,
        activities=core.activities,
        answerKey=core.answerKey,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_wizard_model(),
    )
