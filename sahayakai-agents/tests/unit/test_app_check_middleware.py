"""App Check middleware tests (Phase R.2).

The third auth layer: client attestation. Layered on top of ID-token
identity + HMAC body integrity. Tokens are minted by Firebase on the
browser via reCAPTCHA v3 (web), Play Integrity (Android), or DeviceCheck
(iOS) and forwarded by the Next.js bridge as `X-Firebase-AppCheck`.

These tests exercise the verification path with `firebase_admin.app_check`
NOT loaded — so the fallback `aud`-claim path is taken. Real signature
verification is integration-tested separately against staging tokens.
"""
from __future__ import annotations

import base64
import json
import time
from typing import Any

import pytest

from sahayakai_agents import auth as auth_module
from sahayakai_agents.config import get_settings
from sahayakai_agents.shared.errors import AuthenticationError

pytestmark = pytest.mark.unit


PROJECT_ID = "sahayakai-b4248"


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _make_jwt(payload: dict[str, Any]) -> str:
    """Construct a fake (unsigned) JWT with the given payload.

    Signature segment is just bytes — the Tier-2 fallback path in
    `_verify_app_check_token` only inspects the payload's `aud` claim
    when `firebase_admin.app_check` cannot be imported (the case in
    these unit tests).
    """
    header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    body = _b64url(json.dumps(payload).encode())
    sig = _b64url(b"unverified-signature-bytes")
    return f"{header}.{body}.{sig}"


def _make_request(headers: dict[str, str]) -> Any:
    """Construct a minimal Starlette Request for header inspection."""
    from fastapi import Request

    scope: dict[str, Any] = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }
    return Request(scope)


@pytest.fixture(autouse=True)
def _isolate_firebase_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force the Tier-2 fallback path by hiding `firebase_admin.app_check`.

    The unit test environment does not have a Firebase Admin app initialised,
    so a real `verify_token` call would crash. We force `ImportError` on the
    inline import inside `_verify_app_check_token` to exercise the
    audience-only fallback that the integration suite hits when
    firebase_admin is unavailable.
    """
    import sys

    # Stash and remove any existing reference so the inline `from
    # firebase_admin import app_check` raises ImportError deterministically.
    saved = sys.modules.pop("firebase_admin.app_check", None)
    monkeypatch.setattr(
        "builtins.__import__",
        _make_blocking_import(saved),
    )


def _make_blocking_import(saved: Any):
    real_import = __import__

    def _blocking_import(
        name: str,
        globals: Any = None,
        locals: Any = None,
        fromlist: tuple[str, ...] = (),
        level: int = 0,
    ) -> Any:
        # Block ONLY `from firebase_admin import app_check`. Everything
        # else (json, base64, etc.) hits the real import.
        if name == "firebase_admin" and "app_check" in (fromlist or ()):
            raise ImportError("firebase_admin.app_check forced unavailable for test")
        return real_import(name, globals, locals, fromlist, level)

    return _blocking_import


class TestVerifyAppCheckToken:
    """Direct unit tests of `_verify_app_check_token` (Tier-2 path)."""

    def test_valid_aud_passes(self) -> None:
        token = _make_jwt(
            {
                "iss": f"https://firebaseappcheck.googleapis.com/{PROJECT_ID}",
                "aud": [f"projects/{PROJECT_ID}", "projects/640589855975"],
                "exp": int(time.time()) + 300,
                "app_id": "1:640589855975:web:fakeAppId",
            }
        )
        req = _make_request({"X-Firebase-Appcheck": token})
        claims = auth_module._verify_app_check_token(req, PROJECT_ID)
        assert claims["app_id"] == "1:640589855975:web:fakeAppId"

    def test_missing_header_rejected(self) -> None:
        req = _make_request({})
        with pytest.raises(AuthenticationError, match="Missing X-Firebase-AppCheck"):
            auth_module._verify_app_check_token(req, PROJECT_ID)

    def test_empty_header_rejected(self) -> None:
        req = _make_request({"X-Firebase-Appcheck": "   "})
        with pytest.raises(AuthenticationError, match="Empty X-Firebase-AppCheck"):
            auth_module._verify_app_check_token(req, PROJECT_ID)

    def test_non_jwt_rejected(self) -> None:
        req = _make_request({"X-Firebase-Appcheck": "not-a-jwt"})
        with pytest.raises(AuthenticationError, match="not a JWT"):
            auth_module._verify_app_check_token(req, PROJECT_ID)

    def test_wrong_project_aud_rejected(self) -> None:
        token = _make_jwt(
            {
                "aud": ["projects/some-other-project"],
                "exp": int(time.time()) + 300,
            }
        )
        req = _make_request({"X-Firebase-Appcheck": token})
        with pytest.raises(AuthenticationError, match="audience does not match"):
            auth_module._verify_app_check_token(req, PROJECT_ID)

    def test_aud_as_string_accepted(self) -> None:
        """`aud` may be a single string instead of a list."""
        token = _make_jwt(
            {
                "aud": f"projects/{PROJECT_ID}",
                "exp": int(time.time()) + 300,
            }
        )
        req = _make_request({"X-Firebase-Appcheck": token})
        # Should NOT raise.
        auth_module._verify_app_check_token(req, PROJECT_ID)

    def test_malformed_payload_rejected(self) -> None:
        # Three segments, but middle is not valid base64 JSON.
        token = "header.@@@notbase64@@@.sig"
        req = _make_request({"X-Firebase-Appcheck": token})
        with pytest.raises(AuthenticationError):
            auth_module._verify_app_check_token(req, PROJECT_ID)


@pytest.fixture
def prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Production-mode settings so authenticate_request runs every gate."""
    monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "production")
    monkeypatch.setenv(
        "SAHAYAKAI_AGENTS_AUDIENCE", "https://sahayakai-agents-test.run.app"
    )
    monkeypatch.setenv(
        "SAHAYAKAI_AGENTS_ALLOWED_INVOKERS",
        "svc-next@sahayakai-b4248.iam.gserviceaccount.com",
    )
    monkeypatch.setenv("GOOGLE_GENAI_API_KEY", "dummy-key-1,dummy-key-2")
    monkeypatch.setenv("GOOGLE_GENAI_SHADOW_API_KEY", "shadow-key-1,shadow-key-2")
    monkeypatch.setenv("SAHAYAKAI_REQUEST_SIGNING_KEY", "x" * 64)
    monkeypatch.setenv("GOOGLE_CLOUD_PROJECT", PROJECT_ID)
    monkeypatch.setenv("SAHAYAKAI_REQUIRE_APP_CHECK", "true")
    get_settings.cache_clear()


