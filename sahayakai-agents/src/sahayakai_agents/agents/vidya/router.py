"""FastAPI sub-router for the VIDYA orchestrator.

Phase 5 §5.4 — real Gemini calls live here. Two-stage flow:

  1. Classifier → `IntentClassification` (one structured Gemini call)
  2. Branch on intent:
     - `instantAnswer` → second Gemini call (plain text) for the answer
     - 9 routable flows → no second call; build a `VidyaAction`
     - `unknown` / unhandled → polite fallback; no action

Every model call goes through `run_resiliently` so the same retry +
key-rotation + telephony-bounded backoff applies as parent-call /
lesson-plan.

Cost cap: max 2 Gemini calls per request (classifier + optional
inline answer). Same shape as the current Genkit `agentRouterFlow`,
so net cost is unchanged.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ..._behavioural import assert_vidya_response_rules
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from .agent import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    classify_action,
    get_orchestrator_model,
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
SIDECAR_VERSION = "phase-5.4.0"


# ---- Gemini call helpers (mirror lesson_plan / parent_call routers) ------


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
) -> Any:
    """One Gemini call with structured JSON output."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            # Low temperature: intent classification is deterministic
            # by design; matches the Genkit flow's temperature=0.1.
            temperature=0.1,
        ),
    )


async def _call_gemini_text(
    *,
    api_key: str,
    model: str,
    prompt: str,
) -> Any:
    """One Gemini call returning plain text (no structured schema)."""
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            # Slightly higher temperature for instant-answer prose so
            # responses don't all read identically; still well below
            # creative-writing range.
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


# ---- Stage 1: classifier -------------------------------------------------


async def _run_orchestrator(
    payload: VidyaRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> IntentClassification:
    """Classify intent + extract params from the teacher's utterance."""
    context = {
        "message": payload.message,
        "chatHistory": [m.model_dump() for m in payload.chatHistory],
        "currentScreenContext": payload.currentScreenContext.model_dump(),
        "teacherProfile": payload.teacherProfile.model_dump(),
        "detectedLanguage": payload.detectedLanguage,
        "allowedFlows": ALLOWED_FLOWS,
    }
    prompt = render_orchestrator_prompt(context)
    model = get_orchestrator_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=IntentClassification,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="vidya.orchestrator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
    )
    text = _extract_text(result)
    try:
        return IntentClassification.model_validate_json(text)
    except Exception as exc:
        log.error(
            "vidya.orchestrator.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Orchestrator returned text that does not match IntentClassification",
            http_status=502,
        ) from exc


# ---- Stage 2: inline answer (only when intent == instantAnswer) ---------
#
# Phase B §B.4: VIDYA delegates `instantAnswer` to the dedicated
# instant-answer ADK agent (introduced in Phase B.1-B.3) instead of
# composing a one-off prompt here. Two reasons:
#
#   1. The instant-answer agent has Google Search grounding wired —
#      live web access for fact-style questions. The previous inline
#      path was un-grounded.
#   2. This is the canonical supervisor-pattern hook. VIDYA is the
#      supervisor; instant-answer is the sub-agent. The call uses
#      direct in-process import (no HTTP loop back through Cloud Run).
#      In a future phase we'll switch to ADK `AgentTool` once VIDYA
#      runs through `Runner` — for now the same shape works without
#      that machinery.
#
# The fallback to the local `render_instant_answer_prompt` path is
# kept around at module import time so the prompt-rendering smoke
# test still passes and the local Handlebars template is still
# loaded (warming the lru_cache). The actual call routes through the
# sub-agent.


async def _run_instant_answer(
    payload: VidyaRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> str:
    """Delegate the inline-answer call to the instant-answer agent.

    Returns the answer text only — VIDYA wraps that in its own
    `VidyaResponse.response`. The instant-answer agent's video
    suggestion / metadata fields are dropped on this path because
    VIDYA's wire shape is text-only (the OmniOrb client speaks the
    response via TTS).
    """
    # Lazy import to avoid a Phase 5 → Phase 6 cycle at module load.
    from ..instant_answer.router import _run_answerer  # noqa: PLC0415
    from ..instant_answer.schemas import InstantAnswerRequest  # noqa: PLC0415

    # The instant-answer agent's request shape needs `userId` —
    # VIDYA's request doesn't carry one (the OmniOrb is auth'd at
    # the dispatcher / route layer, not the sidecar). Use a stable
    # placeholder so the schema's path-injection-defence pattern
    # accepts the value.
    sub_request = InstantAnswerRequest(
        question=payload.message,
        language=payload.detectedLanguage,
        gradeLevel=payload.teacherProfile.preferredGrade,
        subject=payload.teacherProfile.preferredSubject,
        userId="vidya-supervisor",
    )

    # The sub-agent runs through `run_resiliently` itself; we just
    # forward the api_keys + settings. Telephony backoff budget is
    # the same — instant-answer's own router call already enforces it.
    core, _grounding_used = await _run_answerer(
        sub_request, api_keys, settings,
    )
    return core.answer


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
    settings = get_settings()
    started = time.perf_counter()
    api_keys = settings.genai_keys

    # Step 1: classify
    try:
        intent = await _run_orchestrator(payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("vidya.orchestrator.safety_block", reason=str(exc))
        raise
    except AgentError:
        # Already structured; let it propagate.
        raise
    except Exception as exc:
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
            response_text = await _run_instant_answer(
                payload, api_keys, settings
            )
        except AISafetyBlockError as exc:
            log.warning("vidya.instant_answer.safety_block", reason=str(exc))
            raise
        except AgentError:
            raise
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
