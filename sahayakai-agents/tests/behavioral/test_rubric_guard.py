"""Behavioural tests for rubric guard (Phase D.1)."""
from __future__ import annotations

import pytest

from sahayakai_agents.agents.rubric._guard import (
    assert_rubric_levels_descend,
    assert_rubric_response_rules,
)

pytestmark = pytest.mark.behavioral


def _level_dict(name: str, points: int, description: str | None = None) -> dict:
    return {
        "name": name,
        "description": description or f"Description for {name} level performance.",
        "points": points,
    }


def _good_criteria() -> list[dict]:
    return [
        {
            "name": "Research and Content",
            "description": "Evaluates depth of research and accuracy.",
            "levels": [
                _level_dict("Exemplary", 4),
                _level_dict("Proficient", 3),
                _level_dict("Developing", 2),
                _level_dict("Beginning", 1),
            ],
        },
        {
            "name": "Presentation",
            "description": "Evaluates clarity and organisation.",
            "levels": [
                _level_dict("Exemplary", 4),
                _level_dict("Proficient", 3),
                _level_dict("Developing", 2),
                _level_dict("Beginning", 1),
            ],
        },
        {
            "name": "Originality",
            "description": "Evaluates novelty of approach and ideas.",
            "levels": [
                _level_dict("Exemplary", 4),
                _level_dict("Proficient", 3),
                _level_dict("Developing", 2),
                _level_dict("Beginning", 1),
            ],
        },
    ]


class TestLevelsDescend:
    def test_correct_descending_passes(self) -> None:
        assert_rubric_levels_descend(_good_criteria())

    def test_inverted_levels_reject(self) -> None:
        bad = [{
            "name": "Bad",
            "description": "x",
            "levels": [
                _level_dict("Beginning", 1),  # lowest first — inverted
                _level_dict("Exemplary", 4),
            ],
        }]
        with pytest.raises(AssertionError, match="not strictly descending"):
            assert_rubric_levels_descend(bad)

    def test_equal_points_reject(self) -> None:
        bad = [{
            "name": "Bad",
            "description": "x",
            "levels": [
                _level_dict("L1", 4),
                _level_dict("L2", 4),  # equal not descending
            ],
        }]
        with pytest.raises(AssertionError, match="not strictly descending"):
            assert_rubric_levels_descend(bad)


class TestRubricResponseRules:
    def test_clean_english_passes(self) -> None:
        assert_rubric_response_rules(
            title="Renewable Energy Project Rubric",
            description="Evaluates the Class 5 renewable energy project.",
            criteria=_good_criteria(),
            language="en",
        )

    def test_forbidden_phrase_in_title_rejects(self) -> None:
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_rubric_response_rules(
                title="Rubric by Sahayak AI",
                description="A standard project rubric.",
                criteria=_good_criteria(),
                language="en",
            )

    def test_forbidden_phrase_in_level_description_rejects(self) -> None:
        bad = _good_criteria()
        bad[0]["levels"][0]["description"] = (
            "I am an AI assistant evaluating this assignment fairly."
        )
        with pytest.raises(AssertionError, match="Forbidden phrase"):
            assert_rubric_response_rules(
                title="Project Rubric",
                description="Evaluates the Class 5 project.",
                criteria=bad,
                language="en",
            )

    def test_inverted_levels_rejects(self) -> None:
        bad = _good_criteria()
        # Reverse the first criterion's levels.
        bad[0]["levels"] = list(reversed(bad[0]["levels"]))
        with pytest.raises(AssertionError, match="not strictly descending"):
            assert_rubric_response_rules(
                title="Project Rubric",
                description="Evaluates the Class 5 project.",
                criteria=bad,
                language="en",
            )

    def test_unsupported_language_skips_script_check(self) -> None:
        # Unknown ISO code → script check is a no-op.
        assert_rubric_response_rules(
            title="Project Rubric",
            description="Evaluates the project.",
            criteria=_good_criteria(),
            language="zz",
        )
