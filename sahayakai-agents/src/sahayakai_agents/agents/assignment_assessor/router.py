"""FastAPI sub-router for the assignment-assessor agent.

Single-stage flow: parse image → render prompt → ADK Runner against
the multimodal `LlmAgent` → structured-output parse → post-hoc
presence/hallucination validator → server-side enrichment
(`assessmentId`, `createdAtIso`, rubric echo, transcript echo) → wire
response.

Defence-in-depth:
  - `imageDataUri` regex-validated AND base64-decoded server-side before
    it reaches Gemini (catches the MIME-downgrade smuggling vector).
  - `rubricSnapshot` is OPTIONAL on the wire; when absent or
    criteria-empty, the canonical `DEFAULT_RUBRIC` is used so a hostile
    client cannot ship an empty rubric to bypass scoring.
  - Post-hoc `validate_assessment` clamps a non-zero score with a
    `[BLANK]` transcript to zero (the documented multi-modal-LLM
    hallucination failure).
"""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini_from_template
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize_optional
from .agent import (
    DEFAULT_RUBRIC,
    HANDWRITING_FEW_SHOTS,
    InvalidDataURIError,
    build_assignment_assessor_agent,
    get_generator_model,
    parse_data_uri,
    render_generator_prompt,
    validate_assessment,
)
from .schemas import (
    AssessAssignmentCore,
    AssessAssignmentRequest,
    AssessAssignmentResponse,
    RubricSnapshot,
)

log = structlog.get_logger(__name__)

assignment_assessor_router = APIRouter(
    prefix="/v1/assignment-assessor",
    tags=["assignment-assessor"],
)

SIDECAR_VERSION = "phase-w.alpha"

# Per-call timeout. Multimodal vision + 5-stage reasoning on
# `gemini-2.5-pro` is the slowest single call in the sidecar; budget
# matches the Genkit-side `withTimeout` for the assessor route.
_PER_CALL_TIMEOUT_S = 60.0

_ASSESSOR_APP_NAME = "sahayakai-assignment-assessor"


def _build_keyed_gemini(api_key: str) -> Any:
    return build_keyed_gemini_from_template(
        build_assignment_assessor_agent, api_key,
    )


def _effective_rubric(snapshot: RubricSnapshot | None) -> dict[str, Any]:
    """Use the wire rubric if it has at least one criterion; else
    fall back to `DEFAULT_RUBRIC`. Mirrors the TS flow's behaviour."""
    if snapshot is not None and snapshot.criteria:
        return snapshot.model_dump()
    return DEFAULT_RUBRIC


