"""Unit tests pinning the ADK construct teacher-training builds (Phase U.alpha).

`build_teacher_training_agent()` returns a real `google.adk.agents.LlmAgent`.
Before Phase U.alpha the teacher-training router used a hand-rolled
`google.genai.Client.aio.models.generate_content` call. These tests guard
against regressing back to that hand-rolled shape.

Tests cover:
  - The factory returns an `LlmAgent` instance.
  - The model string matches `get_advisor_model()` so a future env-var
    override propagates correctly.
  - `lru_cache` semantics — calling twice returns the same instance.
  - `output_schema=TeacherTrainingCore` so ADK switches Gemini into
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


_SENTINEL: object = object()


@pytest.fixture(autouse=True)
def _restore_real_google_genai() -> None:
    """Same hygiene fixture as test_vidya_adk_runtime — see that file
    for the full rationale."""
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
    """Re-import + call the SUT factory."""
    for key in (
        "sahayakai_agents.agents.teacher_training.agent",
    ):
        sys.modules.pop(key, None)
    from sahayakai_agents.agents.teacher_training.agent import (  # noqa: PLC0415
        build_teacher_training_agent,
    )
    build_teacher_training_agent.cache_clear()
    return build_teacher_training_agent()


class TestBuildTeacherTrainingAgent:
    def test_returns_llm_agent(self) -> None:
        """The agent is a real ADK `LlmAgent`, not a hand-rolled
        FastAPI handler. Phase U.alpha's whole point."""
        from google.adk.agents import LlmAgent  # noqa: PLC0415

        agent = _build()
        assert isinstance(agent, LlmAgent), (
            "build_teacher_training_agent must return google.adk.agents."
            f"LlmAgent. Got: {type(agent).__name__}"
        )

    def test_uses_advisor_model(self) -> None:
        """The agent's model matches the env-overridable selector."""
        from sahayakai_agents.agents.teacher_training.agent import (  # noqa: PLC0415
            get_advisor_model,
        )

        agent = _build()
        expected = get_advisor_model()
        assert isinstance(agent.model, str), (
            "Cached agent template should hold a model string, not a "
            f"BaseLlm instance. Got: {type(agent.model).__name__}"
        )
        assert agent.model == expected, (
            f"agent.model={agent.model!r} drifted from "
            f"get_advisor_model()={expected!r}"
        )

    def test_caches_via_lru(self) -> None:
        """Two calls → same instance. The factory uses `lru_cache(1)`."""
        first = _build()
        from sahayakai_agents.agents.teacher_training.agent import (  # noqa: PLC0415
            build_teacher_training_agent,
        )
        second = build_teacher_training_agent()
        assert first is second, (
            "build_teacher_training_agent must cache its result so the "
            "agent is constructed once at import time, not per request."
        )

    def test_output_schema_is_teacher_training_core(self) -> None:
        """Pinning the output_schema link is critical: ADK turns this
        into Gemini's `response_schema` so the model returns structured
        JSON matching `TeacherTrainingCore`."""
        from sahayakai_agents.agents.teacher_training.schemas import (  # noqa: PLC0415
            TeacherTrainingCore,
        )

        agent = _build()
        assert agent.output_schema is TeacherTrainingCore, (
            f"agent.output_schema must be TeacherTrainingCore. "
            f"Got: {agent.output_schema}"
        )

    def test_has_python_identifier_name(self) -> None:
        """ADK 1.31's `LlmAgent.name` Pydantic validator rejects hyphens.
        Pin snake_case so a regression to `teacher-training-advisor` is
        caught at unit-test time."""
        agent = _build()
        assert agent.name, "Agent must have a name set"
        assert agent.name.isidentifier(), (
            f"agent.name={agent.name!r} must be a Python identifier "
            "(no hyphens). ADK 1.31's Pydantic validator rejects "
            "hyphens — use snake_case."
        )
        assert "teacher_training" in agent.name.lower(), (
            f"Agent name should reference teacher_training. "
            f"Got: {agent.name!r}"
        )
