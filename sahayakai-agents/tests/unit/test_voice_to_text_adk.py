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


class TestSoftEmptyTranscription:
    """Soft-empty handling — short / silent / sub-threshold audio.

    When the Gemini transcriber emits no text, the router MUST return a
    `VoiceToTextCore(text="", language=<expected or null>)` rather than
    raising `AgentError`. Mirrors the TS soft-empty fix shipped in
    commit 727522140 (`src/ai/flows/voice-to-text.ts:262, 298`) so the
    UI can render a graceful "I didn't catch that" state instead of a
    destructive HTTP 500 toast that triggers the client's 3x retry
    loop. See qa/results/lane-F/VIDYA_VOICE_DEBUG.md Bug 2.
    """

    def test_normalize_expected_language_passes_known_iso(self) -> None:
        from sahayakai_agents.agents.voice_to_text.router import (  # noqa: PLC0415
            _normalize_expected_language,
        )

        assert _normalize_expected_language("hi") == "hi"
        assert _normalize_expected_language("HI") == "hi"
        assert _normalize_expected_language("  bn  ") == "bn"

    def test_normalize_expected_language_rejects_unknown(self) -> None:
        from sahayakai_agents.agents.voice_to_text.router import (  # noqa: PLC0415
            _normalize_expected_language,
        )

        # Unsupported ISO codes (fr, es) must return None — otherwise the
        # behavioural guard's `assert_language_iso_allowed` would reject
        # the soft-empty response and we'd 502 anyway.
        assert _normalize_expected_language("fr") is None
        assert _normalize_expected_language("es") is None
        assert _normalize_expected_language("") is None
        assert _normalize_expected_language(None) is None
        # 5-letter BCP-47 like "hi-IN" is also rejected (lowercased form
        # "hi-in" is not in the supported set).
        assert _normalize_expected_language("hi-IN") is None

    @pytest.mark.asyncio
    async def test_run_pipeline_soft_empty_returns_empty_core(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """When the ADK Runner yields no transcript text, the soft-empty
        branch must return `VoiceToTextCore(text="", language="hi")`
        when the caller supplied `expected_language="hi"`.

        Patches `InMemoryRunner` + `_build_pinned_pipeline` to avoid
        instantiating a real ADK Runner / Gemini client in a unit test.
        """
        from sahayakai_agents.agents.voice_to_text import (  # noqa: PLC0415
            router as vtt_router,
        )
        from sahayakai_agents.agents.voice_to_text.schemas import (  # noqa: PLC0415
            VoiceToTextCore,
        )

        class _FakeSessionService:
            async def create_session(self, **_: object) -> None:
                return None

        class _FakeRunner:
            def __init__(self, **_: object) -> None:
                self.session_service = _FakeSessionService()

            async def run_async(self, **_: object):
                # No events yielded — simulates Gemini returning empty
                # response on short / silent audio.
                if False:
                    yield None  # pragma: no cover

        monkeypatch.setattr(vtt_router, "InMemoryRunner", _FakeRunner, raising=False)
        # ADK runner is imported inside `_run_pipeline_via_runner` —
        # patch via sys.modules so the local import resolves to our fake.
        import google.adk.runners as adk_runners  # noqa: PLC0415

        monkeypatch.setattr(adk_runners, "InMemoryRunner", _FakeRunner)
        monkeypatch.setattr(
            vtt_router,
            "_build_pinned_pipeline",
            lambda _api_key: object(),
        )

        result = await vtt_router._run_pipeline_via_runner(
            prompt_text="rubric",
            audio_bytes=b"\x00" * 32,
            audio_mime="audio/webm",
            api_key="fake-key",
            expected_language="hi",
        )

        assert isinstance(result, VoiceToTextCore)
        assert result.text == ""
        assert result.language == "hi"

    @pytest.mark.asyncio
    async def test_run_pipeline_soft_empty_unknown_hint_returns_null_language(
        self,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Soft-empty with no / unknown expected language → language=None.

        Returning an arbitrary string would fail the behavioural guard's
        `assert_language_iso_allowed` check and surface as a 502 anyway.
        """
        from sahayakai_agents.agents.voice_to_text import (  # noqa: PLC0415
            router as vtt_router,
        )
        from sahayakai_agents.agents.voice_to_text.schemas import (  # noqa: PLC0415
            VoiceToTextCore,
        )

        class _FakeRunner:
            def __init__(self, **_: object) -> None:
                class _S:
                    async def create_session(self, **_: object) -> None:
                        return None

                self.session_service = _S()

            async def run_async(self, **_: object):
                if False:
                    yield None  # pragma: no cover

        import google.adk.runners as adk_runners  # noqa: PLC0415

        monkeypatch.setattr(adk_runners, "InMemoryRunner", _FakeRunner)
        monkeypatch.setattr(
            vtt_router,
            "_build_pinned_pipeline",
            lambda _api_key: object(),
        )

        for hint in (None, "", "fr"):
            result = await vtt_router._run_pipeline_via_runner(
                prompt_text="rubric",
                audio_bytes=b"\x00" * 32,
                audio_mime="audio/webm",
                api_key="fake-key",
                expected_language=hint,
            )
            assert isinstance(result, VoiceToTextCore)
            assert result.text == ""
            assert result.language is None, (
                f"hint={hint!r} → expected language=None, got "
                f"{result.language!r}"
            )
