"""ADK helpers for exam paper generator (Phase E.2)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "exam-paper"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "exam-paper"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Exam-paper prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    return str(_compile_generator_template()(context))


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant. Exam paper output is large + structured;
    2.0-flash handles it but 2.5 may produce better blueprints. Override
    via env to A/B."""
    return os.environ.get("SAHAYAKAI_EXAM_PAPER_MODEL", "gemini-2.5-flash")


__all__ = [
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
