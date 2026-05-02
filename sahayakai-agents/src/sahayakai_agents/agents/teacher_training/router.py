"""FastAPI sub-router for the teacher-training agent.

Phase D.2 (router) + Phase U.alpha (ADK promotion). Single-stage flow:
render prompt → ADK Runner against `LlmAgent` → structured-output parse
→ behavioural guard → wire response.

Phase U.alpha: the model call now goes through ADK's `Runner` against
the `LlmAgent` built by `build_teacher_training_agent()`. Wire shape,
request / response schemas, behavioural guard, retry semantics — all
unchanged. Only the INTERNAL call mechanism switches from a hand-rolled
`google.genai.Client.aio.models.generate_content` to ADK's canonical
LlmAgent + Runner pattern.
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
from ._guard import assert_teacher_training_response_rules
from .agent import (
    build_teacher_training_agent,
    get_advisor_model,
    render_advisor_prompt,
)
from .schemas import (
    TeacherTrainingCore,
    TeacherTrainingRequest,
    TeacherTrainingResponse,
)

log = structlog.get_logger(__name__)

teacher_training_router = APIRouter(
    prefix="/v1/teacher-training", tags=["teacher-training"],
)

# Phase U.alpha — bumped from `phase-d.2.0` because the internal call
# mechanism switched to ADK Runner. Wire shape unchanged.
SIDECAR_VERSION = "phase-u.alpha"

# Per-call timeout for run_resiliently. Teacher-training advisor returns
# a structured JSON with multiple sections; 20s caps a hung Gemini call
# without truncating slow but legitimate generations.
_PER_CALL_TIMEOUT_S = 20.0

# ADK Runner needs an app_name for the in-memory session service.
_TEACHER_TRAINING_APP_NAME = "sahayakai-teacher-training"


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


# ---- ADK Runner helpers (Phase U.alpha) ---------------------------------


def _build_keyed_gemini(api_key: str) -> Any:
    """Build a `Gemini` model wrapper pinned to a specific api_key.

    Mirrors L.1 vidya's pattern. The cached agent's `.model` is typed
    `Union[str, BaseLlm]` by ADK — we know our cached template carries
    a string (see `build_teacher_training_agent`). Coerce so the helper
    sees a `str` model name.
    """
    template_model = build_teacher_training_agent().model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return build_keyed_gemini(model_name=model_name, api_key=api_key)


async def _run_pipeline_via_runner(
    *, prompt: str, api_key: str,
) -> TeacherTrainingCore:
    """One ADK Runner invocation against the teacher-training LlmAgent.

    Builds a per-call `LlmAgent` by `model_copy`-ing the cached template
    and swapping in a `Gemini` instance pinned to `api_key`. The cached
    agent itself is never mutated — `model_copy()` returns a fresh
    Pydantic instance.

    The rendered prompt is passed as `new_message` (user content), NOT
    as `instruction`, because:
      - The agent's `instruction` would go through ADK's
        `inject_session_state()` which scans for `{name}` patterns —
        a source of accidental KeyError if our rendered output ever
        contains a `{var}` shape.
      - Putting it in `new_message` is the canonical way to pass
        per-request user input through ADK; matches what the previous
        `_call_gemini_structured` did (prompt → `contents`).
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    template = build_teacher_training_agent()
    agent_for_call = template.model_copy(
        update={"model": _build_keyed_gemini(api_key)}
    )

    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_TEACHER_TRAINING_APP_NAME,
    )

    user_id = "teacher-training-advisor"
    session_id = f"teacher-training-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_TEACHER_TRAINING_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )

    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text=prompt)],
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
        return TeacherTrainingCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "teacher_training.advisor.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Advisor returned text that does not match "
                "TeacherTrainingCore"
            ),
            http_status=502,
        ) from exc


async def _run_advisor(
    payload: TeacherTrainingRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> TeacherTrainingCore:
    """Run the advisor agent. Returns the parsed `TeacherTrainingCore`.

    Phase U.alpha: dispatches via ADK Runner instead of a hand-rolled
    `google.genai` call. Sanitization + key-pool failover + per-call
    timeout semantics all unchanged.

    Token telemetry: Runner doesn't surface the raw model result, so
    the per-router success log emits `tokens_in/out=None`. Per-attempt
    token counts already live in the matching
    `ai_resilience.attempt_succeeded` events, joined by `request_id`.
    """
    # Phase J §J.3 — sanitize user-controlled strings before render.
    context = {
        "question": sanitize(payload.question, max_length=4000),
        "language": sanitize(payload.language or "English", max_length=20),
        "subject": sanitize_optional(payload.subject, max_length=100),
    }
    prompt = render_advisor_prompt(context)

    async def _do(api_key: str) -> TeacherTrainingCore:
        return await _run_pipeline_via_runner(
            prompt=prompt, api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="teacher_training.advisor",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


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
        core = await _run_advisor(payload, api_keys, settings)
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
    # Phase U.alpha — Runner doesn't surface the raw Gemini result, so
    # token counts are emitted as None on this event. Per-attempt token
    # counts already live in the matching `ai_resilience.attempt_succeeded`
    # events, joined by `request_id` (set by the request_id middleware).
    log.info(
        "teacher_training.generated",
        latency_ms=latency_ms,
        language=payload.language,
        subject=payload.subject,
        advice_count=len(core.advice),
        model_used=get_advisor_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
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
