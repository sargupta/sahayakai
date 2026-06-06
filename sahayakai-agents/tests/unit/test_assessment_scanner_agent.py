"""Unit-coverage tests for `assessment_scanner.agent`.

Covers gaps surfaced by Q2-B coverage audit (lane-F): prompt loaders,
model selectors, subject-rubric lookup, confidence helpers, and
`letter_grade_for` boundaries.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from sahayakai_agents.agents.assessment_scanner import agent as sut
from sahayakai_agents.agents.assessment_scanner.schemas import (
    SubjectRubricFamily,
)

pytestmark = pytest.mark.unit


def _clear_caches() -> None:
    sut._compiled.cache_clear()
    sut.get_pass1_model.cache_clear()
    sut.get_pass2_model.cache_clear()


def test_load_pass1_prompt_returns_handlebars_text() -> None:
    _clear_caches()
    text = sut.load_pass1_prompt()
    assert isinstance(text, str) and text
    # Native Script Mandate or task framing should be present.
    assert "{{" in text  # handlebars markers


def test_load_pass2_prompt_returns_handlebars_text() -> None:
    _clear_caches()
    text = sut.load_pass2_prompt()
    assert isinstance(text, str) and text


def test_load_prompt_missing_raises_filenotfounderror(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    _clear_caches()
    with pytest.raises(FileNotFoundError) as ei:
        sut.load_pass1_prompt()
    assert "assessment-scanner" in str(ei.value)


def test_resolve_prompts_dir_uses_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    resolved = sut._resolve_prompts_dir()
    assert resolved == tmp_path / "assessment-scanner"


def test_resolve_prompts_dir_falls_back_to_repo(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("SAHAYAKAI_PROMPTS_DIR", raising=False)
    resolved = sut._resolve_prompts_dir()
    assert resolved.name == "assessment-scanner"


def test_compiled_rejects_unknown_template() -> None:
    _clear_caches()
    with pytest.raises(ValueError, match="Unknown"):
        sut._compiled("bogus")


def test_render_pass1_prompt_substitutes_context() -> None:
    _clear_caches()
    # Loose context — handlebars tolerates missing vars (renders empty).
    out = sut.render_pass1_prompt({"pageIndex": 1, "totalPages": 1})
    assert isinstance(out, str)


def test_render_pass2_prompt_substitutes_context() -> None:
    _clear_caches()
    out = sut.render_pass2_prompt({"pageResults": []})
    assert isinstance(out, str)


def test_get_pass1_model_uses_env_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_ASSESSMENT_PASS1_MODEL", "gemini-test-1")
    _clear_caches()
    assert sut.get_pass1_model() == "gemini-test-1"


def test_get_pass1_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_ASSESSMENT_PASS1_MODEL", raising=False)
    _clear_caches()
    assert sut.get_pass1_model().startswith("gemini-")


def test_get_pass2_model_uses_env_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_ASSESSMENT_PASS2_MODEL", "gemini-test-2")
    _clear_caches()
    assert sut.get_pass2_model() == "gemini-test-2"


def test_get_pass2_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_ASSESSMENT_PASS2_MODEL", raising=False)
    _clear_caches()
    assert sut.get_pass2_model().startswith("gemini-")


@pytest.mark.parametrize(
    "family",
    [
        "mathematics", "science", "evs", "social_science",
        "language", "other",
    ],
)
def test_rubric_for_each_family_returns_text(
    family: SubjectRubricFamily,
) -> None:
    text = sut.rubric_for(family)
    assert isinstance(text, str) and len(text) > 100


def test_confidence_guidance_math_branch() -> None:
    g = sut.confidence_guidance_for("mathematics")
    assert g == sut.MATH_CONFIDENCE_GUIDANCE


def test_confidence_guidance_non_math_branch() -> None:
    g = sut.confidence_guidance_for("science")
    assert g == sut.NON_MATH_CONFIDENCE_GUIDANCE


@pytest.mark.parametrize(
    "pct,grade",
    [
        (100.0, "A+"),
        (90.0, "A+"),
        (89.99, "A"),
        (80.0, "A"),
        (79.0, "B"),
        (65.0, "B"),
        (64.99, "C"),
        (50.0, "C"),
        (49.0, "D"),
        (35.0, "D"),
        (34.99, "E"),
        (0.0, "E"),
    ],
)
def test_letter_grade_for_boundaries(pct: float, grade: str) -> None:
    assert sut.letter_grade_for(pct) == grade


def test_subject_rubrics_dict_has_all_families() -> None:
    keys = set(sut.SUBJECT_RUBRICS.keys())
    assert keys == {
        "mathematics", "science", "evs", "social_science",
        "language", "other",
    }
