"""ADK-style helpers for the VIDYA orchestrator.

VIDYA is a 2-stage flow:

  1. **Classifier** — one Gemini call that returns an
     `IntentClassification` (intent label + extracted params).
  2. **Renderer** — branches on the intent:
     - `instantAnswer` → second Gemini call to produce the inline
       answer text.
     - one of 9 routable flows → no second call; build a
       `VidyaAction(type="NAVIGATE_AND_FILL", ...)` from the
       classifier output.
     - `unknown` → no second call; surface a polite fallback.

Render helpers + classifier gate logic live here. The actual Gemini
calls are wired in `router.py` — Phase 5.4 will replace the canned
stubs with real `google.genai` invocations through `run_resiliently`.

Phase 5 §5.2 deliverable.
See `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

from .schemas import (
    AllowedFlow,
    IntentClassification,
    VidyaAction,
    VidyaActionParams,
)

log = structlog.get_logger(__name__)


# ---- Prompt resolution ---------------------------------------------------

# `parents[4]` from this file resolves to the `sahayakai-agents/` repo
# root, mirroring the lesson-plan agent. The directory contains the
# shared `prompts/vidya/` Handlebars set used by both Node and Python.
_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "vidya"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "vidya"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"VIDYA prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing vidya/."
        )
    return path.read_text(encoding="utf-8")


def load_orchestrator_prompt() -> str:
    """Load the intent-classifier Handlebars template."""
    return _load_prompt("orchestrator.handlebars")


def load_instant_answer_prompt() -> str:
    """Load the inline-answer Handlebars template."""
    return _load_prompt("instant_answer.handlebars")


# ---- pybars3 rendering ---------------------------------------------------

_compiler = pybars.Compiler()


@lru_cache(maxsize=2)
def _compile_orchestrator_template() -> Any:
    """Compile the orchestrator template once and cache."""
    return _compiler.compile(load_orchestrator_prompt())


@lru_cache(maxsize=2)
def _compile_instant_answer_template() -> Any:
    """Compile the instant-answer template once and cache."""
    return _compiler.compile(load_instant_answer_prompt())


def render_orchestrator_prompt(context: dict[str, Any]) -> str:
    """Render the orchestrator prompt against the request context.

    Expected keys:
      - `message`: str
      - `chatHistory`: list[dict] (already serialised, not Pydantic)
      - `currentScreenContext`: dict with `path` and `uiState`
      - `teacherProfile`: dict with optional grade/subject/language/school
      - `detectedLanguage`: str | None
      - `allowedFlows`: list[str] (the 9 routable flow names)
    """
    return str(_compile_orchestrator_template()(context))


def render_instant_answer_prompt(context: dict[str, Any]) -> str:
    """Render the instant-answer prompt against the request context.

    Expected keys:
      - `message`: str — the teacher's question
      - `language`: str | None — BCP-47 or ISO code
      - `teacherProfile`: dict (optional grade/subject/school context)
    """
    return str(_compile_instant_answer_template()(context))


# ---- Intent constants ----------------------------------------------------

INSTANT_ANSWER_INTENT = "instantAnswer"
UNKNOWN_INTENT = "unknown"

# The 9 routable flows. Order matches the `AllowedFlow` Literal in
# `schemas.py` so a static check (`len(ALLOWED_FLOWS) == 9` in tests)
# catches drift between the two.
ALLOWED_FLOWS: list[str] = [
    "lesson-plan",
    "quiz-generator",
    "visual-aid-designer",
    "worksheet-wizard",
    "virtual-field-trip",
    "teacher-training",
    "rubric-generator",
    "exam-paper",
    "video-storyteller",
]


# ---- Action gate ---------------------------------------------------------


def classify_action(intent: IntentClassification) -> VidyaAction | None:
    """Convert an `IntentClassification` to a `VidyaAction` or None.

    Returns:
      - `None` for `instantAnswer` (handled inline) and `unknown`
        (router surfaces a polite fallback).
      - A populated `VidyaAction` for any of the 9 routable flows.
      - `None` defensively for any other (invalid) intent string.
        This is a fail-safe: a bad classifier output should never
        navigate the teacher to a non-existent route.
    """
    if intent.type in (INSTANT_ANSWER_INTENT, UNKNOWN_INTENT):
        return None
    if intent.type not in ALLOWED_FLOWS:
        # Defensive: classifier returned something we don't route.
        log.warning("vidya.classify_action.invalid_intent", intent_type=intent.type)
        return None

    # Cast through the Literal — mypy can't narrow `intent.type` to
    # `AllowedFlow` from a runtime `in` check, so we use the Literal
    # type explicitly for the assignment.
    flow: AllowedFlow = intent.type  # type: ignore[assignment]
    return VidyaAction(
        type="NAVIGATE_AND_FILL",
        flow=flow,
        params=VidyaActionParams(
            topic=intent.topic,
            gradeLevel=intent.gradeLevel,
            subject=intent.subject,
            language=intent.language,
            ncertChapter=None,
        ),
    )


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_orchestrator_model() -> str:
    """Default Gemini variant for the intent classifier.

    VIDYA today (Genkit) uses `gemini-2.0-flash` for speed — the orb is
    a real-time UX surface and 2.5-flash latency would feel laggy.
    Override via `SAHAYAKAI_VIDYA_ORCHESTRATOR_MODEL` to A/B test 2.5.
    """
    return os.environ.get("SAHAYAKAI_VIDYA_ORCHESTRATOR_MODEL", "gemini-2.0-flash")


@lru_cache(maxsize=1)
def get_instant_answer_model() -> str:
    """Default Gemini variant for inline answers.

    Same speed-first reasoning as the orchestrator. Override via
    `SAHAYAKAI_VIDYA_INSTANT_ANSWER_MODEL`.
    """
    return os.environ.get("SAHAYAKAI_VIDYA_INSTANT_ANSWER_MODEL", "gemini-2.0-flash")


__all__ = [
    "ALLOWED_FLOWS",
    "INSTANT_ANSWER_INTENT",
    "UNKNOWN_INTENT",
    "classify_action",
    "get_instant_answer_model",
    "get_orchestrator_model",
    "load_instant_answer_prompt",
    "load_orchestrator_prompt",
    "render_instant_answer_prompt",
    "render_orchestrator_prompt",
]
