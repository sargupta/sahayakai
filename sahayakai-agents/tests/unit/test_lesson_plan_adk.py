"""Unit tests pinning the ADK construct lesson-plan now builds (Phase L.3).

Phase L.3 — `build_lesson_plan_agent()` returns a real
`google.adk.agents.LoopAgent` whose three sub-agents own the
writer / evaluator / reviser steps and emit `escalate=True` to
terminate the loop early. Before this phase the router ran a
hand-rolled procedural Python loop. These tests guard against
regressing back to that hand-rolled shape AND they pin the gate
logic embedded in the evaluator's escalation decision.

ADK 1.31's actual `LoopAgent` API (the one installed):
  - max_iterations: optional int cap
  - Loop terminates early when a sub-agent emits an event with
    `actions.escalate=True`
  - There are NO `should_continue` / `escalate_on` kwargs — the
    planning brief's pseudocode for those was wrong; we encode the
    same logic via state-aware sub-agents.

Tests cover:
  - The factory returns a `LoopAgent` instance.
  - `sub_agents` has exactly 3 entries (writer, evaluator, reviser).
  - `max_iterations == 2` (writer + evaluator + revise + evaluator).
  - The evaluator sub-agent's escalation logic matches the
    pre-L.3 `classify_verdict`:
      - revise on v1 → no escalation (loop continues to reviser)
      - pass on v1 → escalate (loop terminates after evaluator)
      - hard_fail on v1 → escalate (no reviser run)
      - any decision on v2 → escalate (one-revision budget)
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest

pytestmark = pytest.mark.unit


# ── Imports from the SUT ──────────────────────────────────────────────────

# The lesson-plan agent module imports are at module-level (no shimming
# needed — these tests don't fight `sys.modules["google.genai"]` because
# they don't go through Runner).
from sahayakai_agents.agents.lesson_plan.agent import (  # noqa: E402
    build_evaluator_agent,
    build_lesson_plan_agent,
    build_reviser_agent,
    build_writer_agent,
)


# ── Fixtures: stub session + invocation context for sub-agent runs ───────


def _good_plan_dict() -> dict[str, Any]:
    """Minimal LessonPlanCore-shaped dict the evaluator sub-agent reads
    out of state via `LessonPlanCore.model_validate`."""
    return {
        "title": "Photosynthesis basics for Class 5 learners",
        "gradeLevel": "Class 5",
        "duration": "45 min",
        "subject": "Science",
        "objectives": [
            "Students will identify chlorophyll as the pigment that captures sunlight",
        ],
        "keyVocabulary": None,
        "materials": ["chart paper"],
        "activities": [
            {
                "phase": "Engage",
                "name": "leaf riddle",
                "description": "Show two leaves and ask why one is greener.",
                "duration": "5 min",
                "teacherTips": None,
                "understandingCheck": None,
            },
        ],
        "assessment": None,
        "homework": None,
        "language": "en",
    }


def _verdict_dict(
    *,
    safety: bool = True,
    grade: float = 0.9,
    objective: float = 0.9,
    resource: float = 0.9,
    language: float = 0.9,
    scaffolding: float = 0.9,
    inclusion: float = 0.9,
    cultural: float = 0.9,
    fail_reasons: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "scores": {
            "grade_level_alignment": grade,
            "objective_assessment_match": objective,
            "resource_level_realism": resource,
            "language_naturalness": language,
            "scaffolding_present": scaffolding,
            "inclusion_signals": inclusion,
            "cultural_appropriateness": cultural,
        },
        "safety": safety,
        "rationale": "auto-generated test verdict",
        "fail_reasons": fail_reasons or [],
    }


class _StubSession:
    """Bare-minimum stand-in for ADK's ``Session`` — only ``state``."""

    def __init__(self, state: dict[str, Any]) -> None:
        self.state = state


