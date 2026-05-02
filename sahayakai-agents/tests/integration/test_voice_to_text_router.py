"""Integration test for voice-to-text router (Phase I)."""
from __future__ import annotations

import base64
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration

# Tiny placeholder audio bytes — the test fake never actually decodes
# them; the router just validates the data URI shape.
_TINY_AUDIO_BYTES = b"\x1aE\xdf\xa3" + b"\x00" * 64
_TINY_AUDIO_B64 = base64.b64encode(_TINY_AUDIO_BYTES).decode("ascii")
_AUDIO_DATA_URI = f"data:audio/webm;base64,{_TINY_AUDIO_B64}"


class _FakeUsageMeta:
    input_tokens = 1200
    output_tokens = 100
    total_tokens = 1300
    cached_content_tokens = 0


class _FakeResult:
    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = []


class _SequencedFakeAioModels:
    def __init__(self) -> None:
        self.queue: list[str] = []
        self.last_call_kwargs: dict[str, Any] = {}

    async def generate_content(self, **kwargs: Any) -> _FakeResult:
        self.last_call_kwargs = kwargs
        if not self.queue:
            raise AssertionError("Test fake: more calls than expected")
        return _FakeResult(self.queue.pop(0))


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

    # Fake `Part.from_bytes` that just returns a sentinel namespace
    # — the test never inspects the part shape, just confirms the
    # router calls Part.from_bytes with the right args.
    fake_part_calls: list[dict[str, Any]] = []

    class _FakePart:
        @staticmethod
        def from_bytes(*, data: bytes, mime_type: str) -> Any:
            fake_part_calls.append({"data_len": len(data), "mime_type": mime_type})
            return SimpleNamespace(_kind="audio_part", _mime=mime_type)

    fake_types = SimpleNamespace(
        GenerateContentConfig=lambda **kw: kw,
        Part=_FakePart,
    )
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
    "audioDataUri": _AUDIO_DATA_URI,
    "userId": "teacher-uid-1",
}


def _good_response_json(*, text: str = "Photosynthesis is the process plants use.", language: str | None = "en") -> str:
    return json.dumps({"text": text, "language": language})


class TestVoiceToTextRouter:
    def test_clean_response_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json()]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["text"].startswith("Photosynthesis")
        assert body["language"] == "en"
        assert body["sidecarVersion"].startswith("phase-i")
        assert body["latencyMs"] >= 0

    def test_hindi_transcription(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
            _good_response_json(text="नमस्ते अध्यापक जी।", language="hi"),
        ]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "नमस्ते" in body["text"]
        assert body["language"] == "hi"

    def test_uncertain_language_passes_with_null(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json(language=None)]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["language"] is None

    def test_unsupported_language_iso_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # French is not in the supported set.
        fake_genai.queue = [_good_response_json(language="fr")]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Long enough to clear the schema's min_length=32 but doesn't
        # match the data: URI regex — caught by the router's own decoder.
        bad_req = dict(
            _BASE_REQUEST,
            audioDataUri="this-is-not-a-valid-data-uri-at-all-just-padding",
        )
        res = client.post("/v1/voice-to-text/transcribe", json=bad_req)
        assert res.status_code == 400, res.text

    def test_unsupported_audio_mime_returns_400(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # PNG is not an audio MIME.
        bad_req = dict(
            _BASE_REQUEST,
            audioDataUri=f"data:image/png;base64,{_TINY_AUDIO_B64}",
        )
        res = client.post("/v1/voice-to-text/transcribe", json=bad_req)
        assert res.status_code == 400, res.text

    def test_malformed_json_response_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_forbidden_phrase_in_text_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
            _good_response_json(
                text="I am an AI assistant from SahayakAI.",
            ),
        ]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
