"""Phase J.4 hot-fix (forensic P1 #20): element-bound regression tests.

Before this hot-fix, every `list[str]` field on every agent schema
bound the LIST length but not the ELEMENT length. Concrete attack:

    POST /v1/lesson-plan/generate
    body = {"materials": ["A" * 5_000_000] * 30, ...}

    -> 150 MB request body that validates cleanly and pins the
       container's memory.

These tests assert each fixed `list[<Annotated str>]` field rejects
elements over its declared `max_length`. We pick five representative
agents (lesson-plan, parent-call summary, video storyteller, vidya
NCERT chapter ref, lesson-plan EvaluatorVerdict) — one bound per
semantic so a future loosening trips the test.

The exam-paper, quiz, and worksheet schemas also got element bounds
in this commit; their dedicated tests live alongside the existing
agent-specific schema test files (each agent's `__init__.py` imports
its router which is touched by parallel Phase J.3 changes — keeping
this file's imports to schema modules whose package `__init__.py` has
no router-side-effect avoids cross-agent test-time collisions).
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.agents.exam_paper.schemas import (
    ExamPaperRequest,
)
from sahayakai_agents.agents.lesson_plan.schemas import (
    EvaluatorVerdict,
    LessonPlanCore,
    LessonPlanRequest,
    NcertChapter,
    RubricScores,
)
from sahayakai_agents.agents.parent_call.schemas import (
    CallSummaryResponse,
)
from sahayakai_agents.agents.quiz.schemas import (
    QuizGeneratorRequest,
    QuizQuestion,
)
from sahayakai_agents.agents.video_storyteller.schemas import (
    VideoStorytellerCategories,
)
from sahayakai_agents.agents.vidya.schemas import NcertChapterRef

pytestmark = pytest.mark.unit


# ── lesson-plan ───────────────────────────────────────────────────────────


def _activity_dict() -> dict[str, str]:
    return {
        "phase": "Engage",
        "name": "x",
        "description": "desc " * 10,
        "duration": "5",
    }


class TestLessonPlanRequestUserIdRequired:
    """Phase J.4 (B3 inconsistency): `LessonPlanRequest.userId` was
    OPTIONAL while every other agent's userId is REQUIRED.
    Made consistent."""

    def test_user_id_is_required(self) -> None:
        with pytest.raises(ValidationError):
            LessonPlanRequest(  # type: ignore[call-arg]
                topic="Photosynthesis",
                language="en",
            )

    def test_user_id_present_passes(self) -> None:
        req = LessonPlanRequest(
            topic="Photosynthesis",
            language="en",
            userId="teacher-uid-1",
        )
        assert req.userId == "teacher-uid-1"


class TestLessonPlanRequestGradeLevelsBounds:
    """Bound on `gradeLevels` element strings (50 chars each)."""

    def test_grade_level_string_at_max_passes(self) -> None:
        req = LessonPlanRequest(
            topic="Photosynthesis",
            language="en",
            userId="teacher-uid-1",
            gradeLevels=["G" * 50],
        )
        assert req.gradeLevels == ["G" * 50]

    def test_grade_level_string_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LessonPlanRequest(
                topic="Photosynthesis",
                language="en",
                userId="teacher-uid-1",
                gradeLevels=["G" * 51],
            )


class TestLessonPlanCoreObjectivesBounds:
    """Bound on `objectives` element strings (300 chars each)."""

    def test_objective_at_max_passes(self) -> None:
        plan = LessonPlanCore(
            title="Title",
            gradeLevel="Class 5",
            duration="45 min",
            subject="Science",
            objectives=["O" * 300, "shorter objective for variety"],
            keyVocabulary=None,
            materials=["M" * 500],
            activities=[_activity_dict()],
            assessment=None,
            homework=None,
            language="en",
        )
        assert len(plan.objectives[0]) == 300

    def test_objective_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LessonPlanCore(
                title="Title",
                gradeLevel="Class 5",
                duration="45 min",
                subject="Science",
                objectives=["O" * 301],
                keyVocabulary=None,
                materials=[],
                activities=[_activity_dict()],
                assessment=None,
                homework=None,
                language="en",
            )


class TestLessonPlanCoreMaterialsBounds:
    """The headline attack: a single material element of 5MB chars
    used to validate cleanly. Now capped at 500."""

    def test_material_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            LessonPlanCore(
                title="Title",
                gradeLevel="Class 5",
                duration="45 min",
                subject="Science",
                objectives=["short"],
                keyVocabulary=None,
                materials=["M" * 501],
                activities=[_activity_dict()],
                assessment=None,
                homework=None,
                language="en",
            )


class TestNcertChapterLearningOutcomesBounds:
    """Bound on `learningOutcomes` element strings (300 chars each)
    on the NCERT chapter hint."""

    def test_learning_outcome_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            NcertChapter(
                title="Photosynthesis",
                number=4,
                subject="Science",
                learningOutcomes=["L" * 301],
            )


class TestEvaluatorVerdictFailReasonsBounds:
    """Bound on `fail_reasons` element strings (500 chars each)."""

    def test_fail_reason_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            EvaluatorVerdict(
                scores=RubricScores(
                    grade_level_alignment=0.5,
                    objective_assessment_match=0.5,
                    resource_level_realism=0.5,
                    language_naturalness=0.5,
                    scaffolding_present=0.5,
                    inclusion_signals=0.5,
                    cultural_appropriateness=0.5,
                ),
                safety=False,
                rationale="r",
                fail_reasons=["F" * 501],
            )


# ── parent-call summary ───────────────────────────────────────────────────


class TestParentCallSummaryElementBounds:
    """Bounds on summary lists (`parentConcerns`, `parentCommitments`,
    `actionItemsForTeacher`, `guidanceGiven`) — 1000 chars each.

    Important: without this bound a CallSummaryResponse with a 1MB
    string × 20 entries on `parentConcerns` would clear the per-list
    20-entry cap but blow Firestore's 1MB per-document limit when
    persisted to `agent_sessions/{callSid}`."""

    def _kwargs(self, **overrides: object) -> dict[str, object]:
        base: dict[str, object] = {
            "parentResponse": "ok",
            "parentConcerns": [],
            "parentCommitments": [],
            "actionItemsForTeacher": [],
            "guidanceGiven": [],
            "parentSentiment": "cooperative",
            "callQuality": "productive",
            "followUpNeeded": False,
            "sessionId": "x",
            "latencyMs": 1,
            "modelUsed": "gemini-2.5-flash",
        }
        base.update(overrides)
        return base

    def test_parent_concern_at_max_passes(self) -> None:
        resp = CallSummaryResponse(**self._kwargs(parentConcerns=["C" * 1000]))
        assert len(resp.parentConcerns[0]) == 1000

    def test_parent_concern_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            CallSummaryResponse(**self._kwargs(parentConcerns=["C" * 1001]))


# ── video-storyteller ─────────────────────────────────────────────────────


class TestVideoStorytellerElementBounds:
    """Bounds on YouTube search-query strings (300 chars each).

    YouTube's actual search-query cap is ~100 chars; 300 is a generous
    ceiling for natural-language queries the model emits."""

    def test_search_query_at_max_passes(self) -> None:
        cats = VideoStorytellerCategories(
            pedagogy=["P" * 300],
            storytelling=["x"],
            govtUpdates=["x"],
            courses=["x"],
            topRecommended=["x"],
        )
        assert cats.pedagogy == ["P" * 300]

    def test_search_query_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            VideoStorytellerCategories(
                pedagogy=["P" * 301],
                storytelling=["x"],
                govtUpdates=["x"],
                courses=["x"],
                topRecommended=["x"],
            )


# ── vidya NcertChapterRef ─────────────────────────────────────────────────


class TestVidyaNcertChapterRefBounds:
    """Bound on `learningOutcomes` element strings inside vidya's
    NCERT chapter reference (300 chars each)."""

    def test_learning_outcome_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            NcertChapterRef(
                number=1,
                title="Photosynthesis",
                learningOutcomes=["L" * 301],
            )


# ── exam-paper ────────────────────────────────────────────────────────────


class TestExamPaperElementBounds:
    """Bounds on `chapters` (300 chars each) on the ExamPaperRequest."""

    def test_chapter_at_max_passes(self) -> None:
        req = ExamPaperRequest(
            board="CBSE",
            gradeLevel="Class 10",
            subject="Mathematics",
            chapters=["C" * 300],
            userId="teacher-uid-1",
        )
        assert req.chapters[0].startswith("C")

    def test_chapter_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            ExamPaperRequest(
                board="CBSE",
                gradeLevel="Class 10",
                subject="Mathematics",
                chapters=["C" * 301],
                userId="teacher-uid-1",
            )


# ── quiz ──────────────────────────────────────────────────────────────────


class TestQuizElementBounds:
    """Bound on `bloomsTaxonomyLevels` (50 chars each) and MCQ
    `options` (1000 chars each) on the QuizQuestion."""

    def test_blooms_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            QuizGeneratorRequest(
                topic="Photosynthesis",
                questionTypes=["multiple_choice"],
                bloomsTaxonomyLevels=["B" * 51],
                userId="teacher-uid-1",
            )

    def test_mcq_option_above_max_rejected(self) -> None:
        with pytest.raises(ValidationError):
            QuizQuestion(
                questionText="Sample?",
                questionType="multiple_choice",
                options=["O" * 1001, "B", "C", "D"],
                correctAnswer="B",
                explanation="because B is correct.",
                difficultyLevel="easy",
            )
