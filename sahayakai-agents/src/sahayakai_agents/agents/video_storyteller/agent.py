"""ADK helpers + LlmAgent builder for video storyteller agent.

Phase F.1 originally landed prompt rendering + model selection here.
Phase U.beta promotes the single Gemini structured call to a real
`google.adk.agents.LlmAgent` driven by `Runner.run_async`. Mirrors the
L.1 vidya pattern: a single cached LlmAgent template with
`output_schema=VideoStorytellerCore`; the router renders the prompt
per call and ships it as the user `new_message`. ADK forwards that to
Gemini's `contents=` and applies the structured-output schema.

The ADK migration replaces the previous hand-rolled
`google.genai.Client.aio.models.generate_content` call with the
canonical ADK Runner shape — same wire contract, same key-pool
failover, same telephony backoff budget.

Snake_case agent name (`video_storyteller_recommender`): ADK's Pydantic
validator rejects hyphens for `LlmAgent.name`.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import VideoStorytellerCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent

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
        "SAHAYAKAI_VIDEO_STORYTELLER_MODEL", "gemini-2.5-flash",
    )


# ---- ADK LlmAgent builder (Phase U.beta) --------------------------------


@lru_cache(maxsize=1)
def build_video_storyteller_agent() -> LlmAgent:
    """Build the video-storyteller recommender as a real ADK `LlmAgent`.

    Wire shape:

      - `model` is the env-overridable string from
        `get_recommender_model()`. The router swaps this to a per-call
        keyed `Gemini` instance via `model_copy()` just before
        `Runner.run_async`.
      - `instruction=""` deliberately. The rendered Handlebars prompt
        ships as the user `new_message` Content rather than the system
        instruction. Two reasons:
          1. ADK's `inject_session_state()` scans `instruction` for
             `{name}` placeholders. Sanitised user input may contain
             `{x}`-shaped fragments that would trip a KeyError.
          2. Matches the pre-migration Genkit shape (`contents=prompt`)
             so a shadow-mode dispatcher can byte-compare both paths.
      - `output_schema=VideoStorytellerCore` enables Gemini's structured
        JSON output. ADK validates the model's response against this
        schema.
      - `disallow_transfer_to_parent=True` so the agent never tries to
        escalate to a non-existent supervisor when invoked by `Runner`
        directly.

    Cached via `lru_cache(maxsize=1)`: the template is request-
    independent. The router's per-call `model_copy()` is what isolates
    per-request state (api_key, rendered prompt).
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415 — lazy import

    return LlmAgent(
        name="video_storyteller_recommender",
        model=get_recommender_model(),
        instruction="",
        output_schema=VideoStorytellerCore,
        disallow_transfer_to_parent=True,
    )


__all__ = [
    "build_video_storyteller_agent",
    "get_recommender_model",
    "load_recommender_prompt",
    "render_recommender_prompt",
]
