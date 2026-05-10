"""Quiz generator ADK agent (Phase E.1).

3-variant pattern: one Gemini call per difficulty (easy/medium/hard)
running in parallel via `asyncio.gather`. Multimodal — accepts an
optional textbook-page image.
"""
from .router import quiz_router
from .schemas import (
    QuizGeneratorCore,
    QuizGeneratorRequest,
    QuizGeneratorResponse,
    QuizVariantsResponse,
)

__all__ = [
    "QuizGeneratorCore",
    "QuizGeneratorRequest",
    "QuizGeneratorResponse",
    "QuizVariantsResponse",
    "quiz_router",
]
