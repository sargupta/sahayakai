"""Unit tests pinning the ADK construct virtual-field-trip builds (Phase U.beta).

`build_virtual_field_trip_agent()` returns a real
`google.adk.agents.LlmAgent`. Before Phase U.beta the sidecar imported
`google-adk` but did not USE it for this router; the planner stage was
a hand-rolled `google.genai.Client.aio.models.generate_content` call.
These tests guard against regressing back to that hand-rolled shape.

Tests cover:
  - The factory returns an `LlmAgent` instance.
  - The model string matches `get_planner_model()` so a future env-var
    override propagates correctly.
  - `lru_cache` semantics — calling twice returns the same instance.
  - `output_schema` is `VirtualFieldTripCore`.
  - The agent has a stable snake_case name (ADK rejects hyphens).

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture. The point here is
to assert the static SHAPE of the agent.
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
    cached `sahayakai_agents.agents.virtual_field_trip.agent` against
    polluted google.adk modules. The autouse fixture has already
    cleaned sys.modules, but importlib needs to reload the SUT to pick
    up the real ADK after restoration.
    """
    for key in (
        "sahayakai_agents.agents.virtual_field_trip.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.virtual_field_trip.agent import (  # noqa: PLC0415
        build_virtual_field_trip_agent,
    )
    return build_virtual_field_trip_agent()


class TestBuildVirtualFieldTripAgent:
    def test_returns_llm_agent(self) -> None:
        """Phase U.beta's whole point: the planner is a real ADK
        `LlmAgent`, not a hand-rolled FastAPI handler."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_virtual_field_trip_agent must return google.adk.agents."
            f"LlmAgent. Got: {type(agent).__name__}"
        )

    def test_uses_planner_model(self) -> None:
        """Agent's model matches the env-overridable selector. The
        cached template holds a string; the router swaps it to a per-
        call keyed `Gemini` instance just before Runner.run_async."""
        from sahayakai_agents.agents.virtual_field_trip.agent import (  # noqa: PLC0415
            get_planner_model,
        )

        agent = _build()
        expected = get_planner_model()
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string, not a "
            f"BaseLlm instance. Got: {type(agent.model).__name__}"
        )
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_planner_model()={expected!r}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`."""
        first = _build()
        from sahayakai_agents.agents.virtual_field_trip.agent import (  # noqa: PLC0415
            build_virtual_field_trip_agent,
        )
        second = build_virtual_field_trip_agent()
        assert first is second, (
            "build_virtual_field_trip_agent must cache its result so the "
            "agent is constructed once at import time, not per request."
        )

    def test_output_schema_is_virtual_field_trip_core(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `VirtualFieldTripCore`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.virtual_field_trip.schemas import (  # noqa: PLC0415
            VirtualFieldTripCore,
        )

        agent = _build()
        assert agent.output_schema is VirtualFieldTripCore, (
            f"agent.output_schema must be VirtualFieldTripCore. "
            f"Got: {agent.output_schema}"
        )

    def test_has_snake_case_name(self) -> None:
        """ADK 1.31's Pydantic validator on `LlmAgent.name` enforces a
        Python-identifier pattern (no hyphens). The agent name is
        snake_case for that reason; this test guards against accidental
        drift to the hyphenated URL form (`virtual-field-trip-...`)."""
        agent = _build()
        assert agent.name, "Agent must have a name set"
        assert "-" not in agent.name, (
            f"Agent name must be snake_case (ADK rejects hyphens). "
            f"Got: {agent.name!r}"
        )
        assert "virtual_field_trip" in agent.name, (
            f"Agent name should reference virtual_field_trip. "
            f"Got: {agent.name!r}"
        )
