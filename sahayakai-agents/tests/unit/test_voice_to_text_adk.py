"""Unit tests pinning the ADK construct voice-to-text builds (Phase L.5).

`build_voice_to_text_agent()` returns a real
`google.adk.agents.SequentialAgent` with exactly 1 sub-agent (the
multimodal transcriber `LlmAgent`). A 1-step SequentialAgent is
degenerate but kept for shape consistency with visual-aid +
avatar-generator. Before Phase L.5 the voice-to-text agent was a
hand-rolled `google.genai.Client.aio.models.generate_content` call —
these tests guard against regressing back.
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
        "sahayakai_agents.agents.voice_to_text.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.voice_to_text.agent import (  # noqa: PLC0415
        build_voice_to_text_agent,
    )
    return build_voice_to_text_agent()


class TestBuildVoiceToTextAgent:
    def test_build_voice_to_text_agent_returns_sequential_agent(self) -> None:
        """The pipeline is a real ADK `SequentialAgent`, not a hand-rolled
        FastAPI handler. Phase L.5's whole point — even for a degenerate
        1-step multimodal pipeline."""
        from google.adk.agents import SequentialAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, SequentialAgent), (
            "build_voice_to_text_agent must return google.adk.agents."
            f"SequentialAgent. Got: {type(agent).__name__}"
        )

    def test_sequential_agent_has_1_sub_agent(self) -> None:
        """Single multimodal stage. If a future phase adds a post-
        processing step (profanity filter, dialect correction), update
        this test to count the new sub-agents."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert len(agent.sub_agents) == 1, (
            f"Expected exactly 1 sub-agent. Got {len(agent.sub_agents)}."
        )
        sub = agent.sub_agents[0]
        assert isinstance(sub, LlmAgent), (
            f"Sub-agent {sub.name!r} must be an LlmAgent. "
            f"Got: {type(sub).__name__}"
        )
        assert sub.name == "voice_to_text_transcriber"

    def test_transcriber_sub_agent_uses_transcriber_model(self) -> None:
        """Transcriber sub-agent's model matches `get_transcriber_model()`."""
        from sahayakai_agents.agents.voice_to_text.agent import (  # noqa: PLC0415
            get_transcriber_model,
        )

        agent = _build()
        sub = agent.sub_agents[0]
        expected = get_transcriber_model()
        assert isinstance(sub.model, str)
        assert sub.model == expected

    def test_transcriber_output_schema_is_voice_to_text_core(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `VoiceToTextCore`. Drift here would silently
        return free-text the router can't parse."""
        from sahayakai_agents.agents.voice_to_text.schemas import (  # noqa: PLC0415
            VoiceToTextCore,
        )

        agent = _build()
        sub = agent.sub_agents[0]
        assert sub.output_schema is VoiceToTextCore

    def test_transcriber_low_temperature(self) -> None:
        """Transcription is deterministic by design. `temperature=0.1`
        matches the pre-L.5 router's implicit low-temperature behaviour."""
        agent = _build()
        sub = agent.sub_agents[0]
        cfg = sub.generate_content_config
        assert cfg is not None
        assert cfg.temperature == 0.1

    def test_caches_via_lru(self) -> None:
        first = _build()
        from sahayakai_agents.agents.voice_to_text.agent import (  # noqa: PLC0415
            build_voice_to_text_agent,
        )
        second = build_voice_to_text_agent()
        assert first is second, (
            "build_voice_to_text_agent must cache its result so the "
            "pipeline is constructed once at import time, not per "
            "request."
        )
