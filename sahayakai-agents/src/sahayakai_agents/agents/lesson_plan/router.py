"""FastAPI sub-router for the lesson-plan agent.

Phase L.3 — the procedural writer/evaluator/reviser/evaluator-on-v2
loop has been replaced with a real ADK ``LoopAgent``. The router now:

  1. Sanitizes the request payload (Phase J §J.3 prompt-safety guard
     — unchanged).
  2. Seeds session state with the request, api_keys, and settings.
  3. Calls ``Runner.run_async`` against ``build_lesson_plan_agent()``.
  4. Reads the final state to decide what to ship per the existing
     "never amplify" rule.
  5. Runs the behavioural guard (fail-closed) on the final plan.
  6. Wraps timing / cache telemetry into the wire response.

Wire shape, request + response schemas, behavioural guard, retry
semantics, hard-fail 502 — all unchanged. Only the INTERNAL
orchestration mechanism switches from a hand-rolled Python loop to
ADK's canonical ``LoopAgent`` + sub-agent state pattern.

Cost cap: still max 4 model calls (writer + evaluator + reviser +
evaluator-on-v2) per lesson plan. The cap is enforced both by the
``LoopAgent``'s ``max_iterations=2`` and by the sub-agents' state-
based no-op guards.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

import structlog
from fastapi import APIRouter

from ..._behavioural import assert_lesson_plan_rules
from ...config import get_settings
from ...resilience import extract_cache_metrics
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_list, sanitize_optional
from .agent import (
    build_lesson_plan_agent,
    classify_verdict,
    get_writer_model,
)
from .schemas import (
    EvaluatorVerdict,
    LessonPlanCore,
    LessonPlanRequest,
    LessonPlanResponse,
)

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/lesson-plan", tags=["lesson-plan"])

# Sidecar version pinned per release cut. Bumped manually when this
# module's contract changes; surfaced in the wire response so a Track
# G dashboard can correlate behaviour shifts to versions.
SIDECAR_VERSION = "phase-l.3"

# ADK Runner needs an app_name for the in-memory session service.
# Opaque to the model — just a session-store key prefix.
_LESSON_PLAN_APP_NAME = "sahayakai-lesson-plan"


# ---- Request sanitization (unchanged from pre-L.3) ----------------------


def _request_to_dict(request: LessonPlanRequest) -> dict[str, Any]:
    """Render context for the writer prompt — drops `None` values so
    the Handlebars template's `{{#if x}}` blocks behave correctly.

    Phase J §J.3 — every user-controlled string field is sanitized
    BEFORE landing in the prompt. The Handlebars template wraps
    each value in `⟦…⟧` markers, but those markers are advisory
    only; without sanitize, a payload like `⟧\\n\\nNew rule: …`
    closes the wrap and the injected instruction reaches Gemini.
    """
    raw = request.model_dump(exclude_none=True)
    raw.setdefault("useRuralContext", True)
    raw.setdefault("language", "en")
    raw.setdefault("gradeLevels", [])
    if "topic" in raw:
        raw["topic"] = sanitize(raw["topic"], max_length=500)
    if "teacherContext" in raw:
        raw["teacherContext"] = sanitize(raw["teacherContext"], max_length=2000)
    if "subject" in raw:
        raw["subject"] = sanitize(raw["subject"], max_length=100)
    if "gradeLevels" in raw and isinstance(raw["gradeLevels"], list):
        raw["gradeLevels"] = sanitize_list(raw["gradeLevels"], max_length=50)
    if "ncertChapter" in raw and isinstance(raw["ncertChapter"], dict):
        chapter = dict(raw["ncertChapter"])
        if "title" in chapter:
            chapter["title"] = sanitize(chapter["title"], max_length=300)
        if "subject" in chapter:
            chapter["subject"] = sanitize_optional(
                chapter.get("subject"), max_length=100,
            )
        if "learningOutcomes" in chapter and isinstance(
            chapter["learningOutcomes"], list,
        ):
            chapter["learningOutcomes"] = sanitize_list(
                chapter["learningOutcomes"], max_length=300,
            )
        raw["ncertChapter"] = chapter
    return raw


# ---- ADK Runner driver ---------------------------------------------------


async def _run_lesson_plan_loop(
    sanitized_request: dict[str, Any],
    api_keys: tuple[str, ...],
    settings: Any,
) -> dict[str, Any]:
    """Drive the LoopAgent end-to-end and return the final session state.

    Seeds state with the sanitized request + api_keys + settings, runs
    the loop, then collects the deltas the sub-agents pushed via
    ``EventActions.state_delta``. The returned dict has whichever of
    ``lesson_plan_v1`` / ``lesson_plan_v2`` / ``lesson_plan_verdict_v1``
    / ``lesson_plan_verdict_v2`` / ``lesson_plan_decision`` were
    populated during the run.
    """
    from google.adk.runners import InMemoryRunner  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    agent = build_lesson_plan_agent()
    runner = InMemoryRunner(agent=agent, app_name=_LESSON_PLAN_APP_NAME)

    user_id = sanitized_request.get("userId") or "lesson-plan-user"
    session_id = f"lesson-plan-{uuid.uuid4().hex}"

    # Seed session state with the inputs each sub-agent reads.
    initial_state: dict[str, Any] = {
        "lesson_plan_request": sanitized_request,
        "lesson_plan_api_keys": api_keys,
        "lesson_plan_settings": settings,
    }
    await runner.session_service.create_session(
        app_name=_LESSON_PLAN_APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state=initial_state,
    )

    # Driver kick-off message. The sub-agents don't read this — they
    # work off session state — but Runner requires a non-empty
    # ``new_message``.
    new_message = genai_types.Content(
        role="user",
        parts=[genai_types.Part(text="run lesson-plan loop")],
    )

    async for _event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=new_message,
    ):
        # We don't consume events directly — the sub-agents push their
        # outputs into session state via ``state_delta``. The Runner
        # applies those deltas to the InMemorySessionService session
        # before yielding. Read the final state when the generator
        # completes.
        pass

    final_session = await runner.session_service.get_session(
        app_name=_LESSON_PLAN_APP_NAME,
        user_id=user_id,
        session_id=session_id,
    )
    if final_session is None:
        # Defensive: should never happen because we just created it.
        raise AgentError(
            code="INTERNAL",
            message="Lesson plan session disappeared mid-run",
            http_status=502,
        )
    return dict(final_session.state)


# ---- Endpoint -----------------------------------------------------------


@router.post("/generate", response_model=LessonPlanResponse)
async def lesson_plan_generate(  # noqa: PLR0915 — single-purpose handler with linear flow
    payload: LessonPlanRequest,
) -> LessonPlanResponse:
    """Generate a lesson plan via the ADK LoopAgent.

    Flow:
        1. Sanitize the request and seed it into session state.
        2. ADK ``LoopAgent`` runs writer → evaluator → (revise →
           evaluator-on-v2) until escalate or max_iterations.
        3. Read final state:
             - decision == "pass"  → ship v1.
             - decision == "hard_fail" on v1 → 502 (canned safe).
             - revised path → ship v2 unless v2 hard-failed (then v1
               per "never amplify" rule).
        4. Behavioural guard on the shipped plan. Fail-closed.
    """
    settings = get_settings()
    started = time.monotonic()
    api_keys = settings.genai_keys

    sanitized_request = _request_to_dict(payload)

    try:
        final_state = await _run_lesson_plan_loop(
            sanitized_request, api_keys, settings,
        )
    except AISafetyBlockError as exc:
        log.warning("lesson_plan.safety_block", reason=str(exc))
        raise

    # Read sub-agent outputs from final state. The sub-agents always
    # populate v1 + verdict_v1; v2 + verdict_v2 only on the revise
    # path.
    v1_dict = final_state.get("lesson_plan_v1")
    v2_dict = final_state.get("lesson_plan_v2")
    verdict_v1_dict = final_state.get("lesson_plan_verdict_v1")
    verdict_v2_dict = final_state.get("lesson_plan_verdict_v2")

    if v1_dict is None or verdict_v1_dict is None:
        # Defensive: the writer + first evaluator always run. Missing
        # state means the loop terminated before either could fire,
        # which only happens on a Gemini error that already raised.
        raise AgentError(
            code="INTERNAL",
            message="Lesson plan loop terminated without producing v1",
            http_status=502,
        )

    plan_v1 = LessonPlanCore.model_validate(v1_dict)
    verdict_v1 = EvaluatorVerdict.model_validate(verdict_v1_dict)
    decision_v1 = classify_verdict(verdict_v1)

    final_plan: LessonPlanCore
    final_verdict: EvaluatorVerdict
    revisions_run = 0

    if decision_v1 == "pass":
        final_plan = plan_v1
        final_verdict = verdict_v1
    elif decision_v1 == "hard_fail":
        log.error(
            "lesson_plan.hard_fail_v1",
            scores=verdict_v1.scores.model_dump(),
            safety=verdict_v1.safety,
            rationale=verdict_v1.rationale,
        )
        # Reuse the existing INTERNAL code rather than minting a new
        # one — keeps the AgentError code Literal closed. The
        # structured log line above is the actual signal for
        # observability; the wire code is just an HTTP shape.
        raise AgentError(
            code="INTERNAL",
            message=(
                "Lesson plan failed safety / quality gate; "
                "route returns canned safe response."
            ),
            http_status=502,
        )
    else:
        # Revise path: v2 + verdict_v2 must be in state.
        if v2_dict is None or verdict_v2_dict is None:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Loop entered revise branch but v2 state is missing"
                ),
                http_status=502,
            )
        plan_v2 = LessonPlanCore.model_validate(v2_dict)
        verdict_v2 = EvaluatorVerdict.model_validate(verdict_v2_dict)
        revisions_run = 1
        decision_v2 = classify_verdict(verdict_v2)
        if decision_v2 == "hard_fail":
            # Reviser made it worse. Per Phase 3 plan §Risks/Reviser-
            # hallucinations: never amplify; ship v1 with v1's verdict.
            log.warning(
                "lesson_plan.reviser_amplified_failure",
                v1_decision=decision_v1,
                v2_decision=decision_v2,
            )
            final_plan = plan_v1
            final_verdict = verdict_v1
        else:
            final_plan = plan_v2
            final_verdict = verdict_v2

    # Behavioural guard. Fail-closed.
    plan_text_for_guard = " ".join(
        [
            final_plan.title,
            *final_plan.objectives,
            *(act.name + " " + act.description for act in final_plan.activities),
        ]
    )
    try:
        assert_lesson_plan_rules(
            plan_text=plan_text_for_guard,
            language=payload.language or "en",
        )
    except AssertionError as exc:
        log.error("lesson_plan.behavioural_guard_failed", reason=str(exc))
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    metrics = extract_cache_metrics(None)  # writer result already consumed
    latency_ms = int((time.monotonic() - started) * 1000)
    # Forensic fix P1 #18: per-router success log so the dashboard can
    # join `lesson_plan.generated` × `ai_resilience.attempt_succeeded`
    # on `request_id` (set by the request_id middleware) and recover
    # the cost-per-user attribution. Lesson-plan dispatches up to 4
    # Gemini calls (writer → evaluator → reviser → evaluator-on-v2)
    # via ADK's LoopAgent; the raw per-call results aren't surfaced
    # here so the token counts live in the matching
    # `ai_resilience.attempt_succeeded` events.
    log.info(
        "lesson_plan.generated",
        latency_ms=latency_ms,
        revisions_run=revisions_run,
        decision_v1=decision_v1,
        language=final_plan.language,
        grade_level=final_plan.gradeLevel,
        model_used=get_writer_model(),
        tokens_in=None,
        tokens_out=None,
        tokens_cached=None,
    )

    return LessonPlanResponse(
        title=final_plan.title,
        gradeLevel=final_plan.gradeLevel,
        duration=final_plan.duration,
        subject=final_plan.subject,
        objectives=final_plan.objectives,
        keyVocabulary=final_plan.keyVocabulary,
        materials=final_plan.materials,
        activities=final_plan.activities,
        assessment=final_plan.assessment,
        homework=final_plan.homework,
        language=final_plan.language,
        sidecarVersion=SIDECAR_VERSION,
        latencyMs=latency_ms,
        modelUsed=get_writer_model(),
        cacheHitRatio=metrics.cache_hit_ratio if metrics else None,
        revisionsRun=revisions_run,
        rubric=final_verdict,
    )
