"""Integration test for avatar generator router (Phase F.2 + Phase L.5).

Phase L.5 fixture redesign — same strategy as L.1 vidya:

The single image stage now runs through ADK's `Runner.run_async` against
a degenerate `SequentialAgent` of 1 sub-agent. The pre-L.5
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` and
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.avatar_generator.router` is
  monkey-patched to pop one entry off a shared queue and return the
  `(image_bytes, image_mime)` tuple directly. This bypasses ADK Runner
  entirely for the test, which is fine because ADK Runner machinery is
  itself covered by ADK's own test suite + the new unit tests at
  `tests/unit/test_avatar_adk.py`.
"""
from __future__ import annotations

import base64
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.avatar_generator import router as avatar_router_mod
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration

# Tiny 1×1 PNG.
_TINY_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWj"
    "kI4QAAAABJRU5ErkJggg=="
)


class _QueueFake:
    """Each call returns the next item from a queue.

    Items can be either:
      - `(image_bytes, image_mime)` — happy path.
      - `_RaiseAgentError(...)` — re-raise the configured AgentError.
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []

    def pop(self) -> Any:
        if not self.queue:
            raise AssertionError(
                "Test fake: more pipeline calls than test queued"
            )
        return self.queue.pop(0)


class _RaiseAgentError:
    """Sentinel — when the fake pops this, raise the configured AgentError."""

    def __init__(self, *, code: str, message: str, http_status: int) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status


@pytest.fixture
def fake_pipeline(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch `_run_pipeline_via_runner` to consume a queue of canned outputs."""
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *, portrait_prompt: str, api_key: str,
    ) -> tuple[bytes, str]:
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        image_bytes, image_mime = nxt
        return image_bytes, image_mime

    monkeypatch.setattr(
        avatar_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


_BASE_REQUEST: dict[str, Any] = {
    "name": "Priya Sharma",
    "userId": "teacher-uid-1",
}


class TestAvatarGeneratorRouter:
    def test_clean_avatar_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [(_TINY_PNG_BYTES, "image/png")]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/png;base64,")
        assert body["sidecarVersion"].startswith("phase-l")
        assert body["latencyMs"] >= 0

    def test_jpeg_avatar_passes_guard(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [(_TINY_PNG_BYTES, "image/jpeg")]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/jpeg;base64,")

    def test_no_inline_data_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            _RaiseAgentError(
                code="INTERNAL",
                message="Avatar generation returned no inline image data",
                http_status=502,
            ),
        ]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_userid_returns_422(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # Pydantic schema rejects userIds outside [A-Za-z0-9_\-].
        bad_req = dict(_BASE_REQUEST, userId="not/valid")
        res = client.post("/v1/avatar-generator/generate", json=bad_req)
        assert res.status_code == 422, res.text
