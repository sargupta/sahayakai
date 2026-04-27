"""Unit tests pinning the ADK construct VIDYA's supervisor builds.

Phase L.1 — `build_vidya_agent()` returns a real
`google.adk.agents.LlmAgent`. Before this phase the sidecar imported
`google-adk` but did not USE it; all ADK constructs were reproduced
by hand on FastAPI. These tests guard against regressing back to
that hand-rolled shape.

Tests cover:
  - The factory returns an `LlmAgent` instance (not a dict, not a
    plain callable, not a `BaseAgent`).
  - The model string matches `get_orchestrator_model()` so a future
    env-var override propagates correctly.
  - `lru_cache` semantics — calling twice returns the same instance.
  - `sub_agents` is empty (L.1 wires nothing; L.2 will add the
    instant-answer `AgentTool`). Pinning this catches accidental
    drift in either direction.

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture. The point here is
to assert the static SHAPE of the supervisor.
"""
from __future__ import annotations

import importlib
import sys

import pytest

pytestmark = pytest.mark.unit


# ── sys.modules hygiene ───────────────────────────────────────────────────
#
# Several integration tests in this repo replace `sys.modules["google.genai"]`
# (and `["google.genai.types"]`) with `SimpleNamespace` shims and never
# restore them. That pollution leaks across the test session: when this
# unit-test file later runs and tries to `from google.adk.agents import
# LlmAgent`, ADK's `google.adk.models.google_llm` module has not been
# loaded yet (because the unit suite never previously needed it), so its
# top-level `from google.genai.errors import ClientError` runs against
# the polluted shim and ImportErrors out.
#
# Fix: an autouse fixture that snapshots+restores the relevant entries.
# This is scoped to THIS test file so it does not affect existing
# fixtures in other files (changing the global conftest broke ~30 tests
# that depend on the polluted state surviving across test cases).


