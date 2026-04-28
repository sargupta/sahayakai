"""ADK helpers for worksheet wizard agent (Phase D.4)."""
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
    Path(__file__).resolve().parents[4] / "prompts" / "worksheet"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "worksheet"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Worksheet prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_wizard_prompt() -> str:
    return _load_prompt("wizard.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_wizard_template() -> Any:
    return _compiler.compile(load_wizard_prompt())


def render_wizard_prompt(context: dict[str, Any]) -> str:
    return str(_compile_wizard_template()(context))


@lru_cache(maxsize=1)
def get_wizard_model() -> str:
    """Default Gemini variant. Multimodal so we use 2.0-flash (which
    handles vision well) by default. Override via env."""
    return os.environ.get("SAHAYAKAI_WORKSHEET_MODEL", "gemini-2.5-flash")


# ---- Data URI parsing ----------------------------------------------------

_DATA_URI_RE = re.compile(
    r"^data:(?P<mime>[^;,]+)(?:;[^;,]+)*;base64,(?P<body>.+)$",
    re.DOTALL,
)


class InvalidDataURIError(ValueError):
    """Raised when an imageDataUri does not parse correctly."""


def parse_data_uri(data_uri: str) -> tuple[str, bytes]:
    """Decode a `data:<mime>;base64,<body>` URI to (mime, bytes).

    Raises `InvalidDataURIError` for any parse failure.
    """
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
    "get_wizard_model",
    "load_wizard_prompt",
    "parse_data_uri",
    "render_wizard_prompt",
]
