"""Pydantic schemas for the assessment-scanner agent.

1:1 port of `sahayakai-main/src/ai/schemas/assessment-scanner-schemas.ts`
(plus the constants module + Pass-1/Pass-2 inner schemas declared inline
in `assessment-scanner.ts`).

Phase-2 scope: up to 3 pages per scan, six subject families
(Mathematics, Science, EVS, Social Science / History / Geography /
Civics, Hindi, English) plus an "Other" generic fallback.
"""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# ---------------------------------------------------------------------------
# Constants -- port of assessment-scanner-constants.ts
# ---------------------------------------------------------------------------

ASSESSMENT_DEMO_PAGE_CAP = 3
PHASE_1_PAGE_CAP = ASSESSMENT_DEMO_PAGE_CAP  # back-compat alias (deprecated)
ASSESSMENT_MAX_PAGES = 15

ASSESSMENT_SUPPORTED_SUBJECTS: tuple[str, ...] = (
    "Mathematics",
    "Science",
    "Environmental Studies (EVS)",
    "Social Science",
    "History",
    "Geography",
    "Civics",
    "Hindi",
    "English",
    "Other",
)

SubjectRubricFamily = Literal[
    "mathematics", "science", "evs", "social_science", "language", "other",
]


def resolve_subject_family(subject: str) -> SubjectRubricFamily:
    """Mirror of `resolveSubjectFamily()` in TS constants module."""
    s = subject.strip().lower()
    if s in {"mathematics", "maths", "math"}:
        return "mathematics"
    if s == "science":
        return "science"
    if "environmental" in s or s == "evs":
        return "evs"
    if s in {"social science", "history", "geography", "civics"}:
        return "social_science"
    if s in {"english", "hindi"}:
        return "language"
    return "other"


# ---------------------------------------------------------------------------
# Enum string types
# ---------------------------------------------------------------------------

QuestionType = Literal[
    "mcq",
    "fill_blank",
    "short_answer",
    "long_answer",
    "math_calculation",
    "diagram",
    "match_following",
    "true_false",
]

ImageQualityIssue = Literal[
    "blurry",
    "glare",
    "low_light",
    "rotated",
    "partial_crop",
    "multiple_handwriting",
    "none",
]

PageType = Literal[
    "question_only",
    "answer_only",
    "mixed",
    "cover",
    "unreadable",
]

MistakePattern = Literal[
    "conceptual",
    "computational",
    "transcription",
    "incomplete",
    "off_topic",
    "none",
]

AssessmentStatus = Literal["graded", "partial", "failed"]


# String length bounds (mirror TS implicit caps).
_ShortStr = Annotated[str, StringConstraints(max_length=2000)]
_LongStr = Annotated[str, StringConstraints(max_length=10000)]


# ---------------------------------------------------------------------------
# PASS 1: Page extraction
# ---------------------------------------------------------------------------


class ExtractedQuestion(BaseModel):
    """One extracted question + the student's handwritten answer (response model)."""

    model_config = ConfigDict(extra="forbid")

    questionId: str
    questionType: QuestionType
    questionText: str
    questionTextConfidence: float = Field(ge=0.0, le=1.0)
    studentAnswerRaw: str
    studentAnswerInterpreted: str
    answerConfidence: float = Field(ge=0.0, le=1.0)
    isAttempted: bool
    workShown: str | None = None
    marksAvailable: float | None = None


class PageScan(BaseModel):
    """Result of Pass-1 extraction for ONE page (response model)."""

    model_config = ConfigDict(extra="forbid")

    pageIndex: int = Field(ge=0)
    pageType: PageType
    handwritingConfidence: float = Field(ge=0.0, le=1.0)
    imageQualityIssues: list[ImageQualityIssue] = Field(min_length=1)
    detectedLanguage: str
    questions: list[ExtractedQuestion] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# PASS 2: Rubric-grounded scoring
# ---------------------------------------------------------------------------


class PartialCreditStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step: str
    earned: float = Field(ge=0.0)
    max: float = Field(ge=0.0)


class TeacherOverrides(BaseModel):
    """Teacher corrections layered on the AI grade (response model)."""

    model_config = ConfigDict(extra="forbid")

    marksAwarded: float | None = Field(default=None, ge=0.0)
    feedback: str | None = None
    studentFacingFeedback: str | None = None
    studentAnswer: str | None = None
    editedAt: str | None = None


class GradedQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    questionId: str
    pageIndex: int = Field(ge=0)
    questionText: str
    studentAnswer: str
    expectedAnswer: str
    marksAwarded: float = Field(ge=0.0)
    marksMax: float = Field(ge=0.0)
    partialCreditBreakdown: list[PartialCreditStep] = Field(default_factory=list)
    feedback: str
    studentFacingFeedback: str
    conceptTested: str
    ncertChapterId: str | None = None
    mistakePattern: MistakePattern | None = None
    needsTeacherReview: bool
    confidence: float = Field(ge=0.0, le=1.0)
    teacherOverrides: TeacherOverrides | None = None


class ConceptMastery(BaseModel):
    model_config = ConfigDict(extra="forbid")

    chapterId: str
    chapterTitle: str
    masteryPct: float = Field(ge=0.0, le=100.0)
    weakestConcept: str | None = None


# ---------------------------------------------------------------------------
# Pass-2 inner output schema (the model's direct response shape)
# ---------------------------------------------------------------------------


class Pass2Output(BaseModel):
    """Direct response shape from the Pass-2 scoring prompt."""

    model_config = ConfigDict(extra="forbid")

    questions: list[GradedQuestion] = Field(default_factory=list)
    recommendedNextSteps: list[str] = Field(default_factory=list)
    studentRecommendations: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Public request + response
# ---------------------------------------------------------------------------


class AssessmentScannerRequest(BaseModel):
    """Request body for `POST /v1/assessment-scanner/grade`."""

    model_config = ConfigDict(extra="forbid")

    assessmentId: str = Field(
        min_length=1,
        max_length=64,
        # Loose UUID-shape check; full validation happens in route guard.
        pattern=r"^[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}$",
    )
    studentId: str | None = Field(default=None, max_length=128)
    classId: str | None = Field(default=None, max_length=128)
    subject: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    language: str = Field(default="English", min_length=1, max_length=20)
    pageUrls: list[str] = Field(
        min_length=1,
        max_length=ASSESSMENT_MAX_PAGES,
    )
    ncertChapterIds: list[str] | None = Field(default=None, max_length=10)
    totalMaxMarks: int | None = Field(default=None, ge=1)
    teacherAnswerKeyText: str | None = Field(default=None, max_length=20000)
    educationBoard: str | None = Field(default=None, max_length=100)
    # The TS dispatcher pre-resolves NCERT chapter context server-side
    # (chapters live in `src/data/ncert/*.ts`, TS-only) and ships the
    # rendered Markdown block here. When omitted, Pass-2 uses a
    # "general knowledge" fallback string.
    ncertContext: str | None = Field(default=None, max_length=50000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class AssessmentScannerResponse(BaseModel):
    """Wire response for the assessment-scanner sidecar."""

    model_config = ConfigDict(extra="forbid")

    assessmentId: str
    status: AssessmentStatus
    pageCount: int = Field(ge=0)
    totalAwardedMarks: float = Field(ge=0.0)
    totalMaxMarks: float = Field(ge=0.0)
    scorePct: float = Field(ge=0.0, le=100.0)
    letterGrade: str
    questions: list[GradedQuestion]
    classAverageAtScan: float | None = None
    conceptMastery: list[ConceptMastery] = Field(default_factory=list)
    recommendedNextSteps: list[str] = Field(default_factory=list)
    studentRecommendations: list[str] = Field(default_factory=list)
    needsReviewCount: int = Field(ge=0)
    imageQualityWarnings: list[str] = Field(default_factory=list)
    teacherEditedAt: str | None = None
    errorMessage: str | None = None

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)


__all__ = [
    "ASSESSMENT_DEMO_PAGE_CAP",
    "ASSESSMENT_MAX_PAGES",
    "ASSESSMENT_SUPPORTED_SUBJECTS",
    "AssessmentScannerRequest",
    "AssessmentScannerResponse",
    "AssessmentStatus",
    "ConceptMastery",
    "ExtractedQuestion",
    "GradedQuestion",
    "ImageQualityIssue",
    "MistakePattern",
    "PHASE_1_PAGE_CAP",
    "PageScan",
    "PageType",
    "PartialCreditStep",
    "Pass2Output",
    "QuestionType",
    "SubjectRubricFamily",
    "TeacherOverrides",
    "resolve_subject_family",
]
