"""Integration tests for `POST /v1/vidya-voice/start-session` — Phase S spike.

Mocks `google.genai.Client` so the test never reaches Google. Three
scenarios:

1. **Happy path** — sidecar mints a token, returns the WSS URL,
   tool list, and session config.
2. **Hindi teacher profile** — language threads through to the
   session config so the Live system instruction speaks Hindi.
3. **Token mint fails** — sidecar returns 502 with a useful message
   (the production migration cannot proceed if minting is broken).

The fake `auth_tokens.create()` returns an object with `name` set —
matches the real `AuthToken.name` shape.
"""
from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Fake google.genai.Client (auth_tokens path) ──────────────────────────


class _FakeAuthToken:
    """Mimics `google.genai.types.AuthToken`."""

    def __init__(self, name: str) -> None:
        self.name = name


class _FakeAuthTokens:
    """Pop the next token name from a queue.

    Each entry is either a string (returned as the token name) or an
    Exception (raised, simulating a Live API failure)."""

    def __init__(self) -> None:
        self.queue: list[str | Exception] = []
        self.last_config: Any | None = None

    async def create(self, *, config: Any) -> _FakeAuthToken:
        self.last_config = config
        if not self.queue:
            raise AssertionError(
                "Test fake: more auth_tokens.create calls than expected"
            )
        item = self.queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return _FakeAuthToken(item)


class _FakeAio:
    def __init__(self, auth_tokens: _FakeAuthTokens) -> None:
        self.auth_tokens = auth_tokens


class _FakeClient:
    def __init__(self, auth_tokens: _FakeAuthTokens) -> None:
        self.aio = _FakeAio(auth_tokens)


@pytest.fixture
def fake_genai(monkeypatch: pytest.MonkeyPatch) -> _FakeAuthTokens:
    """Patch `google.genai` to a fake module that returns a fake client."""
    auth_tokens = _FakeAuthTokens()

    class _FakeGenai:
        def Client(self, api_key: str) -> _FakeClient:  # noqa: N802
            return _FakeClient(auth_tokens)

    # Build a minimal `types` shim so the router's imports resolve.
    # `_capture` is the ctor — it boxes whatever kwargs the router
    # passed into a SimpleNamespace so the assertions can read them
    # back from `auth_tokens.last_config`.
    def _capture(**kw: Any) -> SimpleNamespace:
        return SimpleNamespace(**kw)

    fake_types = SimpleNamespace(
        Modality=SimpleNamespace(AUDIO="AUDIO", TEXT="TEXT"),
        LiveConnectConfig=_capture,
        LiveConnectConstraints=_capture,
        CreateAuthTokenConfig=_capture,
    )
    fake_module = _FakeGenai()
    fake_module.types = fake_types  # type: ignore[attr-defined]

    import sys

    sys.modules["google.genai"] = fake_module  # type: ignore[assignment]
    sys.modules["google.genai.types"] = fake_types  # type: ignore[assignment]
    # `from google import genai` reads the `genai` attribute on the parent
    # `google` package (not sys.modules), so we must also patch the
    # attribute. monkeypatch restores the original on teardown.
    import google  # noqa: PLC0415
    monkeypatch.setattr(google, "genai", fake_module, raising=False)
    return auth_tokens


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """Force an API key for the test environment.

    Production reads via `Settings`. The test injects via env so
    `get_settings.cache_clear()` picks up a value before the first
    request lands.
    """
    monkeypatch.setenv("GOOGLE_GENAI_API_KEY", "test-key")
    from sahayakai_agents.config import get_settings
    get_settings.cache_clear()
    return TestClient(app)


# ── Sample requests ──────────────────────────────────────────────────────


_BASE_REQUEST: dict[str, Any] = {
    "teacherProfile": {
        "preferredGrade": "Class 5",
        "preferredSubject": "Science",
        "preferredLanguage": "en",
        "schoolContext": "rural government school",
    },
    "currentScreenContext": {
        "path": "/dashboard",
        "uiState": None,
    },
    "detectedLanguage": "en",
}


# ── Tests ────────────────────────────────────────────────────────────────


class TestVidyaVoiceRouter:
    def test_happy_path_returns_token_and_wss_url(
        self,
        client: TestClient,
        fake_genai: _FakeAuthTokens,
    ) -> None:
        """Sidecar mints a token; response carries everything the
        client needs to open the WSS connection."""
        fake_genai.queue = ["spike-token-abcdef-12345"]
        res = client.post("/v1/vidya-voice/start-session", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()

        assert body["sessionToken"] == "spike-token-abcdef-12345"
        assert body["wssUrl"].startswith("wss://generativelanguage.googleapis.com/")
        assert body["expiresInSeconds"] >= 30
        assert body["sessionConfig"]["model"].startswith("gemini-")
        assert "live" in body["sessionConfig"]["model"]
        assert body["sessionConfig"]["responseModalities"] == ["AUDIO"]
        assert body["sessionConfig"]["voice"]
        assert body["sidecarVersion"].startswith("phase-s")
        assert body["spike"] is True

        # 9 routable flows surface as 9 tool defs.
        assert len(body["tools"]) == 9
        flows = {tool["flow"] for tool in body["tools"]}
        assert "lesson-plan" in flows
        assert "quiz-generator" in flows

        # Token mint was called exactly once.
        assert fake_genai.queue == []
        assert fake_genai.last_config is not None

    def test_hindi_language_threads_into_session_config(
        self,
        client: TestClient,
        fake_genai: _FakeAuthTokens,
    ) -> None:
        """Hindi-detected request → languageCode `hi` echoed in
        sessionConfig so the client can hint the Live API."""
        fake_genai.queue = ["spike-token-hi"]
        request = {
            **_BASE_REQUEST,
            "detectedLanguage": "hi",
            "teacherProfile": {
                **_BASE_REQUEST["teacherProfile"],
                "preferredLanguage": "hi",
            },
        }
        res = client.post("/v1/vidya-voice/start-session", json=request)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["sessionConfig"]["languageCode"] == "hi"

    def test_token_mint_failure_returns_502(
        self,
        client: TestClient,
        fake_genai: _FakeAuthTokens,
    ) -> None:
        """When the SDK raises (e.g. Live API not enabled on project),
        sidecar surfaces 502 with an actionable error message."""
        fake_genai.queue = [
            RuntimeError("Live API not enabled on project sahayakai-b4248")
        ]
        res = client.post("/v1/vidya-voice/start-session", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
        body = res.json()
        # The router wraps the SDK error with our typed-AgentError envelope.
        assert "Live" in body["error"]["message"]
        assert "ephemeral token" in body["error"]["message"].lower()
        assert fake_genai.queue == []
