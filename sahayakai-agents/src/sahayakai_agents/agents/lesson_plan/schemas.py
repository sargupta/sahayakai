"""Pydantic models — source of truth for the lesson-plan contract.

Every field from the TypeScript Zod schemas in
`sahayakai-main/src/ai/flows/lesson-plan-generator.ts` is mirrored here
with equivalent types. **When TS and Python disagree, Python wins.**
TypeScript types are regenerated from these models via
`datamodel-codegen` in CI (same flow as the parent-call schemas).

Phase 3 §3.1 deliverable.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Same 11-language set as parent-call. Lesson-plan also accepts an
# unspecified default → English server-side; we still constrain to the
# enum to catch typos at the edge.
LessonPlanLanguage = Literal[
    "en", "hi", "bn", "te", "mr", "ta", "gu", "kn", "pa", "ml", "or"
]

ResourceLevel = Literal["low", "medium", "high"]
DifficultyLevel = Literal["remedial", "standard", "advanced"]

# 5E model phase — pinned literal so the evaluator can require structured
# coverage of all five.
ActivityPhase = Literal["Engage", "Explore", "Explain", "Elaborate", "Evaluate"]


class NcertChapter(BaseModel):
    """Optional NCERT chapter alignment hint passed by the client."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    number: int = Field(ge=1, le=30)
    subject: str | None = Field(default=None, max_length=100)
    learningOutcomes: list[str] = Field(default_factory=list, max_length=20)


# --- Request -------------------------------------------------------------


class LessonPlanRequest(BaseModel):
    """Request body for POST /v1/lesson-plan/generate.

    Mirrors `LessonPlanInputSchema` in TS verbatim. Optional fields
    follow the TS shape (string-typed) — no enum coercion at the edge.
    """

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=1, max_length=500)
    language: LessonPlanLanguage | None = None
    gradeLevels: list[str] | None = Field(default=None, max_length=12)
    # Image data URI for OCR / multi-modal — Phase 3 ignores it
    # server-side but accepts it on the wire so a future Phase 4
    # multi-modal extension is non-breaking.
    imageDataUri: str | None = Field(default=None, max_length=10_000_000)
    userId: str | None = Field(default=None, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$")
    teacherContext: str | None = Field(default=None, max_length=2000)
    useRuralContext: bool | None = None
    ncertChapter: NcertChapter | None = None
    resourceLevel: ResourceLevel | None = None
    difficultyLevel: DifficultyLevel | None = None
    subject: str | None = Field(default=None, max_length=100)


# --- Output (model contract) --------------------------------------------


class KeyVocabulary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str = Field(min_length=1, max_length=100)
    meaning: str = Field(min_length=1, max_length=500)


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phase: ActivityPhase
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    duration: str = Field(min_length=1, max_length=50)
    teacherTips: str | None = Field(default=None, max_length=2000)
    understandingCheck: str | None = Field(default=None, max_length=1000)


class LessonPlanCore(BaseModel):
    """Model output schema — what the writer agent MUST return.

    Phase 3 §3.1: same field set as `LessonPlanOutputSchema` in TS.
    No defaults on optional fields per google-genai issue #699 (same
    workaround as parent-call's `AgentReplyCore`).
    """

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=300)
    gradeLevel: str | None = Field(max_length=50)
    duration: str | None = Field(max_length=50)
    subject: str | None = Field(max_length=100)
    objectives: list[str] = Field(min_length=1, max_length=15)
    keyVocabulary: list[KeyVocabulary] | None = Field(max_length=20)
    materials: list[str] = Field(default_factory=list, max_length=30)
    activities: list[Activity] = Field(min_length=1, max_length=10)
    assessment: str | None = Field(max_length=2000)
    homework: str | None = Field(max_length=2000)
    language: str | None = Field(max_length=10)


# --- Evaluator output (rubric) ------------------------------------------


class RubricScores(BaseModel):
    """The 7 quality axes from §Pedagogical Rubric. Each is a float
    [0, 1]. The evaluator agent emits this shape AND a separate
    boolean `safety` field — see `EvaluatorVerdict` below."""

    model_config = ConfigDict(extra="forbid")

    grade_level_alignment: float = Field(ge=0.0, le=1.0)
    objective_assessment_match: float = Field(ge=0.0, le=1.0)
    resource_level_realism: float = Field(ge=0.0, le=1.0)
    language_naturalness: float = Field(ge=0.0, le=1.0)
    scaffolding_present: float = Field(ge=0.0, le=1.0)
    inclusion_signals: float = Field(ge=0.0, le=1.0)
    cultural_appropriateness: float = Field(ge=0.0, le=1.0)


class EvaluatorVerdict(BaseModel):
    """What the evaluator agent returns. The router uses these fields
    to decide whether to: pass v1, revise, or hard-fail.

    Round-2 audit P1 PLAN-3 fix: `safety` is a separate boolean (not
    a float-with-1.0-only gate). Quality axes float in [0, 1]; safety
    is binary.
    """

    model_config = ConfigDict(extra="forbid")

    scores: RubricScores
    safety: bool
    rationale: str = Field(min_length=1, max_length=2000)
    fail_reasons: list[str] = Field(default_factory=list, max_length=10)


# --- Wire response ------------------------------------------------------


class LessonPlanResponse(BaseModel):
    """Response for POST /v1/lesson-plan/generate.

    Same superset shape as parent-call: parity fields match TS verbatim,
    plus additive sidecar telemetry.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity fields — MUST match TS LessonPlanOutputSchema.
    title: str = Field(max_length=300)
    gradeLevel: str | None = Field(default=None, max_length=50)
    duration: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    objectives: list[str] = Field(min_length=1, max_length=15)
    keyVocabulary: list[KeyVocabulary] | None = Field(default=None, max_length=20)
    materials: list[str] = Field(default_factory=list, max_length=30)
    activities: list[Activity] = Field(min_length=1, max_length=10)
    assessment: str | None = Field(default=None, max_length=2000)
    homework: str | None = Field(default=None, max_length=2000)
    language: str | None = Field(default=None, max_length=10)

    # Additive telemetry.
    sidecarVersion: str = Field(max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(max_length=200)
    cacheHitRatio: float | None = Field(default=None, ge=0.0, le=1.0)
    # Number of evaluator-revise loops actually run (0 = writer
    # passed first time; 1 = one revise; 2 = max per cost cap).
    revisionsRun: int = Field(ge=0, le=2)
    # Final evaluator verdict — exposed so the dispatcher can see
    # the rubric breakdown for observability without the model body.
    rubric: EvaluatorVerdict
