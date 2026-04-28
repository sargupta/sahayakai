"""Integration test for `POST /v1/rubric/generate`.

Phase D.1 (router) + Phase U.alpha (ADK promotion). The single Gemini
call now goes through ADK's `Runner.run_async` against the cached
`LlmAgent` from `build_rubric_agent()`, which makes the old
`sys.modules["google.genai"] = _FakeGenai()` shim incompatible (ADK
loads `google.genai.errors.ClientError` and `google.genai.types.Content`
at import time, and replacing the whole module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.rubric.router` is monkey-patched
  to pop one entry off a shared queue and return the parsed
  `RubricGeneratorCore` directly. This bypasses ADK Runner entirely for
  the test, which is fine because ADK Runner machinery is itself covered
  by ADK's own test suite + the new unit tests at
  `tests/unit/test_rubric_adk.py`.

Same fixture pattern as L.5 voice-to-text + L.1 vidya integration tests.

Note: the `*TokenTelemetry` test classes that previously asserted
`tokens_in/out` from the `_FakeUsageMeta` no longer apply — Phase U.alpha
sources tokens from `ai_resilience.attempt_succeeded` events keyed on
`request_id`, and the per-router success log emits `tokens_in/out=None`
because Runner doesn't surface the raw model result. The `request_id`
propagation is still asserted via the per-router `request_id` field on
the success log line.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.rubric import router as rubric_router_mod
from sahayakai_agents.agents.rubric.schemas import RubricGeneratorCore
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
    ) -> RubricGeneratorCore:
        fake.calls.append({
            "prompt_len": len(prompt),
            "api_key": api_key,
        })
        text = fake.pop()
        try:
            return RubricGeneratorCore.model_validate_json(text)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Generator returned text that does not match "
                    "RubricGeneratorCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        rubric_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [
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
        assert body["sidecarVersion"].startswith("phase-")
        assert fake_pipeline.queue == []

    def test_inverted_levels_returns_502_via_guard(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        bad_criterion = _good_criterion("Bad Criterion")
        bad_criterion["levels"] = list(reversed(bad_criterion["levels"]))
        fake_pipeline.queue = [
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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json at all"]
        res = client.post("/v1/rubric/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_too_few_criteria_in_response_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # Schema requires min 3 criteria. Model returns 2 → schema parse fail.
        fake_pipeline.queue = [
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


class TestRubricRequestIdPropagation:
    """Phase U.alpha — the per-router success log no longer carries
    `tokens_in/out` (Runner doesn't surface the raw Gemini result), but
    the `request_id` from the middleware contextvar still flows through
    the structured log call. Per-attempt token counts live on the
    `ai_resilience.attempt_succeeded` events, joined by `request_id`.

    This test only asserts the request_id propagation; tokens are
    `None` by design after Phase U.alpha.

    Captures structlog output by inserting a `LogCapture` processor
    before the existing renderer (preserving `merge_contextvars` so
    the request_id from the middleware reaches the captured entry).
    """

    def test_generated_event_carries_request_id(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
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
            fake_pipeline.queue = [
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
        # Phase U.alpha — Runner doesn't surface raw Gemini result, so
        # tokens are None. Per-attempt counts live on the matching
        # `ai_resilience.attempt_succeeded` events, joined by request_id.
        assert entry["tokens_in"] is None
        assert entry["tokens_out"] is None
        assert entry["tokens_cached"] is None
        assert entry["model_used"], "model_used must be a non-empty string"
        # request_id contextvar bound by the middleware flowed through
        # to the router's structured log call.
        assert entry["request_id"] == "rid-rubric-telemetry-1"


class TestParentMessageRequestIdPropagation:
    """Second-router smoke check that the same telemetry pattern is
    wired the same way — guards against drift between routers.

    Note: this test was previously named TestParentMessageTokenTelemetry
    and asserted token values. Phase U.alpha removes raw-result token
    extraction (Runner doesn't surface it), so the test now only checks
    request_id propagation.
    """

    def test_parent_message_generated_carries_request_id(
        self,
        client: TestClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import structlog
        from structlog.testing import LogCapture

        # Patch parent_message's pipeline runner the same way the rubric
        # fake_pipeline fixture does. Inline because this test class is
        # the only consumer and the fake's shape is trivial.
        from sahayakai_agents.agents.parent_message import (  # noqa: PLC0415
            router as pm_router_mod,
        )
        from sahayakai_agents.agents.parent_message.schemas import (  # noqa: PLC0415
            ParentMessageCore,
        )

        async def _fake_pm_pipeline(
            *, prompt: str, api_key: str,
        ) -> ParentMessageCore:
            return ParentMessageCore.model_validate_json(json.dumps({
                "message": (
                    "Dear Parent, this is a notification regarding your "
                    "child Aman who was absent today. Please ensure "
                    "attendance. Thanks."
                ),
                "languageCode": "en-IN",
                "wordCount": 24,
            }))

        monkeypatch.setattr(
            pm_router_mod, "_run_pipeline_via_runner", _fake_pm_pipeline,
        )

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
            res = client.post(
                "/v1/parent-message/generate",
                json={
                    "studentName": "Aman",
                    "className": "Class 5",
                    "subject": "Mathematics",
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
        # Phase U.alpha — tokens go to None, request_id still flows.
        assert entry["tokens_in"] is None
        assert entry["tokens_out"] is None
        assert entry["tokens_cached"] is None
        assert entry["model_used"]
        assert entry["request_id"] == "rid-pm-telemetry-1"
