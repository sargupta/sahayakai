"""FastAPI sub-router for worksheet wizard (Phase D.4 + Phase U.beta).

Multimodal: image bytes + text prompt → structured JSON.

Phase U.beta — the multimodal call now goes through ADK's
`Runner.run_async` against the cached `LlmAgent` built by
`build_worksheet_agent()`. Wire shape, request + response schemas,
behavioural guard, retry semantics — all unchanged. Only the
INTERNAL call mechanism switches from a hand-rolled
`google.genai.Client.aio.models.generate_content` to ADK's canonical
single-agent Runner.

Per-call the cached agent's `.model` is `model_copy()`-ed to swap in a
`Gemini` instance pinned to the current api_key, leaving the cached
template untouched between concurrent requests. The decoded image
bytes ride along the user `new_message` Content as a separate
`Part.from_bytes(...)` alongside the prompt text Part.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_worksheet_response_rules
from .agent import (
    InvalidDataURIError,
    build_worksheet_agent,
    get_wizard_model,
    parse_data_uri,
    render_wizard_prompt,
)
from .schemas import WorksheetCore, WorksheetRequest, WorksheetResponse

log = structlog.get_logger(__name__)

worksheet_router = APIRouter(prefix="/v1/worksheet", tags=["worksheet"])

SIDECAR_VERSION = "phase-u.beta"

# Per-call timeout for run_resiliently. Worksheet wizard does a
# multimodal call (image + prompt) and emits structured JSON; 20s
# accommodates slow attempts while preventing hung calls.
_PER_CALL_TIMEOUT_S = 20.0

# ADK Runner needs an app_name for the in-memory session service.
_WORKSHEET_APP_NAME = "sahayakai-worksheet"

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


def _build_pinned_agent(api_key: str) -> Any:
    """Build a per-call `LlmAgent` clone with `.model` pinned to api_key.

    The cached agent template is never mutated — `model_copy()` returns
    a fresh Pydantic instance each call.
    """
    template = build_worksheet_agent()
    template_model = template.model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return template.model_copy(
        update={
            "model": build_keyed_gemini(
                model_name=model_name, api_key=api_key,
            ),
        },
    )


async def _run_pipeline_via_runner(
    *,
    prompt: str,
    image_bytes: bytes,
    image_mime: str,
    api_key: str,
) -> WorksheetCore:
    """One ADK Runner invocation against the wizard LlmAgent.

    Builds a per-call `LlmAgent` by `model_copy`-ing the cached template
    and swapping in a `Gemini` instance pinned to `api_key`. The
    rendered prompt + decoded image bytes ride along as a multipart
    user `new_message` Content (text Part + image Part). ADK forwards
    that to Gemini's `contents=` parameter, preserving the pre-Phase-
    U.beta multimodal call shape verbatim.

    Drains every event from the Runner; accumulates non-`thought` text
    parts from the final event(s) into the JSON payload that
    `output_schema=WorksheetCore` produced.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    agent_for_call = _build_pinned_agent(api_key)
    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_WORKSHEET_APP_NAME,
    )

    user_id = "worksheet-wizard"
    session_id = f"worksheet-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_WORKSHEET_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    image_part = genai_types.Part.from_bytes(
        data=image_bytes, mime_type=image_mime,
    )
    new_message = genai_types.Content(
        role="user",
        parts=[
            image_part,
            genai_types.Part(text=prompt),
        ],
    )

    final_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                text = getattr(part, "text", None)
                if text and not getattr(part, "thought", False):
                    final_text += str(text)

    if not final_text.strip():
        raise AgentError(
            code="INTERNAL",
            message="Gemini returned empty response",
            http_status=502,
        )

    try:
        return WorksheetCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "worksheet.wizard.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Wizard returned text that does not match WorksheetCore",
            http_status=502,
        ) from exc


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

    # Phase J §J.3 — sanitize user-controlled strings before they
    # land in the rendered prompt.
    context = {
        "prompt": sanitize(payload.prompt, max_length=2000),
        "language": sanitize(payload.language or "English", max_length=20),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
        "subject": sanitize_optional(payload.subject, max_length=100),
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=1000,
        ),
    }
    prompt = render_wizard_prompt(context)

    async def _do(api_key: str) -> WorksheetCore:
        return await _run_pipeline_via_runner(
            prompt=prompt,
            image_bytes=image_bytes,
            image_mime=image_mime,
            api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="worksheet.wizard",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


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
    # Phase U.beta — tokens are NOT extracted here because the ADK Runner
    # doesn't surface a single Gemini result object; per-attempt token
    # counts already live in `ai_resilience.attempt_succeeded` events
    # keyed on the same `request_id` (set by the request_id middleware).
    log.info(
        "worksheet.generated",
        latency_ms=latency_ms,
        language=payload.language,
        grade_level=payload.gradeLevel,
        subject=payload.subject,
        activity_count=len(core.activities),
        model_used=get_wizard_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
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
