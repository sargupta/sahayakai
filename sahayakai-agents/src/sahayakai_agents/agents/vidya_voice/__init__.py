"""VIDYA voice mode (Gemini Live API spike).

SPIKE / proof-of-concept — NOT a production migration.

The current VIDYA voice path (typed pipeline) routes:
    mic → /api/voice-to-text → /api/assistant → optional instant-answer
        → /api/tts → audio playback
end-to-end p50 ~3-8s before audio plays.

Gemini Live API replaces the entire pipeline with one bidirectional
WebSocket session: mic-bytes in → audio + tool events out, p50 ~500ms.

This package proves the integration shape end-to-end without touching
the production OmniOrb path. Migration plan in
`spikes/gemini_live_voice/SPIKE.md`.

Phase S deliverable. See feature/phase-n-through-t branch.
"""
from __future__ import annotations

from .router import vidya_voice_router
from .schemas import (
    SessionStartRequest,
    SessionStartResponse,
)

__all__ = [
    "SessionStartRequest",
    "SessionStartResponse",
    "vidya_voice_router",
]
