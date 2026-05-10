"""Pydantic models for quiz generator agent (Phase E.1)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): list[str] elements bounded.
_McqOption = Annotated[str, StringConstraints(max_length=1000)]
_BloomsLevel = Annotated[str, StringConstraints(max_length=50)]

# 10 MB cap on the optional textbook-page image data URI.
_DATA_URI_MAX_LEN = 10 * 1024 * 1024

QuizQuestionType = Literal[
    "multiple_choice", "fill_in_the_blanks", "short_answer", "true_false",
]

QuizDifficulty = Literal["easy", "medium", "hard"]


class QuizQuestion(BaseModel):
    """One quiz question."""

    model_config = ConfigDict(extra="forbid")

    questionText: str = Field(min_length=3, max_length=2000)
    questionType: QuizQuestionType
    options: list[_McqOption] | None = Field(default=None, max_length=10)
    correctAnswer: str = Field(min_length=1, max_length=2000)
    explanation: str = Field(min_length=10, max_length=3000)
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
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class QuizGeneratorCore(BaseModel):
    """One difficulty variant of the quiz."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    questions: list[QuizQuestion] = Field(min_length=1, max_length=30)
    teacherInstructions: str | None = Field(default=None, max_length=2000)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)


class QuizGeneratorResponse(BaseModel):
    """Single-variant response (used internally; Variants response is
    the wire shape)."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    questions: list[QuizQuestion] = Field(min_length=1, max_length=30)
    teacherInstructions: str | None = Field(default=None, max_length=2000)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)


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
