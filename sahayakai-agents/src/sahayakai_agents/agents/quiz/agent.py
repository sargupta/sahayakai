"""ADK helpers for quiz generator (Phase E.1)."""
from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars
import structlog

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "quiz"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "quiz"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Quiz prompt missing: {path}")
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
    return os.environ.get("SAHAYAKAI_QUIZ_MODEL", "gemini-2.0-flash")


# ---- Optional data URI parsing ------------------------------------------

_DATA_URI_RE = re.compile(
    r"^data:(?P<mime>[^;,]+)(?:;[^;,]+)*;base64,(?P<body>.+)$",
    re.DOTALL,
)


class InvalidDataURIError(ValueError):
    """Raised when an imageDataUri does not parse correctly."""


def parse_data_uri_optional(
    data_uri: str | None,
) -> tuple[str, bytes] | None:
    """Decode a data URI to (mime, bytes), or return None if not provided.

    Raises `InvalidDataURIError` only when the URI is non-empty but
    malformed.
    """
    if not data_uri:
        return None
    match = _DATA_URI_RE.match(data_uri)
    if not match:
        raise InvalidDataURIError(
            "imageDataUri does not match data:<mime>;base64,<body> format",
        )
    mime = match.group("mime").strip().lower()
    body = match.group("body").strip()
    if not mime.startswith("image/"):
        raise InvalidDataURIError(
            f"imageDataUri MIME type must be image/*; got {mime!r}",
        )
    try:
        decoded = base64.b64decode(body, validate=True)
    except Exception as exc:
        raise InvalidDataURIError(
            f"imageDataUri base64 decode failed: {exc}",
        ) from exc
    if not decoded:
        raise InvalidDataURIError("imageDataUri body decoded to empty bytes")
    return mime, decoded


__all__ = [
    "InvalidDataURIError",
    "get_generator_model",
    "load_generator_prompt",
    "parse_data_uri_optional",
    "render_generator_prompt",
]
