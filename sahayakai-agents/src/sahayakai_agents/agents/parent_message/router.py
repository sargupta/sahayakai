"""FastAPI sub-router for the parent-message-generator agent.

Phase C §C.4 (router) + Phase U.alpha (ADK promotion). Single-stage
flow: render prompt → ADK Runner against `LlmAgent` → structured-output
parse → behavioural guard → wire response.

Phase U.alpha: the model call now goes through ADK's `Runner` against
the `LlmAgent` built by `build_parent_message_agent()`. Wire shape,
request/response schemas, behavioural guard, retry semantics — all
unchanged. Only the INTERNAL call mechanism switches from a hand-rolled
`google.genai.Client.aio.models.generate_content` to ADK's canonical
LlmAgent + Runner pattern.

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
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from ._guard import assert_parent_message_response_rules
from .agent import (
    LANGUAGE_TO_BCP47,
    REASON_CONTEXT,
    build_parent_message_agent,
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

# Phase U.alpha — bumped from `phase-c.1.0` because the internal call
# mechanism switched to ADK Runner. Wire shape unchanged.
SIDECAR_VERSION = "phase-u.alpha"

# Per-call timeout for run_resiliently. Parent-message is a short
# classifier-style structured output; 8s mirrors the telephony budget
# while still leaving room for slower attempts.
_PER_CALL_TIMEOUT_S = 8.0

# ADK Runner needs an app_name for the in-memory session service.
# This is opaque to the model — it's just a session-store key prefix.
_PARENT_MESSAGE_APP_NAME = "sahayakai-parent-message"


# ---- ADK Runner helpers (Phase U.alpha) ---------------------------------


def _build_keyed_gemini(api_key: str) -> Any:
    """Build a `Gemini` model wrapper pinned to a specific api_key.

    Mirrors L.1 vidya's pattern. The cached agent's `.model` is typed
    `Union[str, BaseLlm]` by ADK — we know our cached template carries
    a string (see `build_parent_message_agent`). Coerce so the helper
    sees a `str` model name.
    """
    template_model = build_parent_message_agent().model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return build_keyed_gemini(model_name=model_name, api_key=api_key)


async def _run_pipeline_via_runner(
    *, prompt: str, api_key: str
) -> ParentMessageCore:
    """One ADK Runner invocation against the parent-message LlmAgent.

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

    template = build_parent_message_agent()
    agent_for_call = template.model_copy(
        update={"model": _build_keyed_gemini(api_key)}
    )

    runner = InMemoryRunner(
        agent=agent_for_call, app_name=_PARENT_MESSAGE_APP_NAME,
    )

    user_id = "parent-message-generator"
    session_id = f"parent-message-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_PARENT_MESSAGE_APP_NAME,
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
        # Accumulate text from final-response events. A single
        # output_schema call typically yields one final event whose
        # content.parts[0].text is the full JSON.
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
        return ParentMessageCore.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "parent_message.generator.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Generator returned text that does not match "
                "ParentMessageCore"
            ),
            http_status=502,
        ) from exc


# ---- Single-stage runner -------------------------------------------------


async def _run_generator(
    payload: ParentMessageRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> ParentMessageCore:
    """Run the generator agent. Returns the parsed `ParentMessageCore`.

    Phase U.alpha: dispatches via ADK Runner instead of a hand-rolled
    `google.genai` call. Sanitization + key-pool failover + per-call
    timeout semantics all unchanged.

    Token telemetry: Runner doesn't surface the raw model result, so
    the per-router success log emits `tokens_in/out=None`. Per-attempt
    token counts already live in the matching
    `ai_resilience.attempt_succeeded` events, joined by `request_id`.
    """
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

    async def _do(api_key: str) -> ParentMessageCore:
        return await _run_pipeline_via_runner(
            prompt=prompt, api_key=api_key,
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="parent_message.generator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


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
    # Phase U.alpha — Runner doesn't surface the raw Gemini result, so
    # token counts are emitted as None on this event. Per-attempt token
    # counts already live in the matching `ai_resilience.attempt_succeeded`
    # events, joined by `request_id` (set by the request_id middleware).
    log.info(
        "parent_message.generated",
        latency_ms=latency_ms,
        reason=payload.reason,
        parent_language=payload.parentLanguage,
        word_count=actual_word_count,
        model_used=get_generator_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )
    return ParentMessageResponse(
        message=core.message,
        languageCode=canonical_language_code,
        wordCount=actual_word_count,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_generator_model(),
    )
