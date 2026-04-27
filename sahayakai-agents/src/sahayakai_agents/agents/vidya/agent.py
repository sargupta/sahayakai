"""ADK supervisor builder for the VIDYA orchestrator (Phase L.1).

Constructs a real `google.adk.agents.LlmAgent` to drive the intent
classifier through ADK's `Runner`. Replaces the previous hand-rolled
2-stage pattern (FastAPI handler → `google.genai` direct call) with
the canonical ADK supervisor shape.

What lives here NOW (Phase L.1):
- `build_vidya_agent()` — the cached `LlmAgent` factory.

What used to live here, moved out:
- Prompt loading + Handlebars rendering → `prompts.py`.
- `classify_action`, model selectors → `gates.py`.

Backwards-compat re-exports at the bottom keep `_behavioural.py` +
existing tests + the router happy without churning their imports.

Phase L.1 deliverable. See
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

# Local re-exports keep the public surface stable for callers that
# import from `agents.vidya.agent` (router, _behavioural, tests).
from .gates import (
    classify_action,
    get_instant_answer_model,
    get_orchestrator_model,
)
from .prompts import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    UNKNOWN_INTENT,
    load_instant_answer_prompt,
    load_orchestrator_prompt,
    render_instant_answer_prompt,
    render_orchestrator_prompt,
)
from .schemas import IntentClassification

if TYPE_CHECKING:
    from google.adk.agents import LlmAgent


# ---- ADK supervisor builder ---------------------------------------------


@lru_cache(maxsize=1)
def build_vidya_agent() -> LlmAgent:
    """Build the VIDYA supervisor as an ADK `LlmAgent`.

    Phase L.1 wiring (refined in L.2):

    - `model` is the env-overridable string from `get_orchestrator_model()`
      (defaults to `gemini-2.0-flash` to match the Genkit production flow).
    - `instruction` is the rendered orchestrator Handlebars template.
      ADK's basic flow forwards this as the system instruction. Per-call
      teacher context (message, history, screen, profile) is appended
      via the `new_message` Content the router passes to `Runner.run_async`.
    - `output_schema=IntentClassification` enables Gemini's structured
      JSON output (response_schema). The router parses the JSON text
      from the final event into `IntentClassification`.
    - `sub_agents=[]`: AutoFlow-driven sub-agent delegation is unused
      here — the OmniOrb's other 9 routable flows are dispatched
      client-side via `NAVIGATE_AND_FILL` actions, and the
      instant-answer flow is invoked by the router after intent
      classification (see point below).
    - `tools=[]`: deliberately empty. Phase L.2's audit found that
      ADK 1.31's basic LLM-flow (see
      `google/adk/flows/llm_flows/basic.py:53-59` and
      `google/adk/utils/output_schema_utils.py:can_use_output_schema_with_tools`)
      gates `response_schema` behind `Vertex AI + Gemini 2+`. On the
      public Gemini API path (which is where the sidecar runs today)
      adding tools forces a fallback through `_output_schema_processor`
      that emits `SetModelResponseTool`-shaped function calls instead
      of raw structured JSON — incompatible with the queue-fake test
      contract and with the existing wire shape. The instant-answer
      `AgentTool` (built by `agents.instant_answer.agent.build_answerer_tool`)
      stays unregistered here; the router invokes the public
      `run_answerer()` helper explicitly when intent type is
      `instantAnswer`. L.3+ migrations of agents that DON'T pin
      `output_schema` (e.g. workflow-style supervisors) can register
      the tool freely.
    - `disallow_transfer_to_parent=True` so the supervisor never tries
      to escalate to a non-existent parent agent.

    Cached via `lru_cache(maxsize=1)` because the same `LlmAgent` is
    safe to re-use across requests; ADK threads per-call state through
    the `Runner` + session, not the agent itself.

    NOTE: this function imports `google.adk.agents.LlmAgent` lazily so
    unit tests that don't exercise ADK don't pay the import cost. Once
    Phase L.3-L.5 land, ADK is on the hot path for lesson-plan + quiz
    + visual-aid too, so the import cost amortises away.
    """
    from google.adk.agents import LlmAgent  # noqa: PLC0415 — lazy import

    return LlmAgent(
        name="vidya_supervisor",
        model=get_orchestrator_model(),
        instruction=load_orchestrator_prompt(),
        sub_agents=[],
        tools=[],  # See docstring: output_schema + tools is unsafe on the Gemini API path.
        output_schema=IntentClassification,
        disallow_transfer_to_parent=True,
    )


__all__ = [
    # ADK supervisor builder (Phase L.1 addition).
    "build_vidya_agent",
    # Backwards-compat re-exports — callers should migrate to importing
    # from `prompts.py` / `gates.py` directly, but for now the symbols
    # stay here so tests + _behavioural keep working.
    "ALLOWED_FLOWS",
    "INSTANT_ANSWER_INTENT",
    "UNKNOWN_INTENT",
    "classify_action",
    "get_instant_answer_model",
    "get_orchestrator_model",
    "load_instant_answer_prompt",
    "load_orchestrator_prompt",
    "render_instant_answer_prompt",
    "render_orchestrator_prompt",
]
