"""Pydantic models for video storyteller agent (Phase F.1)."""
from __future__ import annotations

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

# Phase J.4 hot-fix (forensic P1 #20): bound search-query strings.
# Phase 1a: bounds kept on REQUEST elements only.
_SearchQuery = Annotated[str, StringConstraints(max_length=300)]


class VideoStorytellerCategories(BaseModel):
    """Five search-query categories (response model)."""

    model_config = ConfigDict(extra="forbid")

    pedagogy: list[str]
    storytelling: list[str]
    govtUpdates: list[str]
    courses: list[str]
    topRecommended: list[str]


class VideoStorytellerRequest(BaseModel):
    """Request body for `POST /v1/video-storyteller/recommend-queries`."""

    model_config = ConfigDict(extra="forbid")

    subject: str = Field(min_length=1, max_length=100)
    gradeLevel: str = Field(min_length=1, max_length=50)
    topic: str | None = Field(default=None, max_length=300)
    language: str | None = Field(default=None, max_length=20)
    state: str | None = Field(default=None, max_length=100)
    educationBoard: str | None = Field(default=None, max_length=100)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class VideoStorytellerCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    categories: VideoStorytellerCategories
    personalizedMessage: str


class VideoStorytellerResponse(BaseModel):
    """Response for `POST /v1/video-storyteller/recommend-queries`."""

    model_config = ConfigDict(extra="forbid")

    categories: VideoStorytellerCategories
    personalizedMessage: str

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
