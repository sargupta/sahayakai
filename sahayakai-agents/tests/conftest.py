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


@pytest.fixture(autouse=True)
def _reset_settings_cache() -> Iterator[None]:
    """Ensure each test reads fresh env vars."""
    from sahayakai_agents.config import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def test_api_key_pool() -> tuple[str, ...]:
    """Small key pool for resilience tests."""
    return ("dev-key-1", "dev-key-2", "dev-key-3")


@pytest.fixture
def single_key_pool() -> tuple[str, ...]:
    return ("solo-key",)
