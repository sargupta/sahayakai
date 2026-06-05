"""Pydantic models for quiz generator agent (Phase E.1)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): list[str] elements bounded.
# Phase 1a: bounds kept on REQUEST elements only (dispatcher hygiene);
# response/output models use plain `str` to match Genkit Zod baseline.
_McqOption = Annotated[str, StringConstraints(max_length=1000)]
_BloomsLevel = Annotated[str, StringConstraints(max_length=50)]

# 10 MB cap on the optional textbook-page image data URI.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024

QuizQuestionType = Literal[
    "multiple_choice", "fill_in_the_blanks", "short_answer", "true_false",
]

QuizDifficulty = Literal["easy", "medium", "hard"]


class QuizQuestion(BaseModel):
    """One quiz question (response model — Gemini structured-output shape)."""

    model_config = ConfigDict(extra="forbid")

    questionText: str
    questionType: QuizQuestionType
    options: list[str] | None = None
    correctAnswer: str
    explanation: str
    difficultyLevel: QuizDifficulty


class QuizGeneratorRequest(BaseModel):
    """Request body for `POST /v1/quiz/generate`.

    Returns a `QuizVariantsResponse` with three difficulty variants
    (easy / medium / hard), each generated in parallel server-side.
    """

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3, max_length=500)
    imageDataUri: str | None = Field(default=None, max_length=_DATA_URI_MAX_LEN)
    numQuestions: int = Field(default=5, ge=1, le=30)
    questionTypes: list[QuizQuestionType] = Field(min_length=1, max_length=4)
    gradeLevel: str | None = Field(default=None, max_length=50)
    language: str | None = Field(default=None, max_length=20)
    bloomsTaxonomyLevels: list[_BloomsLevel] | None = Field(default=None, max_length=10)
    targetDifficulty: QuizDifficulty | None = None
    subject: str | None = Field(default=None, max_length=100)
    teacherContext: str | None = Field(default=None, max_length=1000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern; dispatcher enforces auth.
    userId: str = Field(min_length=1, max_length=128)


class QuizGeneratorCore(BaseModel):
    """One difficulty variant of the quiz (Gemini responseSchema shape).

    Phase 1a Fix 2/3: bounds dropped to match Genkit Zod baseline
    (no per-field maxLength; no questions[] max_items).
    """

    model_config = ConfigDict(extra="forbid")

    title: str
    questions: list[QuizQuestion] = Field(min_length=1)
    teacherInstructions: str | None = None
    gradeLevel: str | None = None
    subject: str | None = None


class QuizGeneratorResponse(BaseModel):
    """Single-variant response (used internally; Variants response is
    the wire shape)."""

    model_config = ConfigDict(extra="forbid")

    title: str
    questions: list[QuizQuestion] = Field(min_length=1)
    teacherInstructions: str | None = None
    gradeLevel: str | None = None
    subject: str | None = None


class QuizVariantsResponse(BaseModel):
    """The wire response for `POST /v1/quiz/generate`. Three optional
    variants — any of them may be `None` if the model failed for that
    difficulty (matches the existing Genkit Promise.allSettled
    pattern)."""

    model_config = ConfigDict(extra="forbid")

    easy: QuizGeneratorResponse | None = None
    medium: QuizGeneratorResponse | None = None
    hard: QuizGeneratorResponse | None = None
    gradeLevel: str | None = None
    subject: str | None = None
    topic: str

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
    variantsGenerated: int = Field(ge=0, le=3)
