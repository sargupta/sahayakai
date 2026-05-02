"""Avatar generator ADK agent (Phase F.2).

Generates a professional teacher portrait as a base64 PNG/JPEG data URI.
No metadata text — just the image. Storage write (Firebase Storage +
users/{uid}/avatars/) stays in the Next.js Genkit flow because the
sidecar has no Firestore/Storage credentials in Phase F.
"""
from .router import avatar_generator_router
from .schemas import (
    AvatarGeneratorRequest,
    AvatarGeneratorResponse,
)

__all__ = [
    "AvatarGeneratorRequest",
    "AvatarGeneratorResponse",
    "avatar_generator_router",
]
