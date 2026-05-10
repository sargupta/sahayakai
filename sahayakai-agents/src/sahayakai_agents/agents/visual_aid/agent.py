"""ADK helpers for visual aid designer (Phase E.3 + Phase L.5).

Two prompts: image-gen and metadata-text. Both rendered via pybars3.

Phase L.5 wraps the two stages in an ADK `SequentialAgent`:

    SequentialAgent(sub_agents=[
        LlmAgent(name="visual-aid-image",    output: IMAGE),
        LlmAgent(name="visual-aid-metadata", output: VisualAidMetadata),
    ])

The previous router ran the two stages sequentially with hand-rolled
try/except + `run_resiliently` per stage. Wrapping in a SequentialAgent
gives us:

  - Built-in tracing per sub-agent (visible in OpenTelemetry spans).
  - Shared session state — both sub-agents read their respective
    rendered prompts from the per-call session state via `instruction`
    callables. The router populates state via `Runner.run_async`'s
    session-creation step. ADK's `inject_session_state()` skips the
    user-controlled prompts (`bypass_state_injection=True` for
    InstructionProvider callables) so a `{var}` in the teacher's input
    cannot trigger a KeyError.
  - One canonical Runner shape across all L.5 agents (visual-aid,
    avatar, voice-to-text).

The router (Phase L.5) drives the SequentialAgent via a single
`Runner.run_async` call and pulls the image bytes + metadata JSON out
of the resulting events (segregated by sub-agent name). The 90s
router-level `asyncio.wait_for` budget is preserved.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import VisualAidMetadata

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent, SequentialAgent

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


# ---- ADK SequentialAgent builder ----------------------------------------


# Session state keys that the router populates via `state_delta` and
# the sub-agents read from via `instruction` callables. Centralised so
# the router and tests can reference the same string.
STATE_IMAGE_PROMPT = "visual_aid.image_prompt"
STATE_METADATA_PROMPT = "visual_aid.metadata_prompt"


def _image_instruction_provider(ctx: Any) -> str:
    """Read the rendered image prompt from session state.

    Using a callable (InstructionProvider) instead of a string instruction
    has two benefits:
      1. ADK's `inject_session_state()` skips the user-controlled prompt
         (`bypass_state_injection=True`), so a `{var}` pattern in the
         teacher's free-text input cannot trigger a KeyError.
      2. The cached `LlmAgent` template is request-independent — per-call
         state lives in the Runner's session, not the agent.
    """
    text = ctx.state.get(STATE_IMAGE_PROMPT)
    if not isinstance(text, str) or not text:
        raise RuntimeError(
            "visual_aid.image_prompt missing from session state"
        )
    return text


def _metadata_instruction_provider(ctx: Any) -> str:
    """Read the rendered metadata prompt from session state."""
    text = ctx.state.get(STATE_METADATA_PROMPT)
    if not isinstance(text, str) or not text:
        raise RuntimeError(
            "visual_aid.metadata_prompt missing from session state"
        )
    return text


@lru_cache(maxsize=1)
def build_image_agent() -> LlmAgent:
    """Image-gen sub-agent.

    `generate_content_config.response_modalities=['IMAGE']` switches
    Gemini into image output mode. `temperature=0.4` matches the
    pre-L.5 router. No `output_schema` — the response carries an
    inline image Blob, not structured JSON.

    The instruction is a callable (InstructionProvider) that reads the
    rendered image prompt from session state. The router populates the
    state via `Runner.run_async(state_delta={...})` immediately before
    the call.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="visual_aid_image",
        model=get_image_model(),
        instruction=_image_instruction_provider,
        generate_content_config=genai_types.GenerateContentConfig(
            response_modalities=["IMAGE"],
            temperature=0.4,
        ),
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


@lru_cache(maxsize=1)
def build_metadata_agent() -> LlmAgent:
    """Metadata-text sub-agent.

    `output_schema=VisualAidMetadata` switches Gemini into structured
    JSON output mode (ADK forwards this as `response_schema` on the
    underlying `GenerateContentConfig`). Same `temperature=0.4` as the
    pre-L.5 router.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415
    from google.genai import types as genai_types  # noqa: PLC0415

    return LlmAgent(
        name="visual_aid_metadata",
        model=get_metadata_model(),
        instruction=_metadata_instruction_provider,
        generate_content_config=genai_types.GenerateContentConfig(
            temperature=0.4,
        ),
        output_schema=VisualAidMetadata,
        disallow_transfer_to_parent=True,
        disallow_transfer_to_peers=True,
    )


@lru_cache(maxsize=1)
def build_visual_aid_agent() -> SequentialAgent:
    """Build the visual-aid pipeline as an ADK `SequentialAgent`.

    Two sub-agents in fixed order: image first, metadata second. The
    router invokes each sub-agent with its own `new_message` Content
    (image prompt → image agent; metadata prompt → metadata agent)
    via `Runner.run_async`.

    Cached via `lru_cache(maxsize=1)` — the same template is safe to
    re-use across requests; per-call state lives in the Runner /
    session, not the agent.
    """
    from google.adk.agents import SequentialAgent  # noqa: PLC0415

    return SequentialAgent(
        name="visual_aid_pipeline",
        sub_agents=[build_image_agent(), build_metadata_agent()],
    )


__all__ = [
    "STATE_IMAGE_PROMPT",
    "STATE_METADATA_PROMPT",
    "build_image_agent",
    "build_metadata_agent",
    "build_visual_aid_agent",
    "get_image_model",
    "get_metadata_model",
    "load_image_prompt",
    "load_metadata_prompt",
    "render_image_prompt",
    "render_metadata_prompt",
]