class _StubCtx:
    """Bare-minimum stand-in for ``InvocationContext``.

    The sub-agents only read ``ctx.session.state``, ``ctx.invocation_id``,
    and ``ctx.branch``, so a tiny stub suffices and keeps these tests
    free of ADK Runner machinery.
    """

    def __init__(self, state: dict[str, Any]) -> None:
        self.session = _StubSession(state)
        self.invocation_id = "test-invocation"
        self.branch = None


class _StubSettings:
    max_total_backoff_seconds = 7.0


def _base_request_dict() -> dict[str, Any]:
    """A minimal `LessonPlanRequest`-shaped dict for state seeding."""
    return {
        "topic": "Photosynthesis",
        "language": "en",
        "gradeLevels": ["Class 5"],
        "useRuralContext": False,
        "resourceLevel": "low",
        "userId": "teacher-uid-1",
    }


async def _drive(sub_agent: Any, state: dict[str, Any]) -> list[Any]:
    """Drive a single sub-agent against a stub context, return events."""
    ctx = _StubCtx(state)
    events: list[Any] = []
    async for event in sub_agent._run_async_impl(ctx):  # type: ignore[attr-defined]
        events.append(event)
    return events


# ── Tests on the top-level LoopAgent shape ────────────────────────────────


class TestBuildLessonPlanAgent:
    def test_build_lesson_plan_agent_returns_loop_agent(self) -> None:
        """The factory returns a real ADK ``LoopAgent``, not a hand-
        rolled runtime object. Phase L.3's whole point."""
        from google.adk.agents import LoopAgent  # noqa: PLC0415

        agent = build_lesson_plan_agent()
        assert isinstance(agent, LoopAgent), (
            "build_lesson_plan_agent must return google.adk.agents.LoopAgent. "
            f"Got: {type(agent).__name__}"
        )

    def test_loop_agent_has_3_sub_agents(self) -> None:
        """sub_agents = [writer, evaluator, reviser]. Order matters
        — that's the literal sequence the LoopAgent executes per
        iteration, and the gate logic in the evaluator depends on
        seeing v1-then-v2 in that order."""
        agent = build_lesson_plan_agent()
        assert len(agent.sub_agents) == 3, (
            f"Expected 3 sub_agents (writer, evaluator, reviser); "
            f"got {len(agent.sub_agents)}."
        )
        names = [sa.name for sa in agent.sub_agents]
        assert "writer" in names[0], (
            f"sub_agents[0] should be the writer; got {names[0]!r}"
        )
        assert "evaluator" in names[1], (
            f"sub_agents[1] should be the evaluator; got {names[1]!r}"
        )
        assert "reviser" in names[2], (
            f"sub_agents[2] should be the reviser; got {names[2]!r}"
        )

    def test_loop_agent_max_iterations_is_2(self) -> None:
        """max_iterations=2 → at most writer + evaluator + reviser +
        evaluator-on-v2 = 4 sub-agent steps. With state-aware no-op
        guards in writer + reviser, that's also at most 4 Gemini
        calls (matches the pre-L.3 cost cap)."""
        agent = build_lesson_plan_agent()
        assert agent.max_iterations == 2, (
            f"LoopAgent.max_iterations must be 2; got {agent.max_iterations}"
        )


# ── Tests on the evaluator sub-agent's gate logic ─────────────────────────
#
# These pin the WHAT-USED-TO-BE-A-CALLBACK behaviour: the planning
# brief's `should_continue` / `escalate_on` are not part of the actual
# ADK 1.31 LoopAgent API, so we encoded the same gate logic inside the
# evaluator's escalation decision. These tests assert that decision.


