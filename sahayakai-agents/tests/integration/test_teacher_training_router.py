"""Integration test for `POST /v1/teacher-training/advise` (Phase D.2)."""
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
    output_tokens = 600
    total_tokens = 1400
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


_BASE_REQUEST = {
    "question": "How do I keep students engaged during the last period?",
    "language": "English",
    "subject": "Pedagogy",
    "userId": "teacher-uid-1",
}


def _good_response_json() -> str:
    return json.dumps({
        "introduction": (
            "Your concern is shared by many practitioners. The last period "
            "is a structural challenge in any school day."
        ),
        "advice": [
            {
                "strategy": "Open with a 90-second physical activation routine.",
                "pedagogy": "Embodied cognition",
                "explanation": (
                    "Movement primes the prefrontal cortex for attention. "
                    "Think of it as priming the soil before planting — without "
                    "preparation the lesson will not take root."
                ),
            },
            {
                "strategy": (
                    "Switch to peer-led explanation in pairs for 5 minutes."
                ),
                "pedagogy": "Constructivism",
                "explanation": (
                    "Students construct understanding by articulating it. "
                    "It is the difference between watching cricket and playing "
                    "the cover drive yourself."
                ),
            },
        ],
        "conclusion": (
            "The work is sovereign. Hold the standard and the students will "
            "rise to meet it."
        ),
        "gradeLevel": None,
        "subject": "Pedagogy",
    })


class TestTeacherTrainingRouter:
    def test_clean_advice_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json()]
        res = client.post(
            "/v1/teacher-training/advise", json=_BASE_REQUEST,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert len(body["advice"]) == 2
        assert body["advice"][0]["pedagogy"]
        assert body["sidecarVersion"].startswith("phase-d.2")

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post(
            "/v1/teacher-training/advise", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text
