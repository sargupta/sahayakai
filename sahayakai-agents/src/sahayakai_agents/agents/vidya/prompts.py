"""Prompt loading + Handlebars rendering for VIDYA (Phase L.1).

Split out of `agent.py` so the supervisor builder there can stay
small and focused on ADK construct wiring. This module owns:

- Path resolution for the shared `prompts/vidya/` Handlebars set.
- Reading `orchestrator.handlebars` and `instant_answer.handlebars`
  off disk (with `SAHAYAKAI_PROMPTS_DIR` override).
- Compiling each template once via pybars3 and caching.
- Rendering against a context dict.

Plus the intent string constants — they live with the prompts because
the prompt template references them (the orchestrator output's `type`
is one of the 9 routable flows + `instantAnswer` + `unknown`).

Phase L.1 deliverable. See
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars

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


__all__ = [
    "ALLOWED_FLOWS",
    "INSTANT_ANSWER_INTENT",
    "UNKNOWN_INTENT",
    "load_instant_answer_prompt",
    "load_orchestrator_prompt",
    "render_instant_answer_prompt",
    "render_orchestrator_prompt",
]
