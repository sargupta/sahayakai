"""Typed errors exposed by the sidecar.

Mirrors `AIQuotaExhaustedError` in sahayakai-main/src/ai/genkit.ts so the
Next.js circuit breaker can react consistently regardless of which path handled
the request.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ErrorCode = Literal[
    "AI_QUOTA_EXHAUSTED",
    "AI_SAFETY_BLOCK",
    "UPSTREAM_TIMEOUT",
    "INVALID_INPUT",
    "UNAUTHENTICATED",
    "FORBIDDEN",
    "CONFLICT",
    "INTERNAL",
]


@dataclass
class AgentError(Exception):
    """Base typed error. Subclasses add HTTP mapping.

    Any unhandled exception in the sidecar is wrapped as `INTERNAL` at the
    FastAPI boundary so the wire format is always the same shape.
    """

    code: ErrorCode
    message: str
    http_status: int = 500
    retry_after_seconds: int | None = None

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.message}"


class AIQuotaExhaustedError(AgentError):
    """Gemini returned 429 after all key-pool retries."""

    def __init__(self, message: str = "AI quota exhausted", retry_after_seconds: int = 60) -> None:
        super().__init__(
            code="AI_QUOTA_EXHAUSTED",
            message=message,
            http_status=503,
            retry_after_seconds=retry_after_seconds,
        )


class AISafetyBlockError(AgentError):
    """Gemini refused to generate (safety filter). Never retry."""

    def __init__(self, message: str = "Output blocked by safety filter") -> None:
        super().__init__(code="AI_SAFETY_BLOCK", message=message, http_status=422)


class UpstreamTimeoutError(AgentError):
    """Upstream call exceeded its own budget."""

    def __init__(self, message: str = "Upstream timeout") -> None:
        super().__init__(code="UPSTREAM_TIMEOUT", message=message, http_status=504)


class SessionConflictError(AgentError):
    """P0 #10: duplicate or out-of-order turn number."""

    def __init__(self, message: str = "Session turn conflict") -> None:
        super().__init__(code="CONFLICT", message=message, http_status=409)


class AuthenticationError(AgentError):
    """Caller's ID token or HMAC digest rejected."""

    def __init__(self, message: str = "Authentication failed") -> None:
        super().__init__(code="UNAUTHENTICATED", message=message, http_status=401)


class AuthorizationError(AgentError):
    """Valid caller, but not in the allowed-invoker set."""

    def __init__(self, message: str = "Caller not allowed") -> None:
        super().__init__(code="FORBIDDEN", message=message, http_status=403)


class NotImplementedAgentError(AgentError):
    """Scaffold endpoints that intentionally return 501.

    Round-2 P1-10 fix: replaces raw `HTTPException(detail={...})` in
    router stubs so the wire envelope stays `{"error": {...}}` as
    declared in `schemas.WireErrorEnvelope`. Next.js circuit breaker
    expects the error under `body.error.code`.
    """

    def __init__(self, message: str) -> None:
        super().__init__(
            code="INTERNAL",  # Reusing INTERNAL; clients key off HTTP 501.
            message=message,
            http_status=501,
        )
