"""ADK `LoopAgent` definitions for the lesson-plan flow (Phase L.3).

Forensic audit architectural finding #3: this flow ran a procedural
writer→evaluator→classify→reviser→evaluator-on-v2 loop by hand. The
file's own header openly admitted "procedural (Python loop) rather
than ADK ``SequentialAgent``". L.3 replaces that with a real ADK
`LoopAgent` whose three sub-agents own the call-and-store-and-emit
sequence.

ADK `LoopAgent` API (v1.31, what's actually installed — *NOT* the
hypothetical `should_continue` / `escalate_on` callback shape from
the planning brief):

  - Sub-agents run in declared order, then the loop restarts.
  - `max_iterations` caps the number of complete passes.
  - The loop stops early when a sub-agent emits an event whose
    `actions.escalate=True`.
  - There are no `should_continue` / `escalate_on` parameters.

So we encode the gate logic INSIDE the sub-agents themselves:

  - ``WriterSubAgent``: idempotent (reads ``state["lesson_plan_v1"]``;
    if already set, no-ops). On first iteration it generates v1 and
    stores it.
  - ``EvaluatorSubAgent``: scores the latest plan in state, classifies
    the verdict (pass / revise / hard_fail), stores the verdict, then
    emits ``escalate=True`` UNLESS the verdict is ``revise``. So a
    pass / hard_fail terminates the loop after the evaluator; a
    revise lets the loop continue to the reviser.
  - ``ReviserSubAgent``: reads v1 + last verdict's fail_reasons,
    generates v2, stores it. The next iteration's evaluator sees
    v2 (not v1) and ALWAYS escalates because we've used our 1
    revision budget.

Top-level shape:

    LoopAgent(
        sub_agents=[writer, evaluator, reviser],
        max_iterations=2,
    )

Iteration 1: writer (call 1) → evaluator (call 2) → if revise, reviser
(call 3). If evaluator escalates (pass / hard_fail), loop ends.
Iteration 2: writer (no-op, v1 cached) → evaluator on v2 (call 4) →
ALWAYS escalates. Reviser would skip (escalate=True) but loop already
ended after evaluator.

Cost cap remains at most 4 model calls per request — same as the
old procedural loop. The hard-fail short-circuit (no reviser run)
is preserved.

State keys used through the run (all stored on
``ctx.session.state`` via ``EventActions.state_delta``):

  - ``lesson_plan_v1``: ``LessonPlanCore`` JSON (writer output)
  - ``lesson_plan_v2``: ``LessonPlanCore`` JSON (reviser output, if
    reviser ran)
  - ``lesson_plan_verdict_v1``: ``EvaluatorVerdict`` JSON
  - ``lesson_plan_verdict_v2``: ``EvaluatorVerdict`` JSON (only set
    if the loop progresses to evaluator-on-v2)
  - ``lesson_plan_decision``: classification string (pass / revise /
    hard_fail) of the LATEST verdict — the router reads this to
    decide what to ship.
  - ``lesson_plan_request``: the dict the router pre-populated (used
    by sub-agents to render prompts and run the resilience layer).
  - ``lesson_plan_api_keys``: tuple of API keys.
  - ``lesson_plan_settings``: settings object (telephony budget).

The router seeds the request / api_keys / settings into the session
state BEFORE invoking the LoopAgent's Runner.

Phase L.3 deliverable. See
``sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md``.
"""
from __future__ import annotations

import os
from collections.abc import AsyncGenerator
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from ..._behavioural import (
    _CONFUSABLE_FOLD as _UNUSED,  # noqa: F401 — keeps import-time pybars warm
)
from ...resilience import run_resiliently
from ...shared.errors import AgentError
from .schemas import (
    EvaluatorVerdict,
    LessonPlanCore,
    LessonPlanRequest,
)

if TYPE_CHECKING:
    from google.adk.agents import LoopAgent
    from google.adk.agents.base_agent import BaseAgent
    from google.adk.agents.invocation_context import InvocationContext
    from google.adk.events.event import Event

log = structlog.get_logger(__name__)


