"""Unit tests pinning the ADK construct visual-aid builds (Phase L.5).

`build_visual_aid_agent()` returns a real
`google.adk.agents.SequentialAgent` whose two sub-agents are real
`LlmAgent` instances (image-gen + metadata-text). Before Phase L.5 the
sidecar imported `google-adk` but did not USE it; both stages were
hand-rolled `google.genai.Client.aio.models.generate_content` calls
glued together with try/except + `run_resiliently`. These tests guard
against regressing back to that hand-rolled shape.

Tests cover:
  - `build_visual_aid_agent` returns a `SequentialAgent`.
  - `sub_agents` has exactly 2 entries (image then metadata).
  - Each sub-agent is a real `LlmAgent`.
  - The image sub-agent's model matches `get_image_model()`; the
    metadata sub-agent's model matches `get_metadata_model()`.
  - Image sub-agent has IMAGE response modality + no output_schema.
  - Metadata sub-agent has `output_schema=VisualAidMetadata`.
  - `lru_cache` semantics — calling twice returns the same instance.

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture. The point here is
to assert the static SHAPE of the pipeline.
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
    cached `sahayakai_agents.agents.visual_aid.agent` against polluted
    google.adk modules. The autouse fixture has already cleaned
    sys.modules, but importlib needs to reload the SUT to pick up
    the real ADK after restoration.
    """
    for key in (
        "sahayakai_agents.agents.visual_aid.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.visual_aid.agent import (  # noqa: PLC0415
        build_visual_aid_agent,
    )
    return build_visual_aid_agent()


class TestBuildVisualAidAgent:
    def test_build_visual_aid_agent_returns_sequential_agent(self) -> None:
        """The pipeline is a real ADK `SequentialAgent`, not a hand-rolled
        FastAPI handler. Phase L.5's whole point."""
        from google.adk.agents import SequentialAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, SequentialAgent), (
            "build_visual_aid_agent must return google.adk.agents."
            f"SequentialAgent. Got: {type(agent).__name__}"
        )

    def test_sequential_agent_has_2_sub_agents(self) -> None:
        """Image first, metadata second. Drift here would break the
        router's event-stream parsing (which keys off sub-agent name)."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert len(agent.sub_agents) == 2, (
            f"Expected exactly 2 sub-agents (image + metadata). "
            f"Got {len(agent.sub_agents)}."
        )
        for sub in agent.sub_agents:
            assert isinstance(sub, LlmAgent), (
                f"Sub-agent {sub.name!r} must be an LlmAgent. "
                f"Got: {type(sub).__name__}"
            )
        # Order matters: image stage first, metadata second.
        assert agent.sub_agents[0].name == "visual_aid_image"
        assert agent.sub_agents[1].name == "visual_aid_metadata"

    def test_image_sub_agent_uses_image_model(self) -> None:
        """Image sub-agent's model matches `get_image_model()`. The
        cached template holds a string; the router swaps it to a per-
        call keyed `Gemini` instance just before Runner.run_async."""
        from sahayakai_agents.agents.visual_aid.agent import (  # noqa: PLC0415
            get_image_model,
        )

        agent = _build()
        image_sub = agent.sub_agents[0]
        expected = get_image_model()
        assert isinstance(image_sub.model, str)
        assert image_sub.model == expected, (
            f"image sub-agent.model={image_sub.model!r} drifted from "
            f"get_image_model()={expected!r}"
        )

    def test_metadata_sub_agent_uses_metadata_model(self) -> None:
        from sahayakai_agents.agents.visual_aid.agent import (  # noqa: PLC0415
            get_metadata_model,
        )

        agent = _build()
        metadata_sub = agent.sub_agents[1]
        expected = get_metadata_model()
        assert isinstance(metadata_sub.model, str)
        assert metadata_sub.model == expected

    def test_image_sub_agent_has_image_response_modality(self) -> None:
        """Image-gen needs `response_modalities=['IMAGE']` on the
        underlying GenerateContentConfig — without that, Gemini returns
        text not image bytes."""
        agent = _build()
        image_sub = agent.sub_agents[0]
        cfg = image_sub.generate_content_config
        assert cfg is not None
        assert cfg.response_modalities == ["IMAGE"], (
            f"image sub-agent must request IMAGE modality. "
            f"Got: {cfg.response_modalities}"
        )

    def test_image_sub_agent_has_no_output_schema(self) -> None:
        """Image-gen produces inline image bytes, not structured JSON.
        `output_schema` would force the model into JSON mode (incompatible
        with response_modalities=['IMAGE'])."""
        agent = _build()
        image_sub = agent.sub_agents[0]
        assert image_sub.output_schema is None

    def test_metadata_sub_agent_output_schema_is_visual_aid_metadata(
        self,
    ) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `VisualAidMetadata`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.visual_aid.schemas import (  # noqa: PLC0415
            VisualAidMetadata,
        )

        agent = _build()
        metadata_sub = agent.sub_agents[1]
        assert metadata_sub.output_schema is VisualAidMetadata

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`.

        Mutating one would mutate the other; the router's per-call
        `clone()` is what isolates per-request state.
        """
        first = _build()
        from sahayakai_agents.agents.visual_aid.agent import (  # noqa: PLC0415
            build_visual_aid_agent,
        )
        second = build_visual_aid_agent()
        assert first is second, (
            "build_visual_aid_agent must cache its result so the "
            "pipeline is constructed once at import time, not per "
            "request."
        )
