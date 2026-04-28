"""Phase O.2 — size-boundary integration tests.

Forensic finding C5 follow-up: every size cap on the wire (audio bytes,
text field max_length) was tested at the happy path only. A regression
that shifted the cap by one byte would not surface in CI. This file
exercises the boundary on each major surface:

- Audio (voice-to-text): 0-byte, 1-byte, 9.99 MB, 10 MB exact, 10.01 MB
  → 413 over the cap.
- Text fields (lesson-plan topic, exam-paper teacherContext,
  visual-aid prompt, avatar name): 0-char (rejected), max-1, max,
  max+1 → 422 over the cap.

The audio fake never decodes the bytes — we only need the router's
own decode + size-check path to fire. Text-field tests stop at the
schema layer, so the FastAPI 422 response carries the Pydantic
violation.

Two `passes_schema` lesson-plan tests trigger the lesson-plan router
internally (no fake), which loads ADK's `InMemoryRunner`. Other tests
in the suite that ran earlier may have left a `SimpleNamespace` shim
at `sys.modules["google.genai"]`; ADK then fails on
`from google.genai.errors import ClientError` at import time. The
`_restore_real_google_genai` autouse fixture (mirrored from
`test_lesson_plan_router.py`) restores the real modules for our
duration so those tests don't false-fail downstream.
"""
from __future__ import annotations

import base64
import importlib
import json
import sys
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.voice_to_text import router as vtt_router_mod
from sahayakai_agents.agents.voice_to_text.schemas import (
    MAX_AUDIO_BYTES,
    VoiceToTextCore,
)
from sahayakai_agents.main import app
from sahayakai_agents.shared.errors import AgentError

pytestmark = pytest.mark.integration


# ── sys.modules hygiene (mirrors test_lesson_plan_router.py) ─────────────


