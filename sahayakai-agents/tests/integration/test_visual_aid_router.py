"""Integration test for visual aid router (Phase E.3)."""
from __future__ import annotations

import base64
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration

# Tiny 1×1 PNG.
_TINY_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWj"
    "kI4QAAAABJRU5ErkJggg=="
)


class _FakeUsageMeta:
    input_tokens = 800
    output_tokens = 200
    total_tokens = 1000
    cached_content_tokens = 0


class _FakeInlineData:
    def __init__(self, data: bytes, mime_type: str) -> None:
        self.data = data
        self.mime_type = mime_type


class _FakePart:
    def __init__(self, *, text: str | None = None, inline_data: _FakeInlineData | None = None) -> None:
        self.text = text
        self.inline_data = inline_data


class _FakeContent:
    def __init__(self, parts: list[_FakePart]) -> None:
        self.parts = parts


class _FakeCandidate:
    def __init__(self, *, parts: list[_FakePart]) -> None:
        self.content = _FakeContent(parts)


class _FakeImageResult:
    def __init__(self, image_bytes: bytes, mime: str) -> None:
        self.usage_metadata = _FakeUsageMeta()
        self.text = None
        self.candidates = [
            _FakeCandidate(parts=[_FakePart(inline_data=_FakeInlineData(image_bytes, mime))]),
        ]


class _FakeTextResult:
    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = []


class _SequencedFakeAioModels:
    """Each call returns the next item from a queue.

    Items can be either:
      - `_FakeImageResult` (for image-generation calls)
      - `_FakeTextResult` (for metadata calls)
      - a string (interpreted as a `_FakeTextResult` for metadata)
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []

    async def generate_content(self, **kwargs: Any) -> Any:
        if not self.queue:
            raise AssertionError("Test fake: more calls than expected")
        nxt = self.queue.pop(0)
        if isinstance(nxt, str):
            return _FakeTextResult(nxt)
        return nxt


class _FakeAio:
    def __init__(self, models: _SequencedFakeAioModels) -> None:
        self.models = models


class _FakeClient:
    def __init__(self, models: _SequencedFakeAioModels) -> None:
        self.aio = _FakeAio(models)
        self.models = models


@pytest.fixture
def fake_genai(monkeypatch: pytest.MonkeyPatch) -> _SequencedFakeAioModels:
    models = _SequencedFakeAioModels()

    class _FakeGenai:
        def Client(self, api_key: str) -> _FakeClient:  # noqa: N802
            return _FakeClient(models)

    fake_types = SimpleNamespace(GenerateContentConfig=lambda **kw: kw)
    fake_module = _FakeGenai()
    fake_module.types = fake_types  # type: ignore[attr-defined]

    import sys

    sys.modules["google.genai"] = fake_module  # type: ignore[assignment]
    sys.modules["google.genai.types"] = fake_types  # type: ignore[assignment]
    return models


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
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Image first, metadata second.
        fake_genai.queue = [
            _FakeImageResult(_TINY_PNG_BYTES, "image/png"),
            _good_metadata_json(),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/png;base64,")
        assert "roots" in body["discussionSpark"].lower()
        assert body["subject"] == "Science"
        assert body["sidecarVersion"].startswith("phase-e.3")

    def test_image_generation_empty_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Image call returns no inline data.
        empty = SimpleNamespace(
            text=None,
            usage_metadata=_FakeUsageMeta(),
            candidates=[_FakeCandidate(parts=[])],
        )
        fake_genai.queue = [empty]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_metadata_malformed_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
            _FakeImageResult(_TINY_PNG_BYTES, "image/png"),
            "not valid json",
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_unsupported_image_mime_passes_guard(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # JPEG should be accepted by the guard.
        fake_genai.queue = [
            _FakeImageResult(_TINY_PNG_BYTES, "image/jpeg"),
            _good_metadata_json(),
        ]
        res = client.post("/v1/visual-aid/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/jpeg;base64,")
