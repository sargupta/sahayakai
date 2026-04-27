"""Pydantic models for video storyteller agent (Phase F.1)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VideoStorytellerCategories(BaseModel):
    """Five search-query categories."""

    model_config = ConfigDict(extra="forbid")

    pedagogy: list[str] = Field(min_length=1, max_length=10)
    storytelling: list[str] = Field(min_length=1, max_length=10)
    govtUpdates: list[str] = Field(min_length=1, max_length=10)
    courses: list[str] = Field(min_length=1, max_length=10)
    topRecommended: list[str] = Field(min_length=1, max_length=10)


class VideoStorytellerRequest(BaseModel):
    """Request body for `POST /v1/video-storyteller/recommend-queries`."""

    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    topic: str | None = Field(default=None, max_length=300)
    language: str | None = Field(default=None, max_length=20)
    state: str | None = Field(default=None, max_length=100)
    educationBoard: str | None = Field(default=None, max_length=100)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class VideoStorytellerCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    categories: VideoStorytellerCategories
    personalizedMessage: str = Field(min_length=10, max_length=1500)


class VideoStorytellerResponse(BaseModel):
    """Response for `POST /v1/video-storyteller/recommend-queries`."""

    model_config = ConfigDict(extra="forbid")

    categories: VideoStorytellerCategories
    personalizedMessage: str = Field(min_length=10, max_length=1500)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
