"""FastAPI sub-router for the lesson-plan agent.

Phase 3 §3.1c. The procedural orchestration:

    write → evaluate → classify_verdict
        if pass:        return v1
        if hard_fail:   raise (route returns canned safe response)
        if revise:      revise → evaluate-on-v2 → return whichever
                        v ranks higher (per "never amplify" rule)

Every model call goes through `run_resiliently` so the same retry +
key-rotation + telephony-bounded backoff applies as parent-call.

Cost cap enforced procedurally: max 4 calls (writer + 2 evaluators +
1 reviser). The cap is implicit — the loop literally cannot make a
fifth call.
"""
from __future__ import annotations

import time
from typing import Any

import structlog
from fastapi import APIRouter

from ..._behavioural import assert_lesson_plan_rules
from ...config import get_settings
from ...resilience import extract_cache_metrics, run_resiliently
from ...shared.errors import AgentError, AISafetyBlockError
from ...shared.prompt_safety import sanitize, sanitize_list, sanitize_optional
from .agent import (
    classify_verdict,
    get_evaluator_model,
    get_reviser_model,
    get_writer_model,
    render_evaluator_prompt,
    render_reviser_prompt,
    render_writer_prompt,
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
SIDECAR_VERSION = "phase-3.1.0"

# Per-call timeout for run_resiliently. Lesson plan generates a full
# multi-section JSON document so 30s gives enough room for a slow
# attempt while still preventing a hung call from blocking the route
# until the SDK's ~600s default.
_PER_CALL_TIMEOUT_S = 30.0


# ---- Gemini call helper (mirrors parent_call.router) ---------------------


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
) -> Any:
    """One Gemini call with structured JSON output.

    Identical pattern to `parent_call.router._call_gemini_structured`
    — could be extracted to a shared helper, but keeping per-router
    copies keeps the import surface small and the test mocks simple.
    """
    from google import genai
    from google.genai import types as genai_types

    client = genai.Client(api_key=api_key)
    return await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            # Lower temperature for structured output — lesson plans
            # are pedagogical artefacts, not creative writing.
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
    # Default: useRuralContext True if not specified. Mirrors TS
    # default in `LessonPlanInputSchema`.
    raw.setdefault("useRuralContext", True)
    # Default: language "en" if not specified.
    raw.setdefault("language", "en")
    raw.setdefault("gradeLevels", [])
    # Sanitize the user-controlled string fields. Pydantic enforces
    # the bounds (max_length on each field) — sanitize re-bounds
    # using the same caps for defense in depth.
    if "topic" in raw:
        raw["topic"] = sanitize(raw["topic"], max_length=500)
    if "teacherContext" in raw:
        raw["teacherContext"] = sanitize(raw["teacherContext"], max_length=2000)
    if "subject" in raw:
        raw["subject"] = sanitize(raw["subject"], max_length=100)
    if "gradeLevels" in raw and isinstance(raw["gradeLevels"], list):
        raw["gradeLevels"] = sanitize_list(raw["gradeLevels"], max_length=50)
    # `ncertChapter` is a structured object — sanitize its title +
    # learningOutcomes individually if present.
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


# ---- Orchestration loop --------------------------------------------------


async def _run_writer(
    request: LessonPlanRequest, api_keys: tuple[str, ...], settings: Any
) -> LessonPlanCore:
    """Single Gemini call: writer agent."""
    context = _request_to_dict(request)
    prompt = render_writer_prompt(context)
    model = get_writer_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key, model=model, prompt=prompt, response_schema=LessonPlanCore
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="lesson_plan.writer",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return LessonPlanCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "lesson_plan.writer.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Writer returned text that does not match LessonPlanCore",
            http_status=502,
        ) from exc


async def _run_evaluator(
    plan: LessonPlanCore,
    request: LessonPlanRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> EvaluatorVerdict:
    """Single Gemini call: evaluator agent."""
    context = {
        "plan": plan.model_dump_json(),
        "request": request.model_dump_json(exclude_none=True),
    }
    prompt = render_evaluator_prompt(context)
    model = get_evaluator_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=EvaluatorVerdict,
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="lesson_plan.evaluator",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return EvaluatorVerdict.model_validate_json(text)
    except Exception as exc:
        log.error(
            "lesson_plan.evaluator.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Evaluator returned text that does not match EvaluatorVerdict",
            http_status=502,
        ) from exc


async def _run_reviser(
    plan_v1: LessonPlanCore,
    fail_reasons: list[str],
    request: LessonPlanRequest,
    api_keys: tuple[str, ...],
    settings: Any,
) -> LessonPlanCore:
    """Single Gemini call: reviser agent."""
    context = {
        "plan": plan_v1.model_dump_json(),
        "request": request.model_dump_json(exclude_none=True),
        "fail_reasons": fail_reasons,
    }
    prompt = render_reviser_prompt(context)
    model = get_reviser_model()

    async def _do(api_key: str) -> Any:
        return await _call_gemini_structured(
            api_key=api_key, model=model, prompt=prompt, response_schema=LessonPlanCore
        )

    result = await run_resiliently(
        _do,
        api_keys,
        span_name="lesson_plan.reviser",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
        per_call_timeout_seconds=_PER_CALL_TIMEOUT_S,
    )
    text = _extract_text(result)
    try:
        return LessonPlanCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "lesson_plan.reviser.json_parse_failed",
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Reviser returned text that does not match LessonPlanCore",
            http_status=502,
        ) from exc


# ---- Endpoint -----------------------------------------------------------


@router.post("/generate", response_model=LessonPlanResponse)
async def lesson_plan_generate(
    payload: LessonPlanRequest,
) -> LessonPlanResponse:
    """Generate a lesson plan via the writer-evaluator-reviser loop.

    Flow:
        1. Writer → v1
        2. Evaluator on v1 → verdict_v1
        3. classify_verdict(verdict_v1):
             - pass     → return v1
             - hard_fail → raise → route returns canned safe response
             - revise   → continue
        4. Reviser → v2
        5. Evaluator on v2 → verdict_v2
        6. classify_verdict(verdict_v2):
             - pass / revise → return v2 (with verdict_v2)
             - hard_fail     → return v1 (with verdict_v1) per the
                              "never amplify a failed reviser" rule
        7. Behavioural guard on the returned plan. Fail-closed on
           any violation.
    """
    settings = get_settings()
    started = time.monotonic()
    api_keys = settings.genai_keys

    # Step 1: writer
    try:
        plan_v1 = await _run_writer(payload, api_keys, settings)
        verdict_v1 = await _run_evaluator(plan_v1, payload, api_keys, settings)
    except AISafetyBlockError as exc:
        log.warning("lesson_plan.writer.safety_block", reason=str(exc))
        raise

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
        # Revise path: 2 more model calls (reviser + evaluator).
        plan_v2 = await _run_reviser(
            plan_v1, verdict_v1.fail_reasons, payload, api_keys, settings
        )
        verdict_v2 = await _run_evaluator(plan_v2, payload, api_keys, settings)
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

    # Step 7: behavioural guard. Fail-closed.
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
