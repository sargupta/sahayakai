"""What the bridge needs from a conversation engine — nothing more.

STATUS: a description, not a refactor. The bridge (`router.py`) is unchanged
and still talks to a Gemini Live session directly; this Protocol names the
exact surface it uses so a second engine can be built against it. The Sampark
plan (`docs/sampark/CONVERSATION_PLAN.md` §4, phase C1, on
`feature/school-parent-calling`) owns the cascaded engine (Sarvam recognition
-> director -> per-language speech, hosted in India) and its `Engine`
interface. This file is a proposal to that work, agreed nowhere yet; it must
not grow into a competing interface without the Sampark owner.

THE CONTRACT, AS THE BRIDGE ACTUALLY CONSUMES IT

Inbound to the engine:
    send_realtime_input(audio=Blob(pcm16 @ 16 kHz))   parent audio, continuous
    send_client_content(turns=..., turn_complete=True) a director cue (text)
    send_tool_response(function_responses=[...])       a tool's answer

Outbound, from `receive()` — a PER-TURN async iterator (it ends when the
engine's turn ends; the bridge re-enters it), yielding messages with:
    .data                                   PCM16 @ 24 kHz speech for the parent
    .server_content.output_transcription    what the engine is saying (fragments,
                                            joined raw)
    .server_content.input_transcription     what it heard the parent say
    .server_content.interrupted             the engine abandoned its reply
    .server_content.turn_complete           the engine's turn is over
    .tool_call.function_calls[*]            id, name, args
    .tool_call_cancellation.ids             lookups the engine no longer wants

What the bridge owns and an engine must NOT re-implement: admission and
tokens, pacing and comfort noise, barge-in (pause/cancel/resume and
clearAudio), the identity gate and school-data tools, the end-call veto,
hangup ordering, transcript and summary persistence.

A cascade engine adapts to this by emitting the same message shapes: its
recogniser's interim/final text as `input_transcription`, its TTS chunks
(resampled to 24 kHz, or the bridge's resampler parameterised) as `.data`,
and `interrupted` when its own endpointer cancels synthesis.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any, Protocol, runtime_checkable

__all__ = ["ConversationSession"]


@runtime_checkable
class ConversationSession(Protocol):
    """The engine surface `router.py` uses. Gemini Live's session satisfies it."""

    def receive(self) -> AsyncIterator[Any]: ...

    async def send_realtime_input(self, *, audio: Any) -> None: ...

    async def send_client_content(self, *, turns: Any, turn_complete: bool = ...) -> None: ...

    async def send_tool_response(self, *, function_responses: Any) -> None: ...
