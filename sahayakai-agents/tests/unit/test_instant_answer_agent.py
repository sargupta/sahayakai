"""Unit tests for the instant-answer agent helpers (Phase B §B.2).

Pure functions only \u2014 no Gemini calls. Tests prompt rendering and
model selectors.
"""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.instant_answer.agent import (
    get_answerer_model,
    load_answerer_prompt,
    render_answerer_prompt,
)

pytestmark = pytest.mark.unit


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
