"""Integration test for `POST /v1/rubric/generate` (Phase D.1)."""
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
            raise AssertionError(
                "Test fake: more generate_content calls than expected"
            )
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


def _good_criterion(name: str) -> dict:
    return {
        "name": name,
        "description": f"Evaluates the {name.lower()} aspect of the assignment.",
        "levels": [
            {"name": "Exemplary", "description": "Exceeds all expectations clearly.", "points": 4},
            {"name": "Proficient", "description": "Meets all standard expectations.", "points": 3},
            {"name": "Developing", "description": "Shows partial understanding.", "points": 2},
            {"name": "Beginning", "description": "Minimal evidence of skill present.", "points": 1},
        ],
    }


_BASE_REQUEST = {
    "assignmentDescription": "A grade 5 project on renewable energy sources.",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "language": "English",
    "userId": "teacher-uid-1",
}


class TestRubricRouter:
    def test_clean_rubric_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
            json.dumps({
                "title": "Renewable Energy Project Rubric",
                "description": "Evaluates a Class 5 project on renewable energy.",
                "criteria": [
                    _good_criterion("Research and Content"),
                    _good_criterion("Presentation"),
                    _good_criterion("Originality"),
                ],
                "gradeLevel": "Class 5",
                "subject": "Science",
            })
        ]
        res = client.post("/v1/rubric/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["title"] == "Renewable Energy Project Rubric"
        assert len(body["criteria"]) == 3
        assert body["criteria"][0]["levels"][0]["points"] == 4
        assert body["sidecarVersion"].startswith("phase-d")
        assert fake_genai.queue == []

    def test_inverted_levels_returns_502_via_guard(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        bad_criterion = _good_criterion("Bad Criterion")
        bad_criterion["levels"] = list(reversed(bad_criterion["levels"]))
        fake_genai.queue = [
            json.dumps({
                "title": "Bad Rubric",
                "description": "A rubric with inverted levels.",
                "criteria": [
                    bad_criterion,
                    _good_criterion("OK1"),
                    _good_criterion("OK2"),
                ],
                "gradeLevel": "Class 5",
                "subject": "Science",
            })
        ]
        res = client.post("/v1/rubric/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json at all"]
        res = client.post("/v1/rubric/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_too_few_criteria_in_response_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Schema requires min 3 criteria. Model returns 2 → schema parse fail.
        fake_genai.queue = [
            json.dumps({
                "title": "Sparse Rubric",
                "description": "Only two criteria.",
                "criteria": [_good_criterion("C1"), _good_criterion("C2")],
                "gradeLevel": "Class 5",
                "subject": "Science",
            })
        ]
        res = client.post("/v1/rubric/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
