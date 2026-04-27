"""Integration test for exam paper router (Phase E.2)."""
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
    output_tokens = 2000
    total_tokens = 3500
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


def _good_paper_json(*, max_marks: float = 80) -> str:
    """A 2-section paper with 4 questions totalling max_marks."""
    section_a_marks = max_marks * 0.25  # MCQs
    section_b_marks = max_marks * 0.75
    return json.dumps({
        "title": "CBSE Class 10 Mathematics Sample Paper",
        "board": "CBSE",
        "subject": "Mathematics",
        "gradeLevel": "Class 10",
        "duration": "3 Hours",
        "maxMarks": max_marks,
        "generalInstructions": [
            "All questions are compulsory.",
            "There is no overall choice. However an internal choice has been provided in some questions.",
            "Use of calculators is not permitted.",
        ],
        "sections": [
            {
                "name": "Section A",
                "label": "Multiple Choice Questions (1 mark each)",
                "totalMarks": section_a_marks,
                "questions": [
                    {
                        "number": 1,
                        "text": "What is the sum of the first 10 natural numbers?",
                        "marks": section_a_marks / 2,
                        "options": ["45", "55", "50", "60"],
                        "internalChoice": None,
                        "answerKey": "55",
                        "markingScheme": "1 mark for correct option.",
                        "source": "AI Generated",
                    },
                    {
                        "number": 2,
                        "text": "If x + 2 = 7, what is x?",
                        "marks": section_a_marks / 2,
                        "options": ["3", "4", "5", "6"],
                        "internalChoice": None,
                        "answerKey": "5",
                        "markingScheme": "1 mark for correct option.",
                        "source": "AI Generated",
                    },
                ],
            },
            {
                "name": "Section B",
                "label": "Long Answer Questions",
                "totalMarks": section_b_marks,
                "questions": [
                    {
                        "number": 1,
                        "text": "Prove that the diagonals of a parallelogram bisect each other.",
                        "marks": section_b_marks / 2,
                        "options": None,
                        "internalChoice": "Prove that opposite sides of a parallelogram are equal.",
                        "answerKey": "Standard proof using triangle congruence.",
                        "markingScheme": "1 mark for diagram, 2 marks for proof, 1 mark for conclusion.",
                        "source": "PYQ 2023",
                    },
                    {
                        "number": 2,
                        "text": "Solve the system: 2x + 3y = 12, x - y = 1.",
                        "marks": section_b_marks / 2,
                        "options": None,
                        "internalChoice": None,
                        "answerKey": "x = 3, y = 2.",
                        "markingScheme": "Method 2 marks, computation 2 marks.",
                        "source": "AI Generated",
                    },
                ],
            },
        ],
        "blueprintSummary": {
            "chapterWise": [
                {"chapter": "Algebra", "marks": max_marks / 2},
                {"chapter": "Geometry", "marks": max_marks / 2},
            ],
            "difficultyWise": [
                {"level": "easy", "percentage": 40},
                {"level": "moderate", "percentage": 40},
                {"level": "hard", "percentage": 20},
            ],
        },
        "pyqSources": [
            {"id": "cbse-2023-q5", "year": 2023, "chapter": "Geometry"},
        ],
    })


_BASE_REQUEST = {
    "board": "CBSE",
    "gradeLevel": "Class 10",
    "subject": "Mathematics",
    "chapters": ["Algebra", "Geometry"],
    "duration": 180,
    "maxMarks": 80,
    "language": "English",
    "difficulty": "mixed",
    "includeAnswerKey": True,
    "includeMarkingScheme": True,
    "userId": "teacher-uid-1",
}


class TestExamPaperRouter:
    def test_clean_paper_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [_good_paper_json(max_marks=80)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["title"].startswith("CBSE")
        assert len(body["sections"]) == 2
        assert body["sidecarVersion"].startswith("phase-e.2")

    def test_section_marks_mismatch_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Paper claims 80 marks total but section sums to 60.
        bad = json.loads(_good_paper_json(max_marks=80))
        # Override section totalMarks so they sum to 60 not 80.
        bad["sections"][0]["totalMarks"] = 20
        bad["sections"][0]["questions"][0]["marks"] = 10
        bad["sections"][0]["questions"][1]["marks"] = 10
        bad["sections"][1]["totalMarks"] = 40
        bad["sections"][1]["questions"][0]["marks"] = 20
        bad["sections"][1]["questions"][1]["marks"] = 20
        fake_genai.queue = [json.dumps(bad)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_question_marks_mismatch_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Section claims 20 marks but questions sum to 5.
        bad = json.loads(_good_paper_json(max_marks=80))
        bad["sections"][0]["questions"][0]["marks"] = 2
        bad["sections"][0]["questions"][1]["marks"] = 3
        # Section A still has totalMarks=20; questions sum 5 → mismatch.
        fake_genai.queue = [json.dumps(bad)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json"]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
