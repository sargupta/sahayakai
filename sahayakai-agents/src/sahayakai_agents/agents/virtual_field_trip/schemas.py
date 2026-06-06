"""Pydantic models for virtual field-trip agent (Phase D.3)."""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class VirtualFieldTripStop(BaseModel):
    """One stop on the virtual field trip (response model)."""

    model_config = ConfigDict(extra="forbid")

    name: str
    description: str
    educationalFact: str
    reflectionPrompt: str
    googleEarthUrl: str
    culturalAnalogy: str
    explanation: str


class VirtualFieldTripRequest(BaseModel):
    """Request body for `POST /v1/virtual-field-trip/plan`."""

    model_config = ConfigDict(extra="forbid")

    topic: str = Field(min_length=3, max_length=300)
    language: str | None = Field(default=None, max_length=20)
    gradeLevel: str | None = Field(default=None, max_length=50)
    # Phase 1a Fix 1: drop opaque-ID regex pattern.
    userId: str = Field(min_length=1, max_length=128)


class VirtualFieldTripCore(BaseModel):
    """What the model MUST return."""

    model_config = ConfigDict(extra="forbid")

    title: str
    stops: list[VirtualFieldTripStop]
    gradeLevel: str
    subject: str


class VirtualFieldTripResponse(BaseModel):
    """Response for `POST /v1/virtual-field-trip/plan`."""

    model_config = ConfigDict(extra="forbid")

    title: str
    stops: list[VirtualFieldTripStop]
    gradeLevel: str
    subject: str

    sidecarVersion: str = Field(min_length=1, max_length=64)
    latencyMs: int = Field(ge=0)
    modelUsed: str = Field(min_length=1, max_length=200)
