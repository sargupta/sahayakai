"""ADK helpers and factories for the instant-answer agent.

Phase 6 §6.2 / Phase L.2. Two responsibilities live here:

1. **Prompt resolution + rendering** — Handlebars template loading,
   pybars3 compile + render. (Phase 6 §6.2.)

2. **ADK construct factories** — `build_instant_answer_agent()` returns
   an `LlmAgent` and `build_answerer_tool()` wraps it as an `AgentTool`
   so a supervising LlmAgent can register it under `tools=[]`. (Phase
   L.2 — replaces VIDYA's in-process import of a private function.)

Why ADK over Genkit for this one flow:
  - **Real tool-use**: Genkit's `googleSearch` tool is currently mocked
    (returns canned strings). The Python migration uses Gemini's
    *native* `Google Search` grounding, which gives the model live
    web access through the same call surface as parent-call /
    lesson-plan / vidya. The wire contract stays identical.
  - **Shared resilience**: rotates through the same key pool +
    telephony-bounded backoff as the other ADK agents.
  - **Schema-first**: structured output enforced via google-genai's
    `response_schema=InstantAnswerCore` rather than a separate
    schema-validation step.

Phase L.2 design choice — explicit tool invocation, not AutoFlow:

  ADK 1.31 will not let an `LlmAgent` set BOTH `output_schema` AND
  `tools` cleanly on the Gemini API path: the basic LLM-flow gates
  `response_schema` behind `can_use_output_schema_with_tools(model)`,
  which returns `True` only on Vertex AI + Gemini 2.x. On the public
  Gemini API path it falls back to a prompt-based workaround
  (`SetModelResponseTool`) that changes the wire contract. VIDYA's
  classifier MUST emit structured `IntentClassification` JSON, so we
  keep VIDYA's `tools=[]` empty and have the router call the
  instant-answer path explicitly. The AgentTool factory below is
  still built so it's ready for L.3+ migrations where supervising
  agents do not pin `output_schema`.

See `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pybars
import structlog

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent
    from google.adk.tools.agent_tool import AgentTool

log = structlog.get_logger(__name__)


# ---- Prompt resolution ---------------------------------------------------

# `parents[4]` from this file resolves to the `sahayakai-agents/` repo
# root, mirroring the lesson-plan / vidya agents.
_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "instant-answer"
)


def _resolve_prompts_dir() -> Path:
    """`SAHAYAKAI_PROMPTS_DIR` in prod; repo layout fallback in dev."""
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "instant-answer"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Instant-answer prompt missing: {path}. "
            "Set SAHAYAKAI_PROMPTS_DIR to the directory containing instant-answer/."
        )
    return path.read_text(encoding="utf-8")


def load_answerer_prompt() -> str:
    """Load the answerer Handlebars template."""
    return _load_prompt("answerer.handlebars")


# ---- pybars3 rendering ---------------------------------------------------

_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_answerer_template() -> Any:
    """Compile the answerer template once and cache."""
    return _compiler.compile(load_answerer_prompt())


def render_answerer_prompt(context: dict[str, Any]) -> str:
    """Render the answerer prompt against the request context.

    Expected keys:
      - `question`: str — the teacher's question (already length-capped)
      - `language`: str | None — BCP-47 / ISO code, normalised upstream
      - `gradeLevel`: str | None — e.g. "Class 5", normalised upstream
      - `subject`: str | None — e.g. "Science"
    """
    return str(_compile_answerer_template()(context))


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_answerer_model() -> str:
    """Default Gemini variant for the instant-answer agent.

    Matches the existing Genkit flow's `gemini-2.0-flash` default for
    speed — instant-answer is a synchronous teacher-facing surface and
    p95 latency directly affects perceived UX. Override via
    `SAHAYAKAI_INSTANT_ANSWER_MODEL` to A/B test 2.5.
    """
    return os.environ.get("SAHAYAKAI_INSTANT_ANSWER_MODEL", "gemini-2.0-flash")


# ---- ADK construct factories (Phase L.2) ---------------------------------


# Tool name surfaced to the supervising LlmAgent. Snake_case because
# ADK turns this into a Gemini function-calling declaration and the
# Gemini API rejects hyphenated function names.
_ANSWERER_TOOL_NAME = "answer_factual_question"

# Description the supervising LLM uses to decide when to invoke the
# tool. Kept terse + factual — the supervisor's prompt already enforces
# routing via `intent.type == "instantAnswer"`, so this is mostly for
# observability (it surfaces in ADK trace logs as the tool name).
_ANSWERER_TOOL_DESCRIPTION = (
    "Answer a teacher's direct factual question (definitions, "
    "what/when/why questions, quick facts). Returns a concise "
    "explanation in the teacher's preferred language. Use only "
    "when no other tool fits and the question has a "
    "well-defined factual answer."
)


@lru_cache(maxsize=1)
def build_instant_answer_agent() -> LlmAgent:
    """Build the instant-answer ADK `LlmAgent`.

    Phase L.2 — terminal agent (no `sub_agents`, no tools). Wires:

    - `model` is the env-overridable string from `get_answerer_model()`.
    - `instruction` is the rendered Handlebars template; per-call
      teacher context is appended via the `Runner.run_async` call site
      (same pattern as VIDYA L.1, see `agents/vidya/agent.py`).
    - `output_schema=InstantAnswerCore` so the model emits structured
      JSON the router can deserialize without a free-text parse step.
    - `disallow_transfer_to_parent=True` so the agent never tries to
      escalate to a supervisor that may not exist (when invoked by
      `Runner` directly, `parent_agent` is `None`).

    The factory is cached so a single template is shared across
    requests; the router's per-call `model_copy()` is what swaps in
    the keyed Gemini wrapper.

    NOTE: `description` is the human-readable summary surfaced when
    this agent is wrapped as an `AgentTool`. The `name` is
    `instant_answer` (snake_case) because ADK 1.31 enforces a Python-
    identifier pattern via Pydantic validation (no hyphens). The
    FastAPI router URL stays hyphenated (`/v1/instant-answer/answer`);
    only the in-process agent identity uses underscores.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415 — lazy import

    from .schemas import InstantAnswerCore  # noqa: PLC0415 — avoid cycle

    return LlmAgent(
        name="instant_answer",
        description=_ANSWERER_TOOL_DESCRIPTION,
        model=get_answerer_model(),
        instruction=load_answerer_prompt(),
        output_schema=InstantAnswerCore,
        disallow_transfer_to_parent=True,
    )


