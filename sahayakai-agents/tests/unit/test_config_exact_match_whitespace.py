"""Class gate: settings compared exactly must survive Secret Manager whitespace.

On 2026-06-06 a new version of SAHAYAKAI_AGENTS_AUDIENCE was added with a
trailing newline. The web app's ID tokens carry the audience without it, so
`verify_oauth2_token` refused every call as "Token has wrong audience ...,
expected one of ['https://...run.app\\n']". All shadow and canary dispatch to
this service failed with 401 until 2026-11-16, and nothing alerted, because
every dispatcher falls back to Genkit on a sidecar error.

The class is "a value read from Secret Manager is compared byte for byte". The
gate is on every audience- or URL-like setting, so a field added later is
covered without anyone remembering this incident. The HMAC signing key is the
deliberate exception: it must stay byte-identical to the caller's copy.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.config import _EXACT_MATCH_ALIAS_SUFFIXES, Settings

pytestmark = pytest.mark.unit

URL = "https://sahayakai-agents-zwydpvyuca-as.a.run.app"


def _settings(monkeypatch: pytest.MonkeyPatch, **env: str) -> Settings:
    monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "staging")
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)  # type: ignore[call-arg]


def _exact_match_aliases() -> list[str]:
    return sorted(
        (field.alias or "").upper()
        for field in Settings.model_fields.values()
        if (field.alias or "").upper().endswith(_EXACT_MATCH_ALIAS_SUFFIXES)
    )


class TestExactMatchSettingsAreNormalised:
    def test_the_gate_covers_at_least_the_audience(self) -> None:
        # If this drops to nothing, the suffix list no longer matches the
        # fields and the gate below would pass vacuously.
        assert "SAHAYAKAI_AGENTS_AUDIENCE" in _exact_match_aliases()

    @pytest.mark.parametrize("raw", [f"{URL}\n", f"  {URL}  ", f"{URL}\r\n", f"\t{URL}"])
    def test_audience_with_surrounding_whitespace_matches_the_token(
        self, monkeypatch: pytest.MonkeyPatch, raw: str
    ) -> None:
        assert _settings(monkeypatch, SAHAYAKAI_AGENTS_AUDIENCE=raw).audience == URL

    def test_every_exact_match_setting_is_stripped(self, monkeypatch: pytest.MonkeyPatch) -> None:
        env = {alias: f" value-{i}\n" for i, alias in enumerate(_exact_match_aliases())}
        settings = _settings(monkeypatch, **env)
        for name, field in Settings.model_fields.items():
            alias = (field.alias or "").upper()
            if alias in env:
                assert getattr(settings, name) == env[alias].strip(), alias

    def test_the_signing_key_is_left_byte_identical(self, monkeypatch: pytest.MonkeyPatch) -> None:
        settings = _settings(monkeypatch, SAHAYAKAI_REQUEST_SIGNING_KEY="key-with-newline\n")
        assert settings.request_signing_key.get_secret_value() == "key-with-newline\n"