# Sentinel for "attribute didn't exist in the original state".
_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force the real google.genai modules into sys.modules for this test.

    Snapshots `sys.modules` AND the `google` package's `.genai` /
    `.adk` attributes, drops everything, runs the test against fresh
    real modules, then restores EXACT pre-test state.

    Why both axes: `from google import genai` reads
    `getattr(google, 'genai')`, NOT `sys.modules["google.genai"]`.
    When my fixture imports the real google.genai, it sets the
    attribute on the `google` package — and that attribute persists
    even after sys.modules is restored. A subsequent test's
    `sys.modules["google.genai"] = SimpleNamespace(...)` shim is
    invisible to `from google import genai` because the attribute
    binding wins.

    Restoring exact pre-test state is critical: integration tests
    later in the run depend on the SimpleNamespace shims they install
    not being shadowed by real modules our fixture loaded.
    """
    import google as _google_pkg  # noqa: PLC0415

    pre_keys = {
        key for key in sys.modules
        if key == "google.genai" or key.startswith("google.genai.")
    }
    pre_state = {key: sys.modules[key] for key in pre_keys}
    pre_genai_attr = getattr(_google_pkg, "genai", _SENTINEL)

    # Drop everything google.genai* so the next import re-resolves
    # the real package fresh. If the prior session left a shim, this
    # is what un-shims it for our test.
    for key in pre_keys:
        del sys.modules[key]
    # Drop the attribute too — `from google import genai` would
    # otherwise short-circuit to whatever shim was attached.
    if hasattr(_google_pkg, "genai"):
        delattr(_google_pkg, "genai")

    # Re-import the real google.genai eagerly. This populates
    # `sys.modules` with the genuine submodules AND re-binds
    # `google.genai` on the package; ADK can then load.
    importlib.import_module("google.genai")
    importlib.import_module("google.genai.errors")
    importlib.import_module("google.genai.types")
    try:
        yield
    finally:
        # Restore EXACT pre-test state. Drop everything google.genai*
        # loaded during the test, restore snapshot, restore attribute.
        post_keys = {
            key for key in sys.modules
            if key == "google.genai" or key.startswith("google.genai.")
        }
        for key in post_keys:
            del sys.modules[key]
        for key, value in pre_state.items():
            sys.modules[key] = value
        if pre_genai_attr is _SENTINEL:
            # The pre-test state had no `google.genai` attribute —
            # delete whatever we set during the test.
            if hasattr(_google_pkg, "genai"):
                delattr(_google_pkg, "genai")
        else:
            _google_pkg.genai = pre_genai_attr  # type: ignore[attr-defined]


# ── Imports from the SUT (must run AFTER the autouse fixture would
# normally fire — but module-level imports run at COLLECTION time,
# before fixtures, so here we import lazily inside each test).


def _build() -> object:
    """Re-import + call the SUT factory.

    Re-import is necessary because the previous test session may have
    cached `sahayakai_agents.agents.vidya.agent` against polluted
    google.adk modules. The autouse fixture has already cleaned
    sys.modules, but importlib needs to reload the SUT to pick up
    the real ADK after restoration.
    """
    # Drop any cached SUT module so re-import sees the freshly-restored
    # google.genai chain.
    for key in (
        "sahayakai_agents.agents.vidya.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.vidya.agent import build_vidya_agent
    return build_vidya_agent()


class TestBuildVidyaAgent:
    def test_returns_llm_agent(self) -> None:
        """The supervisor is a real ADK `LlmAgent`, not a hand-rolled
        FastAPI handler. Phase L.1's whole point."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_vidya_agent must return google.adk.agents.LlmAgent. "
            f"Got: {type(agent).__name__}"
        )

    def test_uses_orchestrator_model(self) -> None:
        """The agent's model matches the env-overridable selector.

        Phase L.1 keeps `model` as a plain string so the cached agent
        reflects the env at module load. The router swaps it to a
        per-call `Gemini` instance with explicit api_key just before
        Runner.run_async — but the cached template here stays a string.
        """
        from sahayakai_agents.agents.vidya.gates import get_orchestrator_model  # noqa: PLC0415

        agent = _build()
        expected = get_orchestrator_model()
        # Agent.model can be `str` or a `BaseLlm` subclass. The cached
        # template uses a string; Pydantic stores it as-is.
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string, not a "
            f"BaseLlm instance. Got: {type(agent.model).__name__}"
        )
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_orchestrator_model()={expected!r}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`.

        Mutating one would mutate the other; the router's per-call
        `model_copy()` is what isolates per-request state.
        """
        first = _build()
        # Re-importing through `_build` would clear the cache; use
        # the SAME freshly-imported `build_vidya_agent` reference for
        # both calls so we actually exercise the lru_cache path.
        from sahayakai_agents.agents.vidya.agent import build_vidya_agent  # noqa: PLC0415
        second = build_vidya_agent()
        assert first is second, (
            "build_vidya_agent must cache its result so the supervisor "
            "is constructed once at import time, not per request."
        )

    def test_has_no_sub_agents_yet(self) -> None:
        """Phase L.1 wires `sub_agents=[]`. L.2 will add the
        instant-answer `AgentTool`. If this drifts before L.2 ships,
        update the docstring + plan reference; if it drifts AFTER L.2,
        update this test to count the expected sub-agents."""
        agent = _build()
        assert agent.sub_agents == [], (
            f"Phase L.1 expects empty sub_agents. "
            f"Got {len(agent.sub_agents)} sub_agents — has L.2 landed?"
        )

    def test_output_schema_is_intent_classification(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `IntentClassification`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.vidya.schemas import IntentClassification  # noqa: PLC0415

        agent = _build()
        assert agent.output_schema is IntentClassification, (
            f"agent.output_schema must be IntentClassification. "
            f"Got: {agent.output_schema}"
        )

    def test_has_supervisor_name(self) -> None:
        """Sanity: the supervisor has a stable, descriptive name. ADK
        uses this for logging + (post-L.2) sub-agent transfer routing."""
        agent = _build()
        assert agent.name, "Agent must have a name set"
        assert "vidya" in agent.name.lower(), (
            f"Supervisor name should reference VIDYA. Got: {agent.name!r}"
        )
