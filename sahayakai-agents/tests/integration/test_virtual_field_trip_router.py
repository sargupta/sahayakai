"""Integration test for virtual field-trip router (Phase D.3)."""
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


def _good_stop(name: str) -> dict:
    return {
        "name": name,
        "description": (
            f"A vivid description of {name} suitable for the stated grade level."
        ),
        "educationalFact": f"A wow-factor educational fact about {name}.",
        "reflectionPrompt": f"What does {name} teach us about the topic?",
        "googleEarthUrl": f"https://earth.google.com/web/search/{name.replace(' ', '+')}",
        "culturalAnalogy": (
            "Like the Western Ghats during monsoon, but in a colder regime."
        ),
        "explanation": f"This stop best teaches the topic because {name} is iconic.",
    }


def _good_response_json() -> str:
    return json.dumps({
        "title": "Volcanoes of the World — A Class 6 Field Trip",
        "stops": [
            _good_stop("Mauna Loa, Hawaii"),
            _good_stop("Mount Vesuvius, Italy"),
            _good_stop("Mount Fuji, Japan"),
            _good_stop("Krakatoa, Indonesia"),
        ],
        "gradeLevel": "Class 6",
        "subject": "Geography",
    })


_BASE_REQUEST = {
    "topic": "Volcanoes of the world for class 6",
    "language": "English",
    "gradeLevel": "Class 6",
    "userId": "teacher-uid-1",
}


class TestVirtualFieldTripRouter:
    def test_clean_trip_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json()]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert len(body["stops"]) == 4
        assert body["stops"][0]["googleEarthUrl"].startswith("https://earth.google.com/")
        assert body["sidecarVersion"].startswith("phase-d.3")

    def test_invalid_url_in_stop_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        bad = json.loads(_good_response_json())
        bad["stops"][0]["googleEarthUrl"] = "ftp://example.com/notearth"
        fake_genai.queue = [json.dumps(bad)]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
