"""VIDYA orchestrator agent: SahayakAI multi-agent intent classifier.

Ports the existing TS orchestrator (`agent-router.ts` + `agent-definitions.ts`
+ `/api/assistant`) to the Python sidecar. Two-stage flow:

  1. Classify teacher intent into one of 11 labels (9 routable flows
     + `instantAnswer` + `unknown`).
  2. Either return a `NAVIGATE_AND_FILL` action (routable flows) or
     produce an inline answer (`instantAnswer`).

Phase 5 of the hybrid migration plan. See
`sahayakai-main/.claude/plans/ai-agent-quality-and-migration-plan.md`.
"""
from __future__ import annotations

from .router import vidya_router
from .schemas import VidyaAction, VidyaActionParams, VidyaRequest, VidyaResponse

__all__ = [
    "VidyaAction",
    "VidyaActionParams",
    "VidyaRequest",
    "VidyaResponse",
    "vidya_router",
]
