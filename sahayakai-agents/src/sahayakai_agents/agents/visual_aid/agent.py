"""ADK helpers for visual aid designer (Phase E.3).

Two prompts: image-gen and metadata-text. Both rendered via pybars3.
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
    Path(__file__).resolve().parents[4] / "prompts" / "visual-aid"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "visual-aid"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Visual-aid prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_image_prompt() -> str:
    return _load_prompt("image.handlebars")


def load_metadata_prompt() -> str:
    return _load_prompt("metadata.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=2)
def _compile_template(name: str) -> Any:
    if name == "image":
        source = load_image_prompt()
    elif name == "metadata":
        source = load_metadata_prompt()
    else:
        raise ValueError(f"Unknown visual-aid template: {name!r}")
    return _compiler.compile(source)


def render_image_prompt(context: dict[str, Any]) -> str:
    return str(_compile_template("image")(context))


def render_metadata_prompt(context: dict[str, Any]) -> str:
    return str(_compile_template("metadata")(context))


@lru_cache(maxsize=1)
def get_image_model() -> str:
    """Default image-gen Gemini variant — must support IMAGE response
    modality (3-pro-image-preview as of 2026 Q2)."""
    return os.environ.get(
        "SAHAYAKAI_VISUAL_AID_IMAGE_MODEL", "gemini-3-pro-image-preview",
    )


@lru_cache(maxsize=1)
def get_metadata_model() -> str:
    """Default metadata-text Gemini variant. 2.5-flash gives consistent
    structured output for the metadata block."""
    return os.environ.get(
        "SAHAYAKAI_VISUAL_AID_METADATA_MODEL", "gemini-2.5-flash",
    )


__all__ = [
    "get_image_model",
    "get_metadata_model",
    "load_image_prompt",
    "load_metadata_prompt",
    "render_image_prompt",
    "render_metadata_prompt",
]
