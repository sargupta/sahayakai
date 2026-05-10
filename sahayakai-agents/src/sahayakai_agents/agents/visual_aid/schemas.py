"""Pydantic models for visual aid designer agent (Phase E.3)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VisualAidRequest(BaseModel):
    """Request body for `POST /v1/visual-aid/generate`."""

    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=3, max_length=2000)
    language: str | None = Field(default=None, max_length=20)
    gradeLevel: str | None = Field(default=None, max_length=50)
    subject: str | None = Field(default=None, max_length=100)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class VisualAidMetadata(BaseModel):
    """Metadata produced by the second (text) call."""

    model_config = ConfigDict(extra="forbid")

    pedagogicalContext: str = Field(min_length=10, max_length=2000)
    discussionSpark: str = Field(min_length=5, max_length=1000)
    subject: str = Field(min_length=1, max_length=100)


class VisualAidResponse(BaseModel):
    """Response for `POST /v1/visual-aid/generate`.

    `imageDataUri` is a `data:image/...;base64,...` URI containing the
    chalkboard-style illustration. The frontend renders it directly.
    """

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(min_length=20, max_length=20 * 1024 * 1024)
    pedagogicalContext: str = Field(min_length=10, max_length=2000)
    discussionSpark: str = Field(min_length=5, max_length=1000)
    subject: str = Field(min_length=1, max_length=100)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    imageModelUsed: str = Field(min_length=1, max_length=200)
    metadataModelUsed: str = Field(min_length=1, max_length=200)
