"""Live voice ↔ SahayakAI app context and controlled app actions (ADK engine).

Offline wiring checks (fake runner / model), like
`test_vidya_voice_adk_engine.py`: they prove the context is stored but never
spoken, tools see it, actions are only forwarded when the screen offered
them, saving actions are flagged for confirmation, public sessions get none
of it — and the existing audio/transcript behaviour is untouched.
"""
from __future__ import annotations

import asyncio
import base64
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.agents.vidya_voice import adk_live
from sahayakai_agents.agents.vidya_voice.agent import build_tool_definitions
from sahayakai_agents.agents.vidya_voice.app_context import AppContextStore

from .test_vidya_voice_adk_engine import _FakeRunner

pytestmark = pytest.mark.integration

APP_FRAME = {
    "knowledge": "- attendance | Attendance (/attendance) — Where: Sidebar → Assess → Attendance",
    "sections": ["home", "attendance", "my-library"],
    "screen": {
        "path": "/attendance/c1", "section": "Attendance", "screenId": "attendance.class",
        "entities": {"className": "Class 7A", "attendanceSubmitted": False},
        "capabilities": [
            {"id": "attendance.mark_all_present", "enabled": True, "params": [], "requiresConfirmation": False},
            {"id": "attendance.submit", "enabled": True, "params": [], "requiresConfirmation": True},
            {"id": "students.open_add", "enabled": False, "reason": "40-student limit reached", "params": []},
            {"id": "library.filter", "enabled": True, "params": ["type"], "requiresConfirmation": False},
        ],
        "fingerprint": "fp-1",
    },
}


def _app_tools(store: AppContextStore) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    emitted: list[dict[str, Any]] = []

    async def emit(p: dict[str, Any]) -> None:
        emitted.append(p)

    return {t.name: t for t in adk_live._build_app_tools(emit, store)}, emitted


def test_app_tools_exist_and_hide_the_tool_context() -> None:
    tools, _ = _app_tools(AppContextStore())
    assert set(tools) == {"get_app_context", "navigate_to", "perform_app_action"}
    for t in tools.values():
        decl = t._get_declaration()
        props = (decl.parameters.properties if decl.parameters else None) or {}
        assert "tool_context" not in props


def test_get_app_context_is_answered_server_side_and_fails_soft() -> None:
    store = AppContextStore()
    tools, emitted = _app_tools(store)
    ctx = SimpleNamespace(function_call_id="fc")
    assert asyncio.run(tools["get_app_context"].func(ctx))["status"] == "unavailable"
    store.update(APP_FRAME)
    out = asyncio.run(tools["get_app_context"].func(ctx))
    assert out["currentScreen"]["whatTheScreenShows"]["className"] == "Class 7A"
    assert "Sidebar → Assess → Attendance" in out["appGuide"]
    assert emitted == []  # reading context never touches the browser


def test_navigate_to_forwards_only_known_sections() -> None:
    store = AppContextStore()
    store.update(APP_FRAME)
    tools, emitted = _app_tools(store)
    ctx = SimpleNamespace(function_call_id="fc-nav")
    assert asyncio.run(tools["navigate_to"].func(ctx, destination="my-library"))["status"] == "dispatched"
    assert emitted == [{"toolCall": {"name": "navigate_to", "args": {"destination": "my-library"}, "id": "fc-nav"}}]
    assert asyncio.run(tools["navigate_to"].func(ctx, destination="https://evil.example"))["status"] == "refused"
    assert len(emitted) == 1


def test_perform_app_action_respects_availability_and_confirmation() -> None:
    store = AppContextStore()
    store.update(APP_FRAME)
    tools, emitted = _app_tools(store)
    act = tools["perform_app_action"].func
    ctx = SimpleNamespace(function_call_id="fc-act")
    store.for_model()  # the model looked at fp-1

    assert asyncio.run(act(ctx, capability="attendance.mark_all_present"))["status"] == "dispatched"
    # Saving action: forwarded, but the model is told the teacher must confirm.
    assert asyncio.run(act(ctx, capability="attendance.submit"))["status"] == "awaiting_confirmation"
    assert asyncio.run(act(ctx, capability="students.open_add"))["status"] == "disabled"
    assert asyncio.run(act(ctx, capability="grant_admin"))["status"] == "unavailable"
    assert [e["toolCall"]["args"]["capability"] for e in emitted] == ["attendance.mark_all_present", "attendance.submit"]
    assert all(e["toolCall"]["args"]["fingerprint"] == "fp-1" for e in emitted)


