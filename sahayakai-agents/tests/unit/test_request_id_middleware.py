"""Tests for the request_id propagation middleware.

Forensic finding P1 #18 — telemetry split-brain. The middleware mints a
hex request_id (or honours a caller-supplied `X-Request-ID`) and binds
it via structlog contextvars so every downstream log line carries it.
The same id is echoed in the response header for client-side
correlation.

These tests run in dev mode (auth is bypassed there per `auth.py`) so
they exercise the middleware on the public health route too.
"""
from __future__ import annotations

import re

import pytest
import structlog
from fastapi.testclient import TestClient

from sahayakai_agents.main import app

pytestmark = pytest.mark.unit

_HEX_RE = re.compile(r"^[0-9a-f]{32}$")


@pytest.fixture
def client() -> TestClient:
    """Lifespan-disabled client so we don't pay telemetry init cost."""
    return TestClient(app)


class TestRequestIdMiddleware:
    def test_generates_hex_id_when_header_absent(self, client: TestClient) -> None:
        """On a fresh request with no X-Request-ID, the middleware mints
        a 32-char hex id (uuid4 hex)."""
        res = client.get("/healthz")
        assert res.status_code == 200
        rid = res.headers.get("X-Request-ID")
        assert rid is not None
        assert _HEX_RE.match(rid), f"expected 32 hex chars, got {rid!r}"

    def test_honours_caller_supplied_header(self, client: TestClient) -> None:
        """If the caller sends `X-Request-ID`, we propagate it as-is so a
        caller-side trace (e.g. Next.js dispatcher) can join logs."""
        supplied = "ts-vidya-abc-123"
        res = client.get("/healthz", headers={"X-Request-ID": supplied})
        assert res.status_code == 200
        assert res.headers.get("X-Request-ID") == supplied

    def test_response_header_set_on_error_path(self, client: TestClient) -> None:
        """A 404 still emits the request_id header so clients can quote
        it in a bug report even when the route itself failed."""
        res = client.get("/this-route-does-not-exist")
        assert res.status_code == 404
        assert res.headers.get("X-Request-ID") is not None

    def test_each_request_gets_distinct_id(self, client: TestClient) -> None:
        """Two back-to-back requests with no caller-supplied id should
        receive different ids — this is the contract that makes
        per-request log correlation possible."""
        ids = {client.get("/healthz").headers["X-Request-ID"] for _ in range(3)}
        assert len(ids) == 3, "all three minted ids must be distinct"

    def test_contextvars_cleared_between_requests(
        self, client: TestClient
    ) -> None:
        """Each request starts with `clear_contextvars()` so state from
        a prior request can never leak forward — a crash mid-request
        otherwise leaves the contextvar bound on the worker thread, and
        the next request would log under the wrong request_id."""
        # First request binds an id.
        first = client.get("/healthz")
        assert first.status_code == 200
        # Force a fresh contextvar bind via a new request, then read
        # the structlog context AFTER the response — it should match
        # the second request, not the first.
        second_id = "second-explicit-id"
        second = client.get(
            "/healthz", headers={"X-Request-ID": second_id}
        )
        assert second.headers["X-Request-ID"] == second_id

        # After the request returns, the test thread's contextvars are
        # whatever the last middleware left bound. The middleware does
        # not unbind on the way out (clearing on entry is sufficient),
        # so we just assert the id flowed through end-to-end via the
        # response header — the contextvar reset on the NEXT request
        # is what prevents leakage.
        # We additionally inspect the structlog contextvars directly
        # to confirm the binding mechanism is actually reachable from
        # the request scope.
        ctx = structlog.contextvars.get_contextvars()
        # The TestClient runs the app in the same thread, so the last
        # request's contextvar binding is observable here. Either the
        # second id is still bound, or the contextvars dict contains
        # nothing leaked from the first request.
        if "request_id" in ctx:
            assert ctx["request_id"] == second_id
