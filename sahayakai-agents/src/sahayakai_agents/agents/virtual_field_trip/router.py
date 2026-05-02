"""FastAPI sub-router for virtual field-trip (Phase D.3)."""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ._guard import assert_virtual_field_trip_response_rules
from .agent import get_planner_model, render_planner_prompt
from .schemas import (
    VirtualFieldTripCore,
    VirtualFieldTripRequest,
    VirtualFieldTripResponse,
)

log = structlog.get_logger(__name__)

virtual_field_trip_router = APIRouter(
    prefix="/v1/virtual-field-trip", tags=["virtual-field-trip"],
)

SIDECAR_VERSION = "phase-d.3.0"

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


async def _run_planner(
    payload: VirtualFieldTripRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> VirtualFieldTripCore:
    context = {
        "topic": payload.topic,
        "language": payload.language or "English",
        "gradeLevel": payload.gradeLevel,
    }
    prompt = render_planner_prompt(context)
    model = get_planner_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=VirtualFieldTripCore,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="virtual_field_trip.planner",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
    )
    text = _extract_text(result)
    try:
        return VirtualFieldTripCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "virtual_field_trip.planner.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Planner returned text that does not match VirtualFieldTripCore",
            http_status=502,
        ) from exc


@virtual_field_trip_router.post(
    "/plan", response_model=VirtualFieldTripResponse,
)
async def virtual_field_trip_plan(
    payload: VirtualFieldTripRequest,
) -> VirtualFieldTripResponse:
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_planner(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("virtual_field_trip.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("virtual_field_trip.planner.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Virtual field-trip agent failed",
            http_status=502,
        ) from exc

    try:
        assert_virtual_field_trip_response_rules(
            title=core.title,
            stops=[s.model_dump() for s in core.stops],
            language=_iso_for_lang(payload.language),
        )
    except AssertionError as exc:
        log.error("virtual_field_trip.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    return VirtualFieldTripResponse(
        title=core.title,
        stops=core.stops,
        gradeLevel=core.gradeLevel,
        subject=core.subject,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_planner_model(),
    )
