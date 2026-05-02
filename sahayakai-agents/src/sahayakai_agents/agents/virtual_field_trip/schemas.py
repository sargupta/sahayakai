"""Pydantic models for virtual field-trip agent (Phase D.3)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VirtualFieldTripStop(BaseModel):
    """One stop on the virtual field trip."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=20, max_length=1500)
    educationalFact: str = Field(min_length=10, max_length=1000)
    reflectionPrompt: str = Field(min_length=10, max_length=500)
    googleEarthUrl: str = Field(min_length=10, max_length=500)
    culturalAnalogy: str = Field(min_length=10, max_length=500)
    explanation: str = Field(min_length=10, max_length=1000)


class VirtualFieldTripRequest(BaseModel):
    """Request body for `POST /v1/virtual-field-trip/plan`."""

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3, max_length=300)
    language: str | None = Field(default=None, max_length=20)
    gradeLevel: str | None = Field(default=None, max_length=50)
    userId: str = Field(
        min_length=1, max_length=128, pattern=r"^[A-Za-z0-9_\-]+$",
    )


class VirtualFieldTripCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    stops: list[VirtualFieldTripStop] = Field(min_length=3, max_length=8)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)


class VirtualFieldTripResponse(BaseModel):
    """Response for `POST /v1/virtual-field-trip/plan`."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=3, max_length=300)
    stops: list[VirtualFieldTripStop] = Field(min_length=3, max_length=8)
    gradeLevel: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=100)

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
