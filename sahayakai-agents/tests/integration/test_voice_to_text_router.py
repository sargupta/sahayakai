"""Integration test for voice-to-text router (Phase I + Phase L.5).

Phase L.5 fixture redesign — same strategy as L.1 vidya:

The single multimodal stage now runs through ADK's `Runner.run_async`
against a degenerate `SequentialAgent` of 1 sub-agent. The pre-L.5
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` and
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.voice_to_text.router` is
  monkey-patched to pop one entry off a shared queue and return the
  parsed `VoiceToTextCore` directly. This bypasses ADK Runner entirely
  for the test, which is fine because ADK Runner machinery is itself
  covered by ADK's own test suite + the new unit tests at
  `tests/unit/test_voice_to_text_adk.py`.

The router-side input validation (data URI shape, MIME prefix, byte
size cap) still runs verbatim — only the model-call surface is faked.
"""
from __future__ import annotations

import base64
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.voice_to_text import router as vtt_router_mod
from sahayakai_agents.agents.voice_to_text.schemas import VoiceToTextCore
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration

# Tiny placeholder audio bytes — the test fake never actually decodes
# them; the router validates the data URI shape before the fake fires.
_TINY_AUDIO_BYTES = b"\x1aE\xdf\xa3" + b"\x00" * 64
_TINY_AUDIO_B64 = base64.b64encode(_TINY_AUDIO_BYTES).decode("ascii")
_AUDIO_DATA_URI = f"data:audio/webm;base64,{_TINY_AUDIO_B64}"


class _QueueFake:
    """Each call returns the next item from a queue.

    Items are either:
      - A JSON string matching `VoiceToTextCore` (happy path).
      - `_RaiseAgentError(...)` — re-raise the configured AgentError.
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []
        self.calls: list[dict[str, Any]] = []

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
    """Patch `_run_pipeline_via_runner` to consume a queue of canned JSON."""
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *,
        prompt_text: str,
        audio_bytes: bytes,
        audio_mime: str,
        api_key: str,
    ) -> VoiceToTextCore:
        # Record the call so tests could assert audio bytes flowed
        # through. The router-side audio data URI decoder is what makes
        # the byte length non-trivial.
        fake.calls.append({
            "prompt_text_len": len(prompt_text),
            "audio_bytes_len": len(audio_bytes),
            "audio_mime": audio_mime,
        })
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        try:
            return VoiceToTextCore.model_validate_json(nxt)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Transcriber returned text that does not match "
                    "VoiceToTextCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        vtt_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


_BASE_REQUEST: dict[str, Any] = {
    "audioDataUri": _AUDIO_DATA_URI,
    "userId": "teacher-uid-1",
}


def _good_response_json(
    *,
    text: str = "Photosynthesis is the process plants use.",
    language: str | None = "en",
) -> str:
    return json.dumps({"text": text, "language": language})


class TestVoiceToTextRouter:
    def test_clean_response_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json()]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["text"].startswith("Photosynthesis")
        assert body["language"] == "en"
        assert body["sidecarVersion"].startswith("phase-l")
        assert body["latencyMs"] >= 0
        # Sanity: audio bytes flowed through to the pipeline.
        assert fake_pipeline.calls[0]["audio_bytes_len"] == len(
            _TINY_AUDIO_BYTES
        )
        assert fake_pipeline.calls[0]["audio_mime"] == "audio/webm"

    def test_hindi_transcription(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json(language=None)]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["language"] is None

    def test_unsupported_language_iso_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # French is not in the supported set.
        fake_pipeline.queue = [_good_response_json(language="fr")]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
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
        fake_pipeline: _QueueFake,
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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json"]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_forbidden_phrase_in_text_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            _good_response_json(
                text="I am an AI assistant from SahayakAI.",
            ),
        ]
        res = client.post("/v1/voice-to-text/transcribe", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
