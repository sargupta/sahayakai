"""Integration test for worksheet router (Phase D.4 + Phase U.beta).

Phase U.beta fixture redesign — same strategy as L.1 vidya / L.5
visual-aid:

The single multimodal Gemini call now runs through ADK's
`Runner.run_async` against a cached `LlmAgent`. The pre-migration
`sys.modules["google.genai"] = _FakeGenai()` shim is incompatible with
that machinery (ADK loads `google.genai.errors.ClientError` and
`google.genai.types.Content` at import time, and replacing the whole
module breaks both).

New strategy — patch at one surgical point:

  `_run_pipeline_via_runner` in `agents.worksheet.router` is monkey-
  patched to pop one entry off a shared queue and return the parsed
  `WorksheetCore` directly. This bypasses ADK Runner entirely for the
  test; ADK Runner machinery is itself covered by ADK's own test suite
  + the new `tests/unit/test_worksheet_adk.py`.

The router-side input validation (data URI shape, MIME prefix) still
runs verbatim — only the model-call surface is faked.
"""
from __future__ import annotations

import base64
import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.worksheet import router as worksheet_router_mod
from sahayakai_agents.agents.worksheet.schemas import WorksheetCore
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


# Tiny 1×1 PNG (transparent) — valid bytes, smallest possible image.
_TINY_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWj"
    "kI4QAAAABJRU5ErkJggg=="
)
_VALID_DATA_URI = "data:image/png;base64," + base64.b64encode(_TINY_PNG_BYTES).decode("ascii")


class _QueueFake:
    """Each call returns the next item from a queue.

    Items can be either:
      - A JSON string matching `WorksheetCore` (happy path).
      - `_RaiseAgentError(...)` — re-raise the configured AgentError.
    """

    def __init__(self) -> None:
        self.queue: list[Any] = []
        self.calls: list[dict[str, Any]] = []

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
        *,
        prompt: str,
        image_bytes: bytes,
        image_mime: str,
        api_key: str,
    ) -> WorksheetCore:
        # Record the call so tests can assert image bytes flowed
        # through. The router-side data URI decoder is what makes
        # the byte length non-trivial.
        fake.calls.append({
            "prompt_len": len(prompt),
            "image_bytes_len": len(image_bytes),
            "image_mime": image_mime,
        })
        nxt = fake.pop()
        if isinstance(nxt, _RaiseAgentError):
            raise AgentError(
                code=nxt.code,
                message=nxt.message,
                http_status=nxt.http_status,
            )
        try:
            return WorksheetCore.model_validate_json(nxt)
        except Exception as exc:
            raise AgentError(
                code="INTERNAL",
                message=(
                    "Wizard returned text that does not match WorksheetCore"
                ),
                http_status=502,
            ) from exc

    monkeypatch.setattr(
        worksheet_router_mod,
        "_run_pipeline_via_runner",
        _fake_run_pipeline_via_runner,
    )
    return fake


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
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = [_good_response_json()]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["title"].startswith("Photosynthesis")
        assert len(body["activities"]) == 2
        assert len(body["answerKey"]) == 2
        assert body["sidecarVersion"].startswith("phase-")
        # Sanity: image bytes flowed through to the pipeline.
        assert fake_pipeline.calls[0]["image_bytes_len"] == len(
            _TINY_PNG_BYTES
        )
        assert fake_pipeline.calls[0]["image_mime"] == "image/png"

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        bad = {**_BASE_REQUEST, "imageDataUri": "not-a-data-uri"}
        res = client.post("/v1/worksheet/generate", json=bad)
        # Schema cap on length is 20 chars min; "not-a-data-uri" is 14 chars
        # so Pydantic rejects → 422. Test the longer-but-malformed case.
        assert res.status_code in (400, 422), res.text

    def test_malformed_data_uri_long_enough_returns_400(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        # Long enough to pass schema, but not parseable as data URI.
        bad = {**_BASE_REQUEST, "imageDataUri": "garbage" * 5}
        res = client.post("/v1/worksheet/generate", json=bad)
        assert res.status_code == 400, res.text

    def test_answer_key_index_oob_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        bad = json.loads(_good_response_json())
        bad["answerKey"][0]["activityIndex"] = 99  # out of bounds
        fake_pipeline.queue = [json.dumps(bad)]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_pipeline: _QueueFake,
    ) -> None:
        fake_pipeline.queue = ["not valid json"]
        res = client.post("/v1/worksheet/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
