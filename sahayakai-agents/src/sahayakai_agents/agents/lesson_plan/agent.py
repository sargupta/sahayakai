"""ADK `Agent` definitions for the lesson-plan flow.

Phase 3 §3.1: writer + evaluator + reviser triplet that orchestrates
inside the FastAPI router. The orchestration is procedural (Python
loop) rather than ADK `SequentialAgent` because the gate logic
(quality-pass-soft-fail-hard-fail) doesn't map cleanly to ADK's linear
sequence — the hard-fail path needs to short-circuit BEFORE the
reviser even runs.

Three agents:
  - **writer**  — generates a draft from the request
  - **evaluator** — scores the draft (7 floats + bool)
  - **reviser** — produces v2 given v1 + fail reasons

Each is an `LlmAgent` pinned to the same model (default
`gemini-2.5-flash`); the orchestration runs them sequentially through
`google.genai`'s async surface, identically to the parent-call sidecar.

The router (Phase 3.1c) calls `run_lesson_plan_loop(request)` and
gets back a `(LessonPlanCore, EvaluatorVerdict, revisions_run)` tuple.

Cost cap: max 4 model calls (writer + evaluator + reviser +
evaluator-on-v2) per lesson plan.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

from ..._behavioural import (
    _CONFUSABLE_FOLD as _UNUSED,  # noqa: F401 — keeps import-time pybars warm
)
from .schemas import (
    EvaluatorVerdict,
    LessonPlanCore,
)

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


# ---- ADK Agent builders (for future Runner-based paths) ------------------


def build_writer_agent():  # type: ignore[no-untyped-def]
    """Constructs an ADK `Agent` for the writer.

    Local import of `google.adk` so tests that don't exercise ADK
    don't pay the import cost. Same pattern as parent-call's
    `build_reply_agent`.
    """
    from google.adk import Agent

    return Agent(
        name="lesson_plan_writer",
        model=get_writer_model(),
        instruction=load_writer_prompt(),
        tools=[],
    )


def build_evaluator_agent():  # type: ignore[no-untyped-def]
    from google.adk import Agent

    return Agent(
        name="lesson_plan_evaluator",
        model=get_evaluator_model(),
        instruction=load_evaluator_prompt(),
        tools=[],
    )


def build_reviser_agent():  # type: ignore[no-untyped-def]
    from google.adk import Agent

    return Agent(
        name="lesson_plan_reviser",
        model=get_reviser_model(),
        instruction=load_reviser_prompt(),
        tools=[],
    )


# Keep the LessonPlanCore + EvaluatorVerdict imports anchored to this
# module so the router can re-export them as the model contract.
__all__ = [
    "LessonPlanCore",
    "EvaluatorVerdict",
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
]