class TestEvaluatorEscalationGate:
    """The evaluator sub-agent emits ``escalate=True`` when the loop
    should terminate. Equivalent to the pre-L.3 `classify_verdict`
    plus the v2-budget rule."""

    def _state_with_v1_only(self, verdict_text: str) -> dict[str, Any]:
        """State seeded so the evaluator scores v1 (no v2 in state)."""
        return {
            "lesson_plan_v1": _good_plan_dict(),
            "lesson_plan_request": _base_request_dict(),
            "lesson_plan_api_keys": ("fake-key",),
            "lesson_plan_settings": _StubSettings(),
            # Test seam: when this is set, the patched
            # `_call_gemini_structured` returns this canned text.
            "_test_eval_response": verdict_text,
        }

    def _state_with_v2(self, verdict_text: str) -> dict[str, Any]:
        """State seeded so the evaluator scores v2 (v1 + v2 in state)."""
        return {
            "lesson_plan_v1": _good_plan_dict(),
            "lesson_plan_v2": _good_plan_dict(),
            "lesson_plan_verdict_v1": _verdict_dict(
                safety=True, grade=0.7, objective=0.7,
                fail_reasons=["x"],
            ),
            "lesson_plan_request": _base_request_dict(),
            "lesson_plan_api_keys": ("fake-key",),
            "lesson_plan_settings": _StubSettings(),
            "_test_eval_response": verdict_text,
        }

    def _patch_gemini(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Replace `_call_gemini_structured` so the evaluator pulls its
        fake response off the seeded state's `_test_eval_response` key
        — keeps the test purely sync + ADK-free."""
        from sahayakai_agents.agents.lesson_plan import agent as agent_mod

        async def _fake(
            *,
            api_key: str,
            model: str,
            prompt: str,
            response_schema: type,
        ) -> Any:
            # The fake returns a result with `.text` set; the agent
            # module's `_extract_text` reads `.text` first. The test
            # supplies the response text via a state slot the helper
            # carries from the caller — but state is per-context, not
            # per-call. So we stash on the test class via closure.
            class _FakeResult:
                text = _CURRENT_RESPONSE.get("text", "")
                usage_metadata = None
                candidates: list[Any] = []
            return _FakeResult()

        monkeypatch.setattr(agent_mod, "_call_gemini_structured", _fake)

    def test_should_continue_returns_true_on_revise_verdict(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Loop must continue when v1 verdict is `revise`.

        ``classify_verdict`` returns ``"revise"`` when safety=True
        AND 4-5 of 7 axes pass. With ``escalate_on`` semantics that
        means escalate=False → loop continues to the reviser.
        """
        verdict_revise = json.dumps(_verdict_dict(
            safety=True, grade=0.7, objective=0.7,
            fail_reasons=["weak grade alignment", "vague objective"],
        ))
        _CURRENT_RESPONSE["text"] = verdict_revise
        self._patch_gemini(monkeypatch)
        agent = build_evaluator_agent()
        events = asyncio.run(_drive(agent, self._state_with_v1_only(verdict_revise)))
        assert len(events) == 1
        assert events[0].actions.escalate in (None, False), (
            "On revise verdict, evaluator must NOT escalate so the "
            f"loop continues to the reviser. Got escalate={events[0].actions.escalate!r}"
        )

    def test_should_continue_returns_false_on_pass_verdict(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Loop must terminate when v1 verdict is `pass`.

        ``classify_verdict`` returns ``"pass"`` when safety=True AND
        ≥6 of 7 axes pass. Evaluator escalates → loop ends after
        evaluator (reviser does not run; reviser's no-op guard is
        irrelevant because escalate=True breaks the iteration first).
        """
        verdict_pass = json.dumps(_verdict_dict(safety=True))
        _CURRENT_RESPONSE["text"] = verdict_pass
        self._patch_gemini(monkeypatch)
        agent = build_evaluator_agent()
        events = asyncio.run(_drive(agent, self._state_with_v1_only(verdict_pass)))
        assert len(events) == 1
        assert events[0].actions.escalate is True, (
            "On pass verdict, evaluator must escalate to terminate "
            "the loop before the reviser runs."
        )

    def test_escalate_on_returns_true_on_hard_fail(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Loop must terminate immediately on ``hard_fail``.

        ``classify_verdict`` returns ``"hard_fail"`` when safety=False
        OR <4 of 7 axes pass. The hard-fail short-circuit must NOT
        run the reviser — that's what the original procedural loop
        called out and what the brief mandates. Evaluator escalates
        → loop ends after evaluator.
        """
        verdict_hard = json.dumps(_verdict_dict(
            safety=False, fail_reasons=["caste reinforcement detected"],
        ))
        _CURRENT_RESPONSE["text"] = verdict_hard
        self._patch_gemini(monkeypatch)
        agent = build_evaluator_agent()
        events = asyncio.run(_drive(agent, self._state_with_v1_only(verdict_hard)))
        assert len(events) == 1
        assert events[0].actions.escalate is True, (
            "On hard_fail verdict, evaluator must escalate to "
            "terminate the loop BEFORE the reviser runs."
        )

    def test_v2_evaluation_always_escalates(
        self, monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Once a v2 plan is in state, ANY verdict on v2 must escalate.

        We've used our 1-revision budget. The router applies the
        "never amplify" rule on v2 hard_fails, but the LOOP must end.
        This is the v2-budget rule the planning brief's
        ``escalate_on`` callback would otherwise encode.
        """
        # Even a `revise` verdict on v2 (which would normally NOT
        # escalate on v1) must escalate here.
        verdict_revise = json.dumps(_verdict_dict(
            safety=True, grade=0.7, objective=0.7,
            fail_reasons=["still weak"],
        ))
        _CURRENT_RESPONSE["text"] = verdict_revise
        self._patch_gemini(monkeypatch)
        agent = build_evaluator_agent()
        events = asyncio.run(_drive(agent, self._state_with_v2(verdict_revise)))
        assert len(events) == 1
        assert events[0].actions.escalate is True, (
            "Evaluating v2 must always escalate (one-revision budget). "
            f"Got escalate={events[0].actions.escalate!r}"
        )


# ── Tests on the writer / reviser idempotency guards ─────────────────────


class TestSubAgentIdempotency:
    """Writer + reviser must no-op on iteration 2 so the loop never
    produces a v3 / re-runs the writer. These guards exist because
    LoopAgent re-runs all sub_agents per iteration (no `should_continue`
    callback in the actual ADK API)."""

    def test_writer_noops_when_v1_already_in_state(self) -> None:
        """Writer's iteration-2 no-op: state has v1, writer must yield
        an event without state_delta (no second writer call)."""
        state = {
            "lesson_plan_v1": _good_plan_dict(),
            "lesson_plan_request": _base_request_dict(),
            "lesson_plan_api_keys": ("fake-key",),
            "lesson_plan_settings": _StubSettings(),
        }
        agent = build_writer_agent()
        events = asyncio.run(_drive(agent, state))
        assert len(events) == 1
        # No state_delta means no v1 overwrite + no extra Gemini call.
        # `state_delta` is `dict[str, object]` and defaults to {}; we
        # check that no `lesson_plan_v1` key was written.
        assert "lesson_plan_v1" not in events[0].actions.state_delta, (
            "Writer must NOT re-write lesson_plan_v1 when it's already "
            "present in state."
        )

    def test_reviser_noops_when_v2_already_in_state(self) -> None:
        """Reviser's iteration-2 no-op: state has v2, reviser must
        skip without making a Gemini call."""
        state = {
            "lesson_plan_v1": _good_plan_dict(),
            "lesson_plan_v2": _good_plan_dict(),
            "lesson_plan_verdict_v1": _verdict_dict(
                safety=True, grade=0.7, objective=0.7,
                fail_reasons=["x"],
            ),
            "lesson_plan_request": _base_request_dict(),
            "lesson_plan_api_keys": ("fake-key",),
            "lesson_plan_settings": _StubSettings(),
        }
        agent = build_reviser_agent()
        events = asyncio.run(_drive(agent, state))
        assert len(events) == 1
        assert "lesson_plan_v2" not in events[0].actions.state_delta, (
            "Reviser must NOT re-write lesson_plan_v2 when it's already "
            "present in state."
        )


# Module-level shared store used by the patched gemini helper because
# the closure inside `_patch_gemini` only has access to module state.
_CURRENT_RESPONSE: dict[str, str] = {"text": ""}
