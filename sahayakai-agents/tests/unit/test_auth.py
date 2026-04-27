"""Auth tests — HMAC body-integrity path. ID-token verification is tested
separately against Google's tokeninfo in integration.

Review trace:
- P1 #15 body integrity via X-Content-Digest.
- Round-2 audit P1 REPLAY-1: digest now binds to X-Request-Timestamp.
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
from sahayakai_agents.shared.errors import AuthenticationError

pytestmark = pytest.mark.unit


@pytest.fixture(autouse=True)
def _clear_replay_guard() -> None:
    """Phase J.4 hot-fix: each test starts with an empty nonce store so
    the new replay guard does not cause back-to-back tests to collide."""
    _REPLAY_GUARD.clear()


def _make_request(headers: dict[str, str]) -> Request:
    """Construct a minimal Starlette Request for header inspection."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in headers.items()
        ],
    }
    return Request(scope)  # type: ignore[arg-type]


def _now_ms() -> str:
    return str(int(time.time() * 1000))


def _digest(body: bytes, timestamp: str, key: str = "test-signing-key") -> str:
    """Round-2 audit P1 REPLAY-1: digest = HMAC(key, ts + ":" + body)."""
    signed_input = timestamp.encode() + b":" + body
    raw = hmac.new(key.encode(), signed_input, hashlib.sha256).digest()
    return "sha256=" + base64.b64encode(raw).decode()


class TestVerifyContentDigest:
    def test_empty_body_skips_verification(self) -> None:
        req = _make_request({})  # no digest header
        _verify_content_digest(req, b"")  # should NOT raise

    def test_rejects_missing_header_on_non_empty_body(self) -> None:
        req = _make_request({})
        with pytest.raises(AuthenticationError):
            _verify_content_digest(req, b"{}")

    def test_rejects_unsupported_scheme(self) -> None:
        req = _make_request({"X-Content-Digest": "md5=abcd"})
        with pytest.raises(AuthenticationError):
            _verify_content_digest(req, b"{}")

    def test_rejects_malformed_base64(self) -> None:
        req = _make_request({"X-Content-Digest": "sha256=!!!not-base64!!!"})
        with pytest.raises(AuthenticationError):
            _verify_content_digest(req, b"{}")

    def test_rejects_digest_mismatch(self) -> None:
        ts = _now_ms()
        req = _make_request(
            {
                "X-Content-Digest": _digest(b'{"evil":"tampered"}', ts),
                "X-Request-Timestamp": ts,
            }
        )
        with pytest.raises(AuthenticationError):
            _verify_content_digest(req, b'{"good":"original"}')

    def test_accepts_matching_digest(self) -> None:
        body = b'{"callSid":"CAxxx","turnNumber":1}'
        ts = _now_ms()
        req = _make_request(
            {
                "X-Content-Digest": _digest(body, ts),
                "X-Request-Timestamp": ts,
            }
        )
        _verify_content_digest(req, body)  # should NOT raise

    def test_rejects_missing_timestamp(self) -> None:
        body = b'{"callSid":"CAxxx"}'
        ts = _now_ms()
        req = _make_request({"X-Content-Digest": _digest(body, ts)})
        with pytest.raises(AuthenticationError, match="Missing X-Request-Timestamp"):
            _verify_content_digest(req, body)

    def test_rejects_non_integer_timestamp(self) -> None:
        body = b'{"callSid":"CAxxx"}'
        ts = _now_ms()
        req = _make_request(
            {
                "X-Content-Digest": _digest(body, ts),
                "X-Request-Timestamp": "not-a-number",
            }
        )
        with pytest.raises(AuthenticationError, match="not an integer"):
            _verify_content_digest(req, body)

    def test_rejects_replayed_old_timestamp(self) -> None:
        """Round-2 audit P1 REPLAY-1: a captured (digest, ts) tuple older
        than 5 minutes is dropped — kills the replay attack window."""
        body = b'{"callSid":"CAxxx"}'
        # 10 minutes in the past — well outside the ±5min window.
        ts = str(int(time.time() * 1000) - 10 * 60 * 1000)
        req = _make_request(
            {
                "X-Content-Digest": _digest(body, ts),
                "X-Request-Timestamp": ts,
            }
        )
        with pytest.raises(AuthenticationError, match="out of range"):
            _verify_content_digest(req, body)

    def test_rejects_future_timestamp_outside_skew(self) -> None:
        body = b'{"callSid":"CAxxx"}'
        # 10 minutes in the future.
        ts = str(int(time.time() * 1000) + 10 * 60 * 1000)
        req = _make_request(
            {
                "X-Content-Digest": _digest(body, ts),
                "X-Request-Timestamp": ts,
            }
        )
        with pytest.raises(AuthenticationError, match="out of range"):
            _verify_content_digest(req, body)
