"""ADK helpers for avatar generator agent (Phase F.2 + Phase L.5).

Single image-generation call. No metadata text. Storage write stays in
the Next.js flow because the sidecar has no Storage credentials.

Phase L.5 wraps the single stage in an ADK `SequentialAgent` of one
sub-agent. A 1-step SequentialAgent is degenerate but keeps the same
Runner shape across L.5 agents (visual-aid + voice-to-text + this) and
unlocks easy addition of a future post-processing step (e.g.
background-removal, brightness-correction) without restructuring the
router.
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
    from google.adk.agents import LlmAgent, SequentialAgent

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


# ---- ADK SequentialAgent builder ----------------------------------------


# Session state key the router populates via `state_delta` and the
# sub-agent reads via its `instruction` callable.
STATE_PORTRAIT_PROMPT = "avatar.portrait_prompt"


def _portrait_instruction_provider(ctx: Any) -> str:
    """Read the rendered portrait prompt from session state.

    Using a callable (InstructionProvider) keeps the cached `LlmAgent`
    template request-independent and makes ADK's `inject_session_state()`
    skip the user-controlled prompt (`bypass_state_injection=True`).
    """
    text = ctx.state.get(STATE_PORTRAIT_PROMPT)
    if not isinstance(text, str) or not text:
        raise RuntimeError(
            "avatar.portrait_prompt missing from session state"
        )
    return text


@lru_cache(maxsize=1)
def build_portrait_agent() -> LlmAgent:
    """Image-gen sub-agent.

    `temperature=0.8` matches the pre-L.5 router (more variety on
    portraits than the precise 0.4 used by visual-aid).
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="avatar_portrait",
        model=get_image_model(),
        instruction=_portrait_instruction_provider,
        generate_content_config=genai_types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            temperature=0.8,
        ),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


@lru_cache(maxsize=1)
def build_avatar_agent() -> SequentialAgent:
    """Build the avatar pipeline as a 1-step ADK `SequentialAgent`.

    Degenerate today — single sub-agent. Kept as a SequentialAgent so
    the Runner shape matches visual-aid + voice-to-text and a future
    post-processing step slots in without router churn.
    """
    from google.adk.agents import SequentialAgent  # noqa: PLC0415

    return SequentialAgent(
        name="avatar_pipeline",
        sub_agents=[build_portrait_agent()],
    )


__all__ = [
    "STATE_PORTRAIT_PROMPT",
    "build_avatar_agent",
    "build_portrait_agent",
    "get_image_model",
    "load_portrait_prompt",
    "render_portrait_prompt",
]
