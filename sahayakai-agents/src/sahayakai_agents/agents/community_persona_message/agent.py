"""ADK helpers for the community-persona-message agent.

Single Gemini call:
  - render Handlebars prompt (pybars3)
  - **plain-text output** (NOT structured JSON) — matches the TS flow's
    deliberate choice. Gemini 2.5-flash returns null disproportionately
    often on tiny single-field JSON schemas with tight character bounds.
  - moderate-high temperature (0.85) for prose variety so every demo
    persona doesn't sound identical.

The router applies the same string cleanup the TS flow does (strip
code-fences, surrounding quotes, leading "Name:" prefix, hard-cap at
240 chars at a word boundary).
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent


_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4]
    / "prompts"
    / "community-persona-message"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "community-persona-message"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Community-persona-message prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing "
            "community-persona-message/."
        )
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    """Render the persona-message generator prompt.

    Expected keys: personaName, personaState, personaSubject,
    personaGradeLevel, personaVoiceTone, preferredLanguage,
    yearsExperience, recentBlock (pre-rendered string), mode,
    modeInstruction (pre-resolved sentence for the chosen mode).
    """
    return str(_compile_generator_template()(context))


# Mode → instruction sentence map. Server-side so the wire request
# cannot inject "ignore previous, write spam" via mode-instruction
# manipulation (the TS flow inlined these in the prompt builder).
MODE_INSTRUCTION: dict[str, str] = {
    "reply": (
        "directly reply to the most recent message above. Mention "
        "the previous teacher by first name if natural."
    ),
    "fresh": (
        "start a new thought. Do NOT reference recent messages."
    ),
    "auto": (
        "your call — reply if it feels organic, otherwise post fresh."
    ),
}


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant for the persona-message generator.

    Matches the TS flow's `gemini-2.5-flash` choice. Override via
    `SAHAYAKAI_COMMUNITY_PERSONA_MODEL` for A/B.
    """
    return os.environ.get(
        "SAHAYAKAI_COMMUNITY_PERSONA_MODEL", "gemini-2.5-flash",
    )


# ---- ADK LlmAgent builder ------------------------------------------------


@lru_cache(maxsize=1)
def build_community_persona_message_agent() -> LlmAgent:
    """Build the persona-message generator as an ADK `LlmAgent`.

    - `name="community_persona_message_generator"` — snake_case (ADK
      1.31's Pydantic identifier validator rejects hyphens).
    - `model` is the env-overridable string from `get_generator_model()`.
      The router swaps in a per-call key-pinned `Gemini` via
      `_KeyedGemini` just before `Runner.run_async`.
    - `instruction=""` — rendered Handlebars prompt is passed as
      `new_message` Content, NOT as `instruction`.
    - **NO `output_schema`** — the TS flow deliberately uses plain
      text. Gemini 2.5-flash returns null too often on tiny single-
      field JSON schemas with character bounds. The router parses the
      raw text from the final event and applies the same cleanup
      pipeline the TS flow does.
    - `generate_content_config.temperature=0.85` — same value the TS
      flow uses. High prose variety so personas don't sound identical.
    - `generate_content_config.max_output_tokens=220` — matches TS.
    - `sub_agents=[]` + `tools=[]` — single-call agent, no delegation.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="community_persona_message_generator",
        model=get_generator_model(),
        instruction="",
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.85,
            max_output_tokens=220,
        ),
        sub_agents=[],
        tools=[],
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


__all__ = [
    "MODE_INSTRUCTION",
    "build_community_persona_message_agent",
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
