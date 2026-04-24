"""FastAPI sub-router for the parent-call agent.

G5 implementation: the previous 501 stubs are replaced with real calls
through `google.genai` wrapped in `run_resiliently` (telephony-bounded
backoff) and persisted to Firestore via the `SessionStore`.

Post-response guard: every reply passes through `assert_all_rules`
(forbidden-phrase, sentence-count, script-correctness per parent
language). A guard failure is treated as **fail-closed**: the router
returns HTTP 502 so the Next.js circuit breaker falls back to Genkit.
Wrong output to a real parent is worse than no output.

Review trace:
- P0 #4 shared Handlebars prompt via pystache.
- P0 #5 / #8 post-response guard + turn cap.
- P1 #11 `run_resiliently` on every model call, max 7s total budget.
- P1 #14 `AgentReplyCore` / `CallSummaryCore` are the model's contract;
  the wire schemas wrap them with telemetry.
- P2 #24 `cache_hit_ratio` surfaced in the response.
"""
from __future__ import annotations

import time
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter

from ..._behavioural import assert_all_rules
from ...config import get_settings
from ...resilience import extract_cache_metrics, run_resiliently
from ...session_store import SessionStore, TurnRecord
from ...shared.errors import AgentError, AISafetyBlockError
from .agent import (
    AgentReplyCore,
    CallSummaryCore,
    build_reply_context,
    build_summary_context,
    get_reply_agent_model,
    get_summary_agent_model,
    render_reply_prompt,
    render_summary_prompt,
    turn_cap_exceeded,
)
from .schemas import (
    AgentReplyRequest,
    AgentReplyResponse,
    CallSummaryRequest,
    CallSummaryResponse,
    TranscriptTurn,
)

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/parent-call", tags=["parent-call"])

# Process-scoped session store. Initialised lazily so tests can swap it.
_session_store: SessionStore | None = None


def _get_session_store() -> SessionStore:
    global _session_store
    if _session_store is None:
        _session_store = SessionStore()
    return _session_store


async def _call_gemini_structured(
    *,
    api_key: str,
    model: str,
    prompt: str,
    response_schema: type,
):
    """One Gemini call with structured JSON output.

    `google-genai` is imported lazily so tests can mock without installing
    the SDK. We request strict JSON matching the Pydantic schema via
    `response_mime_type='application/json'` + `response_schema=<type>`.
    """
    from google import genai  # type: ignore[import-untyped]
    from google.genai import types as genai_types  # type: ignore[import-untyped]

    client = genai.Client(api_key=api_key)
    return client.models.generate_content(
        model=model,
        contents=[{"role": "user", "parts": [{"text": prompt}]}],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=response_schema,
            temperature=0.6,
        ),
    )


def _extract_text(result) -> str:  # type: ignore[no-untyped-def]
    """Pull the model's JSON text out of a google-genai response."""
    text = getattr(result, "text", None)
    if text:
        return text
    candidates = getattr(result, "candidates", None) or []
    for cand in candidates:
        content = getattr(cand, "content", None)
        parts = getattr(content, "parts", None) or []
        for part in parts:
            text = getattr(part, "text", None)
            if text:
                return text
    raise AgentError(
        code="INTERNAL",
        message="Gemini returned empty response",
        http_status=502,
    )


# ---- Reply endpoint -------------------------------------------------------


