"""Integration test for video storyteller router (Phase F.1 + Phase U.beta).

Phase U.beta fixture redesign — same strategy as L.1 vidya / L.5
visual-aid:

The single Gemini structured call now runs through ADK's
`Runner.run_async` against a cached `LlmAgent`. The pre-migration
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` and
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.video_storyteller.router` is
  monkey-patched to pop one entry off a shared queue and return the
  parsed `VideoStorytellerCore` directly. This bypasses ADK Runner
  entirely for the test; ADK Runner machinery is itself covered by
  ADK's own test suite + the new
  `tests/unit/test_video_storyteller_adk.py`.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.video_storyteller import (
    router as vs_router_mod,
)
from sahayakai_agents.agents.video_storyteller.schemas import (
    VideoStorytellerCore,
)
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


class _QueueFake:
    """Each call returns the next item from a queue.

    Items can be either:
      - A JSON string matching `VideoStorytellerCore` (happy path).
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
    """Patch `_run_pipeline_via_runner` to consume a queue of canned JSON."""
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *, prompt: str, api_key: str,
    ) -> VideoStorytellerCore:
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        try:
            return VideoStorytellerCore.model_validate_json(nxt)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Recommender returned text that does not match "
                    "VideoStorytellerCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        vs_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _good_categories() -> dict[str, list[str]]:
    return {
        "pedagogy": [
            "NEP 2020 active learning primary",
            "child centred teaching methods",
            "DIKSHA NISHTHA training modules",
        ],
        "storytelling": [
            "NCERT photosynthesis class 5 animated",
            "plant life cycle story",
            "joyful learning science classroom",
        ],
        "govtUpdates": [
            "Ministry of Education school notification",
            "Samagra Shiksha announcement",
            "NIPUN Bharat circular",
        ],
        "courses": [
            "NISHTHA teacher training course",
            "SWAYAM B Ed refresher",
            "DIKSHA professional development",
        ],
        "topRecommended": [
            "NCERT class 5 science",
            "Azim Premji Foundation classroom",
            "Pratham primary teacher",
        ],
    }


def _good_response_json(*, language: str = "English") -> str:
    body: dict[str, Any] = {
        "categories": _good_categories(),
        "personalizedMessage": (
            "Namaste Adhyapak! Here are thoughtfully curated resources for your "
            "Class 5 Science classroom. These videos blend pedagogy guidance, "
            "engaging storytelling, and important government updates."
        ),
    }
    if language and language.lower() == "hindi":
        body["personalizedMessage"] = (
            "नमस्ते अध्यापक जी! आपकी कक्षा 5 विज्ञान के लिए सावधानी से चुने गए "
            "संसाधन यहाँ हैं। ये वीडियो शिक्षण पद्धति, रोचक कहानी कहने और महत्वपूर्ण "
            "सरकारी अद्यतनों को मिलाते हैं।"
        )
    return json.dumps(body)


_BASE_REQUEST: dict[str, Any] = {
    "subject": "Science",
    "gradeLevel": "Class 5",
    "topic": "Photosynthesis",
    "language": "English",
    "state": "Karnataka",
    "educationBoard": "CBSE",
    "userId": "teacher-uid-1",
}


class TestVideoStorytellerRouter:
    def test_clean_response_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json()]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert set(body["categories"].keys()) == {
            "pedagogy", "storytelling", "govtUpdates", "courses", "topRecommended",
        }
        for cat in body["categories"].values():
            assert 1 <= len(cat) <= 10
        assert body["sidecarVersion"].startswith("phase-")
        assert body["latencyMs"] >= 0

    def test_hindi_message_passes_script_check(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json(language="Hindi")]
        req = dict(_BASE_REQUEST, language="Hindi")
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=req,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        # Hindi script must dominate
        msg = body["personalizedMessage"]
        devanagari_count = sum(1 for ch in msg if 0x0900 <= ord(ch) <= 0x097F)
        assert devanagari_count > 30, msg

    def test_empty_category_list_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # Pydantic schema rejects this at parse time → 502 wrapping the
        # parse error. Schema enforces min_length=1 on every category list.
        bad_body = json.loads(_good_response_json())
        bad_body["categories"]["pedagogy"] = []
        fake_pipeline.queue = [json.dumps(bad_body)]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text

    def test_forbidden_phrase_in_message_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        bad_body = json.loads(_good_response_json())
        bad_body["personalizedMessage"] = (
            "Namaste! I am an AI assistant from SahayakAI. Here are some videos."
        )
        fake_pipeline.queue = [json.dumps(bad_body)]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json"]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text
