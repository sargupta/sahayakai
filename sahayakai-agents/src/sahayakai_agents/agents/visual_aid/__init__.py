"""Visual aid designer ADK agent (Phase E.3).

Two-call flow:
  1. Image generation (Gemini-3-pro-image-preview, IMAGE response modality)
  2. Metadata text (Gemini-2.5-flash, structured JSON)

The image is returned as a base64 data URI matching the existing
Genkit wire shape so the frontend renders it without changes.
"""
from .router import visual_aid_router
from .schemas import (
    VisualAidMetadata,
    VisualAidRequest,
    VisualAidResponse,
)

__all__ = [
    "VisualAidMetadata",
    "VisualAidRequest",
    "VisualAidResponse",
    "visual_aid_router",
]
