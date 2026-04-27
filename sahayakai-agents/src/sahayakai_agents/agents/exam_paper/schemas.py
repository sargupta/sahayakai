"""Pydantic models for exam paper generator (Phase E.2)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ExamDifficulty = Literal["easy", "moderate", "hard", "mixed"]


class ExamPaperQuestion(BaseModel):
    """One question on the paper."""

    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1, le=200)
    text: str = Field(min_length=3, max_length=4000)
    marks: float = Field(ge=0, le=100)
    options: list[str] | None = Field(default=None, max_length=10)
    internalChoice: str | None = Field(default=None, max_length=4000)
    answerKey: str | None = Field(default=None, max_length=8000)
    markingScheme: str | None = Field(default=None, max_length=4000)
    source: str = Field(default="AI Generated", min_length=1, max_length=100)


class ExamPaperSection(BaseModel):
    """One section of the paper (e.g. Section A — MCQs)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=300)
    totalMarks: float = Field(ge=0, le=500)
    questions: list[ExamPaperQuestion] = Field(min_length=1, max_length=50)


class BlueprintChapterEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chapter: str = Field(min_length=1, max_length=200)
    marks: float = Field(ge=0, le=500)


class BlueprintDifficultyEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level: str = Field(min_length=1, max_length=50)
    percentage: float = Field(ge=0, le=100)


class BlueprintSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chapterWise: list[BlueprintChapterEntry] = Field(min_length=1, max_length=30)
    difficultyWise: list[BlueprintDifficultyEntry] = Field(min_length=1, max_length=10)


class PYQSource(BaseModel):
    """Prior-year-question attribution entry."""

    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    year: int | None = Field(default=None, ge=1900, le=2100)
    chapter: str | None = Field(default=None, max_length=200)


class ExamPaperRequest(BaseModel):
    """Request body for `POST /v1/exam-paper/generate`."""

    model_config = ConfigDict(extra="forbid")

    board: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    chapters: list[str] = Field(default_factory=list, max_length=50)
    duration: int | None = Field(default=None, ge=10, le=480)
    maxMarks: int | None = Field(default=None, ge=10, le=500)
    language: str = Field(default="English", min_length=1, max_length=20)
    difficulty: ExamDifficulty = "mixed"
    includeAnswerKey: bool = True
    includeMarkingScheme: bool = True
    teacherContext: str | None = Field(default=None, max_length=1000)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class ExamPaperCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=500)
    board: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    duration: str = Field(min_length=1, max_length=50)
    maxMarks: float = Field(ge=10, le=500)
    generalInstructions: list[str] = Field(min_length=1, max_length=20)
    sections: list[ExamPaperSection] = Field(min_length=1, max_length=10)
    blueprintSummary: BlueprintSummary
    pyqSources: list[PYQSource] | None = Field(default=None, max_length=50)


class ExamPaperResponse(BaseModel):
    """Response for `POST /v1/exam-paper/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=500)
    board: str = Field(min_length=1, max_length=100)
    subject: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    duration: str = Field(min_length=1, max_length=50)
    maxMarks: float = Field(ge=10, le=500)
    generalInstructions: list[str] = Field(min_length=1, max_length=20)
    sections: list[ExamPaperSection] = Field(min_length=1, max_length=10)
    blueprintSummary: BlueprintSummary
    pyqSources: list[PYQSource] | None = Field(default=None, max_length=50)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