# ---- Prompt resolution ----------------------------------------------------

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "lesson-plan"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "lesson-plan"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Lesson-plan prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing lesson-plan/."
        )
    return path.read_text(encoding="utf-8")


def load_writer_prompt() -> str:
    return _load_prompt("writer.handlebars")


def load_evaluator_prompt() -> str:
    return _load_prompt("evaluator.handlebars")


def load_reviser_prompt() -> str:
    return _load_prompt("reviser.handlebars")


# ---- pybars3 rendering ----------------------------------------------------

_compiler = pybars.Compiler()


@lru_cache(maxsize=3)
def _compiled(template_name: str) -> Any:
    if template_name == "writer":
        source = load_writer_prompt()
    elif template_name == "evaluator":
        source = load_evaluator_prompt()
    elif template_name == "reviser":
        source = load_reviser_prompt()
    else:
        raise ValueError(f"Unknown lesson-plan template name: {template_name!r}")
    return _compiler.compile(source)


def render_writer_prompt(context: dict[str, Any]) -> str:
    """Render the writer prompt against the request context."""
    return str(_compiled("writer")(context))


def render_evaluator_prompt(context: dict[str, Any]) -> str:
    """Render the evaluator prompt with the request + draft plan."""
    return str(_compiled("evaluator")(context))


def render_reviser_prompt(context: dict[str, Any]) -> str:
    """Render the reviser prompt with v1 + fail reasons + request."""
    return str(_compiled("reviser")(context))


# ---- Model selection ------------------------------------------------------


@lru_cache(maxsize=1)
def get_writer_model() -> str:
    """Default Gemini variant for the writer. Flash is cheap + accurate
    for structured output."""
    return os.environ.get("SAHAYAKAI_LESSON_PLAN_WRITER_MODEL", "gemini-2.5-flash")


@lru_cache(maxsize=1)
def get_evaluator_model() -> str:
    """The evaluator can use the same Flash model — calibration target
    is human grades within ±0.10 MAE per the plan §3.0. If MAE comes
    in higher than that, switch to gemini-2.5-pro via env override."""
    return os.environ.get("SAHAYAKAI_LESSON_PLAN_EVALUATOR_MODEL", "gemini-2.5-flash")


@lru_cache(maxsize=1)
def get_reviser_model() -> str:
    """Reviser uses Flash — same model family the writer used so
    revision style stays consistent."""
    return os.environ.get("SAHAYAKAI_LESSON_PLAN_REVISER_MODEL", "gemini-2.5-flash")


# ---- Pass / fail / revise gate logic --------------------------------------


# §Pedagogical Rubric: pass requires all of these.
QUALITY_PASS_THRESHOLD = 0.80
QUALITY_PASS_AXIS_COUNT = 6  # at least 6 of 7 axes ≥ pass threshold
QUALITY_HARD_FAIL_AXIS_COUNT = 4  # if FEWER than this many axes pass → hard fail


def classify_verdict(verdict: EvaluatorVerdict) -> str:
    """Apply the §Gate logic to an `EvaluatorVerdict`.

    Returns one of: `"pass"`, `"revise"`, `"hard_fail"`.

    - Hard-fail: `safety == false` (regardless of quality scores) OR
      fewer than 4 of 7 quality axes ≥ 0.80
    - Pass: `safety == true` AND ≥ 6 of 7 quality axes ≥ 0.80
    - Revise (soft-fail): `safety == true` AND quality gate not met
      but at least 4 axes pass

    Round-2 audit P1 PLAN-3 fix: safety is a separate boolean, not
    a float-with-1.0-only gate. Eliminates the safety=0.99 edge case.
    """
    scores = verdict.scores.model_dump()
    n_passing = sum(1 for v in scores.values() if v >= QUALITY_PASS_THRESHOLD)

    if not verdict.safety:
        return "hard_fail"
    if n_passing < QUALITY_HARD_FAIL_AXIS_COUNT:
        return "hard_fail"
    if n_passing >= QUALITY_PASS_AXIS_COUNT:
        return "pass"
    return "revise"