@router.post("/reply", response_model=AgentReplyResponse)
async def parent_call_reply(payload: AgentReplyRequest) -> AgentReplyResponse:
    """Generate the next agent reply for an in-progress call.

    Flow:
      1. Load or accept transcript.
      2. Persist the parent's turn with OCC.
      3. Render shared prompt via pystache.
      4. Call Gemini structured, wrapped in run_resiliently.
      5. Parse into AgentReplyCore.
      6. Apply turn-cap enforcement (shouldEndCall at turn >= 6).
      7. Run post-response behavioural guard. Fail-closed on violation.
      8. Persist the agent's turn.
      9. Return wire response with telemetry.
    """
    settings = get_settings()
    started = time.monotonic()

    store = _get_session_store()
    transcript: list[TranscriptTurn]
    if payload.transcript is not None:
        transcript = list(payload.transcript)
    else:
        records = await store.load_transcript(payload.callSid)
        transcript = [
            TranscriptTurn(role=r.role, text=r.text)  # type: ignore[arg-type]
            for r in records
            if r.role in ("agent", "parent")
        ]

    # Record the parent's turn first.
    now_parent = datetime.now(UTC)
    await store.append_turn(
        TurnRecord(
            call_sid=payload.callSid,
            turn_number=payload.turnNumber,
            role="parent",
            text=payload.parentSpeech,
            created_at=now_parent,
        )
    )

    # Render + call.
    context = build_reply_context(
        student_name=payload.studentName,
        class_name=payload.className,
        subject=payload.subject,
        reason=payload.reason,
        teacher_message=payload.teacherMessage,
        teacher_name=payload.teacherName,
        school_name=payload.schoolName,
        parent_language=payload.parentLanguage,
        transcript=transcript
        + [TranscriptTurn(role="parent", text=payload.parentSpeech)],
        parent_speech=payload.parentSpeech,
        turn_number=payload.turnNumber,
        performance_summary=payload.performanceSummary,
    )
    prompt = render_reply_prompt(context)
    model = get_reply_agent_model()

    async def _do_call(api_key: str):  # type: ignore[no-untyped-def]
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=AgentReplyCore,
        )

    try:
        result = await run_resiliently(
            _do_call,
            settings.genai_keys,
            span_name="parent_call.reply",
            max_total_backoff_seconds=settings.max_total_backoff_seconds,
        )
    except AISafetyBlockError as exc:
        # Safety block: do NOT retry, do NOT surface the raw reason to the
        # user. Drop out with 422 and let Next.js fall back to a safe
        # canned response.
        log.warning(
            "parent_call.reply.safety_block", call_sid=payload.callSid, reason=str(exc)
        )
        raise

    text = _extract_text(result)
    try:
        core = AgentReplyCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "parent_call.reply.json_parse_failed",
            call_sid=payload.callSid,
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Model returned text that does not match AgentReplyCore",
            http_status=502,
        ) from exc

    # Turn-cap enforcement: shouldEndCall forced True at or past the cap.
    if turn_cap_exceeded(payload.turnNumber):
        core = core.model_copy(update={"shouldEndCall": True})

    # Post-response behavioural guard. Fail-closed.
    try:
        assert_all_rules(
            reply=core.reply,
            parent_language=payload.parentLanguage,
            turn_number=payload.turnNumber,
        )
    except AssertionError as exc:
        log.error(
            "parent_call.reply.behavioural_guard_failed",
            call_sid=payload.callSid,
            reason=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message=f"Behavioural guard failed: {exc}",
            http_status=502,
        ) from exc

    await store.append_turn(
        TurnRecord(
            call_sid=payload.callSid,
            turn_number=payload.turnNumber,
            role="agent",
            text=core.reply,
            created_at=datetime.now(UTC),
        )
    )
    if core.shouldEndCall:
        await store.mark_ended(payload.callSid)

    metrics = extract_cache_metrics(result)
    latency_ms = int((time.monotonic() - started) * 1000)

    return AgentReplyResponse(
        reply=core.reply,
        shouldEndCall=core.shouldEndCall,
        followUpQuestion=core.followUpQuestion,
        sessionId=payload.callSid,
        turnNumber=payload.turnNumber,
        latencyMs=latency_ms,
        modelUsed=model,
        cacheHitRatio=metrics.cache_hit_ratio if metrics else None,
    )


# ---- Summary endpoint -----------------------------------------------------


@router.post("/summary", response_model=CallSummaryResponse)
async def parent_call_summary(payload: CallSummaryRequest) -> CallSummaryResponse:
    """Produce a structured post-call summary.

    Summary is English-only regardless of `parentLanguage`. Enforced by
    the shared Handlebars instruction + validated via langdetect in a
    behavioural test (pending fixture work).
    """
    settings = get_settings()
    started = time.monotonic()

    context = build_summary_context(
        student_name=payload.studentName,
        class_name=payload.className,
        subject=payload.subject,
        reason=payload.reason,
        teacher_message=payload.teacherMessage,
        teacher_name=payload.teacherName,
        school_name=payload.schoolName,
        parent_language=payload.parentLanguage,
        transcript=list(payload.transcript),
        call_duration_seconds=payload.callDurationSeconds,
    )
    prompt = render_summary_prompt(context)
    model = get_summary_agent_model()

    async def _do_call(api_key: str):  # type: ignore[no-untyped-def]
        return await _call_gemini_structured(
            api_key=api_key,
            model=model,
            prompt=prompt,
            response_schema=CallSummaryCore,
        )

    result = await run_resiliently(
        _do_call,
        settings.genai_keys,
        span_name="parent_call.summary",
        max_total_backoff_seconds=settings.max_total_backoff_seconds,
    )

    text = _extract_text(result)
    try:
        core = CallSummaryCore.model_validate_json(text)
    except Exception as exc:
        log.error(
            "parent_call.summary.json_parse_failed",
            call_sid=payload.callSid,
            raw_excerpt=text[:200],
            error=str(exc),
        )
        raise AgentError(
            code="INTERNAL",
            message="Model returned text that does not match CallSummaryCore",
            http_status=502,
        ) from exc

    metrics = extract_cache_metrics(result)
    latency_ms = int((time.monotonic() - started) * 1000)

    return CallSummaryResponse(
        parentResponse=core.parentResponse,
        parentConcerns=core.parentConcerns,
        parentCommitments=core.parentCommitments,
        actionItemsForTeacher=core.actionItemsForTeacher,
        guidanceGiven=core.guidanceGiven,
        parentSentiment=core.parentSentiment,
        callQuality=core.callQuality,
        followUpNeeded=core.followUpNeeded,
        followUpSuggestion=core.followUpSuggestion,
        sessionId=payload.callSid,
        latencyMs=latency_ms,
        modelUsed=model,
        cacheHitRatio=metrics.cache_hit_ratio if metrics else None,
    )
