"""FastAPI sub-router for the parent-call agent.

Endpoints:
- POST /v1/parent-call/reply     per-turn reply
- POST /v1/parent-call/summary   post-call summary
- A2A alias: POST /a2a/tasks/send routes here when the task type is
  `parent-call-reply` or `parent-call-summary`.

In this scaffold commit, the endpoints return HTTP 501 with a clear reason.
The wire schemas, auth, validation, and persistence paths are fully wired so
the contract is enforced end-to-end; only the ADK model call is stubbed.

Review trace:
- P1 #13 A2A compatibility: the same handler function responds to both
  `/v1/parent-call/reply` and the A2A-aliased path.
- P1 #14 Pydantic source of truth: request/response models live in `schemas.py`.
"""
from __future__ import annotations

import time

import structlog
from fastapi import APIRouter, HTTPException, status

from .schemas import (
    AgentReplyRequest,
    AgentReplyResponse,
    CallSummaryRequest,
    CallSummaryResponse,
)

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/parent-call", tags=["parent-call"])


@router.post("/reply", response_model=AgentReplyResponse)
async def parent_call_reply(payload: AgentReplyRequest) -> AgentReplyResponse:
    """Generate the next agent reply for an in-progress call.

    Scaffold: validates + logs + returns 501. G5 wires the ADK call.
    """
    started = time.monotonic()
    log.info(
        "parent_call.reply.received",
        call_sid=payload.callSid,
        turn_number=payload.turnNumber,
        parent_language=payload.parentLanguage,
        has_transcript=payload.transcript is not None,
    )
    # Intentional: fail loud. The scaffold must never be mistaken for a real
    # agent. Next.js circuit breaker will fall back to Genkit on this 501.
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "NOT_IMPLEMENTED",
            "message": (
                "parent-call reply handler is scaffolded only. "
                "ADK LlmAgent wiring ships in G5."
            ),
            "scaffoldLatencyMs": int((time.monotonic() - started) * 1000),
        },
    )


@router.post("/summary", response_model=CallSummaryResponse)
async def parent_call_summary(payload: CallSummaryRequest) -> CallSummaryResponse:
    """Produce a structured post-call summary.

    Scaffold: validates + logs + returns 501. G5 wires the ADK call.
    """
    started = time.monotonic()
    log.info(
        "parent_call.summary.received",
        call_sid=payload.callSid,
        turns=len(payload.transcript),
        parent_language=payload.parentLanguage,
    )
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "code": "NOT_IMPLEMENTED",
            "message": (
                "parent-call summary handler is scaffolded only. "
                "ADK LlmAgent wiring ships in G5."
            ),
            "scaffoldLatencyMs": int((time.monotonic() - started) * 1000),
        },
    )
