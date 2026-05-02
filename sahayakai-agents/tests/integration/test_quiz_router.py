"""Integration test for `POST /v1/quiz/generate`.

Phase L.4 fixture redesign — the router no longer fans out via
`asyncio.gather` over hand-rolled `_call_gemini` invocations; it now
runs an ADK `ParallelAgent` through `Runner.run_async`. Replacing
`sys.modules["google.genai"]` wholesale (the Phase E.1 pattern) is
incompatible with ADK because ADK loads
`google.genai.errors.ClientError` at import time and the SimpleNamespace
shim breaks that.

New strategy — patch at ONE surgical point:

    `_run_quiz_via_runner` in `agents.quiz.router` is monkey-patched
    to pop one entry off a shared queue PER DIFFICULTY (3 entries
    per request) and return a `{difficulty: QuizGeneratorCore | None}`
    dict that the router consumes exactly as if ADK had written
    session state.

This bypasses ADK Runner + ParallelAgent entirely for the test, which
is fine because:
  - ADK Runner machinery is covered by ADK's own test suite.
  - The new `tests/unit/test_quiz_adk.py` pins the static SHAPE of
    the ParallelAgent (3 sub-agents, unique output_keys, etc.).
  - This integration test focuses on the WIRE shape of the FastAPI
    endpoint and the post-Runner behavioural-guard / 502 path, which
    don't change between the gather-based and ParallelAgent-based
    implementations.

Test scenarios:
1. **All 3 variants succeed** — 200, all slots non-null, variantsGenerated=3.
2. **Partial failure (2 of 3 succeed)** — 200, the failed slot is null,
   variantsGenerated=2.
3. **All 3 fail** — 502 (matches the Genkit `Promise.allSettled` 0-success path).
4. **Invalid imageDataUri** — 400 from request-level validation
   (never reaches the Runner).
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.quiz import router as quiz_router_mod
from sahayakai_agents.agents.quiz.schemas import (
    QuizDifficulty,
    QuizGeneratorCore,
)
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Shared queue fake for the Runner-based path ──────────────────────────


class _QueueFake:
    """Per-request 3-slot queue.

    The router calls `_run_quiz_via_runner` ONCE per request; that one
    call is responsible for all 3 difficulty variants. So the test
    queue is read PER VARIANT inside the fake, not per top-level call.
    """

    def __init__(self) -> None:
        self.queue: list[str] = []

    def pop(self) -> str:
        if not self.queue:
            raise AssertionError(
                "Test fake: more variant calls than test queued"
            )
        return self.queue.pop(0)


# ── Fixture: monkey-patch `_run_quiz_via_runner` ─────────────────────────


@pytest.fixture
def fake_runner(monkeypatch: pytest.MonkeyPatch) -> _QueueFake:
    """Patch the ADK-Runner-based quiz dispatch.

    The replacement consumes 3 queue entries (one per variant). Each
    entry is either:
      - A JSON string that parses as `QuizGeneratorCore` → the
        corresponding slot in the returned dict gets the parsed model.
      - Anything else → the slot gets `None` (matching the wrapper's
        `_VariantWrapper` exception-swallowing behaviour).

    Order: easy, medium, hard. Tests must queue in that order.
    """
    fake = _QueueFake()
    difficulties: tuple[QuizDifficulty, ...] = ("easy", "medium", "hard")

    async def _fake_runner(
        *,
        api_key: str,
        image_bytes: bytes | None,
        image_mime: str | None,
        base_context: dict[str, Any],
    ) -> dict[QuizDifficulty, QuizGeneratorCore | None]:
        results: dict[QuizDifficulty, QuizGeneratorCore | None] = {}
        for difficulty in difficulties:
            text = fake.pop()
            try:
                results[difficulty] = QuizGeneratorCore.model_validate_json(
                    text,
                )
            except Exception:
                # Mirrors `_VariantWrapper`'s exception-swallowing path:
                # a malformed JSON variant becomes a None slot.
                results[difficulty] = None
        return results

    monkeypatch.setattr(
        quiz_router_mod,
        "_run_quiz_via_runner",
        _fake_runner,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ── Canned variant responses ─────────────────────────────────────────────


def _good_variant_json(difficulty: str) -> str:
    return json.dumps({
        "title": f"Photosynthesis Quiz — {difficulty.title()} Level",
        "questions": [
            {
                "questionText": "What process do green plants use to make food?",
                "questionType": "multiple_choice",
                "options": [
                    "Photosynthesis",
                    "Respiration",
                    "Digestion",
                    "Decomposition",
                ],
                "correctAnswer": "Photosynthesis",
                "explanation": (
                    "Just as a farmer relies on the sun to grow crops, "
                    "plants use sunlight in photosynthesis to make their "
                    "own food."
                ),
                "difficultyLevel": difficulty,
            },
        ],
        "teacherInstructions": "Write the question on the left side of the board.",
        "gradeLevel": "Class 5",
        "subject": "Science",
    })


_BASE_REQUEST = {
    "topic": "Photosynthesis for Class 5",
    "numQuestions": 1,
    "questionTypes": ["multiple_choice"],
    "language": "English",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


class TestQuizRouter:
    def test_three_variants_returns_200(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # ParallelAgent runs all 3 variants; the queue order is
        # deterministic (easy, medium, hard) per the fixture's
        # difficulties tuple.
        fake_runner.queue = [
            _good_variant_json("easy"),
            _good_variant_json("medium"),
            _good_variant_json("hard"),
        ]
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["variantsGenerated"] == 3
        assert body["easy"] is not None
        assert body["medium"] is not None
        assert body["hard"] is not None
        # Phase L.4 sidecarVersion bumped from phase-e.1.0 → phase-l.4
        assert body["sidecarVersion"].startswith("phase-l.4")

    def test_partial_failure_still_returns_200(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # Two variants succeed; medium returns malformed JSON →
        # `_VariantWrapper` swallows, slot becomes None, router
        # returns 200 with medium=null.
        fake_runner.queue = [
            _good_variant_json("easy"),
            "not valid json",
            _good_variant_json("hard"),
        ]
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["variantsGenerated"] == 2
        assert body["easy"] is not None
        assert body["medium"] is None
        assert body["hard"] is not None

    def test_all_three_fail_returns_502(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # Zero successful variants — router raises 502 from the
        # `variants_generated == 0` guard.
        fake_runner.queue = ["not json"] * 3
        res = client.post("/v1/quiz/generate", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text

    def test_invalid_data_uri_returns_400(
        self,
        client: TestClient,
        fake_runner: _QueueFake,
    ) -> None:
        # Long enough to pass schema, but malformed. Fails at
        # `parse_data_uri_optional` before the Runner is even invoked.
        bad = {**_BASE_REQUEST, "imageDataUri": "garbage" * 5}
        res = client.post("/v1/quiz/generate", json=bad)
        assert res.status_code == 400, res.text
