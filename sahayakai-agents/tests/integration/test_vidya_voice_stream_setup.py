"""Teacher personalisation + frame hardening on `/v1/vidya-voice/stream`.

`test_vidya_voice_stream_auth.py` pins that an unauthenticated caller cannot
open a billable session; `test_vidya_voice_stream_limits.py` pins that an
authenticated one cannot open unbounded sessions. This file pins the third
thing: that the session a teacher DOES get is actually theirs, and that the
socket carrying it survives whatever the client puts on the wire.

The regression these tests exist for: the websocket handler called
`build_vidya_voice_session(grade=None, subject=None, school_context=None)`
while the turn-based path passed the teacher's real profile, so the flagship
voice feature was strictly LESS personal than the fallback it replaces. The
assertions therefore reach into the system instruction the Vertex session was
opened with — a test that only checked "the setup frame was accepted" would
pass against a handler that parsed the frame and then threw it away.

Bounds are asserted to be the `SessionStartRequest` bounds, not merely "some
bound": if the websocket were the lenient path, it would be the way in for a
`schoolContext` the HTTP route refuses.
"""
from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any

import pytest
import structlog
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from sahayakai_agents.agents.vidya_voice import router as vv_router
from sahayakai_agents.agents.vidya_voice.router import mint_stream_token
from sahayakai_agents.agents.vidya_voice.schemas import (
    ScreenContextLite,
    SessionStartRequest,
    StreamSetupPayload,
    TeacherProfileLite,
)
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Fakes ────────────────────────────────────────────────────────────────


class _FakeLiveSession:
    """Records everything relayed upstream, and hangs after its first frame.

    Hanging keeps the socket genuinely open so a test can drive the client leg
    (send junk, disconnect mid-read) instead of racing the router's unwind.
    """

    def __init__(self) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []

    async def send_realtime_input(self, **kwargs: Any) -> None:
        self.sent.append(("audio", kwargs))

    async def send_client_content(self, **kwargs: Any) -> None:
        self.sent.append(("text", kwargs))

    async def send_tool_response(self, **kwargs: Any) -> None:
        self.sent.append(("tool", kwargs))

    async def receive(self) -> Any:
        yield SimpleNamespace(
            data=None,
            tool_call=None,
            server_content=SimpleNamespace(interrupted=False, turn_complete=True),
        )
        import asyncio

        await asyncio.Event().wait()  # never set — cancelled at teardown


class _ClientSpy:
    """Captures the Vertex client kwargs AND the config each connect used.

    `configs` is what makes the personalisation assertions honest: the system
    instruction is the only place the teacher's grade and subject can actually
    reach the model.
    """

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.connected_models: list[str] = []
        self.configs: list[Any] = []
        self.sessions: list[_FakeLiveSession] = []

    def __call__(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            aio=SimpleNamespace(live=SimpleNamespace(connect=self._connect))
        )

    def _connect(self, *, model: str, config: Any) -> Any:
        self.connected_models.append(model)
        self.configs.append(config)
        session = _FakeLiveSession()
        self.sessions.append(session)

        class _Ctx:
            async def __aenter__(_self) -> _FakeLiveSession:
                return session

            async def __aexit__(_self, *_exc: Any) -> bool:
                return False

        return _Ctx()

    @property
    def system_instruction(self) -> str:
        """The text of the system instruction the latest session opened with."""
        return str(self.configs[-1].system_instruction.parts[0].text)


@pytest.fixture
def genai_spy(monkeypatch: pytest.MonkeyPatch) -> _ClientSpy:
    spy = _ClientSpy()
    monkeypatch.setattr("google.genai.Client", spy)
    return spy


@pytest.fixture
def client() -> TestClient:
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    return TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────


def _bearer(uid: str, *, nth: int = 0) -> dict[str, str]:
    return {"Authorization": f"Bearer {mint_stream_token(uid, ttl_seconds=120 + nth)}"}


def _setup(**fields: Any) -> str:
    return json.dumps({"setup": fields})


def _drain_until_close(ws: Any) -> int:
    with pytest.raises(WebSocketDisconnect) as excinfo:
        while True:
            ws.receive_text()
    return int(excinfo.value.code)


