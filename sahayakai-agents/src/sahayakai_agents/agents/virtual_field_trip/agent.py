"""ADK helpers for virtual field-trip agent (Phase D.3)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "virtual-field-trip"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "virtual-field-trip"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Virtual field-trip prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_planner_prompt() -> str:
    return _load_prompt("planner.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_planner_template() -> Any:
    return _compiler.compile(load_planner_prompt())


def render_planner_prompt(context: dict[str, Any]) -> str:
    return str(_compile_planner_template()(context))


@lru_cache(maxsize=1)
def get_planner_model() -> str:
    return os.environ.get(
        "SAHAYAKAI_VIRTUAL_FIELD_TRIP_MODEL", "gemini-2.0-flash"
    )


__all__ = [
    "get_planner_model",
    "load_planner_prompt",
    "render_planner_prompt",
]
