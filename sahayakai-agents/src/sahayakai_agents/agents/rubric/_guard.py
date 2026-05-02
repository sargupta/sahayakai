"""Behavioural guard for the rubric-generator agent (Phase D.1).

Rubric output is highly structured (arrays of criteria + levels).
Most validation lives in the Pydantic schema; this guard adds:

- forbidden-phrase scan on the descriptive prose (title +
  description + every level description).
- script-match against the requested language.
- structural sanity: each criterion has 4 levels by default, with
  decreasing point values 4 → 1. We accept 3-5 levels (forward-
  compat) but the points must be monotonically decreasing within
  a criterion (no "Exemplary" worth less than "Beginning").
"""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_descriptive_text(
    title: str,
    description: str,
    criteria: list[dict[str, Any]],
) -> str:
    """Concatenate every prose surface for the forbidden-phrase /
    script-match scans.

    Criteria here are passed as `dict` (model_dump-ed) rather than
    `RubricCriterion` instances so the guard stays pure-data and
    can be tested without pulling Pydantic.
    """
    parts: list[str] = [title, description]
    for criterion in criteria:
        parts.append(criterion.get("name", ""))
        parts.append(criterion.get("description", ""))
        for level in criterion.get("levels", []) or []:
            parts.append(level.get("name", ""))
            parts.append(level.get("description", ""))
    return " ".join(p for p in parts if p)


def assert_rubric_levels_descend(criteria: list[dict[str, Any]]) -> None:
    """Each criterion's levels must be ordered highest-to-lowest by
    points. Catches a model failure mode where the AI returns
    "Exemplary: 1 pt, Beginning: 4 pts" by accident.
    """
    for criterion in criteria:
        levels = criterion.get("levels", []) or []
        prev_points: int | None = None
        for level in levels:
            points = int(level.get("points", 0))
            if prev_points is not None:
                assert points < prev_points, (
                    f"Criterion {criterion.get('name')!r} levels are not "
                    f"strictly descending in points: {prev_points} → {points}"
                )
            prev_points = points


def assert_rubric_response_rules(
    *,
    title: str,
    description: str,
    criteria: list[dict[str, Any]],
    language: str,
) -> None:
    """Composite assertion. Any failure → 502.

    Three checks:
    - **forbidden phrases** — scanned across all prose surfaces.
    - **script match** — Unicode-range check on the same flattened
      prose.
    - **descending points** — each criterion's levels go highest →
      lowest.
    """
    flattened = _flatten_descriptive_text(title, description, criteria)
    assert_no_forbidden_phrases(flattened)
    assert_script_matches_language(flattened, language)
    assert_rubric_levels_descend(criteria)


__all__ = [
    "assert_rubric_levels_descend",
    "assert_rubric_response_rules",
]