def _max_len(model: Any, field: str) -> int:
    """`model.field`'s max length, read off the EMITTED JSON Schema.

    Not off `model_fields[...].metadata`: for `Grade | None` the constraint sits
    inside the union member, and a test that quietly found nothing there would
    compare None to None and pass. The JSON Schema is also the thing the wire
    contract and `dist/types.generated.ts` are actually built from.
    """
    prop = model.model_json_schema()["properties"][field]
    for candidate in (prop, *prop.get("anyOf", ())):
        if "maxLength" in candidate:
            return int(candidate["maxLength"])
    raise AssertionError(f"{model.__name__}.{field} publishes no maxLength")


# ── Personalisation ──────────────────────────────────────────────────────


class TestSetupFramePersonalisation:
    def test_setup_frame_reaches_the_system_instruction(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The whole point. A Class 8 science teacher at a low-resource school
        must not get the same session as an anonymous caller — and the proof is
        the text the Vertex session was OPENED with, not that we parsed a frame."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-personal")
        ) as ws:
            ws.send_text(
                _setup(
                    grade="Class 8",
                    subject="Science",
                    schoolContext="Rural government school, 60 students per class",
                    language="hi",
                    screenPath="/lesson-plan",
                )
            )
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        instruction = genai_spy.system_instruction
        assert "grade=Class 8" in instruction
        assert "subject=Science" in instruction
        assert "Rural government school, 60 students per class" in instruction
        assert "Current screen: /lesson-plan" in instruction
        assert "preferred language: hi" in instruction

    def test_no_setup_frame_keeps_the_previous_unpersonalised_behaviour(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A client that never sends the frame is not broken by it — it gets the
        exact session it got before, from the query params it already sends."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream?lang=bn&screen=/quiz",
            headers=_bearer("teacher-silent"),
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        instruction = genai_spy.system_instruction
        assert "grade=not specified" in instruction
        assert "subject=not specified" in instruction
        assert "school_context=general" in instruction
        assert "Current screen: /quiz" in instruction
        assert "preferred language: bn" in instruction

    def test_partial_setup_frame_fills_only_what_it_carries(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Every field is optional. A frame with only a grade must personalise
        the grade and leave the rest at its unspecified default rather than
        being rejected wholesale."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-partial")
        ) as ws:
            ws.send_text(_setup(grade="Class 3"))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        instruction = genai_spy.system_instruction
        assert "grade=Class 3" in instruction
        assert "subject=not specified" in instruction
        assert "school_context=general" in instruction

    def test_setup_frame_overrides_the_query_params(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Query params are the legacy fallback, not a co-equal source: a client
        that sends both is a NEW client, and its frame is the fresher truth."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream?lang=en&screen=/dashboard",
            headers=_bearer("teacher-override"),
        ) as ws:
            ws.send_text(_setup(language="ta", screenPath="/exam-paper"))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        instruction = genai_spy.system_instruction
        assert "preferred language: ta" in instruction
        assert "Current screen: /exam-paper" in instruction

    def test_personalised_flag_is_logged(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Whether the regression is fixed in PRODUCTION depends on clients
        sending the frame, which the code cannot assert. This log field is the
        only way to find out, so it has to be right."""
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-flagged")
        ) as ws:
            ws.send_text(_setup(grade="Class 5"))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        opened = [e for e in logs if e["event"] == "vidya_voice.stream_open"]
        assert len(opened) == 1
        assert opened[0]["personalised"] is True

    def test_personalised_flag_is_false_without_a_frame(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The flag has to distinguish, or it measures nothing."""
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-unflagged")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        opened = [e for e in logs if e["event"] == "vidya_voice.stream_open"]
        assert opened[0]["personalised"] is False


# ── Bounds shared with SessionStartRequest ───────────────────────────────


class TestSetupFrameBounds:
    def test_bounds_are_the_session_start_bounds(self) -> None:
        """Not "a bound" — the SAME bound. Two independently written limits
        drift the first time either is tuned, and the looser one becomes the
        way in. Read off the models so this fails if either side is edited."""
        assert _max_len(StreamSetupPayload, "grade") == _max_len(
            TeacherProfileLite, "preferredGrade"
        )
        assert _max_len(StreamSetupPayload, "subject") == _max_len(
            TeacherProfileLite, "preferredSubject"
        )
        assert _max_len(StreamSetupPayload, "schoolContext") == _max_len(
            TeacherProfileLite, "schoolContext"
        )
        assert _max_len(StreamSetupPayload, "language") == _max_len(
            SessionStartRequest, "detectedLanguage"
        )
        assert _max_len(StreamSetupPayload, "screenPath") == _max_len(
            ScreenContextLite, "path"
        )

    def test_oversized_school_context_is_refused_not_truncated(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A `schoolContext` over the HTTP route's limit must not reach the
        prompt through the socket. The session continues UNPERSONALISED —
        the frame is an enrichment, and a bad one is not worth a dead lesson."""
        over = "x" * (_max_len(TeacherProfileLite, "schoolContext") + 1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-oversize")
        ) as ws:
            ws.send_text(_setup(grade="Class 9", schoolContext=over))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        instruction = genai_spy.system_instruction
        assert "xxxx" not in instruction
        assert "school_context=general" in instruction
        # The valid sibling field goes down with it: a frame is validated whole,
        # so a partially-applied setup can never be a thing to reason about.
        assert "grade=not specified" in instruction

    def test_unknown_setup_key_is_refused(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """`extra="forbid"` matches every other wire model in the package. A
        typo'd field name must surface as an unpersonalised session plus a log
        line, not as a silently-ignored profile."""
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-typo")
        ) as ws:
            ws.send_text(_setup(grade="Class 4", gradeLevel="Class 4"))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert "grade=not specified" in genai_spy.system_instruction
        invalid = [e for e in logs if e["event"] == "vidya_voice.setup_frame_invalid"]
        assert len(invalid) == 1
        assert "gradeLevel" in invalid[0]["fields"]

    def test_setup_frame_cannot_be_the_billable_gate(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The frame arrives after admission and so must never be reachable by
        an unauthenticated caller — no amount of setup gets a socket open."""
        with pytest.raises(WebSocketDisconnect) as excinfo:  # noqa: SIM117
            with client.websocket_connect(
                "/v1/vidya-voice/stream", headers={"Authorization": "Bearer forged"}
            ):
                pass  # pragma: no cover — the handshake never completes
        assert excinfo.value.code == 4401
        assert genai_spy.calls == []


# ── The setup deadline ───────────────────────────────────────────────────


class TestSetupFrameDeadline:
    def test_shipped_deadline_is_five_seconds(
        self, shipped_setup_frame_timeout: float
    ) -> None:
        """Pinned because `tests/conftest.py` shortens this for the whole suite.
        The fixture serves the value captured BEFORE any patching, so if that
        convenience value ever leaked into the module default, this fails —
        otherwise every socket in production would give up on the frame before a
        slow phone sent it and personalisation would silently stop working."""
        assert shipped_setup_frame_timeout == 5.0

    def test_a_silent_client_proceeds_rather_than_hanging(
        self,
        client: TestClient,
        genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The deadline is the whole reason the frame can be optional. Without
        it a client that opens and says nothing holds a uid slot and a global
        permit until the idle cap fires, having never reached Vertex."""
        monkeypatch.setattr(vv_router, "_SETUP_FRAME_TIMEOUT_SECONDS", 0.2)

        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-slow")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert len(genai_spy.calls) == 1
        absent = [e for e in logs if e["event"] == "vidya_voice.setup_frame_absent"]
        assert absent[0]["reason"] == "timeout"

    def test_a_non_setup_first_frame_is_relayed_not_swallowed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A client that starts talking immediately hits the setup read with an
        audio frame. Consuming it to look for `setup` and then dropping it would
        clip the first word of every such session — silently."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-eager")
        ) as ws:
            ws.send_text(json.dumps({"text": "namaste"}))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        relayed = genai_spy.sessions[-1].sent
        assert [kind for kind, _ in relayed] == ["text"]
        assert relayed[0][1]["turns"].parts[0].text == "namaste"

    def test_the_wait_is_unbilled(
        self, client: TestClient, genai_spy: _ClientSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """No Vertex session may exist while we wait: the deadline would
        otherwise be up to five seconds of metered silence on every socket."""
        monkeypatch.setattr(vv_router, "_SETUP_FRAME_TIMEOUT_SECONDS", 1.0)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-unbilled")
        ) as ws:
            assert genai_spy.calls == []  # still inside the setup window
            ws.send_text(_setup(grade="Class 6"))
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            assert len(genai_spy.calls) == 1

    def test_disconnect_during_the_wait_opens_nothing_and_frees_both_slots(
        self, client: TestClient, genai_spy: _ClientSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """A client that hangs up inside the setup window must cost nothing and
        strand nothing. The slots were reserved by the admission ladder BEFORE
        this wait, so a leak here bricks one of the 24 global permits for the
        life of the process."""
        monkeypatch.setattr(vv_router, "_SETUP_FRAME_TIMEOUT_SECONDS", 30)
        vv_router.reset_stream_guards(max_global_sessions=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-ghost")
        ):
            pass  # closes immediately, inside the setup window

        assert genai_spy.calls == []
        assert not vv_router._ACTIVE_UIDS
        assert not vv_router._GLOBAL_SESSION_SEM.locked()


# ── Hostile / malformed client frames ────────────────────────────────────


class TestClientFrameHardening:
    def test_binary_frame_is_dropped_and_the_session_survives(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """`ws.receive_text()` reaches straight into `message["text"]`, so one
        binary frame used to raise KeyError out of the pump and take a paid-for
        Vertex session down with it. It is now a dropped frame."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-binary")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_bytes(b"\x00\x01\x02\x03")
            ws.send_text(json.dumps({"text": "still here"}))
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        # The session kept going and the good frame after the bad one arrived.
        relayed = genai_spy.sessions[-1].sent
        assert [kind for kind, _ in relayed] == ["text"]

    def test_malformed_json_is_dropped_and_the_session_survives(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A truncated frame from a flaky mobile connection is routine, not
        fatal — and `json.loads` raising here would surface to the teacher as
        'live session failed' mid-sentence."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-junk")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_text('{"audio": "abc')
            ws.send_text("null")
            ws.send_text(json.dumps({"text": "still here"}))
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        assert [kind for kind, _ in genai_spy.sessions[-1].sent] == ["text"]

    def test_oversized_frame_is_dropped_before_it_reaches_vertex(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The bound exists to stop a hostile client handing us an arbitrarily
        large string to base64-decode and forward to a metered API. Dropping,
        not closing: a single fat frame is not proof of malice.

        The payload is DELIBERATELY valid base64 (a multiple of four 'A's), so
        the size gate is the only thing that can reject it. An arbitrary long
        string would be rejected by the base64 guard instead and this test would
        pass with the size bound deleted — it did, until the mutation run said
        so."""
        empty = len(json.dumps({"audio": ""}).encode("utf-8"))
        payload_len = vv_router._MAX_CLIENT_FRAME_BYTES - empty + 1
        payload_len += -payload_len % 4  # round up to a valid base64 length
        huge = json.dumps({"audio": "A" * payload_len})
        assert len(huge.encode("utf-8")) > vv_router._MAX_CLIENT_FRAME_BYTES

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-fat")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_text(huge)
            ws.send_text(json.dumps({"text": "still here"}))
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        assert [kind for kind, _ in genai_spy.sessions[-1].sent] == ["text"]

    def test_a_frame_at_the_bound_is_still_relayed(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Off-by-one on a size gate silently clips legitimate audio chunks, and
        clipped audio is indistinguishable from a bad model. The frame is sized
        to land EXACTLY on the bound, so `>` and `>=` disagree about it."""
        empty = len(json.dumps({"text": ""}).encode("utf-8"))
        # A text frame, not audio: base64 needs a length that is a multiple of
        # four, which would stop the frame landing on an arbitrary exact byte.
        exact = json.dumps(
            {"text": "A" * (vv_router._MAX_CLIENT_FRAME_BYTES - empty)}
        )
        assert len(exact.encode("utf-8")) == vv_router._MAX_CLIENT_FRAME_BYTES

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-exact")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_text(exact)
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        assert [kind for kind, _ in genai_spy.sessions[-1].sent] == ["text"]

    def test_non_base64_audio_is_dropped_and_the_session_survives(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Valid JSON carrying an invalid payload is the same class of problem
        as invalid JSON, and must have the same non-fatal verdict."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-badb64")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_text(json.dumps({"audio": "!!!not base64!!!"}))
            ws.send_text(json.dumps({"text": "still here"}))
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        assert [kind for kind, _ in genai_spy.sessions[-1].sent] == ["text"]

    def test_disconnect_mid_read_frees_both_slots_without_an_error(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The common case — the teacher closes the tab. It must not land in the
        handler's error path, and it must give back the uid slot and the global
        permit or the instance leaks capacity on every normal hang-up.

        The `reason=` this produces is asserted in
        `tests/unit/test_vidya_voice_frames.py`, not here: Starlette's
        `WebSocketTestSession.__exit__` pushes the disconnect message and then
        cancels the app task, and which of the two the event loop services first
        is a race. The slot release below holds either way — that is the point
        of putting it in a `finally`."""
        vv_router.reset_stream_guards(max_global_sessions=1)

        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-gone")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert [e for e in logs if e["event"] == "vidya_voice.stream_closed"]
        assert not [e for e in logs if e["event"] == "vidya_voice.stream_failed"]
        assert not vv_router._ACTIVE_UIDS
        assert not vv_router._GLOBAL_SESSION_SEM.locked()

    def test_dropped_frames_are_tallied_for_attribution(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Dropping silently would turn a client shipping garbage into a
        no-symptom outage: the teacher hears nothing back and the logs show a
        healthy session. The counter is how that is visible."""
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-tally")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            ws.send_bytes(b"\x00")
            ws.send_text("{not json")
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

        closed = [e for e in logs if e["event"] == "vidya_voice.stream_closed"]
        assert closed[0]["frames_dropped"] == 2
        assert closed[0]["frames_up"] == 3


# ── Env-driven model + region ────────────────────────────────────────────


class TestVertexLiveConfiguration:
    def test_defaults_are_the_values_proven_in_production(
        self, client: TestClient, genai_spy: _ClientSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Unset must be a no-op. These two strings are the ones verified
        against a real Vertex Live session, and making them configurable is
        worth nothing if it changes the default behaviour on the way."""
        monkeypatch.delenv("SAHAYAKAI_VERTEX_LIVE_MODEL", raising=False)
        monkeypatch.delenv("SAHAYAKAI_VERTEX_LIVE_LOCATION", raising=False)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-default")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert genai_spy.connected_models == ["gemini-live-2.5-flash-native-audio"]
        assert genai_spy.calls[0]["location"] == "us-central1"

    def test_model_is_overridable_without_a_deploy(
        self, client: TestClient, genai_spy: _ClientSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Live model availability moves on Google's schedule, not ours. A
        module constant makes the mitigation a code change, a build and a
        deploy; an env var makes it a revision."""
        monkeypatch.setenv("SAHAYAKAI_VERTEX_LIVE_MODEL", "gemini-live-next")

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-model")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert genai_spy.connected_models == ["gemini-live-next"]

    def test_location_is_overridable_without_a_deploy(
        self, client: TestClient, genai_spy: _ClientSpy, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Same argument for the region, plus the one that matters more: moving
        out of a degraded region has to be minutes, not an hour."""
        monkeypatch.setenv("SAHAYAKAI_VERTEX_LIVE_LOCATION", "europe-west4")

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer("teacher-region")
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert genai_spy.calls[0]["location"] == "europe-west4"

    def test_the_live_model_is_independent_of_the_developer_api_model(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Vertex and the Developer API name the same family differently and are
        two different products. One variable driving both would break the mint
        route the next time the proxy is repointed."""
        monkeypatch.setenv("SAHAYAKAI_VIDYA_VOICE_MODEL", "developer-api-model")
        monkeypatch.delenv("SAHAYAKAI_VERTEX_LIVE_MODEL", raising=False)

        assert vv_router.get_vertex_live_model() != "developer-api-model"
        assert vv_router.get_vertex_live_model() == "gemini-live-2.5-flash-native-audio"
