"""Pydantic models — source of truth for the lesson-plan contract.

Every field from the TypeScript Zod schemas in
`sahayakai-main/src/ai/flows/lesson-plan-generator.ts` is mirrored here
with equivalent types. **When TS and Python disagree, Python wins.**
TypeScript types are regenerated from these models via
`datamodel-codegen` in CI (same flow as the parent-call schemas).

Phase 3 §3.1 deliverable.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): list[str] fields bound the LIST
# but not the ELEMENTS. A 30-element list of 5MB strings = 150 MB POST
# body that validates cleanly. Bounds chosen per semantic meaning.
_LearningOutcome = Annotated[str, StringConstraints(max_length=300)]
_GradeLevelStr = Annotated[str, StringConstraints(max_length=50)]
_Objective = Annotated[str, StringConstraints(max_length=300)]
_Material = Annotated[str, StringConstraints(max_length=500)]
_FailReason = Annotated[str, StringConstraints(max_length=500)]

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
    learningOutcomes: list[_LearningOutcome] = Field(
        default_factory=list, max_length=20,
    )


# --- Request -------------------------------------------------------------


class LessonPlanRequest(BaseModel):
    """Request body for POST /v1/lesson-plan/generate.

    Mirrors `LessonPlanInputSchema` in TS verbatim. Optional fields
    follow the TS shape (string-typed) — no enum coercion at the edge.
    """

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=1, max_length=500)
    language: LessonPlanLanguage | None = None
    gradeLevels: list[_GradeLevelStr] | None = Field(default=None, max_length=12)
    # Image data URI for OCR / multi-modal — Phase 3 ignores it
    # server-side but accepts it on the wire so a future Phase 4
    # multi-modal extension is non-breaking.
    imageDataUri: str | None = Field(default=None, max_length=10_000_000)
    # Phase J.4 (B3 inconsistency): every other agent's userId is
    # required. Making LessonPlanRequest consistent. Authenticated
    # callers always have a uid; the Next.js dispatcher injects it
    # before forwarding to the sidecar.
    # Phase 1a Fix 1: drop opaque-ID regex pattern; dispatcher enforces auth.
    userId: str = Field(min_length=1, max_length=128)
    teacherContext: str | None = Field(default=None, max_length=2000)
    useRuralContext: bool | None = None
    ncertChapter: NcertChapter | None = None
    resourceLevel: ResourceLevel | None = None
    difficultyLevel: DifficultyLevel | None = None
    subject: str | None = Field(default=None, max_length=100)
    # Hyperlocal fields (Phase localisation) — forwarded by the
    # sahayakai-main dispatcher when the teacher's profile has a
    # state/district. `regionalContextBlock` is a pre-rendered prompt
    # snippet (crops/festivals/geography) computed server-side in the
    # Genkit flow; the ADK writer consumes it verbatim for parity.
    # Optional; `extra="forbid"` is retained so genuine schema drift
    # still surfaces as a 422.
    state: str | None = Field(default=None, max_length=100)
    district: str | None = Field(default=None, max_length=100)
    regionalContextBlock: str | None = Field(default=None, max_length=4000)


# --- Output (model contract) --------------------------------------------


class KeyVocabulary(BaseModel):
    model_config = ConfigDict(extra="forbid")

    term: str
    meaning: str


class Activity(BaseModel):
    model_config = ConfigDict(extra="forbid")

    phase: ActivityPhase
    name: str
    description: str
    duration: str
    teacherTips: str | None = None
    understandingCheck: str | None = None


class LessonPlanCore(BaseModel):
    """Model output schema — what the writer agent MUST return.

    Phase 3 §3.1: same field set as `LessonPlanOutputSchema` in TS.
    Phase 1a Fix 2/3: bounds dropped to match Genkit Zod baseline (no
    per-field maxLength; no array max_items). min_length=1 retained
    only where Genkit's required-field semantics imply at least one
    element.
    """

    model_config = ConfigDict(extra="forbid")

    title: str
    gradeLevel: str | None = None
    duration: str | None = None
    subject: str | None = None
    objectives: list[str]
    keyVocabulary: list[KeyVocabulary] | None = None
    materials: list[str] = Field(default_factory=list)
    activities: list[Activity]
    assessment: str | None = None
    homework: str | None = None
    language: str | None = None


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
    rationale: str
    fail_reasons: list[str] = Field(default_factory=list)


# --- Wire response ------------------------------------------------------


class LessonPlanResponse(BaseModel):
    """Response for POST /v1/lesson-plan/generate.

    Same superset shape as parent-call: parity fields match TS verbatim,
    plus additive sidecar telemetry.
    """

    model_config = ConfigDict(extra="forbid")

    # Parity fields — MUST match TS LessonPlanOutputSchema.
    title: str
    gradeLevel: str | None = None
    duration: str | None = None
    subject: str | None = None
    objectives: list[str]
    keyVocabulary: list[KeyVocabulary] | None = None
    materials: list[str] = Field(default_factory=list)
    activities: list[Activity]
    assessment: str | None = None
    homework: str | None = None
    language: str | None = None

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
