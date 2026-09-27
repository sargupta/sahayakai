"""Admission to the telephony stream: the cost gate.

Every accepted socket bills a Live session for as long as it stays open, and the
caller is unauthenticated by construction — the far end is a parent's phone.
So the property under test is not "bad tokens are refused" but something
stronger and more specific: **no rejection path ever calls `accept()`**. A
rejection that accepts first has already started paying.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.tokens import VobizDomain

KEY = "k" * 64


@pytest.fixture(autouse=True)
def _clean(monkeypatch: pytest.MonkeyPatch) -> None:
    telephony.reset_telephony_guards()

    class _Secret:
        @staticmethod
        def get_secret_value() -> str:
            return KEY

    class _Settings:
        request_signing_key = _Secret()
        gcp_project = "test-project"

    def _get_settings() -> type[_Settings]:
        return _Settings

    monkeypatch.setattr("sahayakai_agents.telephony.tokens.get_settings", _get_settings)


def _mint(domain: VobizDomain, outreach_id: str = "outreach123", ttl: int = 300) -> str:
    exp = int(time.time()) + ttl
    sig = (
        base64.urlsafe_b64encode(
            hmac.new(KEY.encode(), f"{domain.value}.{outreach_id}.{exp}".encode(), hashlib.sha256).digest()
        )
        .rstrip(b"=")
        .decode()
    )
    return f"{outreach_id}.{exp}.{sig}"


class _FakeWebSocket:
    """Records whether anyone accepted, and with what code it was closed."""

    def __init__(self, token: str | None) -> None:
        self.query_params = {"t": token} if token is not None else {}
        self.accepted = False
        self.close_code: int | None = None

    async def accept(self) -> None:
        self.accepted = True

    async def close(self, code: int = 1000) -> None:
        self.close_code = code


@pytest.mark.asyncio
class TestAdmission:
    async def test_admits_a_valid_stream_token(self) -> None:
        ws = _FakeWebSocket(_mint(VobizDomain.STREAM))
        assert await telephony._admit(ws) == "outreach123"
        # _admit itself never accepts; the handler does that after reserving.
        assert ws.accepted is False

    async def test_refuses_a_missing_token_without_accepting(self) -> None:
        ws = _FakeWebSocket(None)
        assert await telephony._admit(ws) is None
        assert ws.accepted is False
        assert ws.close_code == telephony._CLOSE_BAD_TOKEN

    async def test_refuses_a_token_minted_for_another_endpoint(self) -> None:
        # The answer webhook's token is visible in the call-control document.
        # If it opened the media socket, that document would be a billing hole.
        for domain in (VobizDomain.ANSWER, VobizDomain.STATUS):
            ws = _FakeWebSocket(_mint(domain))
            assert await telephony._admit(ws) is None
            assert ws.accepted is False

    async def test_refuses_an_expired_token(self) -> None:
        ws = _FakeWebSocket(_mint(VobizDomain.STREAM, ttl=-1))
        assert await telephony._admit(ws) is None
        assert ws.accepted is False

    async def test_burns_the_token_so_a_replay_cannot_open_a_second_session(self) -> None:
        token = _mint(VobizDomain.STREAM)
        first = _FakeWebSocket(token)
        assert await telephony._admit(first) == "outreach123"

        replay = _FakeWebSocket(token)
        assert await telephony._admit(replay) is None
        assert replay.accepted is False
        assert replay.close_code == telephony._CLOSE_BAD_TOKEN

    async def test_refuses_new_calls_at_capacity_without_accepting(self) -> None:
        # Saturate the permit pool, then prove the next call is turned away
        # before it can start billing.
        held = []
        try:
            for _ in range(telephony._MAX_CONCURRENT_CALLS):
                await telephony._SESSION_SEM.acquire()
                held.append(True)
            ws = _FakeWebSocket(_mint(VobizDomain.STREAM))
            assert await telephony._admit(ws) is None
            assert ws.accepted is False
            assert ws.close_code == telephony._CLOSE_AT_CAPACITY
        finally:
            for _ in held:
                telephony._SESSION_SEM.release()

    async def test_every_rejection_path_closes_without_accepting(self) -> None:
        # The class, stated once: whatever the reason, nothing is accepted.
        cases = [
            _FakeWebSocket(None),
            _FakeWebSocket(""),
            _FakeWebSocket("garbage"),
            _FakeWebSocket("a.b.c.d"),
            _FakeWebSocket(_mint(VobizDomain.STREAM, ttl=-1)),
            _FakeWebSocket(_mint(VobizDomain.ANSWER)),
        ]
        for ws in cases:
            assert await telephony._admit(ws) is None
            assert ws.accepted is False, "a rejection path accepted the socket and started billing"
            assert ws.close_code is not None


class TestLimitsAreSane:
    def test_a_call_cannot_bill_forever(self) -> None:
        assert 0 < telephony._MAX_CALL_SECONDS <= 1800

    def test_idle_timeout_is_longer_than_a_natural_pause(self) -> None:
        # A parent thinking, or fetching their child, must not end the call.
        assert telephony._IDLE_SECONDS >= 30

    def test_concurrency_is_bounded(self) -> None:
        assert 0 < telephony._MAX_CONCURRENT_CALLS <= 64

    def test_frame_size_matches_twenty_milliseconds_of_mulaw(self) -> None:
        # 8000 samples/sec * 0.02 sec * 1 byte. Wrong here and every call is
        # paced at the wrong speed.
        assert int(8000 * telephony._FRAME_SECONDS) == telephony._FRAME_BYTES
