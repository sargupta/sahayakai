"""ADK helpers for the rubric-generator agent.

Phase D.1 (router) + Phase U.alpha (ADK promotion). Single Gemini call:
  - render Handlebars prompt (pybars3, byte-identical to Node Handlebars)
  - structured-output JSON matching `RubricGeneratorCore`
  - moderate temperature (0.3) for consistent multi-criteria rubrics

Phase U.alpha: `build_rubric_agent()` returns a real
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

from .schemas import RubricGeneratorCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "rubric"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "rubric"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Rubric prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing rubric/."
        )
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    """Render the rubric-generator prompt.

    Expected keys: assignmentDescription, gradeLevel, subject,
    language, teacherContext (any can be None).
    """
    return str(_compile_generator_template()(context))


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant for the rubric generator.

    Matches the existing Genkit flow's `gemini-2.0-flash`. The schema
    is structured + bounded so 2.0-flash handles it well; override
    via `SAHAYAKAI_RUBRIC_MODEL` for A/B.
    """
    return os.environ.get("SAHAYAKAI_RUBRIC_MODEL", "gemini-2.5-flash")


# ---- ADK LlmAgent builder (Phase U.alpha) -------------------------------


@lru_cache(maxsize=1)
def build_rubric_agent() -> LlmAgent:
    """Build the rubric generator as an ADK `LlmAgent`.

    Phase U.alpha — promotes the previously FastAPI-only single Gemini
    call to a real ADK construct. Mirrors L.1 vidya's pattern:

    - `name="rubric_generator"` — snake_case (ADK 1.31's Pydantic
      identifier validator rejects hyphens).
    - `model` is the env-overridable string from `get_generator_model()`.
      The router swaps it to a per-call key-pinned `Gemini` instance via
      `_KeyedGemini` just before `Runner.run_async`.
    - `instruction=""` — the rendered Handlebars prompt is passed as
      `new_message` Content (NOT as `instruction`) to avoid ADK's
      `inject_session_state()` `{name}` substitution colliding with
      legitimate `{var}` shapes in our prompt output.
    - `output_schema=RubricGeneratorCore` enables Gemini's structured
      JSON output. The router parses the JSON text from the final event.
    - `generate_content_config.temperature=0.3` — same value the pre-U
      router used. Below creative range so multi-criteria scores stay
      consistent. `output_schema` lives at the top level (NOT inside
      `generate_content_config.response_schema`) because ADK 1.31's
      `LlmAgent.generate_content_config` rejects `response_schema`.
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
        name="rubric_generator",
        model=get_generator_model(),
        instruction="",
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.3,
        ),
        output_schema=RubricGeneratorCore,
        sub_agents=[],
        tools=[],
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


__all__ = [
    "build_rubric_agent",
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
