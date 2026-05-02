"""Pydantic models for avatar generator agent (Phase F.2)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AvatarGeneratorRequest(BaseModel):
    """Request body for `POST /v1/avatar-generator/generate`.

    `name` is treated as untrusted user-controlled input. It is wrapped
    in `⟦…⟧` markers in the rendered prompt so the model does not
    interpret display names that contain instruction-like phrases.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class AvatarGeneratorResponse(BaseModel):
    """Response for `POST /v1/avatar-generator/generate`.

    `imageDataUri` is the standard `data:image/<subtype>;base64,<body>`
    form expected by the Next.js client. Storage write happens in
    Next.js after the sidecar returns.
    """

    model_config = ConfigDict(extra="forbid")

    imageDataUri: str = Field(min_length=32)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
