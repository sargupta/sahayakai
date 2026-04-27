"""Instant-answer ADK agent.

Phase 6 of the SahayakAI hybrid migration. Single-stage tool-using
agent with Gemini Google Search grounding. See the Phase 6 plan doc
and `sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from .router import instant_answer_router
from .schemas import (
    InstantAnswerCore,
    InstantAnswerRequest,
    InstantAnswerResponse,
)

__all__ = [
    "InstantAnswerCore",
    "InstantAnswerRequest",
    "InstantAnswerResponse",
    "instant_answer_router",
]
