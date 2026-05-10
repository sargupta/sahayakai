"""Integration test for `POST /v1/parent-message/generate`.

Phase C §C.3 (router) + Phase U.alpha (ADK promotion). The single Gemini
call now goes through ADK's `Runner.run_async` against the cached
`LlmAgent` from `build_parent_message_agent()`, which makes the old
`sys.modules["google.genai"] = _FakeGenai()` shim incompatible (ADK
loads `google.genai.errors.ClientError` and `google.genai.types.Content`
at import time, and replacing the whole module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.parent_message.router` is
  monkey-patched to pop one entry off a shared queue and return the
  parsed `ParentMessageCore` directly. This bypasses ADK Runner entirely
  for the test, which is fine because ADK Runner machinery is itself
  covered by ADK's own test suite + the new unit tests at
  `tests/unit/test_parent_message_adk.py`.

Same fixture pattern as L.5 voice-to-text + L.1 vidya integration tests.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.parent_message import router as pm_router_mod
from sahayakai_agents.agents.parent_message.schemas import ParentMessageCore
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


class _QueueFake:
    """Each call returns the next item from a queue (a JSON string).

    The fake also records call metadata for tests that need to assert
    the prompt passed through the runner boundary.
    """

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
    ) -> ParentMessageCore:
        fake.calls.append({
            "prompt_len": len(prompt),
            "api_key": api_key,
        })
        text = fake.pop()
        try:
            return ParentMessageCore.model_validate_json(text)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Generator returned text that does not match "
                    "ParentMessageCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        pm_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ── Canned model output helper ────────────────────────────────────────────


def _generator_json(*, message: str, language_code: str = "en-IN") -> str:
    return json.dumps(
        {
            "message": message,
            "languageCode": language_code,
            "wordCount": len(message.split()),
        }
    )


_BASE_REQUEST = {
    "studentName": "Arav",
    "className": "Class 5",
    "subject": "Mathematics",
    "reason": "consecutive_absences",
    "parentLanguage": "English",
    "consecutiveAbsentDays": 4,
    "teacherName": "Mrs. Sharma",
    "schoolName": "Sunrise Public",
    "userId": "teacher-uid-1",
}


# ── Tests ────────────────────────────────────────────────────────────────


class TestParentMessageRouter:
    def test_english_message_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
            _generator_json(
                message=(
                    "Dear parent, I am writing about your child Arav. He "
                    "has been absent for four days this week. We hope "
                    "everything is fine at home and would love to "
                    "support you. Please feel free to reach out. Warm "
                    "regards, Mrs. Sharma."
                ),
                language_code="en-IN",
            ),
        ]
        res = client.post("/v1/parent-message/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "Arav" in body["message"]
        # languageCode is server-overwritten from the hardcoded map.
        assert body["languageCode"] == "en-IN"
        assert body["wordCount"] >= 30
        assert body["sidecarVersion"].startswith("phase-")
        assert fake_pipeline.queue == []

    def test_hindi_message_returns_200_with_overwritten_language_code(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        request = {**_BASE_REQUEST, "parentLanguage": "Hindi"}
        # Model returns a junk languageCode; the router should overwrite
        # it from the hardcoded map regardless.
        fake_pipeline.queue = [
            _generator_json(
                message=(
                    "नमस्ते। आपके बच्चे आरव की पिछले चार दिनों से "
                    "लगातार अनुपस्थिति को लेकर हम चिंतित हैं। कृपया "
                    "स्कूल से संपर्क करें। आपकी सहायता के लिए हम सदैव "
                    "तैयार हैं। आपकी बच्चे की शिक्षिका श्रीमती शर्मा।"
                ),
                language_code="WHATEVER-MADE-UP-CODE",
            ),
        ]
        res = client.post("/v1/parent-message/generate", json=request)
        assert res.status_code == 200, res.text
        body = res.json()
        # Server overwrote the model's hallucinated code.
        assert body["languageCode"] == "hi-IN"
        assert "आरव" in body["message"]
        assert fake_pipeline.queue == []

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json at all"]
        res = client.post("/v1/parent-message/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
        assert fake_pipeline.queue == []

    def test_too_short_message_returns_502_via_guard(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # Schema accepts ≥10 chars + ≥1 word. Behavioural guard
        # rejects <30 words. Build a message that passes schema but
        # fails the guard.
        short = (
            "Dear parent. Arav was absent. We are worried. Please call. "
            "Thanks. Goodbye."
        )
        fake_pipeline.queue = [
            _generator_json(message=short, language_code="en-IN")
        ]
        res = client.post("/v1/parent-message/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_reason_in_request_returns_422(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        request = {**_BASE_REQUEST, "reason": "made_up_reason"}
        # Schema validation rejects before any Gemini call.
        res = client.post("/v1/parent-message/generate", json=request)
        assert res.status_code == 422, res.text
        assert fake_pipeline.queue == []
