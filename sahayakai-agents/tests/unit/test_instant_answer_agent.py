"""Unit tests for the instant-answer agent helpers (Phase B §B.2 + L.2).

Pure functions only \u2014 no Gemini calls. Tests:
  - Prompt loading + rendering (Phase B §B.2).
  - Model selectors (Phase B §B.2).
  - ADK construct factories (Phase L.2): `build_instant_answer_agent`
    (returns `LlmAgent`) and `build_answerer_tool` (wraps it as an
    `AgentTool`). The factories use `lru_cache(1)` so two calls return
    the same instance.
"""
from __future__ import annotations

import importlib
import sys

import pytest

from sahayakai_agents.agents.instant_answer.agent import (
    get_answerer_model,
    load_answerer_prompt,
    render_answerer_prompt,
)

pytestmark = pytest.mark.unit


# ---- Same sys.modules hygiene as test_vidya_adk_runtime ------------------
#
# Other test files in this repo replace `sys.modules["google.genai"]` and
# leak it across the session. When this file imports ADK lazily inside
# the `_build_*` helpers below, ADK's module-load chain hits the leaked
# shim and `from google.genai.errors import ClientError` raises. The
# autouse fixture below snapshots+restores both the sys.modules entries
# and the `google` package's `.genai` attribute.

_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force real google.genai modules into sys.modules for this test.

    See `tests/unit/test_vidya_adk_runtime.py::_restore_real_google_genai`
    for the full rationale. This fixture is a near-duplicate so the
    L.2 ADK construct tests in this file pick up the real ADK chain
    even when an earlier integration test polluted the module cache.
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


class TestPromptLoading:
    def test_loads_handlebars_template(self) -> None:
        source = load_answerer_prompt()
        # Template must reference the input fields the renderer passes.
        assert "{{{question}}}" in source
        assert "language" in source.lower()
        # The untrusted-input convention markers (Wave 4 fix 3).
        assert "\u27e6" in source and "\u27e7" in source


class TestPromptRendering:
    def test_renders_with_minimal_context(self) -> None:
        prompt = render_answerer_prompt({
            "question": "What is photosynthesis?",
            "language": "en",
            "gradeLevel": None,
            "subject": None,
        })
        assert "What is photosynthesis?" in prompt
        assert "en" in prompt
        # Length sanity \u2014 the template body is substantial.
        assert len(prompt) > 800

    def test_renders_with_full_context(self) -> None:
        prompt = render_answerer_prompt({
            "question": "Explain Newton's third law",
            "language": "hi",
            "gradeLevel": "Class 9",
            "subject": "Science",
        })
        assert "Newton's third law" in prompt
        assert "hi" in prompt
        assert "Class 9" in prompt
        assert "Science" in prompt

    def test_renders_with_none_optional_fields(self) -> None:
        # gradeLevel / subject / language can all be None on the request \u2014
        # the renderer must not crash; the prompt still produces a valid string.
        prompt = render_answerer_prompt({
            "question": "Hello",
            "language": None,
            "gradeLevel": None,
            "subject": None,
        })
        assert "Hello" in prompt


