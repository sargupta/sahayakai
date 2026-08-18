"""`SAHAYAKAI_AGENTS_ENV` must be REQUIRED, not defaulted.

`auth.authenticate_request` short-circuits every gate — ID token, invoker
allow-list, body HMAC, App Check — when `settings.env == "development"`. When
the setting carried a `development` default, any deploy path that forgot to
export the variable served the whole sidecar unauthenticated and silently.

Making it required turns that into a `ValidationError` at `Settings()`
construction: the startup probe fails and the revision crash-loops. This test
is the tripwire — pytest must catch a reintroduced default, not production.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from sahayakai_agents.config import Settings

pytestmark = pytest.mark.unit


# `_env_file=None` pins the test to the process environment. A developer with
# a local `.env.local` would otherwise satisfy the setting from disk and the
# tripwire would pass for the wrong reason.
def _settings_without_env_file() -> Settings:
    return Settings(_env_file=None)  # type: ignore[call-arg]


class TestEnvSettingIsRequired:
    def test_missing_env_var_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """No `SAHAYAKAI_AGENTS_ENV` → refuse to construct Settings."""
        monkeypatch.delenv("SAHAYAKAI_AGENTS_ENV", raising=False)
        with pytest.raises(ValidationError) as excinfo:
            _settings_without_env_file()
        assert "SAHAYAKAI_AGENTS_ENV" in str(excinfo.value).upper()

    def test_env_var_present_constructs(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """An explicit value is honoured — the field is required, not broken."""
        monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "staging")
        assert _settings_without_env_file().env == "staging"

    def test_unknown_env_value_raises(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """A typo'd value must not silently degrade to a permissive mode."""
        monkeypatch.setenv("SAHAYAKAI_AGENTS_ENV", "prod")
        with pytest.raises(ValidationError):
            _settings_without_env_file()
