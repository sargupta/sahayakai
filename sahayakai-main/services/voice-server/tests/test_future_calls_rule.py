"""CLASS GATE — the model is told never to say whether the school will call again.

Independent review of the promise screen: the screen is a backstop, so the
model must also be told the rule. Neither prompt said it: positive_feedback's
original prompt had no rule at all (it even suggests "main phir call
karunga"), and request_to_talk's only line was about a parent who refuses
calls.

The class is "a call mode whose instructions allow a promise about future
calls". The gate: every call plan, in every call language and both modes,
carries the rule ("Never say whether the school will or will not call again.
If the parent asks, say the class teacher will decide.") in that prompt's
conventions, and the positive_feedback golden changes by exactly that one
line: the honest-answer and identity lines are untouched.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from src.call_policy import LANGUAGE_CODES, plan_call

GOLDEN = Path(__file__).parent / "golden" / "positive_feedback.json"
POSITIVE_RULE = ('- FUTURE CALLS: NEVER say whether the school will or will not call again (never "ab phone nahi '
                 'karenge"). If the parent asks, say the class teacher will decide ("iska faisla class teacher '
                 'karenge").\n')
REQUEST_RULE = ("- Never say whether the school will or will not call again. If the parent asks, say the class "
                "teacher will decide.\n")
HONEST_LINE = "- ANSWER DIRECT QUESTIONS HONESTLY"
IDENTITY_LINE = "- IDENTITY: You ARE {name}. NEVER say AI, bot, assistant, model, machine."


def _record(reason, language):
    return {"reason": reason, "parentLanguage": language, "studentName": "Aarav", "teacherName": "Ms. Sharma",
            "schoolName": "Demo Public School", "generatedMessage": "Aarav did very well this week."}


@pytest.mark.parametrize("language", sorted(LANGUAGE_CODES))
def test_a_request_to_talk_call_is_told_the_rule(language):
    plan = plan_call(_record("consecutive_absences", language))
    assert plan.mode == "request_to_talk"
    assert plan.system_instruction.count(REQUEST_RULE) == 1


@pytest.mark.parametrize("language", sorted(LANGUAGE_CODES))
def test_a_positive_feedback_call_is_told_the_rule(language):
    plan = plan_call(_record("positive_feedback", language))
    assert plan.mode == "positive_feedback"
    assert plan.system_instruction.count(POSITIVE_RULE) == 1


def test_the_golden_changes_by_exactly_the_rule():
    golden = json.loads(GOLDEN.read_text(encoding="utf-8"))
    for name, scenario in golden.items():
        text = scenario["system_instruction"]
        assert text.count(POSITIVE_RULE) == 1, name
        # It sits right after the honest-answer line, which (like the identity
        # line) is unchanged.
        honest_at = text.index(HONEST_LINE)
        assert text.index(POSITIVE_RULE) == text.index("\n", honest_at) + 1, name
        assert IDENTITY_LINE.split("{name}")[0] in text and "NEVER say AI, bot, assistant, model, machine." in text
