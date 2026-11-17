"""VIDYA Live start latency: credentials are resolved once, not on every tap.

Regression: every session built a new genai Client, which re-ran
`google.auth.default()` (~1.65 s measured) before the upstream Live socket could
open. The Live and API clients now share one credentials object, and
`warm_up_vidya_live` resolves it at sidecar start.
"""

from __future__ import annotations

from types import SimpleNamespace
from unittest import mock

import pytest

from sahayakai_agents.agents.vidya_voice import adk_live


@pytest.fixture(autouse=True)
def _reset_shared_creds():
    adk_live._shared_creds = None
    yield
    adk_live._shared_creds = None


def test_credentials_are_looked_up_once_across_sessions():
    creds = SimpleNamespace(refresh=mock.Mock())
    with mock.patch("google.auth.default", return_value=(creds, "p")) as default:
        assert adk_live.shared_vertex_credentials() is creds
        assert adk_live.shared_vertex_credentials() is creds
        assert adk_live.shared_vertex_credentials() is creds
    assert default.call_count == 1


def test_live_and_api_clients_reuse_the_shared_credentials():
    creds = SimpleNamespace(refresh=mock.Mock())
    seen: list[object] = []

    class FakeClient:
        vertexai = True

        def __init__(self, **kwargs):
            seen.append(kwargs.get("credentials"))

        def __getattr__(self, name):  # anything else ADK reads off the client
            return mock.MagicMock()

    with mock.patch("google.auth.default", return_value=(creds, "p")) as default, mock.patch(
        "google.genai.Client", FakeClient
    ):
        for _ in range(3):  # three taps = three sessions
            gem = adk_live._build_vertex_live_gemini(
                model="gemini-live-2.5-flash-native-audio", project="p", location="us-central1", on_connected=lambda: None
            )
            _ = gem._live_api_client
            _ = gem.api_client
    assert seen and all(c is creds for c in seen)
    assert default.call_count == 1


def test_warm_up_resolves_and_refreshes_credentials_and_never_raises():
    creds = SimpleNamespace(refresh=mock.Mock())
    with mock.patch("google.auth.default", return_value=(creds, "p")):
        adk_live.warm_up_vidya_live()
    creds.refresh.assert_called_once()
    assert adk_live._shared_creds is creds

    adk_live._shared_creds = None
    with mock.patch("google.auth.default", side_effect=RuntimeError("no ADC")):
        adk_live.warm_up_vidya_live()  # must not raise
    assert adk_live._shared_creds is None


def test_without_adc_the_client_falls_back_to_its_own_lookup():
    with mock.patch("google.auth.default", side_effect=RuntimeError("no ADC")):
        assert adk_live.shared_vertex_credentials() is None
