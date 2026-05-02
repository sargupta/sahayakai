"""Unit tests pinning the ADK construct parent-message builds (Phase U.alpha).

`build_parent_message_agent()` returns a real `google.adk.agents.LlmAgent`.
Before Phase U.alpha the parent-message router used a hand-rolled
`google.genai.Client.aio.models.generate_content` call. These tests guard
against regressing back to that hand-rolled shape.

Tests cover:
  - The factory returns an `LlmAgent` instance.
  - The model string matches `get_generator_model()` so a future env-var
    override propagates correctly.
  - `lru_cache` semantics — calling twice returns the same instance.
  - `output_schema=ParentMessageCore` so ADK switches Gemini into
    structured-output mode.
  - The agent's `name` is a Python identifier (snake_case, no hyphens) —
    ADK 1.31's Pydantic identifier validator rejects hyphens.

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture. The point here is
to assert the static SHAPE of the LlmAgent.
"""
from __future__ import annotations

import importlib
import sys

import pytest

pytestmark = pytest.mark.unit


# Sentinel for "attribute didn't exist in the original state".
_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Same hygiene fixture as test_vidya_adk_runtime — see that file
    for the full rationale.

    Several integration tests in this repo replace
    `sys.modules["google.genai"]` with `SimpleNamespace` shims that
    pollute the test session. ADK's `from google.genai.errors import
    ClientError` then ImportErrors. We snapshot+restore to insulate
    this unit test from the pollution.
    """
    import google as _google_pkg  # noqa: PLC0415

    pre_keys = {
        key for key in sys.modules
        if key == "google.genai" or key.startswith("google.genai.")
    }
    pre_state = {key: sys.modules[key] for key in pre_keys}
    pre_genai_attr = getattr(_google_pkg, "genai", _SENTINEL)

    for key in pre_keys:
        del sys.modules[key]
    if hasattr(_google_pkg, "genai"):
        delattr(_google_pkg, "genai")

    importlib.import_module("google.genai")
    importlib.import_module("google.genai.errors")
    importlib.import_module("google.genai.types")
    try:
        yield
    finally:
        post_keys = {
            key for key in sys.modules
            if key == "google.genai" or key.startswith("google.genai.")
        }
        for key in post_keys:
            del sys.modules[key]
        for key, value in pre_state.items():
            sys.modules[key] = value
        if pre_genai_attr is _SENTINEL:
            if hasattr(_google_pkg, "genai"):
                delattr(_google_pkg, "genai")
        else:
            _google_pkg.genai = pre_genai_attr  # type: ignore[attr-defined]


def _build() -> object:
    """Re-import + call the SUT factory.

    Re-import is necessary because the previous test session may have
    cached `sahayakai_agents.agents.parent_message.agent` against
    polluted google.adk modules. The autouse fixture has already
    cleaned sys.modules, but importlib needs to reload the SUT to pick
    up the real ADK after restoration.
    """
    for key in (
        "sahayakai_agents.agents.parent_message.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.parent_message.agent import (  # noqa: PLC0415
        build_parent_message_agent,
    )
    # Cache may have a stale entry from before the autouse re-import
    # cycle. Clear it so we exercise the fresh build.
    build_parent_message_agent.cache_clear()
    return build_parent_message_agent()


class TestBuildParentMessageAgent:
    def test_returns_llm_agent(self) -> None:
        """The agent is a real ADK `LlmAgent`, not a hand-rolled
        FastAPI handler. Phase U.alpha's whole point."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_parent_message_agent must return google.adk.agents."
            f"LlmAgent. Got: {type(agent).__name__}"
        )

    def test_uses_generator_model(self) -> None:
        """The agent's model matches the env-overridable selector.

        Phase U.alpha keeps `model` as a plain string so the cached
        agent reflects the env at module load. The router swaps it to a
        per-call `Gemini` instance with explicit api_key just before
        Runner.run_async — but the cached template here stays a string.
        """
        from sahayakai_agents.agents.parent_message.agent import (  # noqa: PLC0415
            get_generator_model,
        )

        agent = _build()
        expected = get_generator_model()
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string, not a "
            f"BaseLlm instance. Got: {type(agent.model).__name__}"
        )
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_generator_model()={expected!r}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`.

        Mutating one would mutate the other; the router's per-call
        `model_copy()` is what isolates per-request state.
        """
        first = _build()
        from sahayakai_agents.agents.parent_message.agent import (  # noqa: PLC0415
            build_parent_message_agent,
        )
        second = build_parent_message_agent()
        assert first is second, (
            "build_parent_message_agent must cache its result so the "
            "agent is constructed once at import time, not per request."
        )

    def test_output_schema_is_parent_message_core(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `ParentMessageCore`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.parent_message.schemas import (  # noqa: PLC0415
            ParentMessageCore,
        )

        agent = _build()
        assert agent.output_schema is ParentMessageCore, (
            f"agent.output_schema must be ParentMessageCore. "
            f"Got: {agent.output_schema}"
        )

    def test_has_python_identifier_name(self) -> None:
        """ADK 1.31's `LlmAgent.name` Pydantic validator rejects hyphens
        (the field must be a Python identifier). The agent name here is
        snake_case `parent_message_generator` — pinned so a future
        regression to `parent-message-generator` is caught at unit-test
        time, not at construction time in production."""
        agent = _build()
        assert agent.name, "Agent must have a name set"
        assert agent.name.isidentifier(), (
            f"agent.name={agent.name!r} must be a Python identifier "
            "(no hyphens). ADK 1.31's Pydantic validator rejects "
            "hyphens — use snake_case."
        )
        assert "parent_message" in agent.name.lower(), (
            f"Agent name should reference parent_message. "
            f"Got: {agent.name!r}"
        )
