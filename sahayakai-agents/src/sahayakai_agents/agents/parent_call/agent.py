"""ADK LlmAgent wiring for the parent-call flow.

This module is deliberately thin in the scaffold commit. The actual ADK
`LlmAgent` construction, tool registration, and prompt rendering will be
completed in a follow-up commit once:
1. The shared Handlebars prompts are byte-identical-verified against the TS
   source.
2. A pystache / Handlebars renderer has been picked and its output matches
   Node's Handlebars renderer on a canned input set.
3. Parity fixtures are recorded from the existing Genkit flow.

For now this file provides the agent builder signature and a deterministic
fake for tests to exercise the rest of the stack (router, session store,
auth) without paying model cost.

Review trace:
- P0 #4: prompts are read from disk, not hard-coded. Shared source with TS.
- P2 #27: no live agent until fixtures are recorded.
"""
from __future__ import annotations

from pathlib import Path

import structlog

log = structlog.get_logger(__name__)

_PROMPTS_DIR = Path(__file__).resolve().parents[3] / "prompts" / "parent-call"


def _load_prompt(filename: str) -> str:
    """Read a shared prompt template. Raises FileNotFoundError if missing."""
    path = _PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Shared prompt missing: {path}. "
            "Did you sync prompts from sahayakai-main/src/ai/prompts/?"
        )
    return path.read_text(encoding="utf-8")


def load_reply_prompt() -> str:
    """Raw Handlebars template for per-turn reply."""
    return _load_prompt("reply.handlebars")


def load_summary_prompt() -> str:
    """Raw Handlebars template for post-call summary."""
    return _load_prompt("summary.handlebars")


# Placeholder for Phase 1 G5: actual ADK agent construction.
#
# def build_parent_call_agent(model: str = "gemini-2.5-flash") -> LlmAgent:
#     from google.adk.agents import LlmAgent
#     return LlmAgent(
#         name="parent_call_reply",
#         model=model,
#         instruction=load_reply_prompt(),  # rendered per-call with pystache
#         tools=[],  # none for Phase 1
#     )
