"""Pydantic models for exam paper generator (Phase E.2)."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): list[str] elements bounded.
# Phase 1a: bounds kept on REQUEST elements only.
_McqOption = Annotated[str, StringConstraints(max_length=1000)]
_Chapter = Annotated[str, StringConstraints(max_length=300)]
_Instruction = Annotated[str, StringConstraints(max_length=1000)]

ExamDifficulty = Literal["easy", "moderate", "hard", "mixed"]


class ExamPaperQuestion(BaseModel):
    """One question on the paper (response model)."""

    model_config = ConfigDict(extra="forbid")

    number: int = Field(ge=1)
    text: str
    marks: float = Field(ge=0)
    options: list[str] | None = None
    internalChoice: str | None = None
    answerKey: str | None = None
    markingScheme: str | None = None
    source: str = "AI Generated"


class ExamPaperSection(BaseModel):
    """One section of the paper (response model)."""

    model_config = ConfigDict(extra="forbid")

    name: str
    label: str
    totalMarks: float = Field(ge=0)
    questions: list[ExamPaperQuestion]


class BlueprintChapterEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chapter: str
    marks: float = Field(ge=0)


class BlueprintDifficultyEntry(BaseModel):
    model_config = ConfigDict(extra="forbid")
    level: str
    percentage: float = Field(ge=0, le=100)


class BlueprintSummary(BaseModel):
    model_config = ConfigDict(extra="forbid")
    chapterWise: list[BlueprintChapterEntry] = Field(default_factory=list)
    difficultyWise: list[BlueprintDifficultyEntry]


class PYQSource(BaseModel):
    """Prior-year-question attribution entry (response model)."""

    model_config = ConfigDict(extra="forbid")
    id: str
    year: int | None = None
    chapter: str | None = None


class ExamPaperRequest(BaseModel):
    """Request body for `POST /v1/exam-paper/generate`."""

    model_config = ConfigDict(extra="forbid")

    board: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)
    chapters: list[_Chapter] = Field(default_factory=list, max_length=50)
    duration: int | None = Field(default=None, ge=10, le=480)
    maxMarks: int | None = Field(default=None, ge=10, le=500)
    language: str = Field(default="English", min_length=1, max_length=20)
    difficulty: ExamDifficulty = "mixed"
    includeAnswerKey: bool = True
    includeMarkingScheme: bool = True
    teacherContext: str | None = Field(default=None, max_length=1000)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class ExamPaperCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str
    board: str
    subject: str
    gradeLevel: str
    duration: str
    maxMarks: float = Field(ge=0)
    generalInstructions: list[str]
    sections: list[ExamPaperSection]
    blueprintSummary: BlueprintSummary
    pyqSources: list[PYQSource] | None = None


class ExamPaperResponse(BaseModel):
    """Response for `POST /v1/exam-paper/generate`."""

    model_config = ConfigDict(extra="forbid")

    title: str
    board: str
    subject: str
    gradeLevel: str
    duration: str
    maxMarks: float = Field(ge=0)
    generalInstructions: list[str]
    sections: list[ExamPaperSection]
    blueprintSummary: BlueprintSummary
    pyqSources: list[PYQSource] | None = None

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
