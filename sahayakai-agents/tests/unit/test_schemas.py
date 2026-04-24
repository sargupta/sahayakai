"""Schema validation tests — Pydantic is the source of truth for the
parent-call contract. These tests document the invariants that the
TypeScript-side codegen must preserve.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.parent_call.schemas import (
    AgentReplyRequest,
    AgentReplyResponse,
    CallSummaryRequest,
    CallSummaryResponse,
    TranscriptTurn,
)


pytestmark = pytest.mark.unit


def _valid_reply_request_kwargs(**overrides):  # type: ignore[no-untyped-def]
    base = dict(
        callSid="CA" + "x" * 32,
        turnNumber=1,
        studentName="Arav Kumar",
        className="Class 5",
        subject="Science",
        reason="Homework follow-up",
        teacherMessage="Please ensure homework is done daily.",
        parentLanguage="hi",
        parentSpeech="Haan, theek hai.",
    )
    base.update(overrides)
    return base


class TestTranscriptTurn:
    def test_accepts_agent_role(self) -> None:
        t = TranscriptTurn(role="agent", text="Namaste")
        assert t.role == "agent"

    def test_accepts_parent_role(self) -> None:
        t = TranscriptTurn(role="parent", text="Ji, boliye")
        assert t.role == "parent"

    def test_rejects_other_role(self) -> None:
        with pytest.raises(ValidationError):
            TranscriptTurn(role="teacher", text="...")  # type: ignore[arg-type]

    def test_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            TranscriptTurn(role="agent", text="...", unexpected=True)  # type: ignore[call-arg]


class TestAgentReplyRequest:
    def test_valid_minimum_payload(self) -> None:
        req = AgentReplyRequest(**_valid_reply_request_kwargs())
        assert req.turnNumber == 1
        assert req.transcript is None  # optional — sidecar will load from Firestore
        assert req.performanceSummary is None

    def test_turn_number_lower_bound(self) -> None:
        with pytest.raises(ValidationError):
            AgentReplyRequest(**_valid_reply_request_kwargs(turnNumber=0))

    def test_turn_number_upper_bound(self) -> None:
        # Hard cap at 12 matches telephony-loop safety; the pedagogy wants
        # shouldEndCall=true at 6, but the schema allows up to 12 to keep
        # Next.js safe if it mis-counts.
        with pytest.raises(ValidationError):
            AgentReplyRequest(**_valid_reply_request_kwargs(turnNumber=13))

    def test_parent_language_too_short(self) -> None:
        with pytest.raises(ValidationError):
            AgentReplyRequest(**_valid_reply_request_kwargs(parentLanguage="e"))

    def test_optional_transcript_passes_through(self) -> None:
        req = AgentReplyRequest(
            **_valid_reply_request_kwargs(
                transcript=[{"role": "agent", "text": "Namaste ji"}]
            )
        )
        assert req.transcript is not None
        assert req.transcript[0].role == "agent"

    def test_rejects_extra_fields(self) -> None:
        with pytest.raises(ValidationError):
            AgentReplyRequest(
                **_valid_reply_request_kwargs(unauthorizedField="oops")
            )


class TestAgentReplyResponse:
    def test_additive_fields_are_present(self) -> None:
        r = AgentReplyResponse(
            reply="Namaste, bataayein.",
            shouldEndCall=False,
            sessionId="CA" + "x" * 32,
            turnNumber=1,
            latencyMs=420,
            modelUsed="gemini-2.5-flash",
            cacheHitRatio=0.42,
        )
        assert r.latencyMs == 420
        assert r.cacheHitRatio == 0.42

    def test_cache_hit_ratio_bounds(self) -> None:
        with pytest.raises(ValidationError):
            AgentReplyResponse(
                reply="...",
                shouldEndCall=False,
                sessionId="x",
                turnNumber=1,
                latencyMs=1,
                modelUsed="gemini-2.5-flash",
                cacheHitRatio=1.5,
            )


class TestCallSummary:
    def test_summary_request_accepts_transcript(self) -> None:
        req = CallSummaryRequest(
            callSid="CAxxx",
            studentName="Arav",
            className="Class 5",
            subject="Science",
            reason="...",
            teacherMessage="...",
            parentLanguage="hi",
            transcript=[{"role": "agent", "text": "..."}],
        )
        assert req.callDurationSeconds is None

    def test_summary_response_enforces_enums(self) -> None:
        with pytest.raises(ValidationError):
            CallSummaryResponse(
                parentResponse="ok",
                parentConcerns=[],
                parentCommitments=[],
                actionItemsForTeacher=["Follow up"],
                guidanceGiven=[],
                parentSentiment="ecstatic",  # type: ignore[arg-type]
                callQuality="productive",
                followUpNeeded=False,
                sessionId="x",
                latencyMs=1,
                modelUsed="gemini-2.5-flash",
            )
