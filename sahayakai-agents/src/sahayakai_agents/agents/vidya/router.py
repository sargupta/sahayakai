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
from ...shared.prompt_safety import sanitize, sanitize_optional
from .agent import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    classify_action,
    get_orchestrator_model,
    render_orchestrator_prompt,
)
from .registry import render_capability_index
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
SIDECAR_VERSION = "phase-g.0"

# Per-call timeout for run_resiliently. VIDYA orchestrator is a
# classifier-only flow; 8s mirrors the Twilio-bounded budget on the
# voice path while still leaving room for the supervisor's structured
# JSON output.
_PER_CALL_TIMEOUT_S = 8.0


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
    """Classify intent + extract params from the teacher's utterance.

    Phase J §J.3 — sanitize every user-controlled string before it
    lands in the prompt:
      - The message itself.
      - Each chatHistory turn's parts[*].text.
      - currentScreenContext.path + uiState dict (keys + values).
      - teacherProfile fields (preferredGrade, preferredSubject,
        preferredLanguage, schoolContext).
    """
    sanitized_history: list[dict[str, Any]] = []
    for m in payload.chatHistory:
        sanitized_history.append({
            "role": m.role,  # Literal — not user-controlled.
            "parts": [
                {"text": sanitize(p.text, max_length=4000)} for p in m.parts
            ],
        })
    screen_context_dump = payload.currentScreenContext.model_dump()
    sanitized_screen_context: dict[str, Any] = {
        "path": sanitize(screen_context_dump.get("path", ""), max_length=500),
    }
    ui_state = screen_context_dump.get("uiState")
    if ui_state is not None:
        # Sanitize both keys AND values — an attacker who controls
        # the form field name can inject just as easily as one who
        # controls the value.
        sanitized_screen_context["uiState"] = {
            sanitize(k, max_length=100): sanitize(v, max_length=500)
            for k, v in ui_state.items()
        }
    else:
        sanitized_screen_context["uiState"] = None
    profile_dump = payload.teacherProfile.model_dump()
    sanitized_profile: dict[str, Any] = {
        "preferredGrade": sanitize_optional(
            profile_dump.get("preferredGrade"), max_length=50,
        ),
        "preferredSubject": sanitize_optional(
            profile_dump.get("preferredSubject"), max_length=100,
        ),
        "preferredLanguage": sanitize_optional(
            profile_dump.get("preferredLanguage"), max_length=10,
        ),
        "schoolContext": sanitize_optional(
            profile_dump.get("schoolContext"), max_length=2000,
        ),
    }
    context = {
        "message": sanitize(payload.message, max_length=2000),
        "chatHistory": sanitized_history,
        "currentScreenContext": sanitized_screen_context,
        "teacherProfile": sanitized_profile,
        "detectedLanguage": sanitize_optional(
            payload.detectedLanguage, max_length=10,
        ),
        "allowedFlows": ALLOWED_FLOWS,
        # Phase G — supervisor-aware capability index. Renders the
        # sub-agent registry as a bullet list so the model can pick
        # the right primary flow on a compound request.
        "capabilityIndex": render_capability_index(),
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
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
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
    # Phase G — propagate any compound follow-up suggestion the
    # orchestrator emitted. None for single-step / unknown / instant-
    # answer paths where there's no natural next step.
    follow_up: str | None = None
    if intent.followUpSuggestion is not None:
        candidate = intent.followUpSuggestion.strip()
        if candidate:
            follow_up = candidate

    return VidyaResponse(
        response=response_text,
        action=action,
        intent=intent_label,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        followUpSuggestion=follow_up,
    )
