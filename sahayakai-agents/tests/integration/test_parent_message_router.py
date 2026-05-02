"""Integration test for `POST /v1/parent-message/generate` — Phase C §C.3.

Same queue-fake `google.genai.Client` pattern as the other integration tests.
"""
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
    output_tokens = 200
    total_tokens = 1000
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
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
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
        assert body["sidecarVersion"].startswith("phase-c")
        assert fake_genai.queue == []

    def test_hindi_message_returns_200_with_overwritten_language_code(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        request = {**_BASE_REQUEST, "parentLanguage": "Hindi"}
        # Model returns a junk languageCode; the router should overwrite
        # it from the hardcoded map regardless.
        fake_genai.queue = [
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
        assert fake_genai.queue == []

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = ["not valid json at all"]
        res = client.post("/v1/parent-message/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
        assert fake_genai.queue == []

    def test_too_short_message_returns_502_via_guard(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Schema accepts ≥10 chars + ≥1 word. Behavioural guard
        # rejects <30 words. Build a message that passes schema but
        # fails the guard.
        short = (
            "Dear parent. Arav was absent. We are worried. Please call. "
            "Thanks. Goodbye."
        )
        fake_genai.queue = [
            _generator_json(message=short, language_code="en-IN")
        ]
        res = client.post("/v1/parent-message/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_reason_in_request_returns_422(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        request = {**_BASE_REQUEST, "reason": "made_up_reason"}
        # Schema validation rejects before any Gemini call.
        res = client.post("/v1/parent-message/generate", json=request)
        assert res.status_code == 422, res.text
        assert fake_genai.queue == []
