"""Behavioural guard for worksheet agent (Phase D.4)."""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_text(
    title: str,
    instructions: str,
    learning_objectives: list[str],
    activities: list[dict[str, Any]],
    answer_key: list[dict[str, Any]],
) -> str:
    parts: list[str] = [title, instructions]
    parts.extend(learning_objectives)
    for activity in activities:
        parts.append(activity.get("content", ""))
        parts.append(activity.get("explanation", ""))
        parts.append(activity.get("chalkboardNote", "") or "")
    for entry in answer_key:
        parts.append(entry.get("answer", ""))
    return " ".join(p for p in parts if p)


def assert_answer_key_indices_valid(
    activities: list[dict[str, Any]],
    answer_key: list[dict[str, Any]],
) -> None:
    """Each answer-key entry must reference a valid activity index."""
    n = len(activities)
    for entry in answer_key:
        idx = entry.get("activityIndex")
        assert isinstance(idx, int) and 0 <= idx < n, (
            f"answerKey entry references activityIndex {idx} but only "
            f"{n} activities exist"
        )


def assert_worksheet_response_rules(
    *,
    title: str,
    instructions: str,
    learning_objectives: list[str],
    activities: list[dict[str, Any]],
    answer_key: list[dict[str, Any]],
    language: str,
) -> None:
    flattened = _flatten_text(
        title, instructions, learning_objectives, activities, answer_key,
    )
    assert_no_forbidden_phrases(flattened)
    assert_script_matches_language(flattened, language)
    assert_answer_key_indices_valid(activities, answer_key)


__all__ = [
    "assert_answer_key_indices_valid",
    "assert_worksheet_response_rules",
]
