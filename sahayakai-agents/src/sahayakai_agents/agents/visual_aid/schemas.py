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
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class VisualAidMetadata(BaseModel):
    """Metadata produced by the second (text) call.

    Phase 1a: this is the actual `response_schema` Gemini sees.
    """

    model_config = ConfigDict(extra="forbid")

    pedagogicalContext: str
    discussionSpark: str
    subject: str


class VisualAidResponse(BaseModel):
    """Response for `POST /v1/visual-aid/generate`.

    `imageDataUri` is a `data:image/...;base64,...` URI containing the
    chalkboard-style illustration. The frontend renders it directly.
    """

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(min_length=20, max_length=20 * 1024 * 1024)
    pedagogicalContext: str
    discussionSpark: str
    subject: str

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    imageModelUsed: str = Field(min_length=1, max_length=200)
    metadataModelUsed: str = Field(min_length=1, max_length=200)
