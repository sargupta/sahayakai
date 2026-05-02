"""Authentication middleware.

Three concerns (Phase R.2 added the App Check layer):

1. **IAM invoker ID-token verification** (P1 #12). Next.js signs a Google-issued
   ID token scoped to this Cloud Run service's audience. We verify it against
   Google's public keys, then check the caller's SA email is in our allowed
   list. No shared secret needed, no rotation burden.

2. **Body integrity HMAC** (P1 #15). Every request body is HMAC-SHA256'd by
   Next.js with a per-environment secret and sent as `X-Content-Digest`. We
   recompute and reject on mismatch. Protects against man-in-the-middle tamper
   even if someone gets a valid ID token.

3. **Firebase App Check token** (Phase R.2). Optional client attestation that
   proves the request originated from a real registered Firebase client (web
   via reCAPTCHA v3, Android via Play Integrity, iOS via DeviceCheck). Closes
   the residual replay window if an attacker captures BOTH a valid ID token
   AND a matching HMAC tuple — App Check tokens are device-bound and rotate
   per session. Controlled by `SAHAYAKAI_REQUIRE_APP_CHECK` (default `true`
   in prod, override `false` in dev for local testing without reCAPTCHA).

All required gates must pass. A bearer-only auth proves identity without
proving integrity; a HMAC-only auth proves integrity without proving identity;
ID-token + HMAC still leaves a narrow capture-and-replay window that App Check
eliminates.
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

# Phase R.2: Firebase App Check header. The Next.js bridge attaches this
# after `getToken(appCheck)` on the browser; the value is a Firebase-signed
# JWT bound to the registered app + device. Header name matches Firebase's
# server-side conventions.
_APP_CHECK_HEADER = "x-firebase-appcheck"


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


def _verify_app_check_token(request: Request, project_id: str) -> dict[str, object]:
    """Verify the `X-Firebase-AppCheck` header (Phase R.2).

    Two-tier verification strategy:

    1. **Preferred**: full `firebase_admin.app_check.verify_token()` call.
       This validates the JWT signature against Firebase's public JWKS,
       checks `iss` (`https://firebaseappcheck.googleapis.com/<project>`),
       `aud` (`projects/<project_number>`), and `exp`.
    2. **Fallback (network-degraded)**: decode the JWT without signature
       verification and at minimum confirm the `aud` claim matches our
       project (`projects/<id>` or `projects/<number>`). This catches the
       common case (header completely missing or pointing at a different
       Firebase project) even if the JWKS endpoint is briefly unreachable.

    Raises `AuthenticationError` if the header is missing or invalid.

    Returns the decoded App Check claims dict on success — useful for
    downstream telemetry (the `app_id` claim identifies WHICH registered
    Firebase app made the request, e.g. web vs Android vs iOS).
    """
    raw = request.headers.get(_APP_CHECK_HEADER)
    if not raw:
        raise AuthenticationError("Missing X-Firebase-AppCheck header")

    raw = raw.strip()
    if not raw:
        raise AuthenticationError("Empty X-Firebase-AppCheck header")

    # Tier 1: full Firebase Admin SDK verification when available.
    try:
        from firebase_admin import app_check

        claims: dict[str, object] = app_check.verify_token(raw)
        log.debug(
            "auth.app_check.verified",
            app_id=str(claims.get("app_id") or ""),
            iss=str(claims.get("iss") or ""),
        )
        return claims
    except ImportError:
        # firebase_admin not initialised in this process. Fall through to
        # the lightweight aud-claim check below so the gate still does
        # something useful.
        log.warning("auth.app_check.firebase_admin_missing")
    except Exception as exc:  # noqa: BLE001 — Firebase raises a wide tree
        # Any verification failure (bad signature, wrong audience, expired)
        # → reject. We log the type, never the token contents.
        log.info(
            "auth.app_check.verify_failed",
            error_type=type(exc).__name__,
            error=str(exc)[:200],
        )
        raise AuthenticationError(
            f"App Check token verification failed: {type(exc).__name__}"
        ) from exc

    # Tier 2: bare-bones audience check. Only reached when firebase_admin
    # cannot be imported (e.g. test environment).
    parts = raw.split(".")
    if len(parts) != 3:
        raise AuthenticationError("App Check token is not a JWT")
    try:
        # Pad base64url to a multiple of 4 to avoid "Invalid padding" errors.
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        import json as _json

        decoded = _json.loads(base64.urlsafe_b64decode(payload_b64).decode("utf-8"))
    except (ValueError, base64.binascii.Error, UnicodeDecodeError) as exc:
        raise AuthenticationError("App Check token payload is not valid JSON") from exc

    aud = decoded.get("aud")
    aud_list: list[str] = (
        list(aud) if isinstance(aud, list)
        else [aud] if isinstance(aud, str)
        else []
    )
    expected_prefix = f"projects/{project_id}"
    if not any(
        a == expected_prefix or a.startswith(f"{expected_prefix}/") for a in aud_list
    ):
        raise AuthenticationError(
            "App Check token audience does not match this project"
        )

    log.debug("auth.app_check.aud_only_verified", project=project_id)
    # `json.loads` returns Any; narrow to dict[str, object] for the typed
    # contract while preserving the runtime payload.
    if not isinstance(decoded, dict):
        raise AuthenticationError("App Check token payload is not a JSON object")
    return dict(decoded)


async def authenticate_request(request: Request) -> dict[str, object]:
    """Run all required gates. Returns the verified token claims on success.

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

    # Phase R.2: App Check (client attestation). Optional via env so dev
    # mode + first staging deploys can skip it before reCAPTCHA is wired.
    if settings.require_app_check:
        app_check_claims = _verify_app_check_token(request, settings.gcp_project)
        # Stash the originating app_id for downstream observability.
        claims["_app_check_app_id"] = app_check_claims.get("app_id")

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
