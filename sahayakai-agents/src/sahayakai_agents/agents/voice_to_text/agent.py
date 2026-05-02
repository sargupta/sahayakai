"""ADK helpers for voice-to-text agent (Phase I + Phase L.5).

Single multimodal Gemini call: audio in, structured JSON
(`{ text, language }`) out. The handlebars template carries the
transcription + cleanup + language-detection rubric; the audio bytes
are passed as a separate Gemini `Part`, not inside the template.

Phase L.5 wraps the single stage in an ADK `SequentialAgent` of one
sub-agent. A 1-step SequentialAgent is degenerate but keeps the same
Runner shape as visual-aid + avatar-generator and unlocks easy
addition of a future post-processing step (e.g. profanity filter)
without restructuring the router.

ADK API note: the rubric prompt + audio bytes are passed together as
the `new_message` Content (multipart: text Part + audio Part) — ADK
forwards this to Gemini's `contents=` parameter, matching the pre-L.5
multimodal call shape verbatim. The agent's `instruction` is left empty
because the rubric IS the user prompt (not a system prompt).
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import VoiceToTextCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent, SequentialAgent

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


# ---- ADK SequentialAgent builder ----------------------------------------


@lru_cache(maxsize=1)
def build_transcriber_agent() -> LlmAgent:
    """Multimodal transcription sub-agent.

    `output_schema=VoiceToTextCore` switches Gemini into structured
    JSON output mode (`{text, language}`). `temperature=0.1` matches
    the pre-L.5 router (transcription is deterministic by design).

    The agent's `instruction` is empty — the rendered rubric +
    audio Part are passed together as the `new_message` Content by the
    router. ADK forwards this multipart Content to Gemini's `contents=`
    parameter, preserving the pre-L.5 multimodal call shape.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="voice_to_text_transcriber",
        model=get_transcriber_model(),
        instruction="",
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.1,
        ),
        output_schema=VoiceToTextCore,
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


@lru_cache(maxsize=1)
def build_voice_to_text_agent() -> SequentialAgent:
    """Build the voice-to-text pipeline as a 1-step ADK `SequentialAgent`.

    Degenerate today — single sub-agent. Kept as a SequentialAgent so
    the Runner shape matches visual-aid + avatar-generator and a future
    post-processing step (e.g. profanity filter, dialect correction)
    slots in without router churn.
    """
    from google.adk.agents import SequentialAgent  # noqa: PLC0415

    return SequentialAgent(
        name="voice_to_text_pipeline",
        sub_agents=[build_transcriber_agent()],
    )


__all__ = [
    "build_transcriber_agent",
    "build_voice_to_text_agent",
    "get_transcriber_model",
    "load_transcriber_prompt",
    "render_transcriber_prompt",
]
