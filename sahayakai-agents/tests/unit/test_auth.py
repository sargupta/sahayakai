"""Auth tests — HMAC body-integrity path. ID-token verification is tested
separately against Google's tokeninfo in integration.

Review trace:
- P1 #15 body integrity via X-Content-Digest.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any

import pytest
from fastapi import Request

from sahayakai_agents.auth import _verify_content_digest
from sahayakai_agents.shared.errors import AuthenticationError


pytestmark = pytest.mark.unit


def _make_request(headers: dict[str, str]) -> Request:
    """Construct a minimal Starlette Request for header inspection."""
    scope: dict[str, Any] = {
        "type": "http",
        "headers": [
            (k.lower().encode(), v.encode()) for k, v in headers.items()
        ],
    }
    return Request(scope)  # type: ignore[arg-type]


def _digest(body: bytes, key: str = "test-signing-key") -> str:
    raw = hmac.new(key.encode(), body, hashlib.sha256).digest()
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
        req = _make_request(
            {"X-Content-Digest": _digest(b'{"evil":"tampered"}')}
        )
        with pytest.raises(AuthenticationError):
            _verify_content_digest(req, b'{"good":"original"}')

    def test_accepts_matching_digest(self) -> None:
        body = b'{"callSid":"CAxxx","turnNumber":1}'
        req = _make_request({"X-Content-Digest": _digest(body)})
        _verify_content_digest(req, body)  # should NOT raise