async def _run_pipeline_via_runner(
    *, prompt: str, image_mime: str, image_bytes: bytes, api_key: str,
) -> AssessAssignmentCore:
    """One multimodal ADK Runner invocation; returns the parsed core.

    The rendered prompt is the *text* part of the user message; the
    image is a separate `Part.from_bytes` part. Same `(image_part,
    text_part)` order as the worksheet wizard router.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    template = build_assignment_assessor_agent()
    agent_for_call = template.model_copy(
        update={"model": _build_keyed_gemini(api_key)}
    )

    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_ASSESSOR_APP_NAME,
    )

    user_id = "assignment-assessor"
    session_id = f"assignment-assessor-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_ASSESSOR_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    image_part = genai_types.Part.from_bytes(
        data=image_bytes, mime_type=image_mime,
    )
    new_message = genai_types.Content(
        role="user",
        parts=[image_part, genai_types.Part(text=prompt)],
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
        return AssessAssignmentCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "assignment_assessor.json_parse_failed",
            raw_excerpt=final_text[:300],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Assessor returned text that does not match "
                "AssessAssignmentCore"
            ),
            http_status=502,
        ) from exc


async def _run_assessor(
    payload: AssessAssignmentRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> AssessAssignmentCore:
    """Parse image, render prompt, dispatch via run_resiliently."""
    import json  # local — only needed here  # noqa: PLC0415

    try:
        image_mime, image_bytes = parse_data_uri(payload.imageDataUri)
    except InvalidDataURIError as exc:
        raise AgentError(
            code="INVALID_INPUT",
            message=f"Invalid imageDataUri: {exc}",
            http_status=400,
        ) from exc

    rubric_dict = _effective_rubric(payload.rubricSnapshot)
    language = payload.language or "English"

    context: dict[str, Any] = {
        "teacherContext": sanitize_optional(
            payload.teacherContext, max_length=2000,
        ),
        "language": language,
        "rubricJson": json.dumps(rubric_dict, ensure_ascii=False, indent=2),
        "fewShots": HANDWRITING_FEW_SHOTS,
        "editedTranscript": sanitize_optional(
            payload.editedTranscript, max_length=20_000,
        ),
        "subject": sanitize_optional(payload.subject, max_length=100),
        "gradeLevel": sanitize_optional(payload.gradeLevel, max_length=50),
    }
    prompt = render_generator_prompt(context)

    async def _do(api_key: str) -> AssessAssignmentCore:
        return await _run_pipeline_via_runner(
            prompt=prompt,
            image_mime=image_mime,
            image_bytes=image_bytes,
            api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="assignment_assessor",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


@assignment_assessor_router.post(
    "/assess", response_model=AssessAssignmentResponse,
)
async def assignment_assessor_assess(
    payload: AssessAssignmentRequest,
) -> AssessAssignmentResponse:
    """Grade ONE handwritten student assignment.

    Flow:
      1. Parse + decode image data URI server-side.
      2. Resolve effective rubric (wire snapshot if any, else default).
      3. Render Handlebars prompt with rubric JSON + few-shot exemplars
         + language lock + Native Script Mandate.
      4. One multimodal Gemini structured call (image + prompt parts).
      5. Post-hoc presence/hallucination validator
         (ports `assignment-assessor-validation.ts`).
      6. Server-side enrichment: assessmentId, createdAtIso, language
         echo, rubric echo, transcript echo.
      7. Wrap timing telemetry.
    """
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    try:
        core = await _run_assessor(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("assignment_assessor.safety_block", reason=str(exc))
        raise
    except AgentError:
        raise
    except Exception as exc:
        log.error("assignment_assessor.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="Assignment-assessor agent failed",
            http_status=502,
        ) from exc

    # Server-side enrichment — overrides whatever the model returned.
    effective_rubric = _effective_rubric(payload.rubricSnapshot)
    enriched = core.model_copy(deep=True)
    enriched.assessmentId = uuid.uuid4().hex
    enriched.createdAtIso = (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )
    enriched.language = payload.language or "English"
    enriched.rubricSnapshot = RubricSnapshot.model_validate(effective_rubric)
    enriched.studentId = payload.studentId
    enriched.editedTranscript = (
        payload.editedTranscript or enriched.editedTranscript
    )

    # Post-hoc presence / hallucination guard.
    final_output, added_warnings = validate_assessment(enriched)
    if added_warnings:
        log.warning(
            "assignment_assessor.presence_guard_triggered",
            added_warnings=added_warnings,
            assessment_id=final_output.assessmentId,
        )

    latency_ms = int((time.perf_counter() - started) * 1000)
    log.info(
        "assignment_assessor.assessed",
        latency_ms=latency_ms,
        language=final_output.language,
        overall_score=final_output.overallScore,
        warnings=final_output.warnings,
        confidence_overall=final_output.confidenceOverall,
        mode=payload.mode,
        model_used=get_generator_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return AssessAssignmentResponse(
        assessmentId=final_output.assessmentId,
        rawTranscript=final_output.rawTranscript,
        editedTranscript=final_output.editedTranscript,
        language=final_output.language,
        overallScore=final_output.overallScore,
        pointsEarned=final_output.pointsEarned,
        pointsPossible=final_output.pointsPossible,
        perCriterionScores=final_output.perCriterionScores,
        strengths=final_output.strengths,
        improvements=final_output.improvements,
        nextSteps=final_output.nextSteps,
        teacherNote=final_output.teacherNote,
        confidenceOverall=final_output.confidenceOverall,
        warnings=final_output.warnings,
        rubricSnapshot=final_output.rubricSnapshot,
        studentId=final_output.studentId,
        createdAtIso=final_output.createdAtIso,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
