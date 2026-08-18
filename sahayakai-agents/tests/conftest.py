"""Pytest fixtures shared across unit, integration, and behavioral layers."""
from __future__ import annotations

import os
from collections.abc import Iterator

import pytest

# Force development mode unless a test explicitly overrides.
os.environ.setdefault("SAHAYAKAI_AGENTS_ENV", "development")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "sahayakai-b4248-test")
os.environ.setdefault("SAHAYAKAI_REQUEST_SIGNING_KEY", "test-signing-key")
# Fake Gemini key pool so `run_resiliently` does not raise on the empty
# pool guard during integration tests. Every integration test then patches
# `google.genai.Client` to a fake that ignores the key, but the resilience
# layer still asserts the pool is non-empty before calling.
os.environ.setdefault("GOOGLE_GENAI_API_KEY", "test-key-1,test-key-2")
os.environ.setdefault("GOOGLE_GENAI_SHADOW_API_KEY", "shadow-key-1")
# Pin the API-key transport for the suite. Production now defaults to Vertex
# (ADC, no key), but the integration fakes replace `google.genai.Client` with
# stubs whose signature takes `api_key=` only — passing `vertexai=True` into
# them raises TypeError, which surfaces as a misleading 502.
#
# The transport is not what these tests are exercising. The Vertex branch is
# covered directly in tests/unit/test_vertex_client.py.
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "false")


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> Iterator[None]:
    """Ensure each test reads fresh env vars."""
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _reset_vidya_stream_guards() -> Iterator[None]:
    """Clear the `/v1/vidya-voice/stream` cost guards between tests.

    They are per-process module state on purpose — a burned token, an active uid
    and an hourly counter all have to outlive the socket that created them — so
    without this one test's successful open spends another's hourly budget, and
    the failure lands in whichever test happens to open sixth.
    """
    from sahayakai_agents.agents.vidya_voice.router import reset_stream_guards

    reset_stream_guards()
    yield
    reset_stream_guards()


def _capture_shipped_setup_deadline() -> float:
    """Read `_SETUP_FRAME_TIMEOUT_SECONDS` once, before anything can patch it.

    `_short_stream_setup_deadline` below overwrites the module attribute for
    every test, so by the time a test body runs there is no way left to observe
    the value the sidecar actually ships with. Captured here at collection time
    and served by the `shipped_setup_frame_timeout` fixture, so the pin in
    `test_vidya_voice_stream_setup.py` compares 5.0 against the real module
    default and not against the fixture's own convenience value.
    """
    from sahayakai_agents.agents.vidya_voice import router

    return float(router._SETUP_FRAME_TIMEOUT_SECONDS)


_SHIPPED_SETUP_FRAME_TIMEOUT = _capture_shipped_setup_deadline()


@pytest.fixture(scope="session")
def shipped_setup_frame_timeout() -> float:
    """The `/stream` setup deadline as shipped, unaffected by any fixture."""
    return _SHIPPED_SETUP_FRAME_TIMEOUT


@pytest.fixture(autouse=True)
def _short_stream_setup_deadline(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    """Shorten the `/stream` setup-frame deadline for the whole suite.

    The handler waits up to `_SETUP_FRAME_TIMEOUT_SECONDS` (5s shipped) for the
    optional `{"setup": ...}` first frame before opening the Vertex session. A
    real client sends it in the same tick as the open, so production never
    approaches the deadline — but a TEST client that sends nothing pays it in
    full, and ~25 socket tests × 5s is two extra minutes of CI for a value none
    of them are asserting.

    The shipped 5s is pinned by
    `test_vidya_voice_stream_setup.py::TestSetupFrameDeadline::
    test_shipped_deadline_is_five_seconds`, so shortening it here cannot
    quietly become shortening it in production; and the timeout BEHAVIOUR is
    exercised by the tests in that file, which set their own value.
    """
    from sahayakai_agents.agents.vidya_voice import router as vv_router

    monkeypatch.setattr(vv_router, "_SETUP_FRAME_TIMEOUT_SECONDS", 0.15)
    yield


@pytest.fixture
def test_api_key_pool() -> tuple[str, ...]:
    """Small key pool for resilience tests."""
    return ("dev-key-1", "dev-key-2", "dev-key-3")


@pytest.fixture
def single_key_pool() -> tuple[str, ...]:
    return ("solo-key",)
