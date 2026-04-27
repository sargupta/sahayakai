"""ADK helpers for voice-to-text agent (Phase I).

Single multimodal Gemini call: audio in, structured JSON
(`{ text, language }`) out. The handlebars template carries the
transcription + cleanup + language-detection rubric; the audio bytes
are passed as a separate Gemini `Part`, not inside the template.
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
    Path(__file__).resolve().parents[4] / "prompts" / "voice-to-text"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "voice-to-text"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Voice-to-text prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_transcriber_prompt() -> str:
    return _load_prompt("transcriber.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_transcriber_template() -> Any:
    return _compiler.compile(load_transcriber_prompt())


def render_transcriber_prompt(context: dict[str, Any]) -> str:
    return str(_compile_transcriber_template()(context))


@lru_cache(maxsize=1)
def get_transcriber_model() -> str:
    """Default Gemini variant for the transcription call.

    Multimodal speech-to-text needs the audio-capable Gemini family.
    `gemini-2.0-flash` accepts audio input via `Part.from_bytes` with
    an audio MIME type. Override via `SAHAYAKAI_VOICE_TO_TEXT_MODEL`.
    """
    return os.environ.get(
        "SAHAYAKAI_VOICE_TO_TEXT_MODEL", "gemini-2.0-flash",
    )


__all__ = [
    "get_transcriber_model",
    "load_transcriber_prompt",
    "render_transcriber_prompt",
]
