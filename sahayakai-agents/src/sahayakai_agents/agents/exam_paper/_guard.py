"""Behavioural guard for exam-paper agent (Phase E.2)."""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_paper(
    title: str,
    instructions: list[str],
    sections: list[dict[str, Any]],
) -> str:
    parts: list[str] = [title]
    parts.extend(instructions)
    for section in sections:
        parts.append(section.get("name", ""))
        parts.append(section.get("label", ""))
        for q in section.get("questions", []) or []:
            parts.append(q.get("text", ""))
            for opt in q.get("options", []) or []:
                parts.append(opt)
            parts.append(q.get("internalChoice", "") or "")
            parts.append(q.get("answerKey", "") or "")
            parts.append(q.get("markingScheme", "") or "")
    return " ".join(p for p in parts if p)


def assert_section_marks_sum(sections: list[dict[str, Any]], max_marks: float) -> None:
    """Each section's totalMarks should sum to the paper's maxMarks
    (within a small tolerance for fractional marks like 0.5).

    Catches the model failure mode where section marks don't add up.
    """
    section_total = sum(float(s.get("totalMarks", 0)) for s in sections)
    # Allow 1-mark slack — some boards allow choice questions etc.
    assert abs(section_total - float(max_marks)) <= 1.0, (
        f"Section totalMarks sum {section_total} != paper maxMarks {max_marks} "
        f"(tolerance: 1.0)"
    )


def assert_question_marks_sum(sections: list[dict[str, Any]]) -> None:
    """Each section's questions should sum to the section's totalMarks
    (within tolerance)."""
    for section in sections:
        section_total = float(section.get("totalMarks", 0))
        question_sum = sum(
            float(q.get("marks", 0))
            for q in section.get("questions", []) or []
        )
        assert abs(question_sum - section_total) <= 1.0, (
            f"Section {section.get('name')!r} question marks sum "
            f"{question_sum} != totalMarks {section_total}"
        )


def assert_exam_paper_response_rules(
    *,
    title: str,
    general_instructions: list[str],
    sections: list[dict[str, Any]],
    max_marks: float,
    language: str,
) -> None:
    """Composite assertion. Five checks:
    - forbidden-phrase scan across every prose surface
    - script-match against the requested language
    - section totalMarks sum to paper maxMarks
    - per-section question marks sum to section totalMarks
    """
    flattened = _flatten_paper(title, general_instructions, sections)
    assert_no_forbidden_phrases(flattened)
    assert_script_matches_language(flattened, language)
    assert_section_marks_sum(sections, max_marks)
    assert_question_marks_sum(sections)


__all__ = [
    "assert_exam_paper_response_rules",
    "assert_question_marks_sum",
    "assert_section_marks_sum",
]
