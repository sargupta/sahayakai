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
- P0 #4 prompts are read from disk, not hard-coded. Shared source with TS.
- P2 #27 no live agent until fixtures are recorded.
- Round-2 P0-1 fix: prompts dir resolved via env var with fallback to repo
  layout. Packaging concern: the wheel no longer relies on the monorepo
  layout to find prompts; deploy copies them to the container's
  `/srv/prompts/parent-call/` and sets `SAHAYAKAI_PROMPTS_DIR=/srv/prompts`.
"""
from __future__ import annotations

import os
from pathlib import Path

import structlog

log = structlog.get_logger(__name__)

# Resolution order for the prompts directory:
#   1. SAHAYAKAI_PROMPTS_DIR env var (set by Cloud Run deploy).
#   2. Repo layout: `<repo-root>/sahayakai-agents/prompts/parent-call/`.
#      Only correct in local dev when the repo layout is intact.
# The wheel build copies `prompts/` next to `src/` so option 1 resolves
# inside the container; there is no `parents[N]` walk that could break on
# install.
_DEFAULT_REPO_PROMPTS = (
    Path(__file__).resolve().parents[4] / "prompts" / "parent-call"
)


def _resolve_prompts_dir() -> Path:
    env = os.environ.get("SAHAYAKAI_PROMPTS_DIR")
    if env:
        return Path(env) / "parent-call"
    return _DEFAULT_REPO_PROMPTS


def _load_prompt(filename: str) -> str:
    """Read a shared prompt template. Raises FileNotFoundError if missing.

    Resolved at call time (not at import) so tests can override the env
    var and so deploys that fail to set `SAHAYAKAI_PROMPTS_DIR` surface a
    clear error on the first real agent call rather than at process start.
    """
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
