"""Integration test for worksheet router (Phase D.4)."""
from __future__ import annotations

import base64
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# Tiny 1×1 PNG (transparent) — valid bytes, smallest possible image.
_TINY_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWj"
    "kI4QAAAABJRU5ErkJggg=="
)
_VALID_DATA_URI = "data:image/png;base64," + base64.b64encode(_TINY_PNG_BYTES).decode("ascii")


class _FakeUsageMeta:
    input_tokens = 1500
    output_tokens = 800
    total_tokens = 2300
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


def _good_response_json() -> str:
    return json.dumps({
        "title": "Photosynthesis Practice — Class 5",
        "gradeLevel": "Class 5",
        "subject": "Science",
        "learningObjectives": [
            "Identify parts of a leaf involved in photosynthesis.",
            "Explain how plants make their own food.",
        ],
        "studentInstructions": "Read the question carefully and write your answer in the space provided.",
        "activities": [
            {
                "type": "question",
                "content": "What is chlorophyll?",
                "explanation": "Anchors the concept in everyday observation of green leaves.",
                "chalkboardNote": "Draw a simple leaf with veins.",
            },
            {
                "type": "puzzle",
                "content": "Match each part of the leaf with its function.",
                "explanation": "Reinforces vocabulary through pattern recognition.",
                "chalkboardNote": None,
            },
        ],
        "answerKey": [
            {"activityIndex": 0, "answer": "Chlorophyll is the green pigment that captures sunlight."},
            {"activityIndex": 1, "answer": "Stomata — gas exchange; veins — transport; chlorophyll — light capture."},
        ],
    })


_BASE_REQUEST = {
    "imageDataUri": _VALID_DATA_URI,
    "prompt": "Make a worksheet on photosynthesis from this textbook page.",
    "language": "English",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


class TestWorksheetRouter:
    def test_clean_worksheet_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_response_json()]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["title"].startswith("Photosynthesis")
        assert len(body["activities"]) == 2
        assert len(body["answerKey"]) == 2
        assert body["sidecarVersion"].startswith("phase-d.4")

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        bad = {**_BASE_REQUEST, "imageDataUri": "not-a-data-uri"}
        res = client.post("/v1/worksheet/generate", json=bad)
        # Schema cap on length is 20 chars min; "not-a-data-uri" is 14 chars
        # so Pydantic rejects → 422. Test the longer-but-malformed case.
        assert res.status_code in (400, 422), res.text

    def test_malformed_data_uri_long_enough_returns_400(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Long enough to pass schema, but not parseable as data URI.
        bad = {**_BASE_REQUEST, "imageDataUri": "garbage" * 5}
        res = client.post("/v1/worksheet/generate", json=bad)
        assert res.status_code == 400, res.text

    def test_answer_key_index_oob_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        bad = json.loads(_good_response_json())
        bad["answerKey"][0]["activityIndex"] = 99  # out of bounds
        fake_genai.queue = [json.dumps(bad)]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
