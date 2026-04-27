"""ADK-style helpers for the instant-answer agent.

Phase 6 §6.2. Single-stage flow:

  1. **Answerer** — one Gemini call with `Google Search` grounding
     enabled. Returns structured output matching `InstantAnswerCore`.

Why ADK over Genkit for this one flow:
  - **Real tool-use**: Genkit's `googleSearch` tool is currently mocked
    (returns canned strings). The Python migration uses Gemini's
    *native* `Google Search` grounding, which gives the model live
    web access through the same call surface as parent-call /
    lesson-plan / vidya. The wire contract stays identical.
  - **Shared resilience**: rotates through the same key pool +
    telephony-bounded backoff as the other ADK agents.
  - **Schema-first**: structured output enforced via google-genai's
    `response_schema=InstantAnswerCore` rather than a separate
    schema-validation step.

See `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)


# ---- Prompt resolution ---------------------------------------------------

# `parents[4]` from this file resolves to the `sahayakai-agents/` repo
# root, mirroring the lesson-plan / vidya agents.
_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "instant-answer"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "instant-answer"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Instant-answer prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing instant-answer/."
        )
    return path.read_text(encoding="utf-8")


def load_answerer_prompt() -> str:
    """Load the answerer Handlebars template."""
    return _load_prompt("answerer.handlebars")


# ---- pybars3 rendering ---------------------------------------------------

_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_answerer_template() -> Any:
    """Compile the answerer template once and cache."""
    return _compiler.compile(load_answerer_prompt())


def render_answerer_prompt(context: dict[str, Any]) -> str:
    """Render the answerer prompt against the request context.

    Expected keys:
      - `question`: str — the teacher's question (already length-capped)
      - `language`: str | None — BCP-47 / ISO code, normalised upstream
      - `gradeLevel`: str | None — e.g. "Class 5", normalised upstream
      - `subject`: str | None — e.g. "Science"
    """
    return str(_compile_answerer_template()(context))


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_answerer_model() -> str:
    """Default Gemini variant for the instant-answer agent.

    Matches the existing Genkit flow's `gemini-2.0-flash` default for
    speed — instant-answer is a synchronous teacher-facing surface and
    p95 latency directly affects perceived UX. Override via
    `SAHAYAKAI_INSTANT_ANSWER_MODEL` to A/B test 2.5.
    """
    return os.environ.get("SAHAYAKAI_INSTANT_ANSWER_MODEL", "gemini-2.0-flash")


__all__ = [
    "get_answerer_model",
    "load_answerer_prompt",
    "render_answerer_prompt",
]
