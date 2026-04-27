"""FastAPI sub-router for the VIDYA orchestrator.

Phase L.1: the classifier call now goes through ADK's `Runner` against
the `LlmAgent` built by `build_vidya_agent()`. Wire shape, request +
response schemas, behavioural guard, retry semantics — all unchanged.
Only the INTERNAL call mechanism switches from a hand-rolled
`google.genai.Client.aio.models.generate_content` to ADK's canonical
supervisor-pattern Runner.

Two-stage flow (unchanged):

  1. Classifier → `IntentClassification` (one structured Gemini call
     via ADK Runner against the cached LlmAgent).
  2. Branch on intent:
     - `instantAnswer` → delegate to the instant-answer ADK agent
       (in-process import; same as Phase B.4).
     - 9 routable flows → no second call; build a `VidyaAction`.
     - `unknown` / unhandled → polite fallback; no action.

Every model call still goes through `run_resiliently` so the same
retry + key-rotation + telephony-bounded backoff applies as the
parent-call / lesson-plan routers. The Runner is invoked inside the
resilience callback; per-attempt the agent's `.model` is swapped to
a `Gemini` instance pinned to the current api_key, leaving the cached
agent template untouched between requests.

Cost cap: max 2 Gemini calls per request (classifier + optional
inline answer). Same shape as the current Genkit `agentRouterFlow`,
so net cost is unchanged.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._adk_keyed_gemini import build_keyed_gemini
from ..._behavioural import assert_vidya_response_rules
from ...config import get_settings
from ...resilience import run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_optional
from .agent import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    build_vidya_agent,
    classify_action,
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
SIDECAR_VERSION = "phase-l.2"

# Per-call timeout for run_resiliently. VIDYA orchestrator is a
# classifier-only flow; 8s mirrors the Twilio-bounded budget on the
# voice path while still leaving room for the supervisor's structured
# JSON output.
_PER_CALL_TIMEOUT_S = 8.0

# Phase M.2 — tightened total backoff for VIDYA. The TS dispatcher caps
# the request at 12s; with 8s per-call timeout + 5s total backoff the
# Python budget tops out at 10s, leaving 2s on the TS side for network
# + auth + headroom. Was: settings.max_total_backoff_seconds (7s
# default), which produced p99 ≥ 10s and triggered TS false-positive
# timeouts on the previous 8s budget.
_MAX_TOTAL_BACKOFF_S = 5.0

# ADK Runner needs an app_name for the in-memory session service.
# This is opaque to the model — it's just a session-store key prefix.
_VIDYA_APP_NAME = "sahayakai-vidya"


# ---- ADK Runner helpers -------------------------------------------------


def _build_keyed_gemini(api_key: str) -> Any:
    """Build a `Gemini` model wrapper pinned to a specific api_key.

    Phase L.5 — delegates to the shared `build_keyed_gemini` helper at
    `sahayakai_agents._adk_keyed_gemini`. The L.5 SequentialAgent
    migrations (visual-aid, avatar-generator, voice-to-text) need the
    same workaround, so the implementation lives in one place.

    The cached agent's `.model` is typed `Union[str, BaseLlm]` by
    ADK — but we know our cached template carries a string (see
    `build_vidya_agent`). Coerce so the helper sees a `str` model name.
    """
    template_model = build_vidya_agent().model
    model_name = (
        template_model
        if isinstance(template_model, str)
        else template_model.model
    )
    return build_keyed_gemini(model_name=model_name, api_key=api_key)


async def _run_orchestrator_via_runner(
    *, prompt: str, api_key: str
) -> IntentClassification:
    """One ADK Runner invocation against the VIDYA supervisor.

    Builds a per-call `LlmAgent` by `model_copy`-ing the cached
    template and swapping in a `Gemini` instance pinned to `api_key`.
    The cached agent itself is never mutated — `model_copy()` returns
    a fresh Pydantic instance.

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

    template = build_vidya_agent()
    agent_for_call = template.model_copy(
        update={"model": _build_keyed_gemini(api_key)}
    )

    runner = InMemoryRunner(agent=agent_for_call, app_name=_VIDYA_APP_NAME)

    # InMemoryRunner uses InMemorySessionService; we must create a
    # session before run_async (no auto_create_session by default).
    user_id = "vidya-orchestrator"
    session_id = f"vidya-{uuid.uuid4().hex}"
    await runner.session_service.create_session(
        app_name=_VIDYA_APP_NAME,
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
        return IntentClassification.model_validate_json(final_text)
    except Exception as exc:
        log.error(
            "vidya.orchestrator.json_parse_failed",
            raw_excerpt=final_text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=(
                "Orchestrator returned text that does not match "
                "IntentClassification"
            ),
            http_status=502,
        ) from exc


# ---- Stage 1: classifier -------------------------------------------------


async def _run_orchestrator(
    payload: VidyaRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> IntentClassification:
    """Classify intent + extract params from the teacher's utterance.

    Phase L.1: dispatches via ADK Runner instead of a hand-rolled
    `google.genai` call. Sanitization + key-pool failover + per-call
    timeout semantics all unchanged.

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

    async def _do(api_key: str) -> IntentClassification:
        return await _run_orchestrator_via_runner(
            prompt=prompt, api_key=api_key
        )

    return await run_resiliently(
        _do,
        api_keys,
        span_name="vidya.orchestrator",
        max_total_backoff_seconds=_MAX_TOTAL_BACKOFF_S,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )


# ---- Stage 2: inline answer (only when intent == instantAnswer) ---------
#
# Phase L.2 — VIDYA delegates `instantAnswer` to the public
# `run_answerer()` helper that the instant-answer router exposes. The
# ADK supervisor pattern is preserved (instant-answer's own LlmAgent
# is built by `build_instant_answer_agent()` and wrapped in an
# `AgentTool` ready for L.3+ supervisors), but VIDYA does not register
# the tool on its `LlmAgent.tools` list because its `output_schema=
# IntentClassification` would conflict with `_output_schema_processor`
# on the public Gemini API path (see `agents/instant_answer/agent.py`
# module docstring for the trade-off). The router calls the public
# helper directly.
#
# This replaces the Phase B.4 in-process import of the private
# `_run_answerer`, which:
#   1. was a layering violation (cross-module private import),
#   2. hard-coded `userId="vidya-supervisor"` — blocking per-user
#      rate-limiting / observability,
#   3. lost the per-call trace span boundary an AgentTool would emit.
#
# All three are fixed below: import goes through the public
# `run_answerer` symbol, `userId` is forwarded from the authenticated
# request, and the structured log already names the call site
# distinctly (`vidya.instant_answer.failed` etc.).


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

    Phase L.2 — uses the public `run_answerer` symbol and propagates
    the authenticated `payload.userId` so the sub-agent's audit trail
    attributes the call to the real teacher (no more
    `vidya-supervisor` placeholder).
    """
    # Lazy import to avoid a Phase 5 → Phase 6 cycle at module load.
    from ..instant_answer.router import run_answerer  # noqa: PLC0415
    from ..instant_answer.schemas import InstantAnswerRequest  # noqa: PLC0415

    sub_request = InstantAnswerRequest(
        question=payload.message,
        language=payload.detectedLanguage,
        gradeLevel=payload.teacherProfile.preferredGrade,
        subject=payload.teacherProfile.preferredSubject,
        userId=payload.userId,
    )

    # The sub-agent runs through `run_resiliently` itself; we just
    # forward the api_keys + settings. Telephony backoff budget is
    # the same — instant-answer's own router call already enforces it.
    core, _grounding_used = await run_answerer(
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