class TestModelSelectors:
    def test_default_is_2_0_flash(self) -> None:
        # Matches Genkit baseline for speed parity.
        assert get_answerer_model() == "gemini-2.0-flash"

    def test_env_override(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        # Clear lru_cache by re-importing in a scoped way.
        get_answerer_model.cache_clear()
        monkeypatch.setenv(
            "SAHAYAKAI_INSTANT_ANSWER_MODEL", "gemini-2.5-flash"
        )
        assert get_answerer_model() == "gemini-2.5-flash"
        # Reset the cache after the override so other tests get the
        # default again.
        get_answerer_model.cache_clear()


# ---- Phase L.2: ADK construct factories ----------------------------------


def _build_agent() -> object:
    """Re-import + call `build_instant_answer_agent`.

    Same drop-and-reimport dance as `tests/unit/test_vidya_adk_runtime`.
    The autouse fixture above already restored the real google.genai
    chain; this helper drops the cached SUT module so re-import picks
    up the freshly-restored ADK.
    """
    sys.modules.pop("sahayakai_agents.agents.instant_answer.agent", None)
    from sahayakai_agents.agents.instant_answer.agent import (  # noqa: PLC0415
        build_instant_answer_agent,
    )
    return build_instant_answer_agent()


def _build_tool() -> object:
    sys.modules.pop("sahayakai_agents.agents.instant_answer.agent", None)
    from sahayakai_agents.agents.instant_answer.agent import (  # noqa: PLC0415
        build_answerer_tool,
    )
    return build_answerer_tool()


class TestBuildInstantAnswerAgent:
    def test_returns_llm_agent(self) -> None:
        """The factory builds a real `google.adk.agents.LlmAgent`,
        not a hand-rolled callable. This is what makes the agent
        registerable on a supervising agent's `tools=[]` (via the
        AgentTool wrapper) or `sub_agents=[]` directly."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build_agent()
        assert isinstance(agent, LlmAgent), (
            "build_instant_answer_agent must return "
            "google.adk.agents.LlmAgent. "
            f"Got: {type(agent).__name__}"
        )

    def test_uses_answerer_model(self) -> None:
        """The agent's model matches the env-overridable selector,
        same pattern as VIDYA's L.1 supervisor builder."""
        agent = _build_agent()
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string. "
            f"Got: {type(agent.model).__name__}"
        )
        assert agent.model == get_answerer_model(), (
            f"agent.model={agent.model!r} drifted from "
            f"get_answerer_model()={get_answerer_model()!r}"
        )

    def test_output_schema_is_instant_answer_core(self) -> None:
        """Pinning `output_schema=InstantAnswerCore` is critical: ADK
        threads it into Gemini's `response_schema` so the model emits
        structured JSON the router parses without a free-text step."""
        from sahayakai_agents.agents.instant_answer.schemas import (  # noqa: PLC0415
            InstantAnswerCore,
        )

        agent = _build_agent()
        assert agent.output_schema is InstantAnswerCore, (
            f"agent.output_schema must be InstantAnswerCore. "
            f"Got: {agent.output_schema}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`,
        which is what makes the AgentTool wrapper safe to memoize too."""
        first = _build_agent()
        from sahayakai_agents.agents.instant_answer.agent import (  # noqa: PLC0415
            build_instant_answer_agent,
        )
        second = build_instant_answer_agent()
        assert first is second, (
            "build_instant_answer_agent must cache its result so the "
            "agent template is constructed once per process."
        )

    def test_has_description(self) -> None:
        """The agent's `description` is what becomes the AgentTool's
        description (see ADK 1.31 `AgentTool.__init__` — no separate
        description kwarg accepted). A blank description would surface
        as an empty function-tool description in the supervisor's
        Gemini schema, hurting tool-selection quality."""
        agent = _build_agent()
        assert agent.description, (
            "build_instant_answer_agent must set a non-empty "
            "description so the AgentTool wrapper has something to "
            "show the supervising LLM."
        )


class TestBuildAnswererTool:
    def test_returns_agent_tool(self) -> None:
        """The factory wraps the LlmAgent as a real ADK `AgentTool`."""
        from google.adk.tools import AgentTool  # noqa: PLC0415

        tool = _build_tool()
        assert isinstance(tool, AgentTool), (
            "build_answerer_tool must return google.adk.tools.AgentTool. "
            f"Got: {type(tool).__name__}"
        )

    def test_tool_name_is_function_safe(self) -> None:
        """The tool's name must match the underlying agent's name (ADK
        copies it through), AND it must be a valid Python identifier
        because ADK 1.31's Pydantic validator on `LlmAgent.name`
        enforces this — and because the AgentTool's name flows into
        Gemini's automatic-function-call schema, where hyphens are
        rejected. We standardise on `instant_answer` (snake_case);
        the FastAPI URL stays hyphenated separately."""
        tool = _build_tool()
        # Sanity check: tool exposes both name + description.
        assert tool.name, "AgentTool must have a name"
        assert tool.description, "AgentTool must have a description"
        assert tool.name == "instant_answer", (
            f"Drift: AgentTool.name = {tool.name!r}; expected "
            f"'instant_answer' (snake_case identifier matching the "
            f"LlmAgent.name; ADK + Gemini both reject hyphens)."
        )
        # Belt + suspenders: assert the name is a valid Python
        # identifier, the same constraint ADK's validator enforces.
        assert tool.name.isidentifier(), (
            f"AgentTool.name {tool.name!r} must be a Python identifier "
            f"so Gemini's automatic-function-call surface accepts it."
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same AgentTool instance. The wrapper is
        cached so repeated imports from supervising modules don't
        reconstruct the AgentTool (and the underlying LlmAgent) on
        every request."""
        first = _build_tool()
        from sahayakai_agents.agents.instant_answer.agent import (  # noqa: PLC0415
            build_answerer_tool,
        )
        second = build_answerer_tool()
        assert first is second, (
            "build_answerer_tool must cache its result so supervising "
            "agents that import it lazily don't re-wrap on every call."
        )

    def test_tool_wraps_the_built_agent(self) -> None:
        """Sanity: the tool's `agent` attribute is the same instance
        the underlying factory returns. This is what lets a
        supervisor's tool-call dispatch route through to the cached
        agent template (and from there into Runner.run_async)."""
        sys.modules.pop("sahayakai_agents.agents.instant_answer.agent", None)
        from sahayakai_agents.agents.instant_answer.agent import (  # noqa: PLC0415
            build_answerer_tool,
            build_instant_answer_agent,
        )

        tool = build_answerer_tool()
        agent = build_instant_answer_agent()
        assert tool.agent is agent, (
            "AgentTool.agent must point at the same cached LlmAgent "
            "instance the factory returns."
        )
