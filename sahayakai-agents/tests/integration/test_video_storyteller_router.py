"""Integration test for video storyteller router (Phase F.1)."""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


class _FakeUsageMeta:
    input_tokens = 800
    output_tokens = 800
    total_tokens = 1600
    cached_content_tokens = 0


class _FakeResult:
    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = []


class _SequencedFakeAioModels:
    def __init__(self) -> None:
        self.queue: list[str] = []

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
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
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json()]
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
        assert body["sidecarVersion"].startswith("phase-f.1")
        assert body["latencyMs"] >= 0

    def test_hindi_message_passes_script_check(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json(language="Hindi")]
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
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Pydantic schema rejects this at parse time → 502 wrapping the
        # parse error. Schema enforces min_length=1 on every category list.
        bad_body = json.loads(_good_response_json())
        bad_body["categories"]["pedagogy"] = []
        fake_genai.queue = [json.dumps(bad_body)]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text

    def test_forbidden_phrase_in_message_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        bad_body = json.loads(_good_response_json())
        bad_body["personalizedMessage"] = (
            "Namaste! I am an AI assistant from SahayakAI. Here are some videos."
        )
        fake_genai.queue = [json.dumps(bad_body)]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post(
            "/v1/video-storyteller/recommend-queries", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text
