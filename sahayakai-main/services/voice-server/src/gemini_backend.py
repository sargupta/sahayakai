"""
Which Gemini endpoint the engine talks to: AI Studio (API key) or Vertex AI.

Both Gemini clients in this service — the conversation LLM in bot.py and the
post-call analyzer in call_analyzer.py — used an AI Studio key
(GOOGLE_GENAI_API_KEY). On 2026-11-16 that key's prepaid credit ran out and
every call died with 402 RESOURCE_EXHAUSTED at the parent's first reply.
Vertex AI bills to the project's Cloud Billing account instead and
authenticates as the service's own identity (the Cloud Run runtime service
account, via Application Default Credentials); no key is involved.

    SAHAYAKAI_GEMINI_BACKEND   ai_studio (default, the behaviour before this
                               switch) | vertex
    SAHAYAKAI_VERTEX_LOCATION  Vertex region, default asia-south1
    GOOGLE_CLOUD_PROJECT       the Vertex project (already set on the service)

Speech-to-text and text-to-speech are Sarvam, not Google, and are unaffected.

Pure: stdlib only.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

AI_STUDIO = "ai_studio"
VERTEX = "vertex"
BACKENDS = (AI_STUDIO, VERTEX)

BACKEND_ENV = "SAHAYAKAI_GEMINI_BACKEND"
LOCATION_ENV = "SAHAYAKAI_VERTEX_LOCATION"
DEFAULT_VERTEX_LOCATION = "asia-south1"


@dataclass(frozen=True)
class GeminiBackend:
    kind: str
    api_key: str = ""
    project: str = ""
    location: str = ""

    @property
    def is_vertex(self) -> bool:
        return self.kind == VERTEX

    def genai_client_kwargs(self) -> dict[str, Any]:
        """Arguments for google.genai.Client(...)."""
        if self.is_vertex:
            return {"vertexai": True, "project": self.project, "location": self.location}
        return {"api_key": self.api_key}

    def describe(self) -> str:
        return f"vertex ({self.project}, {self.location})" if self.is_vertex else "ai_studio (api key)"


def resolve_gemini_backend(config: Any) -> GeminiBackend:
    """Build the backend from Config. Raises ValueError on a misconfiguration.

    A typo must not silently fall back to the AI Studio key, so an unknown
    value is an error, and so is Vertex without a project.
    """
    kind = (getattr(config, "gemini_backend", AI_STUDIO) or AI_STUDIO).strip().lower()
    if kind not in BACKENDS:
        raise ValueError(f"{BACKEND_ENV}={kind!r}: expected one of {', '.join(BACKENDS)}")
    if kind == AI_STUDIO:
        return GeminiBackend(kind=AI_STUDIO, api_key=getattr(config, "google_api_key", "") or "")
    project = (getattr(config, "google_cloud_project", "") or "").strip()
    location = (getattr(config, "vertex_location", "") or DEFAULT_VERTEX_LOCATION).strip()
    if not project:
        raise ValueError(f"{BACKEND_ENV}=vertex needs GOOGLE_CLOUD_PROJECT")
    return GeminiBackend(kind=VERTEX, project=project, location=location)