def test_perform_app_action_sends_only_declared_params() -> None:
    store = AppContextStore()
    store.update(APP_FRAME)
    tools, emitted = _app_tools(store)
    asyncio.run(tools["perform_app_action"].func(
        SimpleNamespace(function_call_id="x"), capability="library.filter", type="quiz", className="7A",
    ))
    assert emitted[-1]["toolCall"]["args"]["params"] == {"type": "quiz"}


def test_instruction_adds_app_awareness_rules_for_teachers() -> None:
    text = adk_live.build_adk_voice_instruction({"system_instruction": "You are VIDYA."})
    assert "get_app_context" in text and "navigate_to" in text and "Confirm" in text
    assert "No interrogation" in text  # existing parity rules untouched


def _run(monkeypatch: pytest.MonkeyPatch, inbound: list[tuple[str, Any]], **kw: Any) -> list[dict[str, Any]]:
    from google.adk import runners

    monkeypatch.setattr(runners, "InMemoryRunner", _FakeRunner)
    monkeypatch.setattr(adk_live, "_build_vertex_live_gemini",
                        lambda **k: (k["on_connected"](), "gemini-live-fake")[1])

    async def recv(_t: float) -> tuple[str, Any]:
        if inbound:
            return inbound.pop(0)
        await asyncio.sleep(0.2)
        return "disconnect", None

    sent: list[dict[str, Any]] = []

    async def send(p: dict[str, Any]) -> None:
        sent.append(p)

    asyncio.run(adk_live.run_adk_live_relay(
        None, uid=kw.pop("uid", "u1"), session_config={"system_instruction": "x"}, model="m", project="p",
        location="l", receive_frame=recv, send=send, first_frame=None, idle_timeout_seconds=5,
        max_session_seconds=5, pcm_in_mime="audio/pcm;rate=16000", **kw,
    ))
    return sent


def test_app_context_frame_is_stored_not_spoken_and_tools_see_it(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = _run(monkeypatch, [
        ("json", {"appContext": APP_FRAME}),
        ("json", {"audio": base64.b64encode(b"\x00\x00" * 8).decode()}),
    ])
    # The first thing the model received is the mic audio — the push never became a turn.
    assert _FakeRunner.last.received[0].blob.mime_type == "audio/pcm;rate=16000"
    # Voice behaviour unchanged: audio + transcripts still flow to the client.
    assert {"ready", "audio", "transcript", "turnComplete"} <= {next(iter(p)) for p in sent}
    # The 9 flow tools are unchanged and first; the app tools are added after them.
    names = [t.name for t in _FakeRunner.last.agent.tools]
    flows = [d.name for d in build_tool_definitions()]
    assert names[: len(flows)] == flows
    assert names[len(flows):] == ["get_app_context", "navigate_to", "perform_app_action"]
    get_ctx = next(t for t in _FakeRunner.last.agent.tools if t.name == "get_app_context")
    assert asyncio.run(get_ctx.func(SimpleNamespace()))["currentScreen"]["screenId"] == "attendance.class"


def test_bad_app_context_frame_does_not_break_the_session(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = _run(monkeypatch, [
        ("json", {"appContext": "garbage"}),
        ("json", {"audio": base64.b64encode(b"\x00\x00" * 8).decode()}),
    ])
    assert {"ready", "audio", "turnComplete"} <= {next(iter(p)) for p in sent}
    get_ctx = next(t for t in _FakeRunner.last.agent.tools if t.name == "get_app_context")
    assert asyncio.run(get_ctx.func(SimpleNamespace()))["status"] == "unavailable"


def test_public_session_ignores_app_context_and_has_no_app_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    _run(monkeypatch, [
        ("json", {"appContext": APP_FRAME}),
        ("json", {"audio": base64.b64encode(b"\x00\x00").decode()}),
    ], uid="public:v", tools_enabled=False, apply_teacher_rules=False)
    assert _FakeRunner.last.agent.tools == []
    assert _FakeRunner.last.received[0].blob is not None
