"""Integration test for quiz router (Phase E.1)."""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


class _FakeUsageMeta:
    input_tokens = 1500
    output_tokens = 1000
    total_tokens = 2500
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
            raise RuntimeError("Test fake: more calls than expected")
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

    fake_types = SimpleNamespace(
        GenerateContentConfig=lambda **kw: kw,
        Part=SimpleNamespace(
            from_bytes=lambda data, mime_type: {"data": data, "mime": mime_type},
        ),
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


def _good_variant_json(difficulty: str) -> str:
    return json.dumps({
        "title": f"Photosynthesis Quiz — {difficulty.title()} Level",
        "questions": [
            {
                "questionText": "What process do green plants use to make food?",
                "questionType": "multiple_choice",
                "options": ["Photosynthesis", "Respiration", "Digestion", "Decomposition"],
                "correctAnswer": "Photosynthesis",
                "explanation": "Just as a farmer relies on the sun to grow crops, plants use sunlight in photosynthesis to make their own food.",
                "difficultyLevel": difficulty,
            },
        ],
        "teacherInstructions": "Write the question on the left side of the board.",
        "gradeLevel": "Class 5",
        "subject": "Science",
    })


_BASE_REQUEST = {
    "topic": "Photosynthesis for Class 5",
    "numQuestions": 1,
    "questionTypes": ["multiple_choice"],
    "language": "English",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


class TestQuizRouter:
    def test_three_variants_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # The 3 calls are scheduled concurrently via asyncio.gather; the
        # queue-fake is FIFO so any call order works as long as we
        # provide 3 valid responses.
        fake_genai.queue = [
            _good_variant_json("easy"),
            _good_variant_json("medium"),
            _good_variant_json("hard"),
        ]
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["variantsGenerated"] == 3
        # Note: asyncio.gather order is deterministic by argument order
        # (easy, medium, hard) — so easy gets the first queue item etc.
        assert body["easy"] is not None
        assert body["medium"] is not None
        assert body["hard"] is not None
        assert body["sidecarVersion"].startswith("phase-e.1")

    def test_partial_failure_still_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Two variants succeed, one returns malformed JSON.
        fake_genai.queue = [
            _good_variant_json("easy"),
            "not valid json",
            _good_variant_json("hard"),
        ]
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["variantsGenerated"] == 2

    def test_all_three_fail_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not json"] * 3
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Long enough to pass schema, but malformed.
        bad = {**_BASE_REQUEST, "imageDataUri": "garbage" * 5}
        res = client.post("/v1/quiz/generate", json=bad)
        assert res.status_code == 400, res.text
