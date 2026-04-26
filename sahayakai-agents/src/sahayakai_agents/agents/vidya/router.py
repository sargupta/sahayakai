"""FastAPI sub-router for the VIDYA orchestrator.

Phase 5 §5.3 deliverable. This is a SKELETON — the real Gemini calls
land in Phase 5.4. Today the route:

  1. Validates the request body against `VidyaRequest`.
  2. Calls `_run_orchestrator()` — currently returns canned data
     (`IntentClassification(type="unknown", ...)`). Real call lands
     in Phase 5.4.
  3. If intent == `instantAnswer`: calls `_run_instant_answer()` —
     also canned data today.
     Else if intent is a routable flow: builds a `VidyaAction` via
     `classify_action()` and a polite acknowledgement string.
     Else (`unknown` / unhandled): returns a polite fallback.
  4. Runs `assert_vidya_response_rules` (fail-closed behavioural guard).
  5. Wraps timing telemetry around everything.

All four code paths are wired through real plumbing so unskipping Phase
5.4 work is mechanical: replace the canned-data lines with `await
run_resiliently(...)` calls and the routing stays unchanged.

See `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ..._behavioural import assert_vidya_response_rules
from ...shared.errors import AgentError
from .agent import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    UNKNOWN_INTENT,
    classify_action,
    render_instant_answer_prompt,
    render_orchestrator_prompt,
)
from .schemas import (
    IntentClassification,
    VidyaAction,
    VidyaRequest,
    VidyaResponse,
)

log = structlog.get_logger(__name__)

vidya_router = APIRouter(prefix="/v1/vidya", tags=["vidya"])

# Sidecar version pinned per release cut. Surfaced in the wire response
# so a Track G dashboard can correlate behaviour shifts to versions.
SIDECAR_VERSION = "phase-5.1.0"


# ---- Stub helpers (Phase 5.4 will replace with real Gemini calls) -------


async def _run_orchestrator(payload: VidyaRequest) -> IntentClassification:
    """Classify intent + extract params from the teacher's utterance.

    TODO Phase 5.4: replace canned response with a real Gemini call:

        prompt = render_orchestrator_prompt({
            "message": payload.message,
            "chatHistory": [m.model_dump() for m in payload.chatHistory],
            "currentScreenContext": payload.currentScreenContext.model_dump(),
            "teacherProfile": payload.teacherProfile.model_dump(),
            "detectedLanguage": payload.detectedLanguage,
            "allowedFlows": ALLOWED_FLOWS,
        })
        result = await run_resiliently(
            lambda key: _call_gemini_structured(
                api_key=key,
                model=get_orchestrator_model(),
                prompt=prompt,
                response_schema=IntentClassification,
            ),
            api_keys,
            span_name="vidya.orchestrator",
            ...,
        )
        return IntentClassification.model_validate_json(_extract_text(result))

    For Phase 5.3 we render the prompt (so the import surface is
    exercised + caches warm) but discard the rendered string and
    return a hard-coded `unknown` classification. The integration
    tests that depend on real classification are skipped accordingly.
    """
    # Render to keep the template + caches warm and to surface
    # FileNotFoundError early if the prompt is missing.
    _ = render_orchestrator_prompt(
        {
            "message": payload.message,
            "chatHistory": [m.model_dump() for m in payload.chatHistory],
            "currentScreenContext": payload.currentScreenContext.model_dump(),
            "teacherProfile": payload.teacherProfile.model_dump(),
            "detectedLanguage": payload.detectedLanguage,
            "allowedFlows": ALLOWED_FLOWS,
        }
    )
    log.info("vidya.orchestrator.stub", intent="unknown")
    return IntentClassification(
        type=UNKNOWN_INTENT,
        topic=None,
        gradeLevel=None,
        subject=None,
        language=payload.detectedLanguage,
    )


async def _run_instant_answer(payload: VidyaRequest) -> str:
    """Produce the inline answer text for an `instantAnswer` intent.

    TODO Phase 5.4: replace canned response with a real Gemini call:

        prompt = render_instant_answer_prompt({
            "message": payload.message,
            "language": payload.detectedLanguage,
            "teacherProfile": payload.teacherProfile.model_dump(),
        })
        result = await run_resiliently(
            lambda key: _call_gemini_text(
                api_key=key,
                model=get_instant_answer_model(),
                prompt=prompt,
            ),
            api_keys,
            span_name="vidya.instant_answer",
            ...,
        )
        return _extract_text(result)
    """
    # Render to keep the template + caches warm.
    _ = render_instant_answer_prompt(
        {
            "message": payload.message,
            "language": payload.detectedLanguage,
            "teacherProfile": payload.teacherProfile.model_dump(),
        }
    )
    log.info("vidya.instant_answer.stub")
    return (
        "I am still warming up the answer engine. "
        "Please ask me again in a moment."
    )


# ---- Endpoint ------------------------------------------------------------


@vidya_router.post("/orchestrate", response_model=VidyaResponse)
async def vidya_orchestrate(payload: VidyaRequest) -> VidyaResponse:
    """Classify teacher intent and return either a navigation action or
    an inline answer.

    Flow:
        1. Orchestrator classifies the message + extracts params.
        2. Branch:
             - `instantAnswer`  → run inline answer; no action.
             - 9 routable flows → build action; canned ack response.
             - `unknown` / else → polite fallback; no action.
        3. Behavioural guard on the response (fail-closed).
        4. Wrap timing telemetry.
    """
    started = time.perf_counter()

    # Step 1: classify
    try:
        intent = await _run_orchestrator(payload)
    except Exception as exc:
        # Per Phase 3 pattern: structured 502 on parse / model failures.
        log.error("vidya.orchestrator.failed", error=str(exc))
        raise AgentError(
            code="INTERNAL",
            message="VIDYA orchestrator failed to classify intent",
            http_status=502,
        ) from exc

    response_text: str
    action: VidyaAction | None = None
    intent_label = intent.type

    # Step 2: branch on intent
    if intent.type == INSTANT_ANSWER_INTENT:
        try:
            response_text = await _run_instant_answer(payload)
        except Exception as exc:
            log.error("vidya.instant_answer.failed", error=str(exc))
            raise AgentError(
                code="INTERNAL",
                message="VIDYA instant-answer agent failed",
                http_status=502,
            ) from exc
    elif intent.type in ALLOWED_FLOWS:
        action = classify_action(intent)
        response_text = (
            "Opening the right tool for you now."
            if action is not None
            else "I could not route that request."
        )
    else:
        # `unknown` or any unrecognised label — polite fallback.
        response_text = (
            "I am not sure how to help with that yet. "
            "Please try rephrasing your request."
        )

    # Step 3: behavioural guard. Fail-closed on any violation.
    try:
        assert_vidya_response_rules(
            response_text=response_text,
            language=payload.detectedLanguage or "en",
            action=action,
        )
    except AssertionError as exc:
        log.error("vidya.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    return VidyaResponse(
        response=response_text,
        action=action,
        intent=intent_label,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
    )


# Keep imports anchored to this module so callers can `from .router
# import vidya_router` without a wildcard import.
_unused: tuple[Any, ...] = (assert_vidya_response_rules,)