# ---- Per-call Gemini wiring (state-driven, run inside ADK sub-agents) ----


# Per-call timeout. Lesson plan generates a full multi-section JSON
# document so 30s gives enough room for a slow attempt while still
# preventing a hung call from blocking the route until the SDK's
# ~600s default.
_PER_CALL_TIMEOUT_S = 30.0


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
) -> Any:
    """One Gemini call with structured JSON output.

    Identical pattern to the old router-level helper. Kept inside the
    agent module now so each sub-agent can run its own resilient call
    without the router needing to know about Gemini at all.
    """
    from google import genai  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

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


# ---- ADK sub-agents (BaseAgent subclasses driving each phase) ------------
#
# Why custom BaseAgent instead of LlmAgent + output_schema:
#   1. Existing call path uses run_resiliently for key-pool failover,
#      per-call timeout, telephony backoff. Replicating that inside an
#      LlmAgent would mean rebuilding all of resilience.py against
#      ADK's BaseLlm contract, which Phase L.3 is not the place for.
#   2. The state-aware gate logic (skip if already done; escalate on
#      pass / hard_fail) wants direct event emission, which BaseAgent
#      gives us cleanly via _run_async_impl.
#   3. The mocked `google.genai.Client` path the integration tests
#      already use keeps working unchanged.


def _build_writer_sub_agent() -> BaseAgent:
    """Sub-agent that produces v1 from the writer prompt template.

    Idempotent: if ``state["lesson_plan_v1"]`` is already set, the
    sub-agent yields a no-op event (without calling Gemini). This
    matters because LoopAgent re-runs the full sub_agents sequence on
    iteration 2, but we only want writer to fire once.
    """
    from google.adk.agents.base_agent import BaseAgent  # noqa: PLC0415
    from google.adk.events.event import Event  # noqa: PLC0415
    from google.adk.events.event_actions import EventActions  # noqa: PLC0415

    class _WriterSubAgent(BaseAgent):
        async def _run_async_impl(
            self, ctx: InvocationContext
        ) -> AsyncGenerator[Event, None]:
            state = ctx.session.state
            if state.get("lesson_plan_v1") is not None:
                # Iteration 2 (or later): writer already produced v1
                # and we have a v2 candidate from the reviser. Skip.
                yield Event(
                    invocation_id=ctx.invocation_id,
                    author=self.name,
                    branch=ctx.branch,
                )
                return

            request_dict = state["lesson_plan_request"]
            api_keys = state["lesson_plan_api_keys"]
            settings = state["lesson_plan_settings"]
            request = LessonPlanRequest.model_validate(request_dict)

            prompt = render_writer_prompt(_request_to_render_dict(request))
            model = get_writer_model()

            async def _do(api_key: str) -> Any:
                return await _call_gemini_structured(
                    api_key=api_key,
                    model=model,
                    prompt=prompt,
                    response_schema=LessonPlanCore,
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
                plan = LessonPlanCore.model_validate_json(text)
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

            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                actions=EventActions(
                    state_delta={"lesson_plan_v1": plan.model_dump(mode="json")},
                ),
            )

    return _WriterSubAgent(name="lesson_plan_writer")


