"""ADK engine (`adk_live.py`) behind `/v1/vidya-voice/stream`.

Automated, offline checks. They fake the ADK runner / Live connection, so
they prove the WIRING (tool surface, event → frame mapping, subprotocol
auth, router → engine handoff) — NOT model behaviour. The real-model check
is `scripts/e2e_voice_live.py` against a running local sidecar.
"""
from __future__ import annotations

import asyncio
import base64
import json
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi.testclient import TestClient

from sahayakai_agents.agents.vidya_voice import adk_live
from sahayakai_agents.agents.vidya_voice.agent import build_tool_definitions
from sahayakai_agents.agents.vidya_voice.router import mint_stream_token
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── engine selection ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, "adk"), ("adk", "adk"), ("genai", "genai"), ("GENAI ", "genai"), ("bogus", "adk")],
)
def test_engine_selection(monkeypatch: pytest.MonkeyPatch, raw: str | None, expected: str) -> None:
    if raw is None:
        monkeypatch.delenv("SAHAYAKAI_VIDYA_VOICE_ENGINE", raising=False)
    else:
        monkeypatch.setenv("SAHAYAKAI_VIDYA_VOICE_ENGINE", raw)
    assert adk_live.get_voice_engine() == expected


# ── tools ───────────────────────────────────────────────────────────────


def test_adk_tools_mirror_the_routable_flows() -> None:
    emitted: list[dict[str, Any]] = []

    async def emit(p: dict[str, Any]) -> None:
        emitted.append(p)

    tools = adk_live._build_tools(emit)
    expected = [d.name for d in build_tool_definitions()]
    assert [t.name for t in tools] == expected
    decl = tools[0]._get_declaration()
    assert sorted(decl.parameters.properties) == ["gradeLevel", "language", "subject", "topic"]
    # The ADK ToolContext is injected by the framework, never exposed to the model.
    assert "tool_context" not in decl.parameters.properties


def test_adk_tool_forwards_intent_to_client_and_confirms_to_model() -> None:
    emitted: list[dict[str, Any]] = []

    async def emit(p: dict[str, Any]) -> None:
        emitted.append(p)

    tool = adk_live._build_tools(emit)[0]  # open_lesson_plan
    ctx = SimpleNamespace(function_call_id="fc-1")
    result = asyncio.run(tool.func(ctx, topic="Photosynthesis", gradeLevel="Class 7", subject="", language="en"))
    assert result["status"] == "dispatched"
    assert emitted == [{
        "toolCall": {
            "name": "open_lesson_plan",
            "args": {"topic": "Photosynthesis", "gradeLevel": "Class 7", "language": "en"},
            "id": "fc-1",
        }
    }]


# ── instruction ─────────────────────────────────────────────────────────


def test_instruction_keeps_voice_prompt_and_adds_text_parity_rules() -> None:
    text = adk_live.build_adk_voice_instruction({"system_instruction": "You are VIDYA. ctx={not a template}"})
    assert text.startswith("You are VIDYA. ctx={not a template}")
    assert "No interrogation" in text
    assert "Pedagogical firewall" in text


# ── event → frame mapping ───────────────────────────────────────────────


def _event(**kw: Any) -> Any:
    base = dict(
        error_code=None, error_message=None, interrupted=False, content=None,
        input_transcription=None, output_transcription=None, turn_complete=False, partial=True,
    )
    base.update(kw)
    return SimpleNamespace(**base)


class _FakeRunner:
    """Stands in for `InMemoryRunner`: reads the queue, yields canned events."""

    last: _FakeRunner | None = None

    def __init__(self, *, agent: Any, app_name: str) -> None:
        self.agent = agent
        self.received: list[Any] = []
        self.session_service = SimpleNamespace(create_session=self._create)
        _FakeRunner.last = self

    async def _create(self, *, app_name: str, user_id: str) -> Any:
        return SimpleNamespace(id="s-1")

    async def run_live(self, *, user_id: str, session_id: str, live_request_queue: Any, run_config: Any):
        from google.genai import types

        self.run_config = run_config
        req = await live_request_queue.get()  # the client's first mic chunk
        self.received.append(req)
        audio = types.Part(inline_data=types.Blob(data=b"\x01\x02", mime_type="audio/pcm;rate=24000"))
        yield _event(input_transcription=SimpleNamespace(text="make it class 7", finished=True), partial=False)
        yield _event(content=types.Content(role="model", parts=[audio]))
        yield _event(interrupted=True)
        yield _event(output_transcription=SimpleNamespace(text="Okay", finished=False))
        yield _event(turn_complete=True)


