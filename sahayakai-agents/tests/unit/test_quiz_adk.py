"""Unit tests pinning the ADK construct quiz's ParallelAgent builds.

Phase L.4 — `build_quiz_agent()` returns a real
`google.adk.agents.ParallelAgent` of three difficulty-variant
`LlmAgent`s. Before this phase the router used `asyncio.gather` over
hand-rolled `_call_gemini` invocations. These tests guard against
regressing back to that hand-rolled shape AND against drift in the
per-variant `output_key` contract the router depends on.

Tests cover:
  - The factory returns a `ParallelAgent` instance (not a dict, not
    an `LlmAgent`, not a hand-rolled awaitable).
  - There are exactly 3 sub-agents (one per difficulty).
  - Each variant has a unique `output_key` matching the
    `variant_state_key(difficulty)` contract — the router reads
    these slots from session state post-Runner.

These tests must NOT exercise ADK Runner — that's covered by the
integration suite via the monkey-patched fixture. The point here is
to assert the static SHAPE of the parallel composite.
"""
from __future__ import annotations

import importlib
import sys

import pytest

pytestmark = pytest.mark.unit


# ── sys.modules hygiene ───────────────────────────────────────────────────
#
# Mirrors the pattern from `test_vidya_adk_runtime.py`: integration tests
# elsewhere in this repo replace `sys.modules["google.genai"]` with
# `SimpleNamespace` shims, which leaks across the test session and makes
# `from google.adk.agents import ParallelAgent` fail when ADK lazily
# imports `google.genai.errors.ClientError`.
#
# Fix: snapshot+restore around each test in this file. Do NOT touch the
# global conftest — other tests rely on the polluted state surviving.


_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Force the real google.genai modules into sys.modules for this test.

    See `test_vidya_adk_runtime.py` for the full rationale. Restores
    EXACT pre-test state on teardown so subsequent integration-test
    fixtures' SimpleNamespace shims aren't shadowed.
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


def _build():  # type: ignore[no-untyped-def]
    """Re-import + call the SUT factory.

    Re-import because the previous test session may have cached
    `sahayakai_agents.agents.quiz.agent` against polluted google.adk
    modules. The autouse fixture has cleaned sys.modules; importlib
    needs to reload the SUT to pick up the real ADK after restoration.

    Also clear the `lru_cache` on `build_quiz_agent` since a stale
    cached ParallelAgent built against the pre-restoration ADK would
    be invalid — its sub-agents would be from the old class hierarchy.
    """
    for key in (
        "sahayakai_agents.agents.quiz.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.quiz.agent import build_quiz_agent
    # Cache may have a stale entry from before the autouse re-import
    # cycle (this test file holds references across runs). Clear it
    # to guarantee we're testing the fresh build.
    build_quiz_agent.cache_clear()
    return build_quiz_agent()


class TestBuildQuizAgent:
    def test_build_quiz_agent_returns_parallel_agent(self) -> None:
        """The quiz composite is a real ADK `ParallelAgent`, not a
        hand-rolled `asyncio.gather` block. Phase L.4's whole point.

        Pinning the type catches accidental regression to FastAPI-only
        orchestration AND catches a drift to `SequentialAgent` (which
        would serialise the variants and triple p50 latency).
        """
        from google.adk.agents import ParallelAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, ParallelAgent), (
            "build_quiz_agent must return google.adk.agents.ParallelAgent. "
            f"Got: {type(agent).__name__}"
        )

    def test_parallel_agent_has_3_sub_agents(self) -> None:
        """Three difficulty variants — easy, medium, hard. The router
        reads exactly three slots from session state post-Runner.

        If this drifts (e.g. someone adds a 'beginner' variant), the
        router's `_DIFFICULTIES` tuple + `QuizVariantsResponse` schema
        need to drift too. Pinning the count surfaces that.
        """
        agent = _build()
        assert len(agent.sub_agents) == 3, (
            f"ParallelAgent should have 3 sub-agents (one per "
            f"difficulty). Got: {len(agent.sub_agents)}"
        )

    def test_each_variant_has_unique_output_key(self) -> None:
        """Per ADK docs, ParallelAgent sub-agents must use disjoint
        `output_key` values to prevent shared-state races. The router
        reads `session.state[variant_state_key(d)]` for each
        difficulty post-Runner — keys MUST match the
        `variant_state_key(d)` contract.

        The wrapper's inner LlmAgent is where `output_key` lives
        (the wrapper itself has no `output_key`). Drill in to verify.
        """
        from sahayakai_agents.agents.quiz.agent import (  # noqa: PLC0415
            variant_state_key,
        )

        agent = _build()
        seen: set[str] = set()
        expected = {
            variant_state_key("easy"),
            variant_state_key("medium"),
            variant_state_key("hard"),
        }
        for wrapper in agent.sub_agents:
            assert wrapper.sub_agents, (
                f"Wrapper {wrapper.name} should have one sub_agent (the "
                "inner LlmAgent that owns the output_key)."
            )
            inner = wrapper.sub_agents[0]
            assert inner.output_key, (
                f"Inner agent {inner.name} must have output_key set so "
                "ADK populates session state after the parallel run."
            )
            assert inner.output_key not in seen, (
                f"Duplicate output_key {inner.output_key!r} across "
                "variants — would cause shared-state race per ADK "
                "ParallelAgent docs."
            )
            seen.add(inner.output_key)
        assert seen == expected, (
            f"output_keys {seen} do not match the variant_state_key "
            f"contract {expected}. Router will fail to read state."
        )

    def test_variants_have_output_schema(self) -> None:
        """Each variant binds `output_schema=QuizGeneratorCore` so ADK
        runs Gemini in structured-output mode AND validates the JSON
        before writing to session state. Without this, the router
        would have to re-validate the raw text — which is exactly the
        hand-rolled path Phase L.4 replaces.
        """
        from sahayakai_agents.agents.quiz.schemas import (  # noqa: PLC0415
            QuizGeneratorCore,
        )

        agent = _build()
        for wrapper in agent.sub_agents:
            inner = wrapper.sub_agents[0]
            assert inner.output_schema is QuizGeneratorCore, (
                f"Variant {inner.name} must use QuizGeneratorCore as "
                f"output_schema. Got: {inner.output_schema}"
            )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`.

        Per-call agent state isolation lives at the router boundary
        (per-call `model_copy()` of each variant inner with a pinned
        Gemini wrapper). The cached parent ParallelAgent is shared
        across requests; mutating it would race across concurrent
        requests, which is why the cached template is read-only at
        the application level.
        """
        first = _build()
        # Don't go through `_build` for the second call — that would
        # clear the lru_cache. Use a direct import after the first
        # call has already populated the cache.
        from sahayakai_agents.agents.quiz.agent import (  # noqa: PLC0415
            build_quiz_agent,
        )
        second = build_quiz_agent()
        assert first is second, (
            "build_quiz_agent must cache its result so the parallel "
            "composite is constructed once, not per request."
        )
