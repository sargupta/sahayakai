"""Integration test for `POST /v1/instant-answer/answer` — Phase B §B.2.

Same queue-fake `google.genai.Client` pattern as
`test_lesson_plan_router.py` and `test_vidya_router.py`.

Three scenarios:
  1. Clean English answer + valid video URL → 200.
  2. Hindi answer in Devanagari → 200, video URL None.
  3. Malformed JSON from model → 502.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Fake google.genai.Client with grounding metadata ──────────────────────


class _FakeUsageMeta:
    input_tokens = 800
    output_tokens = 200
    total_tokens = 1000
    cached_content_tokens = 0


class _FakeGroundingMetadata:
    """Minimal placeholder so `_grounding_used` returns True."""
    grounding_chunks: list[Any] = []


class _FakeCandidate:
    def __init__(self, with_grounding: bool) -> None:
        self.grounding_metadata = (
            _FakeGroundingMetadata() if with_grounding else None
        )


class _FakeResult:
    def __init__(self, text: str, with_grounding: bool = True) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = [_FakeCandidate(with_grounding)]


class _SequencedFakeAioModels:
    """Pop the next text from a queue per call."""

    def __init__(self) -> None:
        self.queue: list[tuple[str, bool]] = []

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        if not self.queue:
            raise AssertionError(
                "Test fake: more generate_content calls than expected"
            )
        text, with_grounding = self.queue.pop(0)
        return _FakeResult(text, with_grounding)


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

    fake_types = SimpleNamespace(
        GenerateContentConfig=lambda **kw: kw,
        Tool=lambda **kw: kw,
        GoogleSearch=lambda **kw: kw,
    )
    fake_module = _FakeGenai()
    fake_module.types = fake_types  # type: ignore[attr-defined]

    import sys

    sys.modules["google.genai"] = fake_module  # type: ignore[assignment]
    sys.modules["google.genai.types"] = fake_types  # type: ignore[assignment]
    # `from google import genai` reads the `genai` attribute on the parent
    # `google` package (not sys.modules), so we must also patch the
    # attribute. monkeypatch restores the original on teardown.
    import google  # noqa: PLC0415
    monkeypatch.setattr(google, "genai", fake_module, raising=False)
    return models


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


# ── Canned model outputs ─────────────────────────────────────────────────


def _answer_json(
    *,
    answer: str,
    video_url: str | None = None,
    grade_level: str | None = None,
    subject: str | None = None,
) -> str:
    return json.dumps(
        {
            "answer": answer,
            "videoSuggestionUrl": video_url,
            "gradeLevel": grade_level,
            "subject": subject,
        }
    )


_BASE_REQUEST = {
    "question": "What is photosynthesis?",
    "language": "en",
    "gradeLevel": "Class 5",
    "subject": "Science",
    "userId": "teacher-uid-1",
}


# ── Tests ────────────────────────────────────────────────────────────────


class TestInstantAnswerRouter:
    def test_english_answer_with_video_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [
            (
                _answer_json(
                    answer=(
                        "Photosynthesis is the process by which green plants "
                        "make their food using sunlight, water, and carbon "
                        "dioxide. The chlorophyll in leaves captures the "
                        "sunlight, which is then converted to glucose."
                    ),
                    video_url=(
                        "https://www.youtube.com/results?search_query=photosynthesis+for+class+5"
                    ),
                    grade_level="Class 5",
                    subject="Science",
                ),
                True,
            )
        ]
        res = client.post("/v1/instant-answer/answer", json=_BASE_REQUEST)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "Photosynthesis" in body["answer"]
        assert body["videoSuggestionUrl"].startswith(
            "https://www.youtube.com/results?search_query="
        )
        assert body["sidecarVersion"].startswith("phase-6")
        assert body["groundingUsed"] is True
        assert fake_genai.queue == []

    def test_hindi_answer_in_devanagari_returns_200(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        request = {**_BASE_REQUEST, "language": "hi"}
        fake_genai.queue = [
            (
                _answer_json(
                    answer=(
                        "प्रकाश संश्लेषण वह प्रक्रिया है जिसके द्वारा "
                        "हरे पौधे सूर्य के प्रकाश पानी और कार्बन डाइऑक्साइड "
                        "का उपयोग करके अपना भोजन बनाते हैं।"
                    ),
                    video_url=None,
                    grade_level="Class 5",
                    subject="Science",
                ),
                False,
            )
        ]
        res = client.post("/v1/instant-answer/answer", json=request)
        assert res.status_code == 200, res.text
        body = res.json()
        assert "प्रकाश संश्लेषण" in body["answer"]
        assert body["videoSuggestionUrl"] is None
        assert body["groundingUsed"] is False
        assert fake_genai.queue == []

    def test_malformed_json_returns_502(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        fake_genai.queue = [("not valid json at all", True)]
        res = client.post("/v1/instant-answer/answer", json=_BASE_REQUEST)
        assert res.status_code == 502, res.text
        assert fake_genai.queue == []

    def test_invalid_video_url_returns_502_via_guard(
        self,
        client: TestClient,
        fake_genai: _SequencedFakeAioModels,
    ) -> None:
        # Model returns a plausible-looking but invalid (non-search) URL.
        fake_genai.queue = [
            (
                _answer_json(
                    answer=(
                        "Mathematics is the study of patterns. It includes "
                        "arithmetic, algebra, geometry, and calculus as "
                        "its main branches."
                    ),
                    video_url="https://www.youtube.com/watch?v=fakeId",
                    grade_level="Class 5",
                    subject="Mathematics",
                ),
                True,
            )
        ]
        res = client.post("/v1/instant-answer/answer", json=_BASE_REQUEST)
        # The behavioural guard rejects watch?v=... — fail-closed 502.
        assert res.status_code == 502, res.text
        assert fake_genai.queue == []

    def test_public_run_answerer_is_callable(self) -> None:
        """Phase L.2: `run_answerer` is the public delegation symbol
        VIDYA imports. Pinning that the symbol exists, is async, and
        is the one referenced via the deprecated `_run_answerer`
        alias guards against silent renames."""
        from sahayakai_agents.agents.instant_answer import router as ia_router  # noqa: PLC0415

        assert hasattr(ia_router, "run_answerer"), (
            "router must export `run_answerer` (public). Phase L.2 "
            "promoted this from `_run_answerer` so VIDYA can delegate "
            "without reaching into a private symbol."
        )
        # Same callable is reachable via both names during the
        # deprecation window.
        assert ia_router.run_answerer is ia_router._run_answerer, (
            "The deprecated `_run_answerer` alias should still resolve "
            "to the public `run_answerer` callable until the alias is "
            "removed in a subsequent phase."
        )
