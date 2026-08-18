"""Cost and abuse controls for the `/v1/vidya-voice/stream` websocket proxy.

The companion file `test_vidya_voice_stream_auth.py` pins that an UNAUTHENTICATED
caller cannot open a billable Vertex Live session. These tests pin the other half:
an *authenticated* caller cannot open an unbounded number of them, or hold one
open forever. The billable unit is the per-audio-token live session, metered for
as long as the socket stays up, so authentication alone bounds nothing.

Each limit gets a test that asserts its exact close code, because the close code
is the contract the client retries against — 4429 means "wait", 4409 means
"re-mint and stop the other session", 4503 means "this instance is full".

`genai.Client` is spied rather than stubbed throughout, matching the auth tests:
a limit that rejects the socket but allocates the client first would pass a
close-code-only assertion while leaving the cost hole open. `spy.calls` is what
proves a reject path is actually free.
"""
from __future__ import annotations

import asyncio
import json
import time
from types import SimpleNamespace
from typing import Any

import pytest
import structlog
from fastapi import WebSocketDisconnect
from fastapi.testclient import TestClient

from sahayakai_agents.agents.vidya_voice import router as vv_router
from sahayakai_agents.agents.vidya_voice.router import mint_stream_token
from sahayakai_agents.main import app

pytestmark = pytest.mark.integration


# ── Fakes ────────────────────────────────────────────────────────────────


class _FakeLiveSession:
    """Stand-in for the session yielded by `client.aio.live.connect()`.

    `hang` controls whether the downstream leg stays open after its first frame.
    A session that ENDS lets the router unwind on its own (fine for the rate-limit
    test, which needs opens to complete and release their slot). A session that
    HANGS keeps the socket genuinely open, which is the only way to have two
    sockets alive at once and so the only honest way to test a concurrency gate.
    """

    def __init__(self, *, hang: bool) -> None:
        self.sent: list[tuple[str, dict[str, Any]]] = []
        self._hang = hang

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
        if self._hang:
            await asyncio.Event().wait()  # never set — cancelled at teardown


class _FakeLiveConnect:
    def __init__(self, session: _FakeLiveSession) -> None:
        self._session = session

    async def __aenter__(self) -> _FakeLiveSession:
        return self._session

    async def __aexit__(self, *_exc: Any) -> bool:
        return False


