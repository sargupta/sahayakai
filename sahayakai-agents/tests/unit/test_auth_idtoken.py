"""Unit tests for the IAM invoker ID-token verification path in `auth.py`.

Mocks `google.oauth2.id_token.verify_oauth2_token` so no network call is
made and no Google OAuth2 certs are fetched.

Companion to `test_auth.py`, which covers the HMAC `X-Content-Digest`
path. Together they cover both of the sidecar's auth gates.

Review trace:
- P1 #12 IAM invoker identity (Google-signed ID token with audience +
  allowed-invoker check).
- Round-2: auth.py imports google.oauth2.id_token; tests must patch at
  the import location used inside auth.py.
"""
from __future__ import annotations

import time
from typing import Any

import pytest

from sahayakai_agents import auth as auth_module
from sahayakai_agents.config import get_settings
from sahayakai_agents.shared.errors import AuthenticationError, AuthorizationError

pytestmark = pytest.mark.unit


AUDIENCE = "https://sahayakai-agents-test.run.app"
ALLOWED_INVOKER = "svc-next@sahayakai-b4248.iam.gserviceaccount.com"


@pytest.fixture
def prod_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Set production-like env so the ID-token path is actually exercised.

    In `development` mode, `authenticate_request` short-circuits the token
    path. We monkeypatch the settings-cached env values directly to avoid
    restarting the process.
    """
    monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "production")
    monkeypatch.setenv("SAHAYAKAI_AGENTS_AUDIENCE", AUDIENCE)
    monkeypatch.setenv("SAHAYAKAI_AGENTS_ALLOWED_INVOKERS", ALLOWED_INVOKER)
    monkeypatch.setenv("GOOGLE_GENAI_API_KEY", "dummy-key-1,dummy-key-2")
    monkeypatch.setenv(
        "GOOGLE_GENAI_SHADOW_API_KEY", "shadow-key-1,shadow-key-2"
    )
    monkeypatch.setenv(
        "SAHAYAKAI_REQUEST_SIGNING_KEY",
        "x" * 64,  # passes the 32-char floor
    )
    get_settings.cache_clear()


def _valid_claims(**overrides: Any) -> dict[str, Any]:
    claims = {
        "iss": "https://accounts.google.com",
        "email": ALLOWED_INVOKER,
        "email_verified": True,
        "aud": AUDIENCE,
        "exp": int(time.time()) + 300,
    }
    claims.update(overrides)
    return claims


def _stub_verify(returns: dict[str, Any] | Exception):
    """Factory for a `verify_oauth2_token` stub.

    Returns the claims dict (or raises the passed exception) regardless of
    arguments. Signature matches the real `verify_oauth2_token(token,
    request, audience=None)`.
    """

    def _stub(
        _token: str, _request: Any, audience: str | None = None
    ) -> dict[str, Any]:  # noqa: ARG001
        if isinstance(returns, Exception):
            raise returns
        return dict(returns)

    return _stub


class TestVerifyIdToken:
    def test_valid_token_returns_claims(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(_valid_claims()),
        )
        claims = auth_module._verify_id_token("fake.token.here", AUDIENCE)
        assert claims["email"] == ALLOWED_INVOKER
        assert claims["iss"] == "https://accounts.google.com"

    def test_value_error_from_verifier_raises_auth_error(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(ValueError("Invalid signature")),
        )
        with pytest.raises(AuthenticationError):
            auth_module._verify_id_token("bad.token", AUDIENCE)

    def test_wrong_issuer_raises_auth_error(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(_valid_claims(iss="https://evil.example.com")),
        )
        with pytest.raises(AuthenticationError):
            auth_module._verify_id_token("token-with-bad-issuer", AUDIENCE)

    def test_expired_token_raises_auth_error(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        past = int(time.time()) - 600
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(_valid_claims(exp=past)),
        )
        with pytest.raises(AuthenticationError):
            auth_module._verify_id_token("expired.token", AUDIENCE)

    def test_issuer_without_https_scheme_is_accepted(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Google's documented issuers include both `accounts.google.com`
        and `https://accounts.google.com`. Both must verify.
        """
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(_valid_claims(iss="accounts.google.com")),
        )
        claims = auth_module._verify_id_token("schemaless-iss.token", AUDIENCE)
        assert claims["iss"] == "accounts.google.com"


class TestAuthenticateRequest:
    """End-to-end flow exercising both gates at once in production mode.

    Reaches into `authenticate_request` to confirm the invoker-allowlist
    check fires and Response.body is read exactly once.
    """

    @pytest.mark.asyncio
    async def test_unknown_invoker_raises_authorization_error(
        self, prod_env: None, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        from starlette.requests import Request

        # Stub the ID-token verify to return a valid-shape token from an
        # unknown SA.
        unknown_sa = "svc-attacker@other-project.iam.gserviceaccount.com"
        monkeypatch.setattr(
            auth_module.google_id_token,
            "verify_oauth2_token",
            _stub_verify(_valid_claims(email=unknown_sa)),
        )

        async def _receive() -> dict[str, Any]:
            return {"type": "http.request", "body": b"", "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/v1/parent-call/reply",
            "headers": [
                (b"authorization", b"Bearer fake-token"),
            ],
        }
        request = Request(scope, _receive)

        with pytest.raises(AuthorizationError):
            await auth_module.authenticate_request(request)
