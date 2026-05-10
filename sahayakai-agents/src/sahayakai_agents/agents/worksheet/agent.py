"""ADK helpers + LlmAgent builder for worksheet wizard agent.

Phase D.4 originally landed prompt rendering + data-URI parsing +
model selection here. Phase U.beta promotes the single multimodal
Gemini call to a real `google.adk.agents.LlmAgent` driven by
`Runner.run_async`. Mirrors the L.1 vidya pattern with one
multimodal twist: the rendered prompt + decoded image bytes ship
together as a multipart user `new_message` (text Part + image Part).

The ADK migration replaces the previous hand-rolled
`google.genai.Client.aio.models.generate_content` call with the
canonical ADK Runner shape — same wire contract, same key-pool
failover, same telephony backoff budget.

Snake_case agent name (`worksheet_wizard`): ADK's Pydantic validator
rejects hyphens for `LlmAgent.name`.
"""
from __future__ import annotations

import base64
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

from .schemas import WorksheetCore

log = structlog.get_logger(__name__)

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent

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
    """Default Gemini variant. Multimodal so we use 2.5-flash (which
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


# ---- ADK LlmAgent builder (Phase U.beta) --------------------------------


@lru_cache(maxsize=1)
def build_worksheet_agent() -> LlmAgent:
    """Build the worksheet wizard as a real ADK `LlmAgent`.

    Wire shape:

      - `model` is the env-overridable string from `get_wizard_model()`.
        The router swaps this to a per-call keyed `Gemini` instance via
        `model_copy()` just before `Runner.run_async`.
      - `instruction=""` deliberately. The rendered Handlebars prompt
        (text Part) and the decoded image bytes (image Part) ship
        together as a multipart user `new_message` Content. ADK forwards
        that to Gemini's `contents=` parameter, preserving the pre-
        migration multimodal call shape verbatim.
      - `output_schema=WorksheetCore` enables Gemini's structured JSON
        output. ADK validates the model's response against this schema.
      - `disallow_transfer_to_parent=True` so the agent never tries to
        escalate to a non-existent supervisor when invoked by `Runner`
        directly.

    Cached via `lru_cache(maxsize=1)`: the template is request-
    independent. The router's per-call `model_copy()` is what isolates
    per-request state (api_key, rendered prompt, image bytes).
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415 — lazy import

    return LlmAgent(
        name="worksheet_wizard",
        model=get_wizard_model(),
        instruction="",
        output_schema=WorksheetCore,
        disallow_transfer_to_parent=True,
    )


__all__ = [
    "InvalidDataURIError",
    "build_worksheet_agent",
    "get_wizard_model",
    "load_wizard_prompt",
    "parse_data_uri",
    "render_wizard_prompt",
]
