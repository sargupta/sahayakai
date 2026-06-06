"""Unit-coverage tests for `community_persona_message.agent`."""
from __future__ import annotations

from pathlib import Path

import pytest

from sahayakai_agents.agents.community_persona_message import agent as sut

pytestmark = pytest.mark.unit


def _clear() -> None:
    sut._compile_generator_template.cache_clear()
    sut.get_generator_model.cache_clear()
    sut.build_community_persona_message_agent.cache_clear()


def test_load_generator_prompt() -> None:
    _clear()
    text = sut.load_generator_prompt()
    assert isinstance(text, str) and "{{" in text


def test_load_prompt_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    _clear()
    with pytest.raises(FileNotFoundError, match="community-persona-message"):
        sut.load_generator_prompt()


def test_resolve_prompts_dir_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    assert (
        sut._resolve_prompts_dir() == tmp_path / "community-persona-message"
    )


def test_resolve_prompts_dir_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_PROMPTS_DIR", raising=False)
    assert sut._resolve_prompts_dir().name == "community-persona-message"


def test_render_generator_prompt() -> None:
    _clear()
    out = sut.render_generator_prompt(
        {
            "personaName": "Priya",
            "personaState": "Karnataka",
            "personaSubject": "Math",
            "personaGradeLevel": "5",
            "personaVoiceTone": "warm",
            "preferredLanguage": "kn",
            "yearsExperience": 8,
            "recentBlock": "",
            "mode": "fresh",
            "modeInstruction": sut.MODE_INSTRUCTION["fresh"],
        }
    )
    assert isinstance(out, str)


def test_mode_instruction_has_all_modes() -> None:
    assert set(sut.MODE_INSTRUCTION.keys()) == {"reply", "fresh", "auto"}
    for v in sut.MODE_INSTRUCTION.values():
        assert isinstance(v, str) and v


def test_get_generator_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_COMMUNITY_PERSONA_MODEL", raising=False)
    _clear()
    assert sut.get_generator_model().startswith("gemini-")


def test_get_generator_model_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAHAYAKAI_COMMUNITY_PERSONA_MODEL", "gemini-xx")
    _clear()
    assert sut.get_generator_model() == "gemini-xx"


def test_build_community_persona_message_agent_shape() -> None:
    _clear()
    from google.adk.agents import LlmAgent

    a = sut.build_community_persona_message_agent()
    assert isinstance(a, LlmAgent)
    assert a.name == "community_persona_message_generator"
    assert a.name.isidentifier()
    # Plain-text path — no output_schema.
    assert a.output_schema is None
    assert a.sub_agents == []
    assert a.tools == []
    cfg = a.generate_content_config
    assert cfg is not None
    assert cfg.temperature == 0.85
    assert cfg.max_output_tokens == 220


def test_build_community_persona_message_agent_cached() -> None:
    _clear()
    first = sut.build_community_persona_message_agent()
    second = sut.build_community_persona_message_agent()
    assert first is second
