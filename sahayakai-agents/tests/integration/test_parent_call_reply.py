"""End-to-end integration test for the parent-call reply endpoint.

Mocks `google.genai.Client` so no real Gemini call is made, and uses
the in-memory Firestore fake so no real Firestore client is built.
Exercises: auth bypass (dev env), prompt render, structured model call,
turn-cap enforcement, behavioural post-response guard, OCC persistence.

Review trace:
- Round-2 P0 #5 / #8: behavioural guard (fail-closed) + turn cap.
- P1 #14 wire contract from schemas.py.
"""
from __future__ import annotations

import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.parent_call import router as router_module
from sahayakai_agents.main import app

from ..unit.fake_firestore import make_fake_session_store

pytestmark = pytest.mark.integration


class _FakeUsageMeta:
    input_tokens = 1200
    output_tokens = 80
    total_tokens = 1280
    cached_content_tokens = 300


class _FakeResult:
    def __init__(self, text: str) -> None:
        self.text = text
        self.usage_metadata = _FakeUsageMeta()
        self.candidates: list[Any] = []


class _FakeModels:
    """Sync surface — kept for any caller that still uses `client.models`."""

    def __init__(self, text: str) -> None:
        self._text = text

    def generate_content(self, **_kwargs: Any) -> _FakeResult:
        return _FakeResult(self._text)


class _FakeAioModels:
    """Async surface matching `client.aio.models.generate_content`.

    Round-2 P0 fix landed in router.py (Apr 2026): the production code now
    uses the official async path `client.aio.models.generate_content`. The
    fake mirrors that surface so tests exercise the real call shape.
    """

    def __init__(self, text: str) -> None:
        self._text = text

    async def generate_content(self, **_kwargs: Any) -> _FakeResult:
        return _FakeResult(self._text)


class _FakeAio:
    def __init__(self, text: str) -> None:
        self.models = _FakeAioModels(text)


class _FakeClient:
    def __init__(self, text: str) -> None:
        self.models = _FakeModels(text)
        self.aio = _FakeAio(text)


def _patch_gemini(monkeypatch: pytest.MonkeyPatch, reply_json: dict[str, Any]) -> None:
    """Replace `google.genai.Client` with a fake that returns `reply_json`
    serialised as text on every call.
    """
    fake_text = json.dumps(reply_json)

    class _FakeGenai:
        def Client(self, api_key: str) -> _FakeClient:  # noqa: N802 — match SDK
            return _FakeClient(fake_text)

    import sys

    # Use SimpleNamespace so attribute access resolves the lambda directly
    # without binding `self` as an implicit positional argument. The
    # previous `type(...)()` wrapper made `GenerateContentConfig` a bound
    # method and the kwargs-only lambda crashed on `self`.
    from types import SimpleNamespace

    fake_genai_types = SimpleNamespace(
        GenerateContentConfig=lambda **kw: kw,
    )
    fake_module = _FakeGenai()
    # The router does `from google.genai import types as genai_types`,
    # which resolves `types` as an attribute on the parent module FIRST,
    # then via sys.modules. Attach `types` to the fake parent so the
    # import succeeds.
    fake_module.types = fake_genai_types  # type: ignore[attr-defined]
    sys.modules["google.genai"] = fake_module  # type: ignore[assignment]
    sys.modules["google.genai.types"] = fake_genai_types  # type: ignore[assignment]


