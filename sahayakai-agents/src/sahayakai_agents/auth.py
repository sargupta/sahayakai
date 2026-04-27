"""Authentication middleware.

Two concerns:

1. **IAM invoker ID-token verification** (P1 #12). Next.js signs a Google-issued
   ID token scoped to this Cloud Run service's audience. We verify it against
   Google's public keys, then check the caller's SA email is in our allowed
   list. No shared secret needed, no rotation burden.

2. **Body integrity HMAC** (P1 #15). Every request body is HMAC-SHA256'd by
   Next.js with a per-environment secret and sent as `X-Content-Digest`. We
   recompute and reject on mismatch. Protects against man-in-the-middle tamper
   even if someone gets a valid ID token.

Both gates must pass. A bearer-only auth can prove identity without proving
integrity; a HMAC-only auth can prove integrity without proving identity.
Together they cover both.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import time
from collections.abc import Awaitable, Callable

import structlog
from cachetools import TTLCache  # type: ignore[import-untyped]
from fastapi import Request, Response
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from .config import get_settings
from .shared.errors import (
    AuthenticationError,
    AuthorizationError,
    ReplayDetectedError,
)

log = structlog.get_logger(__name__)

# Skip auth entirely for these endpoints.
_PUBLIC_PATHS: frozenset[str] = frozenset({"/healthz", "/readyz", "/.well-known/agent.json"})

# IAM ID-token verification is expensive (public key fetch, JWT parse, sig
# check). Cache the Google request transport per-process; it reuses keys.
_google_request = google_requests.Request()


def _extract_bearer(request: Request) -> str:
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        raise AuthenticationError("Missing or malformed Authorization header")
    return auth[len("bearer ") :].strip()


def _verify_id_token(token: str, audience: str) -> dict[str, object]:
    """Verify a Google-signed ID token against our audience."""
    try:
        payload: dict[str, object] = google_id_token.verify_oauth2_token(
            token, _google_request, audience=audience
        )
    except ValueError as exc:
        raise AuthenticationError(f"ID token verification failed: {exc}") from exc

    # Google always sets iss to accounts.google.com or https://accounts.google.com.
    iss = payload.get("iss")
    if iss not in {"accounts.google.com", "https://accounts.google.com"}:
        raise AuthenticationError(f"Unexpected token issuer: {iss}")

    # Expiry is enforced by verify_oauth2_token, but belt-and-braces:
    exp = int(payload.get("exp") or 0)
    if exp and exp < int(time.time()) - 30:
        raise AuthenticationError("ID token expired")

    return payload


# Round-2 audit P1 REPLAY-1 fix (30-agent review, group A5 + B3):
# HMAC + ID-token alone do NOT prevent replay. A captured
# (Authorization, X-Content-Digest, body) tuple is replayable for the
# full ID-token TTL (~1 hour). Gemini API spend, Firestore writes, and
# behavioural-guard side effects all happen on every replay.
#
# Defence: the caller adds `X-Request-Timestamp: <unix-millis>` and
# folds it into the HMAC input. The verifier here re-checks the
# timestamp is within a ±5-minute window (Cloud Run / load balancer
# clock skew + occasional retry tolerance). Any captured request older
# than 5 minutes is silently dropped.
_TIMESTAMP_SKEW_MS = 5 * 60 * 1000  # ±5 min
_TIMESTAMP_HEADER = "x-request-timestamp"

# Phase J.4 hot-fix (forensic P1 #19): per-process TTL cache for the
# (timestamp_ms, digest_hex) nonce tuples. Without this, the HMAC
# guard above only proves the request body was not tampered — it does
# NOT prevent replay. A captured (Authorization, X-Content-Digest,
# X-Request-Timestamp, body) tuple is valid for the full 5-min skew
# window. 100× replay = 100× Gemini billing on a single captured POST.
#
# 6-min TTL = 1 minute longer than the skew window so a request still
# in-flight when its timestamp ages out cannot be replayed at the edge.
# 10k entries ≈ 5 MB worst case (key tuple + bool); we run at < 100 rps
# steady state so the cache never gets close to its bound.
_REPLAY_GUARD: TTLCache[tuple[int, str], bool] = TTLCache(
    maxsize=10_000,
    ttl=360,
)


def _verify_content_digest(request: Request, raw_body: bytes) -> None:
    """Recompute HMAC-SHA256 of (timestamp + body) and compare against
    `X-Content-Digest`.

    Wire format:
      X-Request-Timestamp: <unix milliseconds>
      X-Content-Digest:    sha256=<base64-stdencoded(hmac(secret,
                                                          ts+":"+body))>

    The colon is a stable delimiter so a body containing the timestamp
    bytes can't collide with a request from a different timestamp.
    A missing timestamp on a non-empty body is a hard failure (no
    backwards-compat with the pre-fix shape — every Next.js client is
    upgraded in lockstep).
    """
    if not raw_body:
        # Empty bodies (e.g. idempotent GET) don't need HMAC.
        return

    header = request.headers.get("x-content-digest")
    if not header:
        raise AuthenticationError("Missing X-Content-Digest header on body request")

    if not header.startswith("sha256="):
        raise AuthenticationError("Unsupported digest scheme (expected sha256=)")

    expected_b64 = header.split("=", 1)[1].strip()
    try:
        expected = base64.b64decode(expected_b64, validate=True)
    except (ValueError, base64.binascii.Error) as exc:
        raise AuthenticationError("X-Content-Digest is not valid base64") from exc

    timestamp_str = request.headers.get(_TIMESTAMP_HEADER)
    if not timestamp_str:
        raise AuthenticationError("Missing X-Request-Timestamp header")
    try:
        timestamp_ms = int(timestamp_str)
    except ValueError as exc:
        raise AuthenticationError("X-Request-Timestamp is not an integer") from exc

    now_ms = int(time.time() * 1000)
    skew = abs(now_ms - timestamp_ms)
    if skew > _TIMESTAMP_SKEW_MS:
        raise AuthenticationError(
            f"X-Request-Timestamp out of range (skew {skew}ms > {_TIMESTAMP_SKEW_MS}ms)"
        )

    key = get_settings().request_signing_key.get_secret_value().encode("utf-8")
    # Bind timestamp to body so the same body at a different time
    # produces a different MAC — kills replay within the skew window.
    signed_input = timestamp_str.encode("utf-8") + b":" + raw_body
    computed = hmac.new(key, signed_input, hashlib.sha256).digest()

    # Constant-time compare to avoid timing oracles.
    if not hmac.compare_digest(expected, computed):
        raise AuthenticationError("Body HMAC digest mismatch")

    # Phase J.4 hot-fix (forensic P1 #19): nonce store. The digest is
    # only inserted AFTER HMAC verification passes — we never let an
    # invalid request poison the cache. The key is `(timestamp_ms,
    # digest_hex)`, which is unique per (signing_key, body) pair: a
    # legitimate retry of the same body sends the same MAC, so the
    # second attempt in the same skew window is rejected. Clients that
    # need true at-least-once retries must change either the body or
    # the timestamp (the OmniOrb client and parent-call dispatcher
    # already do — every retry advances `X-Request-Timestamp`).
    digest_hex = computed.hex()
    nonce_key = (timestamp_ms, digest_hex)
    if nonce_key in _REPLAY_GUARD:
        log.warning(
            "auth.hmac.replay_detected",
            timestamp_ms=timestamp_ms,
        )
        raise ReplayDetectedError("Request replay rejected")
    _REPLAY_GUARD[nonce_key] = True


async def authenticate_request(request: Request) -> dict[str, object]:
    """Run both gates. Returns the verified token claims on success.

    Raises `AgentError` subclasses on failure; the FastAPI error handler maps
    them to HTTP codes.
    """
    settings = get_settings()

    # In development we skip IAM verification to allow plain curl during
    # scaffolding. Production ALWAYS requires both gates.
    if settings.env == "development":
        log.debug("auth.dev_mode_skip", path=request.url.path)
        return {"email": "dev@localhost", "env": "development"}

    token = _extract_bearer(request)
    claims = _verify_id_token(token, settings.audience)

    email = str(claims.get("email") or "")
    if not email:
        raise AuthenticationError("ID token has no email claim")

    if email not in settings.allowed_invokers:
        log.warning(
            "auth.invoker_not_allowed",
            invoker=email,
            allowed_count=len(settings.allowed_invokers),
        )
        raise AuthorizationError(f"Invoker {email!r} is not in allowed list")

    # Body integrity. Reading the body here consumes the stream — we must
    # stash it back onto the request so downstream handlers can re-read.
    raw_body = await request.body()
    _verify_content_digest(request, raw_body)

    # Cache a minimal "verified" context for the request handler.
    claims["_verified_at"] = int(time.time())
    return claims


async def auth_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """FastAPI middleware that enforces both gates on all non-public paths."""
    if request.url.path in _PUBLIC_PATHS:
        return await call_next(request)

    try:
        claims = await authenticate_request(request)
    except ReplayDetectedError as exc:
        # Phase J.4 (forensic P1 #19): distinct log path so ops can
        # alert on replay events without conflating with stale-token
        # failures (which are the bulk of 401 traffic).
        log.warning("auth.replay_rejected", path=request.url.path, reason=exc.message)
        return Response(content=exc.message, status_code=exc.http_status)
    except AuthenticationError as exc:
        log.info("auth.unauthenticated", path=request.url.path, reason=exc.message)
        return Response(content=exc.message, status_code=exc.http_status)
    except AuthorizationError as exc:
        log.warning("auth.forbidden", path=request.url.path, reason=exc.message)
        return Response(content=exc.message, status_code=exc.http_status)

    request.state.invoker = claims.get("email")
    return await call_next(request)
