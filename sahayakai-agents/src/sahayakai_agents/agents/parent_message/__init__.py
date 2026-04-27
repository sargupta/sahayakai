"""Parent-message ADK agent.

Phase C of the supervisor architecture. Single-stage LLM agent that
drafts an empathetic parent notification message in one of 11 Indic
languages. Reuses the same auth + resilience layer as the other ADK
agents.
"""
from .router import parent_message_router
from .schemas import (
    ParentMessageCore,
    ParentMessageRequest,
    ParentMessageResponse,
)

__all__ = [
    "ParentMessageCore",
    "ParentMessageRequest",
    "ParentMessageResponse",
    "parent_message_router",
]
