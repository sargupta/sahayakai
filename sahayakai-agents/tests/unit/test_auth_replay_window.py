"""Phase J.4 hot-fix (forensic P1 #19): HMAC replay-guard regression tests.

Before this hot-fix, `_verify_content_digest` proved the body was not
tampered but did NOT prevent replay. A captured tuple
`(Authorization, X-Content-Digest, X-Request-Timestamp, body)` was
valid for the full 5-minute skew window. 100× replay = 100× Gemini
billing per captured request.

These tests assert the new TTL nonce store behaviour:

  1. First request with a (timestamp, digest) accepted.
  2. Immediate replay of the same (timestamp, digest) rejected (409).
  3. Same body at a different timestamp accepted (digest differs).
  4. After the 360s TTL elapses, the cache evicts the entry and the
     same (timestamp, digest) is accepted again — proving the cache
     bound is real and not a leak.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Any

import pytest
from fastapi import Request

from sahayakai_agents.auth import _REPLAY_GUARD, _verify_content_digest
from sahayakai_agents.shared.errors import ReplayDetectedError

pytestmark = pytest.mark.unit


def _make_request(headers: dict[str, str]) -> Request:
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }
    return Request(scope)  # type: ignore[arg-type]


def _now_ms() -> str:
    return str(int(time.time() * 1000))


def _digest(body: bytes, timestamp: str, key: str = "test-signing-key") -> str:
    """HMAC = sha256(key, ts + ":" + body), base64-encoded under the
    `sha256=` prefix."""
    signed_input = timestamp.encode() + b":" + body
    raw = hmac.new(key.encode(), signed_input, hashlib.sha256).digest()
    return "sha256=" + base64.b64encode(raw).decode()


@pytest.fixture(autouse=True)
def _clear_replay_guard() -> None:
    """Each test starts with an empty nonce store."""
    _REPLAY_GUARD.clear()


class TestReplayWindow:
    def test_first_request_accepted(self) -> None:
        """Phase J.4 (P1 #19): a fresh (timestamp, digest) is accepted."""
        body = b'{"hello":"world"}'
        ts = _now_ms()
        req = _make_request(
            {"X-Content-Digest": _digest(body, ts), "X-Request-Timestamp": ts}
        )
        _verify_content_digest(req, body)  # MUST NOT raise

    def test_immediate_replay_rejected(self) -> None:
        """Phase J.4 (P1 #19): the same (timestamp, digest) twice fails the
        second time with 409 (ReplayDetectedError)."""
        body = b'{"hello":"world"}'
        ts = _now_ms()
        digest = _digest(body, ts)

        # First request: legitimate.
        req1 = _make_request(
            {"X-Content-Digest": digest, "X-Request-Timestamp": ts}
        )
        _verify_content_digest(req1, body)

        # Second request: identical bytes — captured + replayed.
        req2 = _make_request(
            {"X-Content-Digest": digest, "X-Request-Timestamp": ts}
        )
        with pytest.raises(ReplayDetectedError) as excinfo:
            _verify_content_digest(req2, body)
        assert excinfo.value.http_status == 409

    def test_same_body_different_timestamp_accepted(self) -> None:
        """A legitimate retry typically advances the timestamp. The
        digest changes (timestamp is in the HMAC input), so the nonce
        key differs and BOTH requests succeed."""
        body = b'{"hello":"world"}'
        ts1 = _now_ms()
        # 10 s later, same body. Within the ±5 min skew window.
        ts2 = str(int(ts1) + 10_000)

        req1 = _make_request(
            {"X-Content-Digest": _digest(body, ts1), "X-Request-Timestamp": ts1}
        )
        _verify_content_digest(req1, body)

        req2 = _make_request(
            {"X-Content-Digest": _digest(body, ts2), "X-Request-Timestamp": ts2}
        )
        _verify_content_digest(req2, body)

    def test_cache_eviction_at_360s(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """After the 360s TTL elapses, the nonce key is evicted. We
        replace the module-level `_REPLAY_GUARD` with a fresh
        `TTLCache` whose timer we control, jump it forward 361s, and
        assert the same (timestamp, digest) is accepted again. Proves
        the cache is actually bounded — without the eviction path the
        memory would grow unbounded over the lifetime of the process.
        """
        from cachetools import TTLCache

        from sahayakai_agents import auth as auth_module

        # A controllable monotonic-style clock. cachetools' `_Timer`
        # context manager calls this each time it needs a reading.
        clock = {"now": 0.0}

        def fake_timer() -> float:
            return clock["now"]

        controlled_cache: TTLCache[tuple[int, str], bool] = TTLCache(
            maxsize=10_000,
            ttl=360,
            timer=fake_timer,
        )
        monkeypatch.setattr(auth_module, "_REPLAY_GUARD", controlled_cache)

        body = b'{"hello":"world"}'
        ts = _now_ms()
        digest = _digest(body, ts)

        # First request: legit. Stored under key (ts, digest) at time 0.
        req1 = _make_request(
            {"X-Content-Digest": digest, "X-Request-Timestamp": ts}
        )
        _verify_content_digest(req1, body)
        # Sanity: cache has one entry at time 0.
        assert len(controlled_cache) == 1

        # Advance the clock past the 360s TTL.
        clock["now"] = 361.0
        controlled_cache.expire()

        # Same (timestamp, digest) is now fresh again — eviction works.
        req2 = _make_request(
            {"X-Content-Digest": digest, "X-Request-Timestamp": ts}
        )
        _verify_content_digest(req2, body)