def test_relay_maps_adk_events_to_client_frames(monkeypatch: pytest.MonkeyPatch) -> None:
    import google.adk.runners as runners

    monkeypatch.setattr(runners, "InMemoryRunner", _FakeRunner)

    def fake_model(*, model: str, project: str, location: str, on_connected: Any) -> str:
        on_connected()
        return "gemini-live-fake"

    monkeypatch.setattr(adk_live, "_build_vertex_live_gemini", fake_model)

    sent: list[dict[str, Any]] = []
    inbound = [("json", {"audio": base64.b64encode(b"\x00\x00" * 8).decode()})]

    async def recv(_timeout: float) -> tuple[str, Any]:
        if inbound:
            return inbound.pop(0)
        await asyncio.sleep(0.2)
        return "disconnect", None

    async def send(p: dict[str, Any]) -> None:
        sent.append(p)

    reason, hit_cap = asyncio.run(adk_live.run_adk_live_relay(
        None, uid="u1", session_config={"system_instruction": "x"}, model="m", project="p", location="l",
        receive_frame=recv, send=send, first_frame=None, idle_timeout_seconds=5, max_session_seconds=5,
        pcm_in_mime="audio/pcm;rate=16000",
    ))
    assert not hit_cap
    assert reason in {"live_stream_end", "client_disconnect"}
    kinds = [next(iter(p)) for p in sent]
    assert kinds[0] == "ready"
    assert {"transcript", "audio", "interrupted", "turnComplete"} <= set(kinds)
    assert kinds.index("interrupted") > kinds.index("audio")
    assert base64.b64decode(next(p["audio"] for p in sent if "audio" in p)) == b"\x01\x02"
    # Mic audio went into the ADK LiveRequestQueue as a realtime PCM blob.
    blob = _FakeRunner.last.received[0].blob
    assert blob.mime_type == "audio/pcm;rate=16000"
    # Server-side VAD is explicitly on.
    aad = _FakeRunner.last.run_config.realtime_input_config.automatic_activity_detection
    assert aad.disabled is False


# ── router: subprotocol auth + ADK handoff ─────────────────────────────


def test_browser_subprotocol_token_admits_and_hands_off_to_adk(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAHAYAKAI_VIDYA_VOICE_ENGINE", "adk")
    calls: list[dict[str, Any]] = []

    async def fake_relay(ws: Any, **kw: Any) -> tuple[str, bool]:
        calls.append(kw)
        await kw["send"]({"ready": True, "engine": "adk", "model": kw["model"]})
        return "client_end", False

    import sahayakai_agents.agents.vidya_voice.router as router

    monkeypatch.setattr(router, "run_adk_live_relay", fake_relay)
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    token = mint_stream_token("teacher-1")
    with TestClient(app).websocket_connect(
        "/v1/vidya-voice/stream", subprotocols=["vidya.v1", f"bearer.{token}"]
    ) as ws:
        assert ws.accepted_subprotocol == "vidya.v1"
        ws.send_text(json.dumps({"setup": {"grade": "Class 8", "subject": "Science", "language": "en"}}))
        assert json.loads(ws.receive_text())["ready"] is True
    assert len(calls) == 1
    assert calls[0]["uid"] == "teacher-1"
    assert "Class 8" in calls[0]["session_config"]["system_instruction"]


def test_subprotocol_with_bad_token_is_rejected_before_accept() -> None:
    from fastapi import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect) as exc, TestClient(app).websocket_connect(
        "/v1/vidya-voice/stream", subprotocols=["vidya.v1", "bearer.not.a.token"]
    ):
        pass  # pragma: no cover
    assert exc.value.code == 4401