def _patch_session_store(monkeypatch: pytest.MonkeyPatch) -> None:
    store = make_fake_session_store()

    # mark_ended is only used when shouldEndCall is true; give it a no-op
    # async wrapper that goes through the fake.
    async def _mark_ended(call_sid: str, duration_seconds: float | None = None) -> None:  # noqa: ARG001
        store._sync_mark_ended(call_sid, duration_seconds)  # type: ignore[attr-defined]

    store.mark_ended = _mark_ended  # type: ignore[assignment]

    # append_turn wraps the shim set up by make_fake_session_store.
    async def _append_turn(turn: Any) -> None:
        store._sync_append_turn(turn)  # type: ignore[attr-defined]

    store.append_turn = _append_turn  # type: ignore[assignment]

    async def _load(_call_sid: str) -> list[Any]:
        return []

    store.load_transcript = _load  # type: ignore[assignment]

    monkeypatch.setattr(router_module, "_get_session_store", lambda: store)
    monkeypatch.setattr(router_module, "_session_store", store, raising=False)


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _base_request() -> dict[str, Any]:
    return {
        "callSid": "CAxxx",
        "turnNumber": 1,
        "studentName": "Arav",
        "className": "Class 5",
        "subject": "Science",
        "reason": "Homework follow-up",
        "teacherMessage": "Please ensure homework is done daily.",
        "parentLanguage": "en",
        "parentSpeech": "Yes, I will check.",
    }


class TestReplyHappyPath:
    def test_returns_wire_shape(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _patch_gemini(
            monkeypatch,
            {
                "reply": "Thank you. I will follow up if there are any issues.",
                "shouldEndCall": False,
                "followUpQuestion": None,
            },
        )
        _patch_session_store(monkeypatch)

        res = client.post("/v1/parent-call/reply", json=_base_request())
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["reply"].startswith("Thank you")
        assert body["shouldEndCall"] is False
        assert body["sessionId"] == "CAxxx"
        assert body["turnNumber"] == 1
        assert body["latencyMs"] >= 0
        assert body["modelUsed"] == "gemini-2.5-flash"
        # cache-hit ratio surfaces from the fake usage metadata (300/1200).
        assert body["cacheHitRatio"] == 0.25


class TestTurnCap:
    def test_turn_six_forces_end_call(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Model tries to keep the call going...
        _patch_gemini(
            monkeypatch,
            {
                "reply": "Thank you. Let me know any other concerns.",
                "shouldEndCall": False,
                "followUpQuestion": None,
            },
        )
        _patch_session_store(monkeypatch)

        req = _base_request()
        req["turnNumber"] = 6
        res = client.post("/v1/parent-call/reply", json=req)
        assert res.status_code == 200, res.text
        # ...but the router forces the cap.
        assert res.json()["shouldEndCall"] is True


class TestBehaviouralGuardFailsClosed:
    def test_identity_leak_returns_502(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _patch_gemini(
            monkeypatch,
            {
                # Identity-rule violation: "I am an AI..." is forbidden.
                "reply": "Hello. I am an AI assistant from Arav's school. All is well.",
                "shouldEndCall": False,
                "followUpQuestion": None,
            },
        )
        _patch_session_store(monkeypatch)

        res = client.post("/v1/parent-call/reply", json=_base_request())
        assert res.status_code == 502, res.text
        body = res.json()
        assert "error" in body
        assert body["error"]["code"] in ("INTERNAL", "BEHAVIOURAL_GUARD")
        assert "guard" in body["error"]["message"].lower()

    def test_script_drift_returns_502(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _patch_gemini(
            monkeypatch,
            {
                "reply": "Hello sir, Arav is doing well at school.",
                "shouldEndCall": False,
                "followUpQuestion": None,
            },
        )
        _patch_session_store(monkeypatch)

        req = _base_request()
        req["parentLanguage"] = "hi"  # Hindi requested, but reply is in Latin script.
        res = client.post("/v1/parent-call/reply", json=req)
        assert res.status_code == 502, res.text


class TestOCCConflict:
    def test_duplicate_turn_returns_409(
        self, client: TestClient, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _patch_gemini(
            monkeypatch,
            {
                "reply": "Thank you for letting us know.",
                "shouldEndCall": False,
                "followUpQuestion": None,
            },
        )
        _patch_session_store(monkeypatch)

        res1 = client.post("/v1/parent-call/reply", json=_base_request())
        assert res1.status_code == 200
        # Twilio-style retry: same callSid + turnNumber.
        res2 = client.post("/v1/parent-call/reply", json=_base_request())
        assert res2.status_code == 409, res2.text