@lru_cache(maxsize=1)
def build_answerer_tool() -> AgentTool:
    """Wrap the instant-answer LlmAgent as an `AgentTool`.

    Phase L.2 — produced for two reasons:

      1. **Canonical ADK shape.** A supervising agent (VIDYA) declaring
         instant-answer as a sub-capability normally registers it via
         `tools=[build_answerer_tool()]`. We are NOT registering it on
         VIDYA today (see the module docstring's design note about
         output_schema + tools), but the factory stays here so L.3+
         supervisor agents that DO drop `output_schema` can pull it in
         with one import.
      2. **Test surface.** Pinning the AgentTool's name + description
         in unit tests catches accidental drift (e.g. someone renaming
         the underlying agent and breaking observability).

    ADK 1.31 `AgentTool.__init__` signature reminder (from
    `google/adk/tools/agent_tool.py:110`):

        AgentTool(
            agent: BaseAgent,
            skip_summarization: bool = False,
            *,
            include_plugins: bool = True,
            propagate_grounding_metadata: bool = False,
        )

    The tool's `name` and `description` are taken from `agent.name`
    and `agent.description` (no separate kwargs accepted), which is
    why `build_instant_answer_agent` sets both fields above.
    """
    from google.adk.tools.agent_tool import AgentTool  # noqa: PLC0415 — lazy import

    return AgentTool(agent=build_instant_answer_agent())


__all__ = [
    "build_answerer_tool",
    "build_instant_answer_agent",
    "get_answerer_model",
    "load_answerer_prompt",
    "render_answerer_prompt",
]
