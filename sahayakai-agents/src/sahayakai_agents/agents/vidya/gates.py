"""Intent-gate logic + model selectors for VIDYA (Phase L.1).

Split out of `agent.py` so the supervisor builder there can stay
small and focused on ADK construct wiring. This module owns:

- `classify_action` — turn an `IntentClassification` into either a
  `VidyaAction` (for the 9 routable flows) or `None` (for
  instantAnswer / unknown / hallucinated intents).
- `get_orchestrator_model` / `get_instant_answer_model` — env-overridable
  model selectors. The defaults match the Genkit flow today.

Phase L.1 deliverable. See
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

import os
from functools import lru_cache

import structlog

from .prompts import (
    ALLOWED_FLOWS,
    INSTANT_ANSWER_INTENT,
    UNKNOWN_INTENT,
)
from .schemas import (
    AllowedFlow,
    IntentClassification,
    VidyaAction,
    VidyaActionParams,
)

log = structlog.get_logger(__name__)


# ---- Action gate ---------------------------------------------------------


def classify_action(intent: IntentClassification) -> VidyaAction | None:
    """Convert an `IntentClassification` to a `VidyaAction` or None.

    Returns:
      - `None` for `instantAnswer` (handled inline) and `unknown`
        (router surfaces a polite fallback).
      - A populated `VidyaAction` for any of the 9 routable flows.
      - `None` defensively for any other (invalid) intent string.
        This is a fail-safe: a bad classifier output should never
        navigate the teacher to a non-existent route.
    """
    if intent.type in (INSTANT_ANSWER_INTENT, UNKNOWN_INTENT):
        return None
    if intent.type not in ALLOWED_FLOWS:
        # Defensive: classifier returned something we don't route.
        log.warning("vidya.classify_action.invalid_intent", intent_type=intent.type)
        return None

    # Cast through the Literal — mypy can't narrow `intent.type` to
    # `AllowedFlow` from a runtime `in` check, so we use the Literal
    # type explicitly for the assignment.
    flow: AllowedFlow = intent.type  # type: ignore[assignment]
    return VidyaAction(
        type="NAVIGATE_AND_FILL",
        flow=flow,
        params=VidyaActionParams(
            topic=intent.topic,
            gradeLevel=intent.gradeLevel,
            subject=intent.subject,
            language=intent.language,
            ncertChapter=None,
        ),
    )


# ---- Model selection -----------------------------------------------------


@lru_cache(maxsize=1)
def get_orchestrator_model() -> str:
    """Default Gemini variant for the intent classifier.

    VIDYA today (Genkit) uses `gemini-2.0-flash` for speed — the orb is
    a real-time UX surface and 2.5-flash latency would feel laggy.
    Override via `SAHAYAKAI_VIDYA_ORCHESTRATOR_MODEL` to A/B test 2.5.
    """
    return os.environ.get("SAHAYAKAI_VIDYA_ORCHESTRATOR_MODEL", "gemini-2.5-flash")


@lru_cache(maxsize=1)
def get_instant_answer_model() -> str:
    """Default Gemini variant for inline answers.

    Same speed-first reasoning as the orchestrator. Override via
    `SAHAYAKAI_VIDYA_INSTANT_ANSWER_MODEL`.
    """
    return os.environ.get("SAHAYAKAI_VIDYA_INSTANT_ANSWER_MODEL", "gemini-2.5-flash")


__all__ = [
    "classify_action",
    "get_instant_answer_model",
    "get_orchestrator_model",
]
