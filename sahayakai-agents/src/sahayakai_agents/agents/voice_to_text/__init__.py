"""Voice-to-text ADK agent (Phase I).

Multimodal speech-to-text. Input: audio data URI
(`data:<mime>;base64,<payload>`). Output: cleaned transcription + ISO
2-letter language code. Powers VIDYA's voice mode (the OmniOrb mic)
plus the in-app voice-message recorder.

This is the LAST AI flow to leave Genkit. After this PR every
teacher-facing AI surface routes through the Python ADK sidecar.
"""
from .router import voice_to_text_router
from .schemas import (
    VoiceToTextRequest,
    VoiceToTextResponse,
)

__all__ = [
    "VoiceToTextRequest",
    "VoiceToTextResponse",
    "voice_to_text_router",
]