class TestAuthenticateRequestWithAppCheck:
    """End-to-end through `authenticate_request` so the App Check gate
    runs in the correct order relative to ID-token + HMAC verification."""

    @pytest.mark.asyncio
    async def test_missing_app_check_rejects_with_401(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """ID-token + HMAC valid, App Check missing → 401."""
        from starlette.requests import Request as StarletteRequest

        # Stub the ID-token verifier to succeed.
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            lambda *a, **kw: {
                "iss": "https://accounts.google.com",
                "email": "svc-next@sahayakai-b4248.iam.gserviceaccount.com",
                "exp": int(time.time()) + 300,
            },
        )

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/parent-call/reply",
            "headers": [
                (b"authorization", b"Bearer fake-token"),
                # Note: NO x-firebase-appcheck header.
            ],
        }
        request = StarletteRequest(scope, _receive)

        with pytest.raises(AuthenticationError, match="AppCheck"):
            await auth_module.authenticate_request(request)

    @pytest.mark.asyncio
    async def test_valid_app_check_passes_through(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """ID-token + HMAC + valid App Check → claims returned."""
        from starlette.requests import Request as StarletteRequest

        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            lambda *a, **kw: {
                "iss": "https://accounts.google.com",
                "email": "svc-next@sahayakai-b4248.iam.gserviceaccount.com",
                "exp": int(time.time()) + 300,
            },
        )

        app_check_token = _make_jwt(
            {
                "aud": [f"projects/{PROJECT_ID}"],
                "exp": int(time.time()) + 300,
                "app_id": "1:640589855975:web:test",
            }
        )

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/parent-call/reply",
            "headers": [
                (b"authorization", b"Bearer fake-token"),
                (b"x-firebase-appcheck", app_check_token.encode()),
            ],
        }
        request = StarletteRequest(scope, _receive)

        claims = await auth_module.authenticate_request(request)
        assert claims["email"] == "svc-next@sahayakai-b4248.iam.gserviceaccount.com"
        assert claims["_app_check_app_id"] == "1:640589855975:web:test"

    @pytest.mark.asyncio
    async def test_app_check_disabled_in_dev_mode(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """In dev mode the entire auth stack short-circuits — App Check is
        never inspected. Local curl + tests work without provisioning a
        reCAPTCHA site key."""
        from starlette.requests import Request as StarletteRequest

        monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "development")
        get_settings.cache_clear()

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/parent-call/reply",
            "headers": [],  # nothing at all
        }
        request = StarletteRequest(scope, _receive)

        claims = await auth_module.authenticate_request(request)
        assert claims["email"] == "dev@localhost"

    @pytest.mark.asyncio
    async def test_require_app_check_false_skips_gate(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """`SAHAYAKAI_REQUIRE_APP_CHECK=false` lets prod requests pass
        without an App Check token — used during the rollout window
        before every client is upgraded."""
        from starlette.requests import Request as StarletteRequest

        monkeypatch.setenv("SAHAYAKAI_REQUIRE_APP_CHECK", "false")
        get_settings.cache_clear()

        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            lambda *a, **kw: {
                "iss": "https://accounts.google.com",
                "email": "svc-next@sahayakai-b4248.iam.gserviceaccount.com",
                "exp": int(time.time()) + 300,
            },
        )

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/parent-call/reply",
            "headers": [(b"authorization", b"Bearer fake-token")],
        }
        request = StarletteRequest(scope, _receive)

        # Should succeed even though no App Check header is present.
        claims = await auth_module.authenticate_request(request)
        assert claims["email"] == "svc-next@sahayakai-b4248.iam.gserviceaccount.com"
        assert "_app_check_app_id" not in claims
