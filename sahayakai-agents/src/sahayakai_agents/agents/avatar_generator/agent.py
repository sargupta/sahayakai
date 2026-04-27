"""ADK helpers for avatar generator agent (Phase F.2).

Single image-generation call. No metadata text. Storage write stays in
the Next.js flow because the sidecar has no Storage credentials.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "avatar-generator"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "avatar-generator"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Avatar-generator prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_portrait_prompt() -> str:
    return _load_prompt("portrait.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_portrait_template() -> Any:
    return _compiler.compile(load_portrait_prompt())


def render_portrait_prompt(context: dict[str, Any]) -> str:
    return str(_compile_portrait_template()(context))


@lru_cache(maxsize=1)
def get_image_model() -> str:
    """Avatar uses the same Gemini image model as visual-aid by default."""
    return os.environ.get(
        "SAHAYAKAI_AVATAR_MODEL", "gemini-2.5-flash-image",
    )


__all__ = [
    "get_image_model",
    "load_portrait_prompt",
    "render_portrait_prompt",
]
