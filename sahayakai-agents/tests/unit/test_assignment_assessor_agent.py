"""Unit-coverage tests for `assignment_assessor.agent`.

Covers prompt loading, data-URI parsing, model selector,
`build_assignment_assessor_agent()` shape, and the
`validate_assessment` blank-page guard (Q2-B lane-F).
"""
from __future__ import annotations

import base64
from pathlib import Path

import pytest

from sahayakai_agents.agents.assignment_assessor import agent as sut
from sahayakai_agents.agents.assignment_assessor.schemas import (
    AssessAssignmentCore,
    PerCriterionScore,
    RubricCriterion,
    RubricLevel,
    RubricSnapshot,
)

pytestmark = pytest.mark.unit


def _clear() -> None:
    sut._compile_generator_template.cache_clear()
    sut.get_generator_model.cache_clear()
    sut.build_assignment_assessor_agent.cache_clear()


# ---- Prompt resolution + render ----------------------------------------


def test_load_generator_prompt() -> None:
    _clear()
    text = sut.load_generator_prompt()
    assert isinstance(text, str) and "{{" in text


def test_load_prompt_missing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    _clear()
    with pytest.raises(FileNotFoundError, match="assignment-assessor"):
        sut.load_generator_prompt()


def test_resolve_prompts_dir_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SAHAYAKAI_PROMPTS_DIR", str(tmp_path))
    assert sut._resolve_prompts_dir() == tmp_path / "assignment-assessor"


def test_resolve_prompts_dir_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_PROMPTS_DIR", raising=False)
    assert sut._resolve_prompts_dir().name == "assignment-assessor"


def test_render_generator_prompt_returns_string() -> None:
    _clear()
    out = sut.render_generator_prompt({"studentName": "Aarav"})
    assert isinstance(out, str)


# ---- Data URI parsing --------------------------------------------------


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def test_parse_data_uri_jpeg() -> None:
    raw = b"\xff\xd8\xff\xe0jpegbytes"
    uri = f"data:image/jpeg;base64,{_b64(raw)}"
    mime, body = sut.parse_data_uri(uri)
    assert mime == "image/jpeg"
    assert body == raw


def test_parse_data_uri_png() -> None:
    raw = b"\x89PNG\r\n\x1a\nrest"
    uri = f"data:image/png;base64,{_b64(raw)}"
    mime, body = sut.parse_data_uri(uri)
    assert mime == "image/png"
    assert body == raw


def test_parse_data_uri_webp() -> None:
    raw = b"RIFFwebpbytes"
    uri = f"data:image/webp;base64,{_b64(raw)}"
    mime, _ = sut.parse_data_uri(uri)
    assert mime == "image/webp"


def test_parse_data_uri_rejects_wrong_mime() -> None:
    raw = b"hello"
    uri = f"data:application/pdf;base64,{_b64(raw)}"
    with pytest.raises(sut.InvalidDataURIError):
        sut.parse_data_uri(uri)


def test_parse_data_uri_rejects_no_prefix() -> None:
    with pytest.raises(sut.InvalidDataURIError):
        sut.parse_data_uri("not-a-data-uri")


def test_parse_data_uri_rejects_invalid_base64() -> None:
    uri = "data:image/jpeg;base64,!!!not-base64!!!"
    with pytest.raises(sut.InvalidDataURIError, match="base64 decode failed"):
        sut.parse_data_uri(uri)


def test_parse_data_uri_rejects_empty_body() -> None:
    uri = "data:image/jpeg;base64,"
    with pytest.raises(sut.InvalidDataURIError):
        sut.parse_data_uri(uri)


# ---- Model selection ---------------------------------------------------


def test_get_generator_model_default(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SAHAYAKAI_ASSIGNMENT_ASSESSOR_MODEL", raising=False)
    _clear()
    assert sut.get_generator_model().startswith("gemini-")


def test_get_generator_model_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAHAYAKAI_ASSIGNMENT_ASSESSOR_MODEL", "gemini-x")
    _clear()
    assert sut.get_generator_model() == "gemini-x"


# ---- ADK LlmAgent shape ------------------------------------------------


def test_build_assignment_assessor_agent_shape() -> None:
    _clear()
    from google.adk.agents import LlmAgent

    a = sut.build_assignment_assessor_agent()
    assert isinstance(a, LlmAgent)
    assert a.name == "assignment_assessor"
    assert a.name.isidentifier()
    assert a.output_schema is AssessAssignmentCore
    assert a.sub_agents == []
    assert a.tools == []
    cfg = a.generate_content_config
    assert cfg is not None
    assert cfg.temperature == 0.1
    assert cfg.top_p == 0.95
    assert cfg.max_output_tokens == 8192


def test_build_assignment_assessor_agent_cached() -> None:
    _clear()
    first = sut.build_assignment_assessor_agent()
    second = sut.build_assignment_assessor_agent()
    assert first is second


# ---- validate_assessment (blank-page guard) ----------------------------


def _make_rubric() -> RubricSnapshot:
    return RubricSnapshot(
        title="T",
        description="D",
        criteria=[
            RubricCriterion(
                name="C1",
                description="d",
                levels=[
                    RubricLevel(name="L", description="d", points=1.0),
                ],
            ),
        ],
    )


def _core(
    *,
    transcript: str,
    overall: float = 0,
    points: float = 0,
    per_pts: float = 0,
    warnings: list[str] | None = None,
) -> AssessAssignmentCore:
    return AssessAssignmentCore(
        assessmentId="a1",
        rawTranscript=transcript,
        language="en",
        overallScore=overall,
        pointsEarned=points,
        pointsPossible=4,
        perCriterionScores=[
            PerCriterionScore(
                criterionName="C1",
                level="Beginning",
                points=per_pts,
                maxPoints=4,
                feedback="ok",
                confidence=0.5,
            )
        ],
        strengths=["s"],
        improvements=["i"],
        nextSteps=["n"],
        teacherNote="t",
        confidenceOverall=0.5,
        warnings=warnings or [],
        rubricSnapshot=_make_rubric(),
        createdAtIso="2026-01-01T00:00:00Z",
    )


@pytest.mark.parametrize(
    "transcript",
    ["", "   ", "[BLANK]", "—\n-\n.", "null\nnone", "\n\n"],
)
def test_validate_assessment_blank_transcript_with_scores_repairs(
    transcript: str,
) -> None:
    out = _core(transcript=transcript, overall=70, points=3, per_pts=3)
    repaired, added = sut.validate_assessment(out)
    assert "blank_transcript_hallucination_repaired" in added
    assert repaired.overallScore == 0
    assert repaired.pointsEarned == 0
    assert all(s.points == 0 for s in repaired.perCriterionScores)
    assert "page_appears_blank" in repaired.warnings
    assert repaired.confidenceOverall == 0.1


def test_validate_assessment_blank_transcript_no_scores_adds_warning() -> None:
    out = _core(transcript="", overall=0, points=0, per_pts=0)
    repaired, added = sut.validate_assessment(out)
    assert "page_appears_blank_added" in added
    assert "page_appears_blank" in repaired.warnings


def test_validate_assessment_normal_passes_through() -> None:
    out = _core(transcript="1) 24+18=42", overall=70, points=3, per_pts=3)
    repaired, added = sut.validate_assessment(out)
    assert added == []
    assert repaired is out


def test_validate_assessment_blank_with_existing_warning_no_duplicate() -> None:
    out = _core(
        transcript="",
        overall=0,
        points=0,
        per_pts=0,
        warnings=["page_appears_blank"],
    )
    repaired, added = sut.validate_assessment(out)
    assert added == []
    assert repaired is out
