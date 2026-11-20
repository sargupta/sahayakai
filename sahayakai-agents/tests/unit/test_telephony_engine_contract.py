"""The engine surface the bridge uses is exactly what Gemini Live provides.

A second engine (the Sampark cascade) is built against `ConversationSession`;
this gate fails if the bridge's real engine and the documented contract drift.
"""

from __future__ import annotations

import inspect

from google.genai.live import AsyncSession

from sahayakai_agents.telephony.engine import ConversationSession


def test_gemini_live_session_has_every_method_the_contract_names() -> None:
    for name in ("receive", "send_realtime_input", "send_client_content", "send_tool_response"):
        assert callable(getattr(AsyncSession, name, None)), name


def test_the_keyword_arguments_the_bridge_passes_exist() -> None:
    assert "audio" in inspect.signature(AsyncSession.send_realtime_input).parameters
    assert {"turns", "turn_complete"} <= set(
        inspect.signature(AsyncSession.send_client_content).parameters
    )
    assert "function_responses" in inspect.signature(AsyncSession.send_tool_response).parameters


def test_a_minimal_fake_engine_satisfies_the_protocol() -> None:
    class _Cascade:
        def receive(self):  # type: ignore[no-untyped-def]
            async def gen():  # type: ignore[no-untyped-def]
                if False:
                    yield None

            return gen()

        async def send_realtime_input(self, *, audio: object) -> None: ...

        async def send_client_content(self, *, turns: object, turn_complete: bool = True) -> None: ...

        async def send_tool_response(self, *, function_responses: object) -> None: ...

    assert isinstance(_Cascade(), ConversationSession)