_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force the real google.genai modules into sys.modules for this test.

    Other tests in the suite (e.g. test_instant_answer_router.py,
    test_voice_to_text_router.py) install SimpleNamespace shims at
    ``sys.modules["google.genai"]`` and never restore them. Our
    `passes_schema` lesson-plan tests trigger ADK's `InMemoryRunner`
    which loads `google.adk.models.google_llm` which does
    ``from google.genai.errors import ClientError`` at module-import
    time; that fails against a SimpleNamespace.
    """
    import google as _google_pkg  # noqa: PLC0415

    pre_keys = {
        key for key in sys.modules
        if key == "google.genai" or key.startswith("google.genai.")
    }
    pre_state = {key: sys.modules[key] for key in pre_keys}
    pre_genai_attr = getattr(_google_pkg, "genai", _SENTINEL)

    for key in pre_keys:
        del sys.modules[key]
    if hasattr(_google_pkg, "genai"):
        delattr(_google_pkg, "genai")

    importlib.import_module("google.genai")
    importlib.import_module("google.genai.errors")
    importlib.import_module("google.genai.types")
    try:
        yield
    finally:
        post_keys = {
            key for key in sys.modules
            if key == "google.genai" or key.startswith("google.genai.")
        }
        for key in post_keys:
            del sys.modules[key]
        for key, value in pre_state.items():
            sys.modules[key] = value
        if pre_genai_attr is _SENTINEL:
            if hasattr(_google_pkg, "genai"):
                delattr(_google_pkg, "genai")
        else:
            _google_pkg.genai = pre_genai_attr  # type: ignore[attr-defined]


# ── Audio boundaries ─────────────────────────────────────────────────────


def _audio_uri_for_bytes(n: int) -> str:
    """Build a `data:audio/webm;base64,<n raw bytes>` URI."""
    raw = b"\x00" * n
    body = base64.b64encode(raw).decode("ascii")
    return f"data:audio/webm;base64,{body}"


class _AudioFakeQueue:
    def __init__(self) -> None:
        self.queue: list[Any] = []

    def pop(self) -> Any:
        if not self.queue:
            raise AssertionError("Audio fake exhausted")
        return self.queue.pop(0)


@pytest.fixture
def fake_vtt_pipeline(monkeypatch: pytest.MonkeyPatch) -> _AudioFakeQueue:
    """Patch voice-to-text pipeline so it returns a canned response.

    Boundary tests that DON'T fire the model still need the fixture
    in place — the size-cap rejection happens BEFORE the pipeline
    fires, so the fake never gets popped on the over-cap paths. On
    the under-cap path we feed a single canned `VoiceToTextCore`.
    """
    fake = _AudioFakeQueue()

    async def _fake_pipeline(
        *,
        prompt_text: str,
        audio_bytes: bytes,
        audio_mime: str,
        api_key: str,
    ) -> VoiceToTextCore:
        nxt = fake.pop()
        if isinstance(nxt, Exception):
            raise nxt
        return VoiceToTextCore.model_validate_json(nxt)

    monkeypatch.setattr(
        vtt_router_mod,
        "_run_pipeline_via_runner",
        _fake_pipeline,
    )
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


_GOOD_VTT_JSON = json.dumps({"text": "hi", "language": "en"})


class TestVoiceToTextSizeBoundaries:
    """Audio byte-size boundary on `POST /v1/voice-to-text/transcribe`.

    The schema's `MAX_DATA_URI_CHARS = 14 MB` is a coarse outer guard
    that catches blatant abuse before the router decodes. The router
    then base64-decodes and enforces `MAX_AUDIO_BYTES = 10 MB` exactly.
    These tests exercise the inner cap.
    """

    def test_zero_bytes_rejected_by_schema_min_length(
        self,
        client: TestClient,
        fake_vtt_pipeline: _AudioFakeQueue,
    ) -> None:
        """A `data:audio/webm;base64,` URI with NO body decodes to 0
        bytes — under MAX_AUDIO_BYTES but the schema rejects on
        min_length=32 first."""
        bad_uri = "data:audio/webm;base64,"
        res = client.post(
            "/v1/voice-to-text/transcribe",
            json={"audioDataUri": bad_uri, "userId": "teacher-uid-1"},
        )
        assert res.status_code == 422, res.text

    def test_one_byte_passes_size_gate(
        self,
        client: TestClient,
        fake_vtt_pipeline: _AudioFakeQueue,
    ) -> None:
        """1 byte of audio is well under MAX_AUDIO_BYTES; the size
        gate accepts it (the actual audio quality check happens
        downstream)."""
        fake_vtt_pipeline.queue = [_GOOD_VTT_JSON]
        # Need the data URI to be at least 32 chars to clear the schema
        # min_length. 1 byte → 4 chars b64 + 23-char prefix = 27. Pad
        # the prefix MIME with `;codecs=opus` to clear 32.
        raw = b"x"
        body = base64.b64encode(raw).decode("ascii")
        # ~36 chars total — clears schema's 32-char floor.
        uri = f"data:audio/webm;codecs=opus;base64,{body}"
        res = client.post(
            "/v1/voice-to-text/transcribe",
            json={"audioDataUri": uri, "userId": "teacher-uid-1"},
        )
        assert res.status_code == 200, res.text

    def test_just_under_cap_passes(
        self,
        client: TestClient,
        fake_vtt_pipeline: _AudioFakeQueue,
    ) -> None:
        """9 999 999 bytes (~9.99 MB) is under the 10 MB cap."""
        fake_vtt_pipeline.queue = [_GOOD_VTT_JSON]
        uri = _audio_uri_for_bytes(MAX_AUDIO_BYTES - 1024)
        res = client.post(
            "/v1/voice-to-text/transcribe",
            json={"audioDataUri": uri, "userId": "teacher-uid-1"},
        )
        assert res.status_code == 200, res.text

    def test_exactly_at_cap_passes(
        self,
        client: TestClient,
        fake_vtt_pipeline: _AudioFakeQueue,
    ) -> None:
        """Exactly MAX_AUDIO_BYTES (10 MB) is the inclusive upper
        bound — the router's check is `> MAX_AUDIO_BYTES`, so
        equality passes."""
        fake_vtt_pipeline.queue = [_GOOD_VTT_JSON]
        uri = _audio_uri_for_bytes(MAX_AUDIO_BYTES)
        res = client.post(
            "/v1/voice-to-text/transcribe",
            json={"audioDataUri": uri, "userId": "teacher-uid-1"},
        )
        assert res.status_code == 200, res.text

    def test_one_byte_over_cap_returns_413(
        self,
        client: TestClient,
        fake_vtt_pipeline: _AudioFakeQueue,
    ) -> None:
        """MAX_AUDIO_BYTES + 1 byte trips the router's size gate.
        Status is 413 (Payload Too Large)."""
        uri = _audio_uri_for_bytes(MAX_AUDIO_BYTES + 1)
        res = client.post(
            "/v1/voice-to-text/transcribe",
            json={"audioDataUri": uri, "userId": "teacher-uid-1"},
        )
        assert res.status_code == 413, res.text
        # Pipeline should not have been called.
        assert fake_vtt_pipeline.queue == []


# ── Text field boundaries ────────────────────────────────────────────────


# Each item: (route, json_body_factory, field, max_length)
# `json_body_factory(value)` returns the full request body with
# the bounded field set to `value`.


def _vtt_body(value: str) -> dict[str, Any]:
    return {"audioDataUri": value, "userId": "teacher-uid-1"}


def _avatar_body(name: str) -> dict[str, Any]:
    return {"name": name, "userId": "teacher-uid-1"}


def _lesson_plan_body(topic: str) -> dict[str, Any]:
    return {
        "topic": topic,
        "language": "en",
        "gradeLevels": ["Class 5"],
        "useRuralContext": False,
        "resourceLevel": "low",
        "userId": "teacher-uid-1",
    }


def _exam_paper_body(teacher_context: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {
        "board": "CBSE",
        "gradeLevel": "Class 10",
        "subject": "Mathematics",
        "userId": "teacher-uid-1",
    }
    if teacher_context is not None:
        body["teacherContext"] = teacher_context
    return body


def _visual_aid_body(prompt: str) -> dict[str, Any]:
    return {"prompt": prompt, "userId": "teacher-uid-1"}


def _virtual_field_trip_body(topic: str) -> dict[str, Any]:
    return {"topic": topic, "userId": "teacher-uid-1"}


def _instant_answer_body(question: str) -> dict[str, Any]:
    return {"question": question, "userId": "teacher-uid-1"}


def _is_schema_rejection(res: Any) -> bool:
    """A FastAPI Pydantic validation 422 has shape `{"detail": [...]}`.

    Downstream errors that surface as 422 (e.g. AISafetyBlockError)
    use the shared error envelope `{"error": {"code": "..."}}`. This
    helper distinguishes the two so a "passes schema" test that
    happens to land a downstream 422 doesn't get a false negative.
    """
    if res.status_code != 422:
        return False
    body = res.json()
    return isinstance(body.get("detail"), list)


class TestTextFieldSizeBoundaries:
    """Each text-field cap is exercised at four points: 0-char,
    max_length-1, max_length, max_length+1.

    Empty string (0-char) is rejected by every Pydantic
    `min_length>=1` field. max_length is the inclusive upper bound;
    max_length+1 is rejected. All rejections surface as 422.
    """

    # ── lesson-plan: topic (min=1, max=500) ─────────────────────────

    def test_lesson_plan_topic_zero_chars_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post("/v1/lesson-plan/generate", json=_lesson_plan_body(""))
        assert _is_schema_rejection(res), res.text

    def test_lesson_plan_topic_at_max_minus_one_passes_validation(
        self, client: TestClient,
    ) -> None:
        # Validation passes (we only test the schema layer). The
        # downstream Gemini call would normally fire — we don't run
        # it here because the goal is the boundary itself, not the
        # full end-to-end. The response may be a non-2xx because we
        # don't fake Gemini, but it must NOT be a Pydantic schema
        # rejection (`{"detail": [...]}`).
        res = client.post(
            "/v1/lesson-plan/generate", json=_lesson_plan_body("x" * 499),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass schema; got Pydantic 422: {res.text}"
        )

    def test_lesson_plan_topic_exactly_at_max_passes_validation(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/lesson-plan/generate", json=_lesson_plan_body("x" * 500),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass schema; got Pydantic 422: {res.text}"
        )

    def test_lesson_plan_topic_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/lesson-plan/generate", json=_lesson_plan_body("x" * 501),
        )
        assert _is_schema_rejection(res), res.text

    # ── exam-paper: teacherContext (max=1000, optional) ─────────────

    def test_exam_paper_teacher_context_empty_string_passes_schema(
        self, client: TestClient,
    ) -> None:
        # teacherContext has max_length=1000 but no min_length, so an
        # empty string passes the schema. Test pins the current
        # behaviour so a future tightening would be deliberate.
        res = client.post(
            "/v1/exam-paper/generate", json=_exam_paper_body(""),
        )
        assert not _is_schema_rejection(res), (
            f"empty optional string should pass schema; got Pydantic 422: {res.text}"
        )

    def test_exam_paper_teacher_context_at_max_minus_one_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/exam-paper/generate", json=_exam_paper_body("c" * 999),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass schema; got Pydantic 422: {res.text}"
        )

    def test_exam_paper_teacher_context_exactly_at_max_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/exam-paper/generate", json=_exam_paper_body("c" * 1000),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass schema; got Pydantic 422: {res.text}"
        )

    def test_exam_paper_teacher_context_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/exam-paper/generate", json=_exam_paper_body("c" * 1001),
        )
        assert _is_schema_rejection(res), res.text

    # ── avatar: name (min=1, max=100) ───────────────────────────────

    def test_avatar_name_zero_chars_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/avatar-generator/generate", json=_avatar_body(""),
        )
        assert _is_schema_rejection(res), res.text

    def test_avatar_name_at_max_minus_one_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/avatar-generator/generate", json=_avatar_body("A" * 99),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass; got Pydantic 422: {res.text}"
        )

    def test_avatar_name_exactly_at_max_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/avatar-generator/generate", json=_avatar_body("A" * 100),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass; got Pydantic 422: {res.text}"
        )

    def test_avatar_name_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/avatar-generator/generate", json=_avatar_body("A" * 101),
        )
        assert _is_schema_rejection(res), res.text

    # ── visual-aid: prompt (min=3, max=2000) ───────────────────────

    def test_visual_aid_prompt_zero_chars_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/visual-aid/generate", json=_visual_aid_body(""),
        )
        assert _is_schema_rejection(res), res.text

    def test_visual_aid_prompt_at_max_minus_one_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/visual-aid/generate", json=_visual_aid_body("p" * 1999),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass schema; got Pydantic 422: {res.text}"
        )

    def test_visual_aid_prompt_exactly_at_max_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/visual-aid/generate", json=_visual_aid_body("p" * 2000),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass schema; got Pydantic 422: {res.text}"
        )

    def test_visual_aid_prompt_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/visual-aid/generate", json=_visual_aid_body("p" * 2001),
        )
        assert _is_schema_rejection(res), res.text

    # ── virtual-field-trip: topic (min=3, max=300) ─────────────────

    def test_virtual_field_trip_topic_zero_chars_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/virtual-field-trip/plan", json=_virtual_field_trip_body(""),
        )
        assert _is_schema_rejection(res), res.text

    def test_virtual_field_trip_topic_at_max_minus_one_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/virtual-field-trip/plan",
            json=_virtual_field_trip_body("v" * 299),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass schema; got Pydantic 422: {res.text}"
        )

    def test_virtual_field_trip_topic_exactly_at_max_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/virtual-field-trip/plan",
            json=_virtual_field_trip_body("v" * 300),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass schema; got Pydantic 422: {res.text}"
        )

    def test_virtual_field_trip_topic_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/virtual-field-trip/plan",
            json=_virtual_field_trip_body("v" * 301),
        )
        assert _is_schema_rejection(res), res.text

    # ── instant-answer: question (min=1, max=4000) ─────────────────

    def test_instant_answer_question_zero_chars_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/instant-answer/answer", json=_instant_answer_body(""),
        )
        assert _is_schema_rejection(res), res.text

    def test_instant_answer_question_at_max_minus_one_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/instant-answer/answer",
            json=_instant_answer_body("q" * 3999),
        )
        assert not _is_schema_rejection(res), (
            f"max-1 should pass schema; got Pydantic 422: {res.text}"
        )

    def test_instant_answer_question_exactly_at_max_passes(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/instant-answer/answer",
            json=_instant_answer_body("q" * 4000),
        )
        assert not _is_schema_rejection(res), (
            f"exactly max should pass schema; got Pydantic 422: {res.text}"
        )

    def test_instant_answer_question_one_over_max_rejected(
        self, client: TestClient,
    ) -> None:
        res = client.post(
            "/v1/instant-answer/answer",
            json=_instant_answer_body("q" * 4001),
        )
        assert _is_schema_rejection(res), res.text
