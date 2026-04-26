"""Unit tests for `agents/lesson_plan/agent.py`.

Pure functions only — no Gemini calls. Tests `classify_verdict`
gate logic and that the three render functions produce non-empty
strings against well-formed contexts.

Phase 3 §3.5a.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.lesson_plan.agent import (
    QUALITY_HARD_FAIL_AXIS_COUNT,
    QUALITY_PASS_AXIS_COUNT,
    QUALITY_PASS_THRESHOLD,
    classify_verdict,
    render_evaluator_prompt,
    render_reviser_prompt,
    render_writer_prompt,
)
from sahayakai_agents.agents.lesson_plan.schemas import (
    EvaluatorVerdict,
    RubricScores,
)

pytestmark = pytest.mark.unit


# ── Test helper: build an EvaluatorVerdict with overrides ───────────────


def _verdict(
    *,
    safety: bool = True,
    grade: float = 0.9,
    objective: float = 0.9,
    resource: float = 0.9,
    language: float = 0.9,
    scaffolding: float = 0.9,
    inclusion: float = 0.9,
    cultural: float = 0.9,
    rationale: str = "ok",
    fail_reasons: list[str] | None = None,
) -> EvaluatorVerdict:
    return EvaluatorVerdict(
        scores=RubricScores(
            grade_level_alignment=grade,
            objective_assessment_match=objective,
            resource_level_realism=resource,
            language_naturalness=language,
            scaffolding_present=scaffolding,
            inclusion_signals=inclusion,
            cultural_appropriateness=cultural,
        ),
        safety=safety,
        rationale=rationale,
        fail_reasons=fail_reasons or [],
    )


class TestClassifyVerdict:
    def test_all_high_safety_true_passes(self) -> None:
        assert classify_verdict(_verdict()) == "pass"

    def test_safety_false_hard_fails_even_with_high_quality(self) -> None:
        # Round-2 audit P1 PLAN-3 regression: safety is the master gate.
        # Even with all 7 axes at 1.0, safety=false → hard_fail.
        v = _verdict(safety=False, grade=1.0, objective=1.0, resource=1.0,
                     language=1.0, scaffolding=1.0, inclusion=1.0, cultural=1.0)
        assert classify_verdict(v) == "hard_fail"

    def test_six_axes_pass_threshold_passes(self) -> None:
        # Exactly 6 of 7 axes at threshold.
        v = _verdict(grade=0.79, objective=0.80, resource=0.80, language=0.80,
                     scaffolding=0.80, inclusion=0.80, cultural=0.80)
        assert classify_verdict(v) == "pass"

    def test_five_axes_pass_threshold_revises(self) -> None:
        # 5 of 7 ≥ 0.80, 2 below — soft fail (revise) territory.
        v = _verdict(grade=0.79, objective=0.79, resource=0.80, language=0.80,
                     scaffolding=0.80, inclusion=0.80, cultural=0.80)
        assert classify_verdict(v) == "revise"

    def test_three_axes_pass_threshold_hard_fails(self) -> None:
        # < 4 axes pass → hard fail (regardless of safety).
        v = _verdict(grade=0.79, objective=0.79, resource=0.79, language=0.79,
                     scaffolding=0.80, inclusion=0.80, cultural=0.80)
        assert classify_verdict(v) == "hard_fail"

    def test_exactly_four_axes_pass_revises(self) -> None:
        # 4 axes pass — minimum to avoid hard_fail; quality bar not met → revise.
        v = _verdict(grade=0.79, objective=0.79, resource=0.79, language=0.80,
                     scaffolding=0.80, inclusion=0.80, cultural=0.80)
        assert classify_verdict(v) == "revise"

    def test_constants_self_consistent(self) -> None:
        # Sanity: pass count > hard-fail count, both within [1, 7].
        assert 1 <= QUALITY_HARD_FAIL_AXIS_COUNT < QUALITY_PASS_AXIS_COUNT <= 7
        assert 0.0 < QUALITY_PASS_THRESHOLD <= 1.0


class TestPromptRendering:
    def test_writer_renders_with_minimal_context(self) -> None:
        prompt = render_writer_prompt({
            "topic": "Photosynthesis",
            "language": "en",
            "gradeLevels": ["Class 5"],
        })
        assert "Photosynthesis" in prompt
        assert "Class 5" in prompt
        assert "5E" in prompt  # 5E model section landed
        assert len(prompt) > 500  # template body is substantial

    def test_writer_renders_with_full_context(self) -> None:
        prompt = render_writer_prompt({
            "topic": "Fractions",
            "language": "hi",
            "gradeLevels": ["Class 4"],
            "useRuralContext": True,
            "resourceLevel": "low",
            "ncertChapter": {
                "number": 7,
                "title": "Fractions",
                "learningOutcomes": ["Identify halves", "Compare fractions"],
            },
        })
        assert "Fractions" in prompt
        assert "Class 4" in prompt
        assert "Chapter 7" in prompt
        assert "Identify halves" in prompt
        assert "INDIAN RURAL CONTEXT" in prompt

    def test_evaluator_renders_with_plan_and_request(self) -> None:
        prompt = render_evaluator_prompt({
            "plan": '{"title":"X","activities":[]}',
            "request": '{"topic":"Y"}',
        })
        assert '{"title":"X"' in prompt
        assert '{"topic":"Y"' in prompt
        # Evaluator must list each rubric axis.
        for axis in [
            "grade_level_alignment",
            "objective_assessment_match",
            "resource_level_realism",
            "language_naturalness",
            "scaffolding_present",
            "inclusion_signals",
            "cultural_appropriateness",
            "safety",
        ]:
            assert axis in prompt, f"Evaluator prompt missing axis {axis!r}"

    def test_reviser_renders_with_fail_reasons(self) -> None:
        prompt = render_reviser_prompt({
            "plan": '{"title":"X"}',
            "request": '{"topic":"Y"}',
            "fail_reasons": ["Activity 2 needs better scaffolding", "Missing assessment"],
        })
        assert "Activity 2 needs better scaffolding" in prompt
        assert "Missing assessment" in prompt
        assert "v2" in prompt or "revise" in prompt.lower()
