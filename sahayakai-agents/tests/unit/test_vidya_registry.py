"""Unit tests for the VIDYA sub-agent registry (Phase G)."""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.vidya.agent import ALLOWED_FLOWS
from sahayakai_agents.agents.vidya.registry import (
    INLINE_AGENTS,
    SUB_AGENTS,
    get_sub_agent,
    render_capability_index,
)

pytestmark = pytest.mark.unit


class TestRegistryShape:
    def test_sub_agents_match_allowed_flows(self) -> None:
        """Every routable AllowedFlow must have a registry entry."""
        flows = {agent.flow for agent in SUB_AGENTS}
        assert flows == set(ALLOWED_FLOWS), (
            f"Drift: registry={flows} vs ALLOWED_FLOWS={set(ALLOWED_FLOWS)}"
        )

    def test_no_dupes(self) -> None:
        flows = [agent.flow for agent in SUB_AGENTS]
        assert len(flows) == len(set(flows))

    def test_endpoints_are_relative_paths(self) -> None:
        for agent in SUB_AGENTS:
            assert agent.endpoint.startswith("/v1/"), agent

    def test_capabilities_are_short(self) -> None:
        # Capability strings live in the prompt — a 2000-word
        # capability would blow the prompt budget.
        for agent in SUB_AGENTS:
            assert 10 <= len(agent.capability) <= 300, agent

    def test_inline_agents_have_inline_capable_true(self) -> None:
        for agent in INLINE_AGENTS:
            assert agent.inline_capable is True

    def test_navigation_agents_have_inline_capable_false(self) -> None:
        for agent in SUB_AGENTS:
            assert agent.inline_capable is False


class TestRegistryLookup:
    def test_known_flow_returns_agent(self) -> None:
        agent = get_sub_agent("lesson-plan")
        assert agent is not None
        assert agent.flow == "lesson-plan"

    def test_inline_flow_returns_agent(self) -> None:
        agent = get_sub_agent("instantAnswer")
        assert agent is not None
        assert agent.inline_capable is True

    def test_unknown_flow_returns_none(self) -> None:
        assert get_sub_agent("not-a-real-flow") is None


class TestCapabilityIndexRendering:
    def test_index_has_one_line_per_agent(self) -> None:
        index = render_capability_index()
        # 9 SUB_AGENTS + 1 INLINE_AGENTS (instantAnswer) = 10 lines.
        line_count = len([ln for ln in index.splitlines() if ln.strip()])
        assert line_count == len(SUB_AGENTS) + len(INLINE_AGENTS)

    def test_index_includes_lesson_plan(self) -> None:
        index = render_capability_index()
        assert "lesson-plan" in index

    def test_index_includes_instant_answer(self) -> None:
        index = render_capability_index()
        assert "instantAnswer" in index
