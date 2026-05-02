"""ADK helpers for the rubric-generator agent (Phase D.1)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "rubric"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "rubric"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Rubric prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing rubric/."
        )
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    """Render the rubric-generator prompt.

    Expected keys: assignmentDescription, gradeLevel, subject,
    language, teacherContext (any can be None).
    """
    return str(_compile_generator_template()(context))


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant for the rubric generator.

    Matches the existing Genkit flow's `gemini-2.0-flash`. The schema
    is structured + bounded so 2.0-flash handles it well; override
    via `SAHAYAKAI_RUBRIC_MODEL` for A/B.
    """
    return os.environ.get("SAHAYAKAI_RUBRIC_MODEL", "gemini-2.5-flash")


__all__ = [
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
