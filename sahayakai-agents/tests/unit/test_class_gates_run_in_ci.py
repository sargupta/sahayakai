"""Class gate: every class-gate test file is one CI actually runs.

ci-agents.yml runs `pytest -m "unit or integration or behavioral"`, so a test file without one of
those markers is deselected on every pull request and its gate is green forever. The bug this
catches: test_extract_riya_workflow_no_provider_ids.py shipped as the class gate for the workflow
extractor without a marker and never ran in CI (review 2026-11-16). Any file that calls itself a
class gate must carry a module-level `pytestmark` (or mark every test) with a CI-selected marker.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

TESTS = Path(__file__).resolve().parents[1]
CI_MARKERS = ("unit", "integration", "behavioral")
DECLARES_GATE = re.compile(r"class gate", re.IGNORECASE)
MARKERS = "|".join(CI_MARKERS)
MODULE_MARK = re.compile(rf"^pytestmark\s*=\s*(?:\[[^\]]*)?pytest\.mark\.({MARKERS})\b", re.MULTILINE)
TEST_DEF = re.compile(r"^(?:async\s+)?def\s+test_", re.MULTILINE)
DECORATED = re.compile(rf"^@pytest\.mark\.({MARKERS})\b\s*\n(?:@.*\n)*(?:async\s+)?def\s+test_", re.MULTILINE)


def gate_files() -> list[Path]:
    return sorted(p for p in TESTS.rglob("test_*.py") if DECLARES_GATE.search(p.read_text(encoding="utf-8")))


def runs_in_ci(text: str) -> bool:
    if MODULE_MARK.search(text):
        return True
    tests = len(TEST_DEF.findall(text))
    return tests > 0 and len(DECORATED.findall(text)) == tests


def test_finds_class_gate_files_at_all() -> None:
    names = {p.name for p in gate_files()}
    assert "test_telephony_riya_request_to_talk.py" in names
    assert "test_extract_riya_workflow_no_provider_ids.py" in names


def test_recognises_an_unmarked_gate() -> None:
    assert not runs_in_ci('"""Class gate: x."""\nimport pytest\n\ndef test_a():\n    pass\n')
    assert runs_in_ci('"""Class gate: x."""\nimport pytest\npytestmark = pytest.mark.unit\n\ndef test_a():\n    pass\n')
    assert runs_in_ci('"""Class gate."""\nimport pytest\n\n@pytest.mark.unit\ndef test_a():\n    pass\n')


def test_every_class_gate_file_runs_in_ci() -> None:
    unmarked = [str(p.relative_to(TESTS)) for p in gate_files() if not runs_in_ci(p.read_text(encoding="utf-8"))]
    assert unmarked == []
