"""Integration test for avatar generator router (Phase F.2)."""
from __future__ import annotations

import base64
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
    input_tokens = 200
    output_tokens = 0
    total_tokens = 200
    cached_content_tokens = 0


class _FakeInlineData:
    def __init__(self, data: bytes, mime_type: str) -> None:
        self.data = data
        self.mime_type = mime_type


class _FakePart:
    def __init__(
        self,
        *,
        text: str | None = None,
        inline_data: _FakeInlineData | None = None,
    ) -> None:
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
            _FakeCandidate(
                parts=[
                    _FakePart(inline_data=_FakeInlineData(image_bytes, mime)),
                ],
            ),
        ]


class _SequencedFakeAioModels:
    def __init__(self) -> None:
        self.queue: list[Any] = []

    async def generate_content(self, **_kwargs: Any) -> Any:
        if not self.queue:
            raise AssertionError("Test fake: more calls than expected")
        return self.queue.pop(0)


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


_BASE_REQUEST: dict[str, Any] = {
    "name": "Priya Sharma",
    "userId": "teacher-uid-1",
}


class TestAvatarGeneratorRouter:
    def test_clean_avatar_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_FakeImageResult(_TINY_PNG_BYTES, "image/png")]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/png;base64,")
        assert body["sidecarVersion"].startswith("phase-f.2")
        assert body["latencyMs"] >= 0

    def test_jpeg_avatar_passes_guard(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_FakeImageResult(_TINY_PNG_BYTES, "image/jpeg")]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["imageDataUri"].startswith("data:image/jpeg;base64,")

    def test_no_inline_data_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        empty = SimpleNamespace(
            text=None,
            usage_metadata=_FakeUsageMeta(),
            candidates=[_FakeCandidate(parts=[])],
        )
        fake_genai.queue = [empty]
        res = client.post("/v1/avatar-generator/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_userid_returns_422(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Pydantic schema rejects userIds outside [A-Za-z0-9_\-].
        bad_req = dict(_BASE_REQUEST, userId="not/valid")
        res = client.post("/v1/avatar-generator/generate", json=bad_req)
        assert res.status_code == 422, res.text
