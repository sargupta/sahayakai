"""Unit tests pinning the ADK construct video-storyteller builds (Phase U.beta).

`build_video_storyteller_agent()` returns a real
`google.adk.agents.LlmAgent`. Before Phase U.beta the sidecar imported
`google-adk` but did not USE it for this router; the recommender stage
was a hand-rolled `google.genai.Client.aio.models.generate_content`
call. These tests guard against regressing back to that hand-rolled
shape.

Tests cover:
  - The factory returns an `LlmAgent` instance.
  - The model string matches `get_recommender_model()`.
  - `lru_cache` semantics — calling twice returns the same instance.
  - `output_schema` is `VideoStorytellerCore`.
  - The agent has a stable snake_case name (ADK rejects hyphens).

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture.
"""
from __future__ import annotations

import importlib
import sys

import pytest

pytestmark = pytest.mark.unit


_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Same hygiene fixture as test_vidya_adk_runtime — see that file
    for the full rationale.
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
    for key in (
        "sahayakai_agents.agents.video_storyteller.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.video_storyteller.agent import (  # noqa: PLC0415
        build_video_storyteller_agent,
    )
    return build_video_storyteller_agent()


class TestBuildVideoStorytellerAgent:
    def test_returns_llm_agent(self) -> None:
        """Phase U.beta's whole point: the recommender is a real ADK
        `LlmAgent`, not a hand-rolled FastAPI handler."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_video_storyteller_agent must return google.adk.agents."
            f"LlmAgent. Got: {type(agent).__name__}"
        )

    def test_uses_recommender_model(self) -> None:
        """Agent's model matches the env-overridable selector. The
        cached template holds a string; the router swaps it to a per-
        call keyed `Gemini` instance just before Runner.run_async."""
        from sahayakai_agents.agents.video_storyteller.agent import (  # noqa: PLC0415
            get_recommender_model,
        )

        agent = _build()
        expected = get_recommender_model()
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string, not a "
            f"BaseLlm instance. Got: {type(agent.model).__name__}"
        )
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_recommender_model()={expected!r}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`."""
        first = _build()
        from sahayakai_agents.agents.video_storyteller.agent import (  # noqa: PLC0415
            build_video_storyteller_agent,
        )
        second = build_video_storyteller_agent()
        assert first is second, (
            "build_video_storyteller_agent must cache its result so the "
            "agent is constructed once at import time, not per request."
        )

    def test_output_schema_is_video_storyteller_core(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `VideoStorytellerCore`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.video_storyteller.schemas import (  # noqa: PLC0415
            VideoStorytellerCore,
        )

        agent = _build()
        assert agent.output_schema is VideoStorytellerCore, (
            f"agent.output_schema must be VideoStorytellerCore. "
            f"Got: {agent.output_schema}"
        )

    def test_has_snake_case_name(self) -> None:
        """ADK 1.31's Pydantic validator on `LlmAgent.name` enforces a
        Python-identifier pattern (no hyphens). The agent name is
        snake_case for that reason."""
        agent = _build()
        assert agent.name, "Agent must have a name set"
        assert "-" not in agent.name, (
            f"Agent name must be snake_case (ADK rejects hyphens). "
            f"Got: {agent.name!r}"
        )
        assert "video_storyteller" in agent.name, (
            f"Agent name should reference video_storyteller. "
            f"Got: {agent.name!r}"
        )
