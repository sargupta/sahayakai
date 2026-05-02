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


class TestRubricTokenTelemetry:
    """Forensic fix P1 #18 — verify the `rubric.generated` log line
    carries token + model fields and the request_id is bound via
    contextvars from the middleware.

    Captures structlog output by inserting a `LogCapture` processor
    BEFORE the existing renderer (preserving `merge_contextvars` so
    the request_id from the middleware reaches the captured entry).
    """

    def test_generated_event_carries_tokens_and_model(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        import structlog
        from structlog.testing import LogCapture

        cap = LogCapture()
        # Preserve the existing processor chain (contextvars merge,
        # severity, timestamp, etc.) and replace ONLY the final
        # renderer with the LogCapture so the captured entries still
        # carry the bound `request_id` from the middleware.
        old_processors = list(structlog.get_config()["processors"])
        new_processors = [
            p for p in old_processors
            if not isinstance(
                p, structlog.processors.JSONRenderer | structlog.dev.ConsoleRenderer
            )
        ]
        new_processors.append(cap)
        try:
            structlog.configure(processors=new_processors)
            fake_genai.queue = [
                json.dumps({
                    "title": "Test Rubric",
                    "description": "A test rubric for telemetry.",
                    "criteria": [
                        _good_criterion("C1"),
                        _good_criterion("C2"),
                        _good_criterion("C3"),
                    ],
                    "gradeLevel": "Class 5",
                    "subject": "Science",
                })
            ]
            res = client.post(
                "/v1/rubric/generate",
                json=_BASE_REQUEST,
                headers={"X-Request-ID": "rid-rubric-telemetry-1"},
            )
        finally:
            structlog.configure(processors=old_processors)

        assert res.status_code == 200, res.text
        entries = [e for e in cap.entries if e.get("event") == "rubric.generated"]
        assert len(entries) == 1, (
            f"expected one rubric.generated event, got {len(entries)}: "
            f"{[e.get('event') for e in cap.entries]}"
        )
        entry = entries[0]
        # P.2 — token + cache + model fields stamped on the per-router
        # success event (matches `_FakeUsageMeta` above: input=800,
        # output=600, cached=0).
        assert entry["tokens_in"] == 800
        assert entry["tokens_out"] == 600
        assert entry["tokens_cached"] == 0
        assert entry["model_used"], "model_used must be a non-empty string"
        # P.1 — request_id contextvar bound by the middleware flowed
        # through to the router's structured log call.
        assert entry["request_id"] == "rid-rubric-telemetry-1"


class TestParentMessageTokenTelemetry:
    """Second-router smoke check that the same telemetry pattern is
    wired the same way — guards against drift between routers."""

    def test_parent_message_generated_carries_tokens(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        import structlog
        from structlog.testing import LogCapture

        cap = LogCapture()
        old_processors = list(structlog.get_config()["processors"])
        new_processors = [
            p for p in old_processors
            if not isinstance(
                p, structlog.processors.JSONRenderer | structlog.dev.ConsoleRenderer
            )
        ]
        new_processors.append(cap)
        try:
            structlog.configure(processors=new_processors)
            fake_genai.queue = [
                json.dumps({
                    "message": (
                        "Dear Parent, this is a notification regarding "
                        "your child Aman who was absent today. Please "
                        "ensure attendance. Thanks."
                    ),
                    "languageCode": "en-IN",
                    "wordCount": 24,
                })
            ]
            res = client.post(
                "/v1/parent-message/generate",
                json={
                    "studentName": "Aman",
                    "className": "Class 5",
                    "subject": "Mathematics",
                    # Schema requires Literal enums; use canonical values.
                    "reason": "consecutive_absences",
                    "parentLanguage": "English",
                    "consecutiveAbsentDays": 1,
                    "userId": "teacher-uid-1",
                },
                headers={"X-Request-ID": "rid-pm-telemetry-1"},
            )
        finally:
            structlog.configure(processors=old_processors)

        assert res.status_code == 200, res.text
        entries = [
            e for e in cap.entries
            if e.get("event") == "parent_message.generated"
        ]
        assert len(entries) == 1, [e.get("event") for e in cap.entries]
        entry = entries[0]
        assert entry["tokens_in"] == 800
        assert entry["tokens_out"] == 600
        assert entry["tokens_cached"] == 0
        assert entry["model_used"]
        assert entry["request_id"] == "rid-pm-telemetry-1"
