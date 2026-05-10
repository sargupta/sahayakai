"""ADK helpers and factory for exam paper generator.

Phase E.2 introduced the agent as a hand-rolled
`google.genai.Client.aio.models.generate_content` call wrapped in a
FastAPI handler. Phase U.γ promotes the construct to a real ADK
`LlmAgent` driven through `Runner.run_async`, completing the migration
of all 16 sidecar routers to canonical ADK constructs.

Why a single `LlmAgent` (Option B from the Phase U.γ brief), not a
`SequentialAgent` of writer + LLM validator:

  - The validation we already do is a marks-balance arithmetic check
    plus the shared behavioural guard (forbidden-phrase scan + script
    match). Both are pure-Python — running them inside an LLM
    validator would waste tokens AND let the model lie about marks
    (e.g. claim the totals balance when they don't).
  - The single-call cost cap matches the pre-U behaviour exactly
    (one Gemini call per request) so router cost analysis stays valid.
  - The wire shape is a single structured `ExamPaperCore` JSON which
    maps 1:1 to ADK's `output_schema=ExamPaperCore`.

What used to live in the router and now lives in this builder:

  - The `google.genai.Client.aio.models.generate_content` call site →
    the cached `LlmAgent` template's model + output_schema. The router
    swaps the `.model` attribute via `clone(update={"model": ...})`
    immediately before each `Runner.run_async` call to pin the
    api_key (matches the L.1 vidya / L.5 visual-aid pattern).
  - `response_mime_type="application/json"` + `response_schema=...` →
    `output_schema=ExamPaperCore` on the `LlmAgent`. ADK forwards this
    as the response schema on the underlying `GenerateContentConfig`.
  - The hand-rolled `_extract_text` walking candidates → consumed via
    the Runner event-stream's final-response text in the router.

Critical findings from Phase L preserved here (per Phase U.γ brief):

  1. `LlmAgent.name` is a Python identifier — `"exam_paper_generator"`
     uses underscores, no hyphens. ADK 1.31's Pydantic model rejects
     hyphenated names.
  2. `LlmAgent.generate_content_config` rejects `response_schema` —
     structured output goes through `output_schema=...` on the agent
     itself. We set only `temperature=0.4` on `generate_content_config`
     to match the pre-U.γ behaviour.
  3. ADK 1.31 `BaseAgent.clone(update={...})` is the canonical model-
     swap API. We do NOT mutate the cached template; the router calls
     `clone()` on each request to install the per-call keyed Gemini.
  4. The exam_paper flow doesn't have an output_key requirement (no
     SequentialAgent state hand-off), so the LlmAgent has no
     `output_key` and no `sub_agents`.

Marks-balance validation stays in `agents.exam_paper._guard` and is
applied by the router post-Runner. That guard is a pure-Python
assertion over the parsed `ExamPaperCore`, so it doesn't belong inside
ADK's call surface.

Phase U.γ deliverable. See `feature/phase-u-expert-team`.
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

log = structlog.get_logger(__name__)

_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "exam-paper"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "exam-paper"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    path = _resolve_prompts_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Exam-paper prompt missing: {path}")
    return path.read_text(encoding="utf-8")


def load_generator_prompt() -> str:
    return _load_prompt("generator.handlebars")


_compiler = pybars.Compiler()


@lru_cache(maxsize=1)
def _compile_generator_template() -> Any:
    return _compiler.compile(load_generator_prompt())


def render_generator_prompt(context: dict[str, Any]) -> str:
    return str(_compile_generator_template()(context))


@lru_cache(maxsize=1)
def get_generator_model() -> str:
    """Default Gemini variant. Exam paper output is large + structured;
    2.0-flash handles it but 2.5 may produce better blueprints. Override
    via env to A/B."""
    return os.environ.get("SAHAYAKAI_EXAM_PAPER_MODEL", "gemini-2.5-flash")


# ---- ADK LlmAgent builder ------------------------------------------------


@lru_cache(maxsize=1)
def build_exam_paper_agent() -> LlmAgent:
    """Build the exam-paper generator as an ADK `LlmAgent`.

    Phase U.γ wiring:

    - `model` is the env-overridable string from `get_generator_model()`.
      The cached template carries the string; the router's per-call
      `clone(update={"model": ...})` swaps in a key-pinned `Gemini`
      instance via `_adk_keyed_gemini.build_keyed_gemini`.
    - `instruction` is the rendered Handlebars template loaded from
      disk. Per-call teacher context is rendered into the prompt by
      the router (because the template variables come from the
      sanitized request) and then passed as `new_message` to
      `Runner.run_async` — same approach as L.1 vidya. Putting the
      prompt in `new_message` instead of the agent's `instruction`
      sidesteps ADK's `inject_session_state()` which scans for `{var}`
      patterns; teacher-controlled inputs may legitimately contain
      `{...}` shapes that would trigger spurious KeyErrors.
    - `output_schema=ExamPaperCore` switches Gemini into structured
      JSON output mode (ADK forwards this as `response_schema` on the
      underlying `GenerateContentConfig`). The router parses the JSON
      text from the final event into `ExamPaperCore`.
    - `generate_content_config` carries only `temperature=0.4` — ADK
      rejects `response_schema` here (it's set via `output_schema` on
      the agent, see Phase L finding #2 in the module docstring).
    - `sub_agents=[]`: terminal agent, no delegation. Marks-balance
      validation is a pure-Python check the router applies after the
      Runner returns; turning it into a sub-agent would waste tokens
      AND let the model lie about its own arithmetic.
    - `tools=[]`: no tools needed (no grounding, no AgentTool calls).
    - `disallow_transfer_to_parent=True` so the agent never tries to
      escalate to a supervisor that may not exist when invoked
      directly via `Runner`.

    Cached via `lru_cache(maxsize=1)`: the same `LlmAgent` template is
    safe to re-use across requests; per-call state lives in the
    Runner's session, not the agent itself. Mutating the cached
    template across requests would race; the router's per-call
    `clone()` ensures isolation.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415 — lazy import
    from google.genai import types as genai_types  # noqa: PLC0415

    from .schemas import ExamPaperCore  # noqa: PLC0415 — avoid cycle

    return LlmAgent(
        name="exam_paper_generator",
        model=get_generator_model(),
        # Per-call rendered prompt arrives via `Runner.run_async`'s
        # `new_message` (see router). The agent's instruction stays
        # empty so ADK's basic flow doesn't run user-controlled text
        # through `inject_session_state()`.
        instruction="",
        sub_agents=[],
        tools=[],
        output_schema=ExamPaperCore,
        generate_content_config=genai_types.GenerateContentConfig(
            # Lower temperature for structured output — exam papers
            # are pedagogical artefacts, not creative writing.
            temperature=0.4,
        ),
        disallow_transfer_to_parent=True,
    )


__all__ = [
    "build_exam_paper_agent",
    "get_generator_model",
    "load_generator_prompt",
    "render_generator_prompt",
]
