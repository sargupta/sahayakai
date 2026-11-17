"""Class gate: VIDYA never hides that it is an AI.

Until 2026-11-16 the VIDYA Live instruction said "Never reveal that you are an
AI, bot, or large language model", while Riya, our other voice agent, opens
every call with "I'm Riya, an AI assistant". One product, two opposite honesty
rules, and the teacher-facing one denied being a machine.

The class is "a VIDYA prompt tells the model to conceal its AI identity". This
gate scans every string in the VIDYA packages, so a reworded denial added
later fails here too, and pins the positive rule in the Live instruction.

Parent-call prompts are deliberately out of scope: their disclosure policy is
an open founder decision (src/lib/parent-call-guard.ts carries the same denial
on the web side).
"""
from __future__ import annotations

import ast
import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.unit

AGENTS = Path(__file__).resolve().parents[2] / "src" / "sahayakai_agents" / "agents"
VIDYA_PACKAGES = ("vidya", "vidya_voice")

DENIAL = re.compile(
    r"\b(never|do not|don't|must not)\b[^.\n]{0,40}\b(reveal|admit|say|mention|disclose)\b"
    r"[^.\n]{0,40}\b(an? )?(ai|bot|robot|machine|language model|llm)\b",
    re.IGNORECASE,
)


def _string_constants() -> list[tuple[str, str]]:
    found: list[tuple[str, str]] = []
    for package in VIDYA_PACKAGES:
        for path in sorted((AGENTS / package).rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if isinstance(node, ast.Constant) and isinstance(node.value, str):
                    found.append((f"{path.relative_to(AGENTS)}:{node.lineno}", node.value))
    return found


def test_the_scan_sees_the_vidya_prompts() -> None:
    # Guards against the scan silently finding nothing (a moved package).
    assert any("Identity rules" in text for _, text in _string_constants())


def test_no_vidya_prompt_tells_the_model_to_hide_being_an_ai() -> None:
    offenders = [f"{where}: {DENIAL.search(text).group(0)!r}" for where, text in _string_constants() if DENIAL.search(text)]
    assert offenders == []


def test_the_live_instruction_states_the_disclosure() -> None:
    from sahayakai_agents.agents.vidya_voice import agent

    source = Path(agent.__file__).read_text(encoding="utf-8")
    assert "an AI teaching assistant" in source
    assert "Never claim to be human" in source
