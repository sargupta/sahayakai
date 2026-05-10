"""Behavioural guard for quiz agent (Phase E.1)."""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_variant(variant: dict[str, Any] | None) -> str:
    if not variant:
        return ""
    parts: list[str] = [variant.get("title", "")]
    parts.append(variant.get("teacherInstructions", "") or "")
    for q in variant.get("questions", []) or []:
        parts.append(q.get("questionText", ""))
        parts.append(q.get("correctAnswer", ""))
        parts.append(q.get("explanation", ""))
        for opt in q.get("options", []) or []:
            parts.append(opt)
    return " ".join(p for p in parts if p)


def assert_quiz_response_rules(
    *,
    easy: dict[str, Any] | None,
    medium: dict[str, Any] | None,
    hard: dict[str, Any] | None,
    language: str,
) -> None:
    """Run forbidden-phrase + script-match across each generated variant.

    Variants that are `None` (failed during generation) are skipped.
    """
    for variant in (easy, medium, hard):
        text = _flatten_variant(variant)
        if not text:
            continue
        assert_no_forbidden_phrases(text)
        assert_script_matches_language(text, language)


__all__ = ["assert_quiz_response_rules"]