def _build_evaluator_sub_agent() -> BaseAgent:
    """Sub-agent that scores the latest plan and gates the loop.

    Reads ``state["lesson_plan_v2"]`` if present; falls back to
    ``state["lesson_plan_v1"]``. Stores its verdict to a key suffixed
    with the version it scored. Sets ``state["lesson_plan_decision"]``
    to the classification.

    Emits ``escalate=True`` when the loop should stop:
      - ``pass`` or ``hard_fail`` on v1 → escalate.
      - ANY decision on v2 → escalate (we've used our 1-revision
        budget; the router decides what to ship via the never-amplify
        rule).
    """
    from google.adk.agents.base_agent import BaseAgent  # noqa: PLC0415
    from google.adk.events.event import Event  # noqa: PLC0415
    from google.adk.events.event_actions import EventActions  # noqa: PLC0415

    class _EvaluatorSubAgent(BaseAgent):
        async def _run_async_impl(
            self, ctx: InvocationContext
        ) -> AsyncGenerator[Event, None]:
            state = ctx.session.state
            v2 = state.get("lesson_plan_v2")
            v1 = state.get("lesson_plan_v1")
            target_dict = v2 if v2 is not None else v1
            if target_dict is None:
                # Defensive: writer should always have run first.
                raise AgentError(
                    code="INTERNAL",
                    message="Evaluator invoked before writer produced a plan",
                    http_status=502,
                )
            scoring_v2 = v2 is not None

            request_dict = state["lesson_plan_request"]
            api_keys = state["lesson_plan_api_keys"]
            settings = state["lesson_plan_settings"]
            request = LessonPlanRequest.model_validate(request_dict)
            plan = LessonPlanCore.model_validate(target_dict)

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
                verdict = EvaluatorVerdict.model_validate_json(text)
            except Exception as exc:
                log.error(
                    "lesson_plan.evaluator.json_parse_failed",
                    raw_excerpt=text[:200],
                    error=str(exc),
                )
                raise AgentError(
                    code="INTERNAL",
                    message=(
                        "Evaluator returned text that does not match "
                        "EvaluatorVerdict"
                    ),
                    http_status=502,
                ) from exc

            decision = classify_verdict(verdict)
            verdict_key = (
                "lesson_plan_verdict_v2" if scoring_v2 else "lesson_plan_verdict_v1"
            )
            state_delta: dict[str, object] = {
                verdict_key: verdict.model_dump(mode="json"),
                "lesson_plan_decision": decision,
            }

            # Escalation policy:
            #   - On v1: only `revise` allows the loop to continue
            #     (writer-as-no-op → reviser → next iter evaluator).
            #     `pass` / `hard_fail` terminate immediately.
            #   - On v2: ALWAYS escalate. We've used our budget; the
            #     router applies the "never amplify" rule.
            should_escalate = scoring_v2 or decision != "revise"

            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                actions=EventActions(
                    state_delta=state_delta,
                    escalate=True if should_escalate else None,
                ),
            )

    return _EvaluatorSubAgent(name="lesson_plan_evaluator")


