"""Auth-ordering tests for the `/v1/vidya-voice/stream` websocket proxy.

This route is the sidecar's only websocket. Starlette's `BaseHTTPMiddleware`
does not wrap websocket ASGI scopes at all, so the OIDC + HMAC + App Check
chain in `auth.py` never runs here — the signed `?t=` stream token is the
whole gate. These tests pin that the gate runs BEFORE the handshake is
accepted and, critically, before a **billable** Vertex Live client is built.

`genai.Client` is spied rather than merely stubbed: a fix that still accepts
the socket and allocates before closing it would pass a status-code-only
assertion while leaving the cost hole wide open. `spy.calls == []` is the
assertion that actually proves the reject path is free.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from sahayakai_agents.agents.vidya_voice.router import mint_stream_token
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Fakes for the Vertex Live path ───────────────────────────────────────


class _FakeLiveSession:
    """Minimal stand-in for `client.aio.live.connect()`'s session.

    `receive()` emits a single turn-complete marker and then ends, which
    completes the downstream pump and unwinds the router's `asyncio.wait`
    without leaving a task hanging on a real socket.
    """

    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    async def send_realtime_input(self, **kwargs: Any) -> None:
        self.sent.append(("audio", kwargs))

    async def send_client_content(self, **kwargs: Any) -> None:
        self.sent.append(("text", kwargs))

    async def send_tool_response(self, **kwargs: Any) -> None:
        self.sent.append(("tool", kwargs))

    async def receive(self) -> Any:
        yield SimpleNamespace(
            data=None,
            tool_call=None,
            server_content=SimpleNamespace(interrupted=False, turn_complete=True),
        )


class _FakeLiveConnect:
    def __init__(self, session: _FakeLiveSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeLiveSession:
        return self._session

    async def __aexit__(self, *_exc: Any) -> bool:
        return False


class _ClientSpy:
    """Records every `genai.Client(...)` construction.

    On the reject path this list must stay empty — building the client is
    the step that opens a billable Vertex Live session.
    """

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.connected_models: list[str] = []
        self.session = _FakeLiveSession()

    def __call__(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            aio=SimpleNamespace(live=SimpleNamespace(connect=self._connect))
        )

    def _connect(self, *, model: str, config: Any) -> _FakeLiveConnect:
        self.connected_models.append(model)
        return _FakeLiveConnect(self.session)


@pytest.fixture
def genai_spy(monkeypatch: pytest.MonkeyPatch) -> _ClientSpy:
    """Patch `google.genai.Client` with the spy.

    The router resolves `genai.Client` at call time (`from google import
    genai` inside the handler), so patching the module attribute intercepts
    every construction.
    """
    spy = _ClientSpy()
    monkeypatch.setattr("google.genai.Client", spy)
    return spy


@pytest.fixture
def client() -> TestClient:
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    return TestClient(app)


def _assert_rejected(client: TestClient, url: str) -> None:
    """Opening `url` must fail the handshake with our 4401 close code."""
    with pytest.raises(WebSocketDisconnect) as excinfo:  # noqa: SIM117
        with client.websocket_connect(url):
            pass  # pragma: no cover — the handshake never completes
    assert excinfo.value.code == 4401


# ── Tests ────────────────────────────────────────────────────────────────


class TestVidyaVoiceStreamAuth:
    def test_garbage_token_rejected_and_no_client_constructed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A forged token closes the socket at 4401 and costs nothing."""
        _assert_rejected(client, "/v1/vidya-voice/stream?t=not-a-real-token")
        assert genai_spy.calls == []

    def test_missing_token_rejected_and_no_client_constructed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """No `?t=` at all is rejected identically — no anonymous path."""
        _assert_rejected(client, "/v1/vidya-voice/stream")
        assert genai_spy.calls == []

    def test_expired_token_rejected_and_no_client_constructed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A correctly signed but expired token is still refused."""
        expired = mint_stream_token("teacher-uid-1", ttl_seconds=-60)
        _assert_rejected(client, f"/v1/vidya-voice/stream?t={expired}")
        assert genai_spy.calls == []

    def test_tampered_uid_rejected_and_no_client_constructed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Swapping the uid invalidates the HMAC — no impersonation."""
        _uid, exp, sig = mint_stream_token("teacher-uid-1").split(".", 2)
        _assert_rejected(client, f"/v1/vidya-voice/stream?t=attacker.{exp}.{sig}")
        assert genai_spy.calls == []

    def test_valid_token_opens_socket_and_reaches_vertex(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The happy path still works: handshake accepted, Vertex session
        opened with the Vertex-specific model, frames relayed back."""
        token = mint_stream_token("teacher-uid-1")
        url = f"/v1/vidya-voice/stream?t={token}&lang=hi&screen=/lesson-plan"

        with client.websocket_connect(url) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert len(genai_spy.calls) == 1
        assert genai_spy.calls[0]["vertexai"] is True
        assert genai_spy.calls[0]["project"]
        assert genai_spy.connected_models == ["gemini-live-2.5-flash-native-audio"]
