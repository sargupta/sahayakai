"""Integration test for virtual field-trip router (Phase D.3 + Phase U.beta).

Phase U.beta fixture redesign — same strategy as L.1 vidya / L.5
visual-aid:

The single Gemini structured call now runs through ADK's
`Runner.run_async` against a cached `LlmAgent`. The pre-migration
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` and
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.virtual_field_trip.router` is
  monkey-patched to pop one entry off a shared queue and return the
  parsed `VirtualFieldTripCore` directly. This bypasses ADK Runner
  entirely for the test; ADK Runner machinery is itself covered by
  ADK's own test suite + the new
  `tests/unit/test_virtual_field_trip_adk.py`.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.virtual_field_trip import (
    router as vft_router_mod,
)
from sahayakai_agents.agents.virtual_field_trip.schemas import (
    VirtualFieldTripCore,
)
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


class _QueueFake:
    """Each call returns the next item from a queue.

    Items can be either:
      - A JSON string matching `VirtualFieldTripCore` (happy path).
      - `_RaiseAgentError(...)` — re-raise the configured AgentError.
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []

    def pop(self) -> Any:
        if not self.queue:
            raise AssertionError(
                "Test fake: more pipeline calls than test queued"
            )
        return self.queue.pop(0)


class _RaiseAgentError:
    """Sentinel — when the fake pops this, raise the configured AgentError."""

    def __init__(self, *, code: str, message: str, http_status: int) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status


@pytest.fixture
def fake_pipeline(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch `_run_pipeline_via_runner` to consume a queue of canned JSON."""
    fake = _QueueFake()

    async def _fake_run_pipeline_via_runner(
        *, prompt: str, api_key: str,
    ) -> VirtualFieldTripCore:
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        try:
            return VirtualFieldTripCore.model_validate_json(nxt)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Planner returned text that does not match "
                    "VirtualFieldTripCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        vft_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _good_stop(name: str) -> dict:
    return {
        "name": name,
        "description": (
            f"A vivid description of {name} suitable for the stated grade level."
        ),
        "educationalFact": f"A wow-factor educational fact about {name}.",
        "reflectionPrompt": f"What does {name} teach us about the topic?",
        "googleEarthUrl": f"https://earth.google.com/web/search/{name.replace(' ', '+')}",
        "culturalAnalogy": (
            "Like the Western Ghats during monsoon, but in a colder regime."
        ),
        "explanation": f"This stop best teaches the topic because {name} is iconic.",
    }


def _good_response_json() -> str:
    return json.dumps({
        "title": "Volcanoes of the World — A Class 6 Field Trip",
        "stops": [
            _good_stop("Mauna Loa, Hawaii"),
            _good_stop("Mount Vesuvius, Italy"),
            _good_stop("Mount Fuji, Japan"),
            _good_stop("Krakatoa, Indonesia"),
        ],
        "gradeLevel": "Class 6",
        "subject": "Geography",
    })


_BASE_REQUEST = {
    "topic": "Volcanoes of the world for class 6",
    "language": "English",
    "gradeLevel": "Class 6",
    "userId": "teacher-uid-1",
}


class TestVirtualFieldTripRouter:
    def test_clean_trip_returns_200(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json()]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert len(body["stops"]) == 4
        assert body["stops"][0]["googleEarthUrl"].startswith("https://earth.google.com/")
        assert body["sidecarVersion"].startswith("phase-")

    def test_invalid_url_in_stop_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        bad = json.loads(_good_response_json())
        bad["stops"][0]["googleEarthUrl"] = "ftp://example.com/notearth"
        fake_pipeline.queue = [json.dumps(bad)]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json"]
        res = client.post("/v1/virtual-field-trip/plan", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
