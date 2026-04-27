"""ADK helpers for video storyteller agent (Phase F.1)."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "video-storyteller"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "video-storyteller"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Video-storyteller prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_recommender_prompt() -> str:
    return _load_prompt("recommender.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_recommender_template() -> Any:
    return _compiler.compile(load_recommender_prompt())


def render_recommender_prompt(context: dict[str, Any]) -> str:
    return str(_compile_recommender_template()(context))


@lru_cache(maxsize=1)
def get_recommender_model() -> str:
    return os.environ.get(
        "SAHAYAKAI_VIDEO_STORYTELLER_MODEL", "gemini-2.0-flash",
    )


__all__ = [
    "get_recommender_model",
    "load_recommender_prompt",
    "render_recommender_prompt",
]
