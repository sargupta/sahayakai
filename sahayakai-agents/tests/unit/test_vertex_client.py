"""Vertex AI transport branch.

The rest of the suite pins `GOOGLE_GENAI_USE_VERTEXAI=false` (see conftest)
because the integration fakes only accept `api_key=`. That leaves the Vertex
branch — which is what production actually runs — otherwise uncovered. These
tests cover it directly, without touching the network.

Guards the failure that shipped during the migration: five routers built
`genai.Client(api_key=...)` directly, so on Vertex they raised

    401 UNAUTHENTICATED — API keys are not supported by this API

while the ADK path worked fine. Every ANSWER cell in the parity harness 502'd.
"""
from __future__ import annotations

import importlib
from unittest.mock import patch

import pytest

from sahayakai_agents._adk_keyed_gemini import build_genai_client
from sahayakai_agents.config import VERTEX_SENTINEL, Settings

pytestmark = pytest.mark.unit


class TestGenaiClientTransport:
    def test_sentinel_builds_a_vertex_client_and_passes_no_key(self) -> None:
        settings = Settings(
            GOOGLE_GENAI_USE_VERTEXAI=True,
            GOOGLE_CLOUD_PROJECT="proj-x",
            GOOGLE_CLOUD_LOCATION="asia-south1",
        )
        with patch("sahayakai_agents.config.get_settings", return_value=settings), \
             patch("google.genai.Client") as mock_client:
            build_genai_client(VERTEX_SENTINEL)

        kwargs = mock_client.call_args.kwargs
        assert kwargs["vertexai"] is True
        assert kwargs["project"] == "proj-x"
        assert kwargs["location"] == "asia-south1"
        # The single most important assertion here: no key ever reaches Vertex.
        assert "api_key" not in kwargs

    def test_real_key_builds_a_keyed_client_and_sets_no_vertex_flag(self) -> None:
        with patch("google.genai.Client") as mock_client:
            build_genai_client("AIza-real-looking-key")

        kwargs = mock_client.call_args.kwargs
        assert kwargs["api_key"] == "AIza-real-looking-key"
        assert "vertexai" not in kwargs

    def test_extra_kwargs_are_forwarded_on_both_branches(self) -> None:
        settings = Settings(GOOGLE_GENAI_USE_VERTEXAI=True, GOOGLE_CLOUD_PROJECT="p")
        with patch("sahayakai_agents.config.get_settings", return_value=settings), \
             patch("google.genai.Client") as mock_client:
            build_genai_client(VERTEX_SENTINEL, http_options={"headers": {"x": "1"}})
        assert mock_client.call_args.kwargs["http_options"] == {"headers": {"x": "1"}}

        with patch("google.genai.Client") as mock_client:
            build_genai_client("k", http_options={"headers": {"x": "1"}})
        assert mock_client.call_args.kwargs["http_options"] == {"headers": {"x": "1"}}


class TestSettingsCredentialPool:
    def test_vertex_mode_yields_exactly_the_sentinel(self) -> None:
        s = Settings(GOOGLE_GENAI_USE_VERTEXAI=True, GOOGLE_GENAI_API_KEY="ignored,also-ignored")
        # Non-empty so `run_resiliently`'s empty-pool guard does not fire, and
        # length 1 so key failover degenerates to plain retry.
        assert s.genai_keys == (VERTEX_SENTINEL,)

    def test_api_key_mode_still_splits_the_pool(self) -> None:
        s = Settings(GOOGLE_GENAI_USE_VERTEXAI=False, GOOGLE_GENAI_API_KEY="a, b ,c")
        assert s.genai_keys == ("a", "b", "c")

    def test_vertex_default_is_on(self) -> None:
        """Production runs Vertex. If this flips, the free-tier quota ceiling
        comes back and the parity harness becomes unusable."""
        field = Settings.model_fields["use_vertexai"]
        assert field.default is True

    def test_prod_boot_does_not_demand_an_api_key_on_vertex(self) -> None:
        s = Settings(
            SAHAYAKAI_AGENTS_ENV="production",
            GOOGLE_GENAI_USE_VERTEXAI=True,
            GOOGLE_GENAI_API_KEY="",
            SAHAYAKAI_REQUEST_SIGNING_KEY="x" * 40,
            SAHAYAKAI_AGENTS_AUDIENCE="https://example.run.app",
            SAHAYAKAI_AGENTS_ALLOWED_INVOKERS="svc@proj.iam.gserviceaccount.com",
        )
        s.assert_prod_invariants()  # must not raise
