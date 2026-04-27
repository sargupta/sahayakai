"""Integration test for visual aid router (Phase E.3 + Phase L.5).

Phase L.5 fixture redesign — same strategy as L.1 vidya:

The image + metadata stages now run through ADK's `Runner.run_async`
against a `SequentialAgent`. The pre-L.5 `sys.modules["google.genai"]
= _FakeGenai()` shim is incompatible with that machinery (ADK loads
`google.genai.errors.ClientError` + `google.genai.types.Content` at
import time, and replacing the whole module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.visual_aid.router` is monkey-
  patched to pop one entry off a shared queue and return the
  `(image_bytes, image_mime, VisualAidMetadata)` tuple directly. This
  bypasses ADK Runner entirely for the test, which is fine because
  ADK Runner machinery is itself covered by ADK's own test suite +
  the new `tests/unit/test_visual_aid_adk.py`.
"""
from __future__ import annotations

import base64
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.visual_aid import router as visual_aid_router_mod
from sahayakai_agents.agents.visual_aid.schemas import VisualAidMetadata
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
      - A `(image_bytes, image_mime, metadata_text_or_dict)` tuple for
        the happy path.
      - A `_RaiseAgentError(...)` sentinel that re-raises the configured
        AgentError to simulate stage-level failures.
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
    """Patch `_run_pipeline_via_runner` to consume a queue of canned outputs.

    Each pop should be either:
      - `(image_bytes, image_mime, VisualAidMetadata | str | dict)`. If
        the metadata field is a string or dict, the fake validates it
        through `VisualAidMetadata.model_validate_json` (string) or
        `model_validate` (dict), matching what the real Runner would
        do via `output_schema=VisualAidMetadata`.
      - `_RaiseAgentError(...)` — the fake raises the corresponding
        AgentError to simulate a stage-level failure (no image data,
        malformed metadata JSON, etc.).
    """
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *, image_prompt: str, metadata_prompt: str, api_key: str,
    ) -> tuple[bytes, str, VisualAidMetadata]:
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        image_bytes, image_mime, meta = nxt
        if isinstance(meta, str):
            try:
                metadata = VisualAidMetadata.model_validate_json(meta)
            except Exception as exc:
                raise AgentError(
                    code="INTERNAL",
                    message=(
                        "Metadata returned text that does not match "
                        "VisualAidMetadata"
                    ),
                    http_status=502,
                ) from exc
        elif isinstance(meta, dict):
            metadata = VisualAidMetadata.model_validate(meta)
        else:
            metadata = meta
        return image_bytes, image_mime, metadata

    monkeypatch.setattr(
        visual_aid_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _good_metadata_json() -> str:
    return json.dumps({
        "pedagogicalContext": "Use this drawing to walk students through each labelled part. Pause at each label and ask students to describe what it does in their own words before you confirm.",
        "discussionSpark": "Why do you think roots are drawn larger than the leaves?",
        "subject": "Science",
    })


_BASE_REQUEST = {
    "prompt": "A plant cell with labelled organelles",
    "language": "English",
    "gradeLevel": "Class 7",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


class TestVisualAidRouter:
    def test_clean_visual_aid_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            (_TINY_PNG_BYTES, "image/png", _good_metadata_json()),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/png;base64,")
        assert "roots" in body["discussionSpark"].lower()
        assert body["subject"] == "Science"
        assert body["sidecarVersion"].startswith("phase-l")

    def test_image_generation_empty_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            _RaiseAgentError(
                code="INTERNAL",
                message="Image generation returned no inline image data",
                http_status=502,
            ),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_metadata_malformed_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            (_TINY_PNG_BYTES, "image/png", "not valid json"),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_unsupported_image_mime_passes_guard(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # JPEG should be accepted by the guard.
        fake_pipeline.queue = [
            (_TINY_PNG_BYTES, "image/jpeg", _good_metadata_json()),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/jpeg;base64,")