def _build_reviser_sub_agent() -> BaseAgent:
    """Sub-agent that revises v1 → v2 given the evaluator's reasons.

    Idempotent: if ``state["lesson_plan_v2"]`` is already set, no-op.
    Reads ``state["lesson_plan_v1"]`` + ``state["lesson_plan_verdict_v1"]``
    to render the prompt. The reviser only ever runs ONCE per request
    (max 1 revision); the no-op guard exists so a future change that
    bumps ``max_iterations`` cannot accidentally produce a v3.
    """
    from google.adk.agents.base_agent import BaseAgent  # noqa: PLC0415
    from google.adk.events.event import Event  # noqa: PLC0415
    from google.adk.events.event_actions import EventActions  # noqa: PLC0415

    class _ReviserSubAgent(BaseAgent):
        async def _run_async_impl(
            self, ctx: InvocationContext
        ) -> AsyncGenerator[Event, None]:
            state = ctx.session.state
            if state.get("lesson_plan_v2") is not None:
                yield Event(
                    invocation_id=ctx.invocation_id,
                    author=self.name,
                    branch=ctx.branch,
                )
                return

            v1_dict = state.get("lesson_plan_v1")
            verdict_v1_dict = state.get("lesson_plan_verdict_v1")
            if v1_dict is None or verdict_v1_dict is None:
                # Defensive: the evaluator should have populated both
                # before the reviser ever runs. If not, fail closed.
                raise AgentError(
                    code="INTERNAL",
                    message=(
                        "Reviser invoked before writer/evaluator "
                        "populated v1 state"
                    ),
                    http_status=502,
                )

            request_dict = state["lesson_plan_request"]
            api_keys = state["lesson_plan_api_keys"]
            settings = state["lesson_plan_settings"]
            request = LessonPlanRequest.model_validate(request_dict)
            plan_v1 = LessonPlanCore.model_validate(v1_dict)
            verdict_v1 = EvaluatorVerdict.model_validate(verdict_v1_dict)

            context = {
                "plan": plan_v1.model_dump_json(),
                "request": request.model_dump_json(exclude_none=True),
                "fail_reasons": list(verdict_v1.fail_reasons),
            }
            prompt = render_reviser_prompt(context)
            model = get_reviser_model()

            async def _do(api_key: str) -> Any:
                return await _call_gemini_structured(
                    api_key=api_key,
                    model=model,
                    prompt=prompt,
                    response_schema=LessonPlanCore,
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
                plan_v2 = LessonPlanCore.model_validate_json(text)
            except Exception as exc:
                log.error(
                    "lesson_plan.reviser.json_parse_failed",
                    raw_excerpt=text[:200],
                    error=str(exc),
                )
                raise AgentError(
                    code="INTERNAL",
                    message=(
                        "Reviser returned text that does not match "
                        "LessonPlanCore"
                    ),
                    http_status=502,
                ) from exc

            yield Event(
                invocation_id=ctx.invocation_id,
                author=self.name,
                branch=ctx.branch,
                actions=EventActions(
                    state_delta={
                        "lesson_plan_v2": plan_v2.model_dump(mode="json"),
                    },
                ),
            )

    return _ReviserSubAgent(name="lesson_plan_reviser")


# ---- Top-level LoopAgent factory -----------------------------------------


@lru_cache(maxsize=1)
def build_lesson_plan_agent() -> LoopAgent:
    """Build the lesson-plan flow as an ADK ``LoopAgent``.

    Top-level shape:

        LoopAgent(
            sub_agents=[writer, evaluator, reviser],
            max_iterations=2,
        )

    Iteration 1: writer → evaluator → (if revise) reviser.
    Iteration 2: writer (no-op) → evaluator on v2 → escalate exits.

    Cached via ``lru_cache(maxsize=1)``: the agent template is reused
    across requests, but each call gets a fresh session via the
    Runner, so per-request state never leaks. Sub-agent state (the
    plan / verdict deltas) lives on the per-call session.
    """
    from google.adk.agents import LoopAgent  # noqa: PLC0415

    return LoopAgent(
        name="lesson_plan_loop",
        sub_agents=[
            _build_writer_sub_agent(),
            _build_evaluator_sub_agent(),
            _build_reviser_sub_agent(),
        ],
        max_iterations=2,
    )


# Public builder names that mirror the (cached) sub-agent factories so
# unit tests can introspect the shapes without touching ADK directly.
build_writer_agent = _build_writer_sub_agent
build_evaluator_agent = _build_evaluator_sub_agent
build_reviser_agent = _build_reviser_sub_agent


# ---- Render helper used by the writer sub-agent --------------------------


def _request_to_render_dict(request: LessonPlanRequest) -> dict[str, Any]:
    """Convert a sanitized request into a Handlebars-friendly dict.

    Drops `None` values so the template's ``{{#if x}}`` blocks behave
    correctly. Mirrors the pre-L.3 ``_request_to_dict`` in the router
    (sans the sanitize step — sanitization happens in the router
    before the request goes into session state, so by the time this
    runs everything user-controlled is already escaped).
    """
    raw = request.model_dump(exclude_none=True)
    raw.setdefault("useRuralContext", True)
    raw.setdefault("language", "en")
    raw.setdefault("gradeLevels", [])
    return raw


# Keep the LessonPlanCore + EvaluatorVerdict imports anchored to this
# module so the router can re-export them as the model contract.
__all__ = [
    "LessonPlanCore",
    "EvaluatorVerdict",
    "build_lesson_plan_agent",
    "build_writer_agent",
    "build_evaluator_agent",
    "build_reviser_agent",
    "classify_verdict",
    "get_writer_model",
    "get_evaluator_model",
    "get_reviser_model",
    "render_writer_prompt",
    "render_evaluator_prompt",
    "render_reviser_prompt",
    "QUALITY_HARD_FAIL_AXIS_COUNT",
    "QUALITY_PASS_AXIS_COUNT",
    "QUALITY_PASS_THRESHOLD",
]
