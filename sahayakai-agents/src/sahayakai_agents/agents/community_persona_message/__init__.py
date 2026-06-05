"""Community persona message ADK agent.

Single-stage LLM agent that drafts ONE short in-character WhatsApp-style
chat message for a demo teacher persona. Mirrors the Genkit flow
`sahayakai-main/src/ai/flows/community-persona-message.ts` (plain-text
output, single-field response). Used by the persona-pulse scheduled
seeder and the community chat demo loop.
"""
from .router import community_persona_message_router
from .schemas import (
    CommunityPersonaMessageRequest,
    CommunityPersonaMessageResponse,
    RecentMessage,
)

__all__ = [
    "CommunityPersonaMessageRequest",
    "CommunityPersonaMessageResponse",
    "RecentMessage",
    "community_persona_message_router",
]
