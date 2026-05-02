"""Integration test for `POST /v1/teacher-training/advise`.

Phase D.2 (router) + Phase U.alpha (ADK promotion). The single Gemini
call now goes through ADK's `Runner.run_async` against the cached
`LlmAgent` from `build_teacher_training_agent()`, which makes the old
`sys.modules["google.genai"] = _FakeGenai()` shim incompatible (ADK
loads `google.genai.errors.ClientError` and `google.genai.types.Content`
at import time, and replacing the whole module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.teacher_training.router` is
  monkey-patched to pop one entry off a shared queue and return the
  parsed `TeacherTrainingCore` directly. This bypasses ADK Runner
  entirely for the test, which is fine because ADK Runner machinery is
  itself covered by ADK's own test suite + the new unit tests at
  `tests/unit/test_teacher_training_adk.py`.

Same fixture pattern as L.5 voice-to-text + L.1 vidya integration tests.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.teacher_training import router as tt_router_mod
from sahayakai_agents.agents.teacher_training.schemas import TeacherTrainingCore
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


class _QueueFake:
    """Each call returns the next item from a queue (a JSON string)."""

    def __init__(self) -> None:
        self.queue: list[str] = []
        self.calls: list[dict[str, Any]] = []

    def pop(self) -> str:
        if not self.queue:
            raise AssertionError(
                "Test fake: more pipeline calls than test queued"
            )
        return self.queue.pop(0)


@pytest.fixture
def fake_pipeline(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch `_run_pipeline_via_runner` to consume a queue of canned JSON."""
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *, prompt: str, api_key: str,
    ) -> TeacherTrainingCore:
        fake.calls.append({
            "prompt_len": len(prompt),
            "api_key": api_key,
        })
        text = fake.pop()
        try:
            return TeacherTrainingCore.model_validate_json(text)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Advisor returned text that does not match "
                    "TeacherTrainingCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        tt_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json()]
        res = client.post(
            "/v1/teacher-training/advise", json=_BASE_REQUEST,
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert len(body["advice"]) == 2
        assert body["advice"][0]["pedagogy"]
        assert body["sidecarVersion"].startswith("phase-")

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json"]
        res = client.post(
            "/v1/teacher-training/advise", json=_BASE_REQUEST,
        )
        assert res.status_code == 502, res.text