class _ClientSpy:
    """Records every `genai.Client(...)` construction — the billable step."""

    def __init__(self, *, hang: bool) -> None:
        self.calls: list[dict[str, Any]] = []
        self._hang = hang

    def __call__(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return SimpleNamespace(
            aio=SimpleNamespace(live=SimpleNamespace(connect=self._connect))
        )

    def _connect(self, *, model: str, config: Any) -> _FakeLiveConnect:
        return _FakeLiveConnect(_FakeLiveSession(hang=self._hang))


@pytest.fixture
def genai_spy(monkeypatch: pytest.MonkeyPatch) -> _ClientSpy:
    """Spy whose Vertex sessions end on their own."""
    spy = _ClientSpy(hang=False)
    monkeypatch.setattr("google.genai.Client", spy)
    return spy


@pytest.fixture
def hanging_genai_spy(monkeypatch: pytest.MonkeyPatch) -> _ClientSpy:
    """Spy whose Vertex sessions stay open until the socket is torn down."""
    spy = _ClientSpy(hang=True)
    monkeypatch.setattr("google.genai.Client", spy)
    return spy


@pytest.fixture
def client() -> TestClient:
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    return TestClient(app)


# ── Helpers ──────────────────────────────────────────────────────────────


def _token(uid: str, *, nth: int = 0) -> str:
    """A token for `uid` that is distinct per `nth`.

    `mint_stream_token` is deterministic in `(uid, exp)`, so a loop that mints
    the same uid repeatedly inside one second produces byte-identical tokens —
    which the single-use burn would (correctly) reject as replays, masking the
    limit actually under test. Nudging the TTL by a second per call makes each
    token genuinely different without touching the token format.
    """
    return mint_stream_token(uid, ttl_seconds=120 + nth)


def _bearer(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _expect_close(client: TestClient, token: str, code: int) -> None:
    """Opening a socket with `token` must fail the handshake with `code`."""
    with pytest.raises(WebSocketDisconnect) as excinfo:  # noqa: SIM117
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(token)
        ):
            pass  # pragma: no cover — the handshake never completes
    assert excinfo.value.code == code


def _drain_until_close(ws: Any) -> int:
    """Read frames until the server closes; return the close code."""
    with pytest.raises(WebSocketDisconnect) as excinfo:
        while True:
            ws.receive_text()
    return int(excinfo.value.code)


def _open_and_finish(client: TestClient, token: str) -> None:
    """Open a socket, let it complete, and release its slot."""
    with client.websocket_connect(
        "/v1/vidya-voice/stream", headers=_bearer(token)
    ) as ws:
        assert json.loads(ws.receive_text()) == {"turnComplete": True}


# ── Single-use tokens ────────────────────────────────────────────────────


class TestSingleUseToken:
    def test_replayed_token_closes_4409_and_costs_nothing(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A token is spent by its first socket. The second presentation is
        refused at 4409 without constructing a Vertex client."""
        token = _token("teacher-replay")
        _open_and_finish(client, token)
        assert len(genai_spy.calls) == 1  # the legitimate first use

        _expect_close(client, token, 4409)
        assert len(genai_spy.calls) == 1  # replay allocated nothing

    def test_burn_survives_the_first_session_ending(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Burning is tied to the token, not to a live session: a token stays
        spent after its session closes, which is the whole point — otherwise a
        leaked token is reusable once per session for its full TTL."""
        token = _token("teacher-burn")
        _open_and_finish(client, token)
        _expect_close(client, token, 4409)
        _expect_close(client, token, 4409)
        assert len(genai_spy.calls) == 1

    def test_a_fresh_token_still_works_after_a_burn(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The burn is per token, not a per-uid lockout."""
        _open_and_finish(client, _token("teacher-fresh", nth=0))
        _open_and_finish(client, _token("teacher-fresh", nth=1))
        assert len(genai_spy.calls) == 2


# ── Per-uid concurrency ──────────────────────────────────────────────────


class TestPerUidConcurrency:
    def test_second_concurrent_socket_for_same_uid_closes_4409(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """One teacher, one live session. The second socket is refused while the
        first is still open, and constructs nothing."""
        first = _token("teacher-concurrent", nth=0)
        second = _token("teacher-concurrent", nth=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(first)
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            assert len(hanging_genai_spy.calls) == 1

            _expect_close(client, second, 4409)
            assert len(hanging_genai_spy.calls) == 1  # rejection was free

    def test_slot_is_released_when_the_first_socket_closes(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """The concurrency gate must not strand the uid: after the first socket
        goes away the same teacher can start a new session."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream",
            headers=_bearer(_token("teacher-release", nth=0)),
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        with client.websocket_connect(
            "/v1/vidya-voice/stream",
            headers=_bearer(_token("teacher-release", nth=1)),
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert len(hanging_genai_spy.calls) == 2

    def test_a_different_uid_is_unaffected(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """The gate is per uid, not a global mutex."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-a"))
        ) as ws_a:
            assert json.loads(ws_a.receive_text()) == {"turnComplete": True}
            with client.websocket_connect(
                "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-b"))
            ) as ws_b:
                assert json.loads(ws_b.receive_text()) == {"turnComplete": True}

        assert len(hanging_genai_spy.calls) == 2


# ── Per-uid hourly rate limit ────────────────────────────────────────────


class TestPerUidHourlyRateLimit:
    def test_seventh_open_within_the_hour_closes_4429(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """Six sequential opens are allowed — six full 600s sessions is a solid
        unbroken hour of talking, so a seventh is a reconnect loop, not a
        teacher. The seventh is refused at 4429 and costs nothing."""
        uid = "teacher-ratelimit"
        for nth in range(vv_router._MAX_OPENS_PER_UID_PER_HOUR):
            _open_and_finish(client, _token(uid, nth=nth))
        assert len(genai_spy.calls) == vv_router._MAX_OPENS_PER_UID_PER_HOUR

        _expect_close(client, _token(uid, nth=99), 4429)
        assert len(genai_spy.calls) == vv_router._MAX_OPENS_PER_UID_PER_HOUR

    def test_rate_limit_is_per_uid(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """One teacher exhausting their budget must not lock out the school."""
        for nth in range(vv_router._MAX_OPENS_PER_UID_PER_HOUR):
            _open_and_finish(client, _token("teacher-noisy", nth=nth))
        _expect_close(client, _token("teacher-noisy", nth=99), 4429)

        _open_and_finish(client, _token("teacher-quiet"))
        assert len(genai_spy.calls) == vv_router._MAX_OPENS_PER_UID_PER_HOUR + 1


# ── Global ceiling ───────────────────────────────────────────────────────


class TestGlobalCeiling:
    def test_open_beyond_the_ceiling_closes_4503_and_does_not_queue(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """At the ceiling the next socket is shed immediately with 4503. It must
        FAIL, not queue: a queued client holds its socket open and retries, which
        turns a capacity problem into a thundering herd."""
        vv_router.reset_stream_guards(max_global_sessions=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-first"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            assert len(hanging_genai_spy.calls) == 1

            # A DIFFERENT uid, so the per-uid gate cannot be what rejects this.
            _expect_close(client, _token("teacher-second"), 4503)
            assert len(hanging_genai_spy.calls) == 1

    def test_ceiling_slot_is_released_after_a_session_ends(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """A permit leak would brick the instance until it restarts, so prove the
        semaphore is given back on the normal teardown path."""
        vv_router.reset_stream_guards(max_global_sessions=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-x"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-y"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert len(hanging_genai_spy.calls) == 2

    def test_rejected_open_does_not_spend_the_uid_hourly_budget(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """Capacity shedding is our failure, not the teacher's: a 4503 must not
        consume one of their six hourly opens."""
        vv_router.reset_stream_guards(max_global_sessions=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-holder"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            for nth in range(3):
                _expect_close(client, _token("teacher-shed", nth=nth), 4503)

        assert vv_router._UID_OPEN_HISTORY.get("teacher-shed") is None


# ── Session caps ─────────────────────────────────────────────────────────


class TestSessionCaps:
    def test_idle_input_closes_4408(
        self,
        client: TestClient,
        hanging_genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A client that stops sending audio is disconnected. A backgrounded tab
        never sends a FIN, so without this the session bills until Vertex gives
        up. The window is shortened here; 30s is the shipped value."""
        monkeypatch.setattr(vv_router, "_IDLE_INPUT_TIMEOUT_SECONDS", 0.2)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-idle"))
        ) as ws:
            assert _drain_until_close(ws) == 4408

    def test_idle_timer_resets_while_the_client_keeps_talking(
        self,
        client: TestClient,
        hanging_genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """The cap must be IDLE time, not a second wall clock — a teacher who
        keeps talking past the window must not be cut off."""
        monkeypatch.setattr(vv_router, "_IDLE_INPUT_TIMEOUT_SECONDS", 0.3)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-talky"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            for _ in range(4):
                ws.send_text(json.dumps({"text": "still here"}))
                # Well inside the window, four times over — total elapsed exceeds
                # it, so a non-resetting timer would fire before the loop ends.
                # `time.sleep` blocks only this thread; the server loop runs in
                # the TestClient's portal thread and keeps ticking.
                time.sleep(0.1)
            ws.send_text(json.dumps({"end": True}))
            assert _drain_until_close(ws) == 1000

    def test_wall_clock_closes_4410(
        self,
        client: TestClient,
        hanging_genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Even a client that keeps the socket busy is capped. Idle is set well
        above the wall clock here so only the wall clock can fire; 600s is the
        shipped value."""
        monkeypatch.setattr(vv_router, "_MAX_SESSION_SECONDS", 0.2)
        monkeypatch.setattr(vv_router, "_IDLE_INPUT_TIMEOUT_SECONDS", 30)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-marathon"))
        ) as ws:
            assert _drain_until_close(ws) == 4410

    def test_capped_session_releases_both_slots(
        self,
        client: TestClient,
        hanging_genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A cap that fires without releasing the uid slot and the global permit
        would be worse than no cap: it would leak capacity on every timeout."""
        monkeypatch.setattr(vv_router, "_MAX_SESSION_SECONDS", 0.2)
        monkeypatch.setattr(vv_router, "_IDLE_INPUT_TIMEOUT_SECONDS", 30)
        vv_router.reset_stream_guards(max_global_sessions=1)

        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-cap", nth=0))
        ) as ws:
            assert _drain_until_close(ws) == 4410

        assert not vv_router._ACTIVE_UIDS
        assert not vv_router._GLOBAL_SESSION_SEM.locked()


# ── Byte telemetry ───────────────────────────────────────────────────────


class TestByteTelemetry:
    def test_bytes_up_and_down_are_logged_at_close(
        self, client: TestClient, hanging_genai_spy: _ClientSpy
    ) -> None:
        """The audio is relayed and never stored, so this log line is the only
        record that attributes the bill to a uid."""
        up_frames = [json.dumps({"text": "namaste"}), json.dumps({"end": True})]
        expected_up = sum(len(f.encode("utf-8")) for f in up_frames)
        expected_down = len(json.dumps({"turnComplete": True}).encode("utf-8"))

        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-bytes"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
            for frame in up_frames:
                ws.send_text(frame)

        closed = [e for e in logs if e["event"] == "vidya_voice.stream_closed"]
        assert len(closed) == 1
        entry = closed[0]
        assert entry["uid"] == "teacher-bytes"
        assert entry["reason"] == "client_end"
        assert entry["bytes_up"] == expected_up
        assert entry["bytes_down"] == expected_down
        assert entry["frames_up"] == len(up_frames)
        assert entry["frames_down"] == 1
        assert entry["duration_seconds"] >= 0

    def test_telemetry_is_logged_even_when_a_cap_fires(
        self,
        client: TestClient,
        hanging_genai_spy: _ClientSpy,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """A timed-out session still burned audio tokens, so it still has to be
        attributable — the log must not be on the happy path only."""
        monkeypatch.setattr(vv_router, "_IDLE_INPUT_TIMEOUT_SECONDS", 0.2)

        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-timeout"))
        ) as ws:
            assert _drain_until_close(ws) == 4408

        closed = [e for e in logs if e["event"] == "vidya_voice.stream_closed"]
        assert len(closed) == 1
        assert closed[0]["reason"] == "idle_timeout"
        assert closed[0]["close_code"] == 4408
        assert closed[0]["bytes_down"] > 0


# ── Token transport ──────────────────────────────────────────────────────


class TestTokenTransport:
    def test_authorization_bearer_header_is_accepted(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The supported transport. A credential in a query string is written
        verbatim into every access log between the device and this process."""
        with client.websocket_connect(
            "/v1/vidya-voice/stream", headers=_bearer(_token("teacher-header"))
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}
        assert len(genai_spy.calls) == 1

    def test_query_string_token_still_works_and_warns(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """`?t=` must keep working for exactly one release — the shipped Flutter
        client sends it and would break on deploy otherwise — but every use is
        logged so the remaining callers are visible before the branch is cut."""
        token = _token("teacher-legacy")
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            f"/v1/vidya-voice/stream?t={token}"
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        assert len(genai_spy.calls) == 1
        warnings = [
            e for e in logs if e["event"] == "vidya_voice.stream_token_in_query_string"
        ]
        assert len(warnings) == 1
        assert warnings[0]["uid"] == "teacher-legacy"

    def test_header_takes_precedence_and_query_use_is_not_warned(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """A client that sends both is on the supported path — it must not be
        counted as a laggard in the deprecation logs."""
        with structlog.testing.capture_logs() as logs, client.websocket_connect(
            f"/v1/vidya-voice/stream?t={_token('teacher-ignored')}",
            headers=_bearer(_token("teacher-both")),
        ) as ws:
            assert json.loads(ws.receive_text()) == {"turnComplete": True}

        closed = [e for e in logs if e["event"] == "vidya_voice.stream_closed"]
        assert closed[0]["uid"] == "teacher-both"
        assert not [
            e for e in logs if e["event"] == "vidya_voice.stream_token_in_query_string"
        ]

    def test_garbage_bearer_token_is_rejected_and_costs_nothing(
        self, client: TestClient, genai_spy: _ClientSpy
    ) -> None:
        """The header path gets the same 4401 gate as the query path."""
        _expect_close(client, "not-a-real-token", 4401)
        assert genai_spy.calls == []
