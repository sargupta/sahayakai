"""`_receive_client_frame` and the upstream pump, driven directly.

The integration tests in `tests/integration/test_vidya_voice_stream_setup.py`
cover these paths through a real socket, but two things cannot be pinned from
there: what the pump RETURNS when the peer vanishes mid-read, and the second
spelling of that event.

Starlette's `WebSocketTestSession.__exit__` pushes the `websocket.disconnect`
message and then cancels the app task, and which the event loop services first
is a race — so an integration assertion on `reason="client_disconnect"` would
be flaky rather than wrong. Driving the coroutine against a scripted transport
makes it deterministic, and lets the RuntimeError spelling (Starlette's
"cannot receive once a disconnect message has been received", which only
happens on a SECOND read) be reached at all.

That return value is load-bearing: it is the difference between a hang-up
logged as `client_disconnect` and one logged as `error` with a
"live session failed" frame written to a socket that is already gone.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import pytest
from fastapi import WebSocketDisconnect

from sahayakai_agents.agents.vidya_voice import router as vv_router

pytestmark = pytest.mark.unit


class _ScriptedWebSocket:
    """A `WebSocket` whose `receive()` replays a fixed script.

    Each entry is either an ASGI message dict (returned) or an exception
    instance (raised). Running out of script raises, so a test that expects one
    read and gets two fails loudly instead of hanging.
    """

    def __init__(self, script: list[Any]) -> None:
        self._script = list(script)
        self.reads = 0

    async def receive(self) -> Any:
        self.reads += 1
        if not self._script:
            raise AssertionError("pump read past the end of the script")
        item = self._script.pop(0)
        if isinstance(item, BaseException):
            raise item
        if item is None:  # stand in for "nothing ever arrives"
            await asyncio.Event().wait()
        return item


class _RecordingSession:
    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    async def send_realtime_input(self, **kwargs: Any) -> None:
        self.sent.append(("audio", kwargs))

    async def send_client_content(self, **kwargs: Any) -> None:
        self.sent.append(("text", kwargs))


def _text(payload: Any) -> dict[str, Any]:
    return {"type": "websocket.receive", "text": json.dumps(payload)}


def _run(coro: Any) -> Any:
    return asyncio.run(coro)


# ── The receive primitive ────────────────────────────────────────────────


class TestReceiveClientFrame:
    def test_disconnect_message_is_an_outcome_not_an_exception(self) -> None:
        ws = _ScriptedWebSocket([{"type": "websocket.disconnect", "code": 1001}])
        counters = vv_router._StreamCounters()

        outcome, payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=5)
        )

        assert outcome == vv_router._FRAME_DISCONNECT
        assert payload == 1001

    def test_websocket_disconnect_exception_is_caught(self) -> None:
        """Starlette raises rather than returns depending on how the peer went
        away. Both spellings have to land on the same outcome or half the
        hang-ups take the error path."""
        ws = _ScriptedWebSocket([WebSocketDisconnect(code=1006)])
        counters = vv_router._StreamCounters()

        outcome, payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=5)
        )

        assert outcome == vv_router._FRAME_DISCONNECT
        assert payload == 1006

    def test_runtime_error_after_a_disconnect_is_caught(self) -> None:
        """The third spelling: Starlette raises `RuntimeError` when a leg reads
        AFTER the disconnect message was already consumed. Both pumps share one
        socket, so this is reachable on every normal close."""
        ws = _ScriptedWebSocket(
            [RuntimeError('Cannot call "receive" once a disconnect ...')]
        )
        counters = vv_router._StreamCounters()

        outcome, _payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=5)
        )

        assert outcome == vv_router._FRAME_DISCONNECT

    def test_timeout_is_reported_without_cost_to_the_tally(self) -> None:
        ws = _ScriptedWebSocket([None])
        counters = vv_router._StreamCounters()

        outcome, _payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=0.05)
        )

        assert outcome == vv_router._FRAME_TIMEOUT
        assert counters.frames_up == 0

    def test_binary_frame_is_dropped_and_tallied(self) -> None:
        ws = _ScriptedWebSocket(
            [{"type": "websocket.receive", "bytes": b"\x00\x01\x02"}]
        )
        counters = vv_router._StreamCounters()

        outcome, _payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=5)
        )

        assert outcome == vv_router._FRAME_DROPPED
        # It crossed the wire, so it is attributed — the tally records what
        # arrived, not what we approved of.
        assert counters.frames_up == 1
        assert counters.frames_dropped == 1
        assert counters.bytes_up == 3

    def test_json_scalar_is_not_a_frame(self) -> None:
        """`"null"`, `"7"` and `"[]"` are all valid JSON. Without this check the
        very next line is `frame.get(...)` on an int."""
        counters = vv_router._StreamCounters()
        for body in ("null", "7", "[]", '"hello"'):
            ws = _ScriptedWebSocket([{"type": "websocket.receive", "text": body}])
            outcome, _payload = _run(
                vv_router._receive_client_frame(ws, counters, timeout=5)
            )
            assert outcome == vv_router._FRAME_DROPPED, body

    def test_object_frame_is_parsed(self) -> None:
        ws = _ScriptedWebSocket([_text({"text": "namaste"})])
        counters = vv_router._StreamCounters()

        outcome, payload = _run(
            vv_router._receive_client_frame(ws, counters, timeout=5)
        )

        assert outcome == vv_router._FRAME_JSON
        assert payload == {"text": "namaste"}
        assert counters.frames_dropped == 0


# ── The upstream pump ────────────────────────────────────────────────────


class TestPumpClientToVertex:
    def test_disconnect_mid_read_returns_client_disconnect(self) -> None:
        """The assertion the integration layer cannot make deterministically.
        Anything other than this string sends the handler down the `except`
        branch, which logs `stream_failed` and tries to write an error frame to
        a socket that is already gone — noise in the logs for the single most
        common way a session ends."""
        ws = _ScriptedWebSocket(
            [_text({"text": "hi"}), {"type": "websocket.disconnect", "code": 1001}]
        )
        session = _RecordingSession()

        reason = _run(
            vv_router._pump_client_to_vertex(
                ws, session, vv_router._StreamCounters()
            )
        )

        assert reason == "client_disconnect"
        assert [kind for kind, _ in session.sent] == ["text"]

    def test_a_dropped_frame_does_not_end_the_session(self) -> None:
        """The hardening claim in one line: junk between two good frames is
        skipped, and the good frame after it still reaches Vertex."""
        ws = _ScriptedWebSocket(
            [
                {"type": "websocket.receive", "bytes": b"\x00"},
                {"type": "websocket.receive", "text": "{not json"},
                _text({"text": "still here"}),
                _text({"end": True}),
            ]
        )
        session = _RecordingSession()
        counters = vv_router._StreamCounters()

        reason = _run(vv_router._pump_client_to_vertex(ws, session, counters))

        assert reason == "client_end"
        assert [kind for kind, _ in session.sent] == ["text"]
        assert counters.frames_dropped == 2

    def test_the_pushback_frame_is_consumed_before_the_socket_is_read(self) -> None:
        """The frame the setup handshake pulled off the wire must be relayed
        FIRST and must not be re-read from the socket — otherwise a client that
        starts talking immediately loses its opening chunk, or has it replayed
        out of order behind whatever came next."""
        ws = _ScriptedWebSocket([_text({"end": True})])
        session = _RecordingSession()

        reason = _run(
            vv_router._pump_client_to_vertex(
                ws,
                session,
                vv_router._StreamCounters(),
                first_frame={"text": "opening words"},
            )
        )

        assert reason == "client_end"
        assert ws.reads == 1  # only the `{"end": true}` came off the socket
        assert session.sent[0][1]["turns"].parts[0].text == "opening words"

    def test_the_pushback_frame_is_not_double_counted(self) -> None:
        """It was tallied when the setup handshake read it. Counting it again
        here would overstate every personalised session's ingress."""
        ws = _ScriptedWebSocket([_text({"end": True})])
        counters = vv_router._StreamCounters()

        _run(
            vv_router._pump_client_to_vertex(
                ws,
                _RecordingSession(),
                counters,
                first_frame={"text": "already tallied"},
            )
        )

        assert counters.frames_up == 1
