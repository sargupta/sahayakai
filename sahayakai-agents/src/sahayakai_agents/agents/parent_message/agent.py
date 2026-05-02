"""ADK helpers for the parent-message-generator agent.

Phase C §C.2 (router) + Phase U.alpha (ADK promotion). Single Gemini call:
  - render Handlebars prompt (pybars3, byte-identical to Node Handlebars)
  - structured-output JSON matching `ParentMessageCore`
  - light prose temperature so messages don't all read identically

The hardcoded reason → context map and BCP-47 language map live here
(rather than the prompt) so they can't be overridden by a malicious
`reasonContext` field in the wire request.

Phase U.alpha: `build_parent_message_agent()` returns a real
`google.adk.agents.LlmAgent`. The router invokes it via `Runner.run_async`
through `_run_pipeline_via_runner` (mirrors L.1 vidya). Wire shape +
behavioural guard + retry semantics all unchanged.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import ParentMessageCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent


# ---- Hardcoded maps (defence against injection / hallucination) ---------

# Reason → canonical guidance string. The wire request's `reasonContext`
# is IGNORED by the router and rewritten from this map before rendering.
REASON_CONTEXT: dict[str, str] = {
    "consecutive_absences": (
        "The student has been absent for multiple consecutive school days. "
        "Express genuine concern for the student's well-being, ask if "
        "everything is okay at home, and invite the parent to reach out. "
        "Be warm, not accusatory."
    ),
    "poor_performance": (
        "The student's academic performance has recently declined. Focus "
        "on offering support — mention that you want to work together to "
        "help the student succeed. Do NOT blame the student or parent."
    ),
    "behavioral_concern": (
        "There has been a behavioral concern in class. Approach this "
        "delicately — acknowledge the student's positive qualities, "
        "describe the concern objectively without exaggerating, and ask "
        "the parent to have a gentle conversation at home."
    ),
    "positive_feedback": (
        "Share a positive achievement or behavior. This message should be "
        "warm, celebratory, and brief. Encourage the parent to praise the "
        "student at home."
    ),
}

# Language name → BCP-47 code. The wire response's `languageCode` is
# OVERWRITTEN from this map regardless of what the model returns.
# Defends against model hallucination and matches the existing Genkit
# flow's behaviour exactly.
LANGUAGE_TO_BCP47: dict[str, str] = {
    "English": "en-IN",
    "Hindi": "hi-IN",
    "Tamil": "ta-IN",
    "Telugu": "te-IN",
    "Kannada": "kn-IN",
    "Malayalam": "ml-IN",
    "Bengali": "bn-IN",
    "Marathi": "mr-IN",
    "Gujarati": "gu-IN",
    "Punjabi": "pa-IN",
    "Odia": "or-IN",
}

# Two-letter ISO map for the behavioural script-match check. Maps
# the Genkit-style language NAME to the existing `_behavioural` helper's
# expected ISO code.
LANGUAGE_TO_ISO: dict[str, str] = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Bengali": "bn",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Odia": "or",
}


# ---- Prompt resolution ---------------------------------------------------

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "parent-message"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "parent-message"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Parent-message prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing parent-message/."
        )
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    """Load the parent-message generator Handlebars template."""
    return _load_prompt("generator.handlebars")


# ---- pybars3 rendering ---------------------------------------------------

_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    """Render the parent-message generator prompt.

    Expected keys in `context`:
      - studentName, className, subject (required strings)
      - reason (one of the four), reasonContext (resolved server-side)
      - parentLanguage (one of the 11 names)
      - consecutiveAbsentDays, teacherNote, teacherName, schoolName,
        performanceSummary (all optional)
    """
    return str(_compile_generator_template()(context))


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant for the parent-message generator.

    Matches the existing Genkit baseline (gemini-2.0-flash) for speed.
    A parent message is short, deterministic, and rendered straight to
    speech / SMS — no need for the larger model.
    """
    return os.environ.get("SAHAYAKAI_PARENT_MESSAGE_MODEL", "gemini-2.5-flash")


# ---- ADK LlmAgent builder (Phase U.alpha) -------------------------------


@lru_cache(maxsize=1)
def build_parent_message_agent() -> LlmAgent:
    """Build the parent-message generator as an ADK `LlmAgent`.

    Phase U.alpha — promotes the previously FastAPI-only single Gemini
    call to a real ADK construct. Mirrors L.1 vidya's pattern:

    - `name="parent_message_generator"` — snake_case (ADK 1.31's
      Pydantic identifier validator rejects hyphens).
    - `model` is the env-overridable string from `get_generator_model()`.
      The router swaps it to a per-call key-pinned `Gemini` instance via
      `_KeyedGemini` just before `Runner.run_async`.
    - `instruction=""` — the rendered Handlebars prompt is passed as
      `new_message` Content (NOT as `instruction`) to avoid ADK's
      `inject_session_state()` `{name}` substitution colliding with
      legitimate `{var}` shapes in our prompt output.
    - `output_schema=ParentMessageCore` enables Gemini's structured
      JSON output. The router parses the JSON text from the final event.
    - `generate_content_config.temperature=0.4` — slight prose variety
      so messages don't all read identically. Below creative range so
      cited scores stay accurate. `output_schema` lives at the top
      level (NOT inside `generate_content_config.response_schema`)
      because ADK 1.31's `LlmAgent.generate_content_config` rejects
      `response_schema`.
    - `sub_agents=[]` + `tools=[]` — single-call agent, no delegation.
    - `disallow_transfer_to_parent=True` so the agent never tries to
      escalate to a non-existent parent.

    Cached via `lru_cache(maxsize=1)`; the cached template is read-only
    at the application level (per-call state is isolated by the router's
    `model_copy()` clone with the keyed Gemini wrapper).
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="parent_message_generator",
        model=get_generator_model(),
        instruction="",
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.4,
        ),
        output_schema=ParentMessageCore,
        sub_agents=[],
        tools=[],
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


__all__ = [
    "LANGUAGE_TO_BCP47",
    "LANGUAGE_TO_ISO",
    "REASON_CONTEXT",
    "build_parent_message_agent",
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
