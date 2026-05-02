"""Behavioural guard for teacher-training agent (Phase D.2)."""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_text(
    introduction: str,
    advice: list[dict[str, Any]],
    conclusion: str,
) -> str:
    """Concatenate every prose surface for the forbidden-phrase scan."""
    parts: list[str] = [introduction, conclusion]
    for point in advice:
        parts.append(point.get("strategy", ""))
        parts.append(point.get("pedagogy", ""))
        parts.append(point.get("explanation", ""))
    return " ".join(p for p in parts if p)


def assert_teacher_training_response_rules(
    *,
    introduction: str,
    advice: list[dict[str, Any]],
    conclusion: str,
    language: str,
) -> None:
    """Composite assertion. Two checks (descending-points etc don't
    apply here):
    - forbidden-phrase scan across all prose surfaces
    - script-match against the request's language
    """
    flattened = _flatten_text(introduction, advice, conclusion)
    assert_no_forbidden_phrases(flattened)
    assert_script_matches_language(flattened, language)


__all__ = ["assert_teacher_training_response_rules"]