# ── public (anonymous landing-page) scope ──────────────────────────────


def test_public_and_teacher_tokens_are_separate_signing_domains() -> None:
    from sahayakai_agents.agents.vidya_voice import router

    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    pub = router.mint_public_stream_token("abc123")
    teacher = mint_stream_token("teacher-1")
    assert router.verify_public_stream_token(pub) == "public:abc123"
    assert router.verify_stream_token(pub) is None  # public token never passes as a teacher
    assert router.verify_public_stream_token(teacher) is None  # and vice versa
    forged = pub[:-2] + ("AA" if not pub.endswith("AA") else "BB")
    assert router.verify_public_stream_token(forged) is None


def test_public_session_runs_adk_with_no_tools_and_no_teacher_context(monkeypatch: pytest.MonkeyPatch) -> None:
    import sahayakai_agents.agents.vidya_voice.router as router

    monkeypatch.setenv("SAHAYAKAI_VIDYA_VOICE_ENGINE", "genai")  # public must STILL use ADK
    calls: list[dict[str, Any]] = []

    async def fake_relay(ws: Any, **kw: Any) -> tuple[str, bool]:
        calls.append(kw)
        await kw["send"]({"ready": True})
        return "client_end", False

    monkeypatch.setattr(router, "run_adk_live_relay", fake_relay)
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    token = router.mint_public_stream_token("visitor42")
    with TestClient(app).websocket_connect(
        "/v1/vidya-voice/stream", subprotocols=["vidya.v1", f"bearer.{token}"]
    ) as ws:
        # A visitor trying to smuggle teacher context through the setup frame.
        ws.send_text(json.dumps({"setup": {"grade": "Class 8", "subject": "Science",
                                           "schoolContext": "SECRET", "language": "hi", "screenPath": "/attendance"}}))
        assert json.loads(ws.receive_text())["ready"] is True
    kw = calls[0]
    assert kw["uid"] == "public:visitor42"
    assert kw["tools_enabled"] is False
    assert kw["apply_teacher_rules"] is False
    instr = kw["session_config"]["system_instruction"]
    assert "has not signed in" in instr
    assert "SECRET" not in instr and "Class 8" not in instr and "/attendance" not in instr
    assert kw["max_session_seconds"] == router._PUBLIC_MAX_SESSION_SECONDS


def test_public_tools_disabled_means_agent_gets_no_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    import google.adk.runners as runners

    monkeypatch.setattr(runners, "InMemoryRunner", _FakeRunner)
    monkeypatch.setattr(adk_live, "_build_vertex_live_gemini",
                        lambda **kw: (kw["on_connected"](), "gemini-live-fake")[1])
    inbound = [("json", {"audio": base64.b64encode(b"\x00\x00").decode()})]

    async def recv(_t: float) -> tuple[str, Any]:
        if inbound:
            return inbound.pop(0)
        await asyncio.sleep(0.2)
        return "disconnect", None

    async def send(_p: dict[str, Any]) -> None:
        return None

    asyncio.run(adk_live.run_adk_live_relay(
        None, uid="public:v", session_config={"system_instruction": "public"}, model="m", project="p",
        location="l", receive_frame=recv, send=send, first_frame=None, idle_timeout_seconds=5,
        max_session_seconds=5, pcm_in_mime="audio/pcm;rate=16000", tools_enabled=False,
        apply_teacher_rules=False,
    ))
    assert _FakeRunner.last.agent.tools == []


def test_public_pool_is_capped(monkeypatch: pytest.MonkeyPatch) -> None:
    from fastapi import WebSocketDisconnect

    import sahayakai_agents.agents.vidya_voice.router as router

    monkeypatch.setattr(router, "_PUBLIC_SESSION_SEM", asyncio.Semaphore(0))
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    token = router.mint_public_stream_token("full")
    with pytest.raises(WebSocketDisconnect) as exc, TestClient(app).websocket_connect(
        "/v1/vidya-voice/stream", subprotocols=["vidya.v1", f"bearer.{token}"]
    ):
        pass  # pragma: no cover
    assert exc.value.code == 4503
