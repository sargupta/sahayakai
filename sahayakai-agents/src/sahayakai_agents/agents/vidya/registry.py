"""Sub-agent registry for VIDYA supervisor (Phase G).

VIDYA is the supervisor agent (the OmniOrb mic on every screen).
This registry catalogs every sub-agent it can route to, with the
metadata needed for two delegation paths:

1. **NAVIGATE_AND_FILL** (today) — the OmniOrb client opens the route
   and prefills the form. The supervisor only outputs the action; the
   client does the work.

2. **In-process delegation** (Phase B.4 onward, per-sub-agent) — VIDYA
   calls the sub-agent's router directly via Python import. No HTTP
   roundtrip. Today only `instant-answer` uses this path.

3. **Future: ADK Runner / A2A AgentTool** — once VIDYA runs through an
   ADK Runner, the registry's `endpoint` + `capability` fields feed
   the AgentTool definitions automatically. This is the canonical
   ADK supervisor pattern.

The registry is the single source of truth for:
- The 9 routable flow names (`AllowedFlow` enum mirrors this).
- The Cloud Run endpoint of each sub-agent's HTTP surface.
- The short capability sentence (used in the orchestrator prompt to
  help the model pick correctly between similar flows).

Adding a new sub-agent: append a new `SubAgent` entry here, update
`AllowedFlow` in schemas, register the router in `main.py`. The
prompt automatically picks up the capability blurb.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SubAgent:
    """One row in the sub-agent registry."""

    flow: str
    """Stable identifier — matches `AllowedFlow` Literal values."""

    endpoint: str
    """Cloud Run path of the sub-agent's HTTP surface (relative)."""

    capability: str
    """One-line description of what this sub-agent does. Used in the
    orchestrator prompt to disambiguate between similar flows."""

    requires_topic: bool = True
    """If True, the supervisor should reject requests without a topic."""

    inline_capable: bool = False
    """If True, the supervisor can call this sub-agent in-process and
    return the result inline (no NAVIGATE_AND_FILL). Today only
    `instant-answer` (which is not in `AllowedFlow`)."""


# The 9 routable flows VIDYA can dispatch to. Order is significant —
# the orchestrator prompt presents these in this order, and the model
# tends to anchor on earlier items in close ties.
SUB_AGENTS: tuple[SubAgent, ...] = (
    SubAgent(
        flow="lesson-plan",
        endpoint="/v1/lesson-plan/generate",
        capability=(
            "Full multi-activity lesson plan with engagement hook, "
            "explanation, practice, and assessment. Use for "
            "'teach me X' / 'plan a lesson on Y'."
        ),
    ),
    SubAgent(
        flow="quiz-generator",
        endpoint="/v1/quiz/generate",
        capability=(
            "Short quiz (3 difficulty variants) with MCQ + short-answer. "
            "Use for in-class practice or exit tickets."
        ),
    ),
    SubAgent(
        flow="visual-aid-designer",
        endpoint="/v1/visual-aid/generate",
        capability=(
            "Generates a labelled chalkboard-style diagram image. Use "
            "for diagrams, flashcards, illustrated handouts."
        ),
    ),
    SubAgent(
        flow="worksheet-wizard",
        endpoint="/v1/worksheet/generate",
        capability=(
            "Multi-activity worksheet (fill-in, MCQ, short-answer) with "
            "answer key. Use for homework or in-class practice sheets."
        ),
    ),
    SubAgent(
        flow="virtual-field-trip",
        endpoint="/v1/virtual-field-trip/plan",
        capability=(
            "Plans 4-6 stops on Google Earth with cultural analogies. "
            "Use for 'take students to' / 'virtual tour of'."
        ),
        requires_topic=True,
    ),
    SubAgent(
        flow="teacher-training",
        endpoint="/v1/teacher-training/generate",
        capability=(
            "Professional development micro-lesson on classroom "
            "management or pedagogy. Use for CPD-style requests."
        ),
    ),
    SubAgent(
        flow="rubric-generator",
        endpoint="/v1/rubric/generate",
        capability=(
            "Multi-criterion grading rubric with 3-4 performance levels. "
            "Use for 'grade this' / 'rubric for X assignment'."
        ),
    ),
    SubAgent(
        flow="exam-paper",
        endpoint="/v1/exam-paper/generate",
        capability=(
            "Full board-pattern exam paper with sections + marks-balanced "
            "questions. Use for CBSE / state-board / pre-board prep."
        ),
    ),
    SubAgent(
        flow="video-storyteller",
        endpoint="/v1/video-storyteller/recommend-queries",
        capability=(
            "5 categories of YouTube search queries for teachers. Use "
            "for 'find videos on X' / 'YouTube recommendations'."
        ),
        requires_topic=False,
    ),
)


# Inline-capable agents — supervisor can call directly without
# producing a NAVIGATE_AND_FILL action. Today only `instantAnswer`
# (not in AllowedFlow because it has no destination route).
INLINE_AGENTS: tuple[SubAgent, ...] = (
    SubAgent(
        flow="instantAnswer",
        endpoint="/v1/instant-answer/answer",
        capability=(
            "Direct factual answer with optional Google Search "
            "grounding. Use for 'what is' / 'when did' / 'why does'."
        ),
        requires_topic=False,
        inline_capable=True,
    ),
)


def get_sub_agent(flow: str) -> SubAgent | None:
    """Look up a sub-agent by flow name. Returns None if not found."""
    for agent in SUB_AGENTS:
        if agent.flow == flow:
            return agent
    for agent in INLINE_AGENTS:
        if agent.flow == flow:
            return agent
    return None


def render_capability_index() -> str:
    """Human-readable bullet list of every sub-agent's capability.

    Used by the orchestrator prompt to help the model disambiguate.
    """
    lines = []
    for agent in SUB_AGENTS:
        lines.append(f"- `{agent.flow}` — {agent.capability}")
    for agent in INLINE_AGENTS:
        lines.append(f"- `{agent.flow}` — {agent.capability}")
    return "\n".join(lines)


__all__ = [
    "INLINE_AGENTS",
    "SUB_AGENTS",
    "SubAgent",
    "get_sub_agent",
    "render_capability_index",
]
