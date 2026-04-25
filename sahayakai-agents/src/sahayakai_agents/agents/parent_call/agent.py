"""ADK `Agent` definitions for the parent-call flow.

G5 implementation. The canonical ADK pattern (per https://adk.dev/) is:

    from google.adk import Agent
    from google.adk.tools import google_search

    agent = Agent(
        name="researcher",
        model="gemini-flash-latest",
        instruction="...",
        tools=[google_search],
    )

We export two `Agent` instances — `build_reply_agent()` and
`build_summary_agent()` — so future Phase 2 Runner-based flows (Gemini
Live, multi-tool orchestration) can plug in without reshaping this
module. For Phase 1 the router calls Gemini directly via `google.genai`
wrapped in `run_resiliently`, because single-turn structured output is
simpler that way and matches the existing Genkit behaviour one-to-one.
Both paths render the same shared Handlebars prompt through pystache.

Design notes:
- `get_reply_agent_model()` / `get_summary_agent_model()` are cached per
  process.
- Pydantic `AgentReplyCore` / `CallSummaryCore` describe what the model
  MUST return. The wire schemas in `schemas.py` wrap them with
  telemetry fields so the HTTP contract is a superset, not a rename.

Review trace:
- P0 #4 shared prompts.
- Round-2 P0-1 env-var prompt dir resolution.
- P0 #8 turn cap enforced in `turn_cap_exceeded()`; router applies it.
- User decision (2026-04-24): ADK design patterns documented at
  https://adk.dev/ are the source of truth for this module.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any

import pybars  # type: ignore[import-untyped]
import structlog
from pydantic import BaseModel, ConfigDict, Field

from .schemas import (
    CallQuality,
    ParentLanguage,
    ParentSentiment,
    TranscriptTurn,
)

log = structlog.get_logger(__name__)

# ---- Prompt resolution ----------------------------------------------------

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "parent-call"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "parent-call"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Shared prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing parent-call/."
        )
    return path.read_text(encoding="utf-8")


def load_reply_prompt() -> str:
    """Raw Handlebars template for per-turn reply."""
    return _load_prompt("reply.handlebars")


def load_summary_prompt() -> str:
    """Raw Handlebars template for post-call summary."""
    return _load_prompt("summary.handlebars")


# ---- Handlebars rendering -------------------------------------------------

# Round-2 audit P0 PROMPT-1 fix: switched from `pystache` to `pybars3`.
# The shared prompts use Handlebars-specific tags `{{#if x}}...{{/if}}`
# which Mustache does not support — pystache raised
# `pystache.parser.ParsingError: Section end tag mismatch ... expected
# {{/if teacherName}}`, meaning every render against a real prompt 502'd
# in production. pybars3 is a faithful Handlebars implementation and
# matches what Genkit renders on the Node side, keeping the byte-drift
# CI guard meaningful.
_compiler = pybars.Compiler()


@lru_cache(maxsize=2)
def _compiled(template_name: str) -> Any:
    """Compile + cache the Handlebars template once per process.

    `pybars3` compiles to a callable closure; caching avoids re-parsing
    the (~2 KB) prompt on every request.
    """
    if template_name == "reply":
        source = load_reply_prompt()
    elif template_name == "summary":
        source = load_summary_prompt()
    else:
        raise ValueError(f"Unknown template name: {template_name!r}")
    return _compiler.compile(source)


def render_reply_prompt(context: dict[str, Any]) -> str:
    """Render the per-turn reply prompt with call context + parent speech."""
    return _compiled("reply")(context)


def render_summary_prompt(context: dict[str, Any]) -> str:
    """Render the post-call summary prompt with the full transcript."""
    return _compiled("summary")(context)


def build_reply_context(
    *,
    student_name: str,
    class_name: str,
    subject: str,
    reason: str,
    teacher_message: str,
    teacher_name: str | None,
    school_name: str | None,
    parent_language: ParentLanguage,
    transcript: list[TranscriptTurn],
    parent_speech: str,
    turn_number: int,
    performance_summary: str | None,
) -> dict[str, Any]:
    """Convert request fields into the variable shape pystache expects.

    Mustache/Handlebars field names match the `reply.handlebars` template
    exactly. camelCase on purpose so the same template works in Node.
    """
    return {
        "studentName": student_name,
        "className": class_name,
        "subject": subject,
        "reason": reason,
        "teacherMessage": teacher_message,
        "teacherName": teacher_name,
        "schoolName": school_name,
        "parentLanguage": parent_language,
        "transcript": [{"role": t.role, "text": t.text} for t in transcript],
        "parentSpeech": parent_speech,
        "turnNumber": turn_number,
        "performanceSummary": performance_summary,
    }


def build_summary_context(
    *,
    student_name: str,
    class_name: str,
    subject: str,
    reason: str,
    teacher_message: str,
    teacher_name: str | None,
    school_name: str | None,
    parent_language: ParentLanguage,
    transcript: list[TranscriptTurn],
    call_duration_seconds: int | None,
) -> dict[str, Any]:
    return {
        "studentName": student_name,
        "className": class_name,
        "subject": subject,
        "reason": reason,
        "teacherMessage": teacher_message,
        "teacherName": teacher_name,
        "schoolName": school_name,
        "parentLanguage": parent_language,
        "transcript": [{"role": t.role, "text": t.text} for t in transcript],
        "callDurationSeconds": call_duration_seconds,
    }


# ---- Model-facing Pydantic schemas ---------------------------------------


# Round-2 audit P0 fix (issue google-genai #699): the Gemini API rejects
# response schemas that carry `default:` values. Removing all defaults from
# these model-facing schemas. Nullable fields stay nullable but become
# required: the model must always emit the key (possibly as null), and our
# router contract still treats it as optional via Pydantic's `| None` union.
class AgentReplyCore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    reply: str = Field(min_length=1, max_length=4000)
    shouldEndCall: bool
    followUpQuestion: str | None = Field(max_length=500)


class CallSummaryCore(BaseModel):
    model_config = ConfigDict(extra="forbid")
    parentResponse: str
    parentConcerns: list[str]
    parentCommitments: list[str]
    actionItemsForTeacher: list[str]
    guidanceGiven: list[str]
    parentSentiment: ParentSentiment
    callQuality: CallQuality
    followUpNeeded: bool
    followUpSuggestion: str | None


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_reply_agent_model() -> str:
    """Gemini variant for reply. Default 2.5 Flash (cheap, warm, fast)."""
    return os.environ.get("SAHAYAKAI_REPLY_MODEL", "gemini-2.5-flash")


@lru_cache(maxsize=1)
def get_summary_agent_model() -> str:
    """Summary is a one-shot structured output; Flash is fine."""
    return os.environ.get("SAHAYAKAI_SUMMARY_MODEL", "gemini-2.5-flash")


def turn_cap_exceeded(turn_number: int, *, cap: int = 6) -> bool:
    """Pedagogical turn cap. At or past the cap, `shouldEndCall` must be
    True regardless of what the model says. The router enforces this.
    """
    return turn_number >= cap


# ---- ADK Agent builders (for future Runner-based paths) ------------------
#
# Kept in this module so Phase 2 can start using ADK's Runner for Gemini
# Live without re-deriving prompts. The reply `Agent` here is NOT invoked
# by the Phase 1 router — router calls Gemini directly via `google.genai`.


def build_reply_agent():  # type: ignore[no-untyped-def]
    """Constructs an ADK `Agent` per the canonical pattern at https://adk.dev/.

    Local import of `google.adk` so tests that do not exercise ADK do
    not pay the import cost.
    """
    from google.adk import Agent

    return Agent(
        name="parent_call_reply",
        model=get_reply_agent_model(),
        instruction=load_reply_prompt(),
        tools=[],
    )


def build_summary_agent():  # type: ignore[no-untyped-def]
    from google.adk import Agent

    return Agent(
        name="parent_call_summary",
        model=get_summary_agent_model(),
        instruction=load_summary_prompt(),
        tools=[],
    )
