"""Unit tests pinning the ADK construct exam-paper builds (Phase U.γ).

`build_exam_paper_agent()` returns a real `google.adk.agents.LlmAgent`
with structured-output enabled via `output_schema=ExamPaperCore`.
Before Phase U.γ the sidecar imported `google-adk` but did not USE it
on this code path; the call was a hand-rolled
`google.genai.Client.aio.models.generate_content`. These tests guard
against regressing back to that hand-rolled shape AND against drift
on the four critical-finding axes called out in the Phase U.γ brief:

  1. `LlmAgent.name` must be a Python identifier (no hyphens).
  2. `LlmAgent.generate_content_config` rejects `response_schema` —
     structured output goes via `output_schema=...`.
  3. ADK 1.31's canonical model-swap is `clone(update={...})`.
  4. The marks-balance check is purely arithmetic; we should NOT have
     a sub-agent doing it (would waste tokens and let the model lie).
     This test pins `sub_agents == []` to catch a future regression
     that bolts on an LLM validator.

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
    """Same hygiene fixture as test_visual_aid_adk / test_quiz_adk —
    see those files for the full rationale.

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
    cached `sahayakai_agents.agents.exam_paper.agent` against polluted
    google.adk modules. The autouse fixture has already cleaned
    sys.modules, but importlib needs to reload the SUT to pick up
    the real ADK after restoration.

    Also clear the `lru_cache` on `build_exam_paper_agent` since a
    stale cached LlmAgent built against the pre-restoration ADK would
    be invalid — its class would be from the old hierarchy.
    """
    for key in (
        "sahayakai_agents.agents.exam_paper.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.exam_paper.agent import (  # noqa: PLC0415
        build_exam_paper_agent,
    )
    build_exam_paper_agent.cache_clear()
    return build_exam_paper_agent()


class TestBuildExamPaperAgent:
    def test_build_exam_paper_agent_returns_llm_agent(self) -> None:
        """The factory returns a real ADK `LlmAgent`, not a hand-rolled
        FastAPI handler. Phase U.γ's whole point.

        Pinning the type catches accidental regression to FastAPI-only
        orchestration. SequentialAgent / LoopAgent / ParallelAgent
        would also fail this assertion, which is intentional — the
        Option B brief locks us into a single LlmAgent.
        """
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_exam_paper_agent must return google.adk.agents."
            f"LlmAgent. Got: {type(agent).__name__}"
        )

    def test_agent_name_is_python_identifier(self) -> None:
        """Phase U critical finding #1: LlmAgent.name must be a Python
        identifier — no hyphens. ADK 1.31 enforces this via Pydantic
        validation; drift to a hyphenated name (the FastAPI route
        prefix is `/v1/exam-paper`) would crash at agent build time.
        """
        agent = _build()
        assert agent.name == "exam_paper_generator", (
            f"agent.name must be a snake_case Python identifier. "
            f"Got: {agent.name!r}"
        )
        assert agent.name.isidentifier(), (
            f"agent.name {agent.name!r} is not a valid Python identifier "
            "(ADK 1.31 Pydantic rejects hyphenated names)."
        )

    def test_agent_uses_generator_model(self) -> None:
        """Cached template's `.model` matches `get_generator_model()`.
        The router swaps it to a per-call keyed `Gemini` instance just
        before Runner.run_async — drift here would feed the wrong
        model name to `build_keyed_gemini`."""
        from sahayakai_agents.agents.exam_paper.agent import (  # noqa: PLC0415
            get_generator_model,
        )

        agent = _build()
        expected = get_generator_model()
        assert isinstance(agent.model, str)
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_generator_model()={expected!r}"
        )

    def test_agent_output_schema_is_exam_paper_core(self) -> None:
        """Phase U critical finding #2: structured output goes via
        `output_schema=ExamPaperCore` on the agent itself, NOT via
        `response_schema` inside `generate_content_config`. ADK
        forwards the agent-level `output_schema` as `response_schema`
        on the underlying GenerateContentConfig. Drift here would
        silently return free-text the router can't parse.
        """
        from sahayakai_agents.agents.exam_paper.schemas import (  # noqa: PLC0415
            ExamPaperCore,
        )

        agent = _build()
        assert agent.output_schema is ExamPaperCore, (
            f"agent.output_schema must be ExamPaperCore. "
            f"Got: {agent.output_schema}"
        )

    def test_generate_content_config_does_not_set_response_schema(
        self,
    ) -> None:
        """Phase U critical finding #2 (negative): the agent must NOT
        set `response_schema` on its `generate_content_config` — that
        field belongs at the agent level (`output_schema`), and ADK
        would raise on construction if both were set together. Pin
        the absence so a future change that copies the lesson_plan
        per-stage `_call_gemini_structured` pattern doesn't accidentally
        set both.
        """
        agent = _build()
        cfg = agent.generate_content_config
        # cfg may be None if no temperature/etc. is set; either way
        # it must not carry response_schema.
        if cfg is not None:
            assert getattr(cfg, "response_schema", None) is None, (
                "generate_content_config.response_schema must be None — "
                "structured output is set via the agent's output_schema "
                "field, not via the config. ADK forwards output_schema "
                "as response_schema on the underlying config."
            )

    def test_no_sub_agents_or_tools(self) -> None:
        """Phase U.γ is Option B: single LlmAgent, no sub-agents, no
        tools. Marks-balance + behavioural guard are pure-Python in
        the router. A future regression that bolts on a SequentialAgent
        of writer + LLM-validator would waste tokens AND let the
        model lie about its own arithmetic. Pin the shape.
        """
        agent = _build()
        assert agent.sub_agents == [], (
            f"agent.sub_agents must be empty (Option B = single LlmAgent). "
            f"Got: {agent.sub_agents}"
        )
        assert agent.tools == [], (
            f"agent.tools must be empty (no grounding, no AgentTools). "
            f"Got: {agent.tools}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`.

        Mutating one would mutate the other; the router's per-call
        `clone()` is what isolates per-request state.
        """
        first = _build()
        # Don't go through `_build` for the second call — that would
        # clear the lru_cache. Use a direct import after the first
        # call has already populated the cache.
        from sahayakai_agents.agents.exam_paper.agent import (  # noqa: PLC0415
            build_exam_paper_agent,
        )
        second = build_exam_paper_agent()
        assert first is second, (
            "build_exam_paper_agent must cache its result so the agent "
            "is constructed once at import time, not per request."
        )
