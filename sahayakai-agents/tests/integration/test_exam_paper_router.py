"""Integration test for exam paper router (Phase E.2 + Phase U.γ).

Phase U.γ fixture redesign — the generator call now goes through ADK's
`Runner.run_async` against an `LlmAgent`. The pre-U.γ
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` +
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_generator_via_runner` in `agents.exam_paper.router` is monkey-
  patched to pop one entry off a shared queue and return the parsed
  `ExamPaperCore` directly. This bypasses ADK Runner entirely for the
  test, which is fine because ADK Runner machinery is itself covered
  by ADK's own test suite + the new `tests/unit/test_exam_paper_adk.py`.

The pre-U.γ wire-shape tests (clean paper, marks-mismatch, malformed
JSON) all still pass because the post-Runner marks-balance + parse-
failure paths are unchanged.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.exam_paper import router as exam_paper_router_mod
from sahayakai_agents.agents.exam_paper.schemas import ExamPaperCore
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


class _QueueFake:
    """Each call returns the next item from a queue.

    Items can be either:
      - A JSON string that parses as `ExamPaperCore` → the fake validates
        through `ExamPaperCore.model_validate_json` (matching what the
        real Runner would do via `output_schema=ExamPaperCore`) and
        returns the parsed model. Malformed JSON triggers the same
        `AgentError(502)` the real router raises on parse failure.
      - A `_RaiseAgentError(...)` sentinel that re-raises the configured
        AgentError to simulate stage-level failures.
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []

    def pop(self) -> Any:
        if not self.queue:
            raise AssertionError(
                "Test fake: more generator calls than test queued"
            )
        return self.queue.pop(0)


class _RaiseAgentError:
    """Sentinel — when the fake pops this, raise the configured AgentError."""

    def __init__(self, *, code: str, message: str, http_status: int) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status


@pytest.fixture
def fake_runner(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch `_run_generator_via_runner` to consume a queue of canned outputs.

    Each pop should be either:
      - A JSON string for the happy path. If the string is unparseable,
        the fake raises `AgentError(502)` mirroring the real router's
        JSON-parse-failed path.
      - `_RaiseAgentError(...)` — the fake raises the corresponding
        AgentError (e.g. empty response, transient failure simulation).
    """
    fake = _QueueFake()

    async def _fake_run_generator_via_runner(
        *, prompt: str, api_key: str,
    ) -> ExamPaperCore:
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        if not isinstance(nxt, str):
            raise AssertionError(
                f"Test fake: queue entries must be str or _RaiseAgentError, "
                f"got {type(nxt).__name__}"
            )
        try:
            return ExamPaperCore.model_validate_json(nxt)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Generator returned text that does not match ExamPaperCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        exam_paper_router_mod,
        "_run_generator_via_runner",
        _fake_run_generator_via_runner,
    )
    return fake


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
        fake_runner: _QueueFake,
    ) -> None:
        fake_runner.queue = [_good_paper_json(max_marks=80)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["title"].startswith("CBSE")
        assert len(body["sections"]) == 2
        # Phase U.γ — sidecarVersion bumped from phase-e.2.0 → phase-u.gamma.
        assert body["sidecarVersion"].startswith("phase-u")

    def test_section_marks_mismatch_returns_502(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
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
        fake_runner.queue = [json.dumps(bad)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_question_marks_mismatch_returns_502(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # Section claims 20 marks but questions sum to 5.
        bad = json.loads(_good_paper_json(max_marks=80))
        bad["sections"][0]["questions"][0]["marks"] = 2
        bad["sections"][0]["questions"][1]["marks"] = 3
        # Section A still has totalMarks=20; questions sum 5 → mismatch.
        fake_runner.queue = [json.dumps(bad)]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        fake_runner.queue = ["not valid json"]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_empty_runner_response_returns_502(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # Phase U.γ — simulate the empty-Runner-output path. The router
        # raises AgentError(502, "Gemini returned empty response") in
        # `_run_generator_via_runner`; the fake exposes the same shape.
        fake_runner.queue = [
            _RaiseAgentError(
                code="INTERNAL",
                message="Gemini returned empty response",
                http_status=502,
            ),
        ]
        res = client.post("/v1/exam-paper/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
