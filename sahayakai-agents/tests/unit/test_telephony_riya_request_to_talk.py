"""Class gate: on the Vobiz bridge a Riya concern call is a request to talk.

Founder decision of 23 Oct 2026 and Sampark plan §2A: a concern call asks the parent to talk to
the class teacher. It never states or names the concern: not the subjects, not marks, not the
behaviour, and not even the category ("academic progress update", "classroom participation
update"), before or after the listener is verified.

The bug this catches: the web app already sent only the request line, but the bridge's own
workflow (riya_workflow.json, extracted from the hosted ElevenLabs agent) still opened with
"I'm calling about a brief academic progress update" / "a brief classroom participation update"
(played before verification by `guardian_question()` and pre-rendered by `fixed_lines()`), then
told the model to discuss low marks or "difficulty paying attention ... disturbing other students".

The gate is per purpose, not per sentence: every purpose in REQUEST_TO_TALK_PURPOSES is checked,
on every line the bridge plays or pre-renders, every line its node prompt scripts, its unlock cue
and the runtime notes, against the closed vocabularies staff can select (subjects, observations),
the concern words and the category phrases. A re-extract of the old node wording fails here.
"""

from __future__ import annotations

import re

import pytest

from sahayakai_agents.telephony import riya as R
from sahayakai_agents.telephony.riya import RiyaCall

pytestmark = pytest.mark.unit

#: What the web app sends in the request-to-talk variable (REQUEST_TO_TALK_LINES in
#: sahayakai-main/src/lib/sampark/conversation/riya-purposes.ts).
REQUEST_LINES = {
    "academic_performance": (
        "academic_update",
        "Your child's class teacher would like to speak with you about your child's studies. "
        "Is there a good time this week for a short call?",
    ),
    "classroom_behaviour": (
        "behaviour_summary",
        "Your child's class teacher would like to speak with you this week. "
        "Is there a good time for a short call?",
    ),
}

#: EXAM_SUBJECTS names (riya-purposes.ts): staff pick these for an academic concern.
SUBJECTS = (
    "English",
    "Hindi",
    "Bengali",
    "Nepali",
    "Sanskrit",
    "Mathematics",
    "Maths",
    "Science",
    "Social Science",
    "Environmental Studies",
    "Computer Science",
    "Physics",
    "Chemistry",
    "Biology",
    "History",
    "Geography",
    "Political Science",
    "Economics",
    "Accountancy",
    "Business Studies",
    "General Knowledge",
)
#: BEHAVIOUR_OBSERVATIONS (riya-purposes.ts) and the old node's own examples.
OBSERVATIONS = (
    "difficulty paying attention",
    "paying attention",
    "disturbing other students",
    "not been completing classwork",
    "taking less part in class activities",
    "arriving late to class",
)
#: The category, named: forbidden anywhere in a request-to-talk node, spoken or not.
CATEGORY_PHRASES = (
    "academic progress",
    "academic performance",
    "academic update",
    "progress update",
    "classroom participation",
    "participation update",
    "classroom behaviour",
    "classroom behavior",
    "classroom update",
    "low marks",
)
#: Words that state or frame a concern: forbidden in anything Riya is scripted to say.
CONCERN_WORDS = (
    "academic",
    "academics",
    "performance",
    "progress",
    "marks",
    "grades",
    "behaviour",
    "behavior",
    "conduct",
    "discipline",
    "participation",
    "attention",
    "disturbing",
    "concern",
    "concerns",
    "improvement",
)

BASE = {"school_name": "Hillview Demo School", "student_name": "Pema", "class_name": "Seven"}


def _whole(phrase: str) -> re.Pattern[str]:
    return re.compile(rf"\b{re.escape(phrase)}\b", re.IGNORECASE)


def _named(text: str, phrases: tuple[str, ...]) -> list[str]:
    return [p for p in phrases if _whole(p).search(text)]


def _spoken_problems(text: str) -> list[str]:
    return _named(text, CONCERN_WORDS + CATEGORY_PHRASES + SUBJECTS + OBSERVATIONS)


def _call(purpose: str) -> RiyaCall:
    var, line = REQUEST_LINES[purpose]
    return RiyaCall({**BASE, "call_purpose": purpose, var: line}, product_context="sampark")


def _scripted_lines(prompt: str) -> list[str]:
    """Every line the node prompt tells Riya to say (its double-quoted lines)."""
    return re.findall(r'"([^"]+)"', prompt)


PURPOSES = sorted(R.REQUEST_TO_TALK_PURPOSES)


def test_gate_covers_the_concern_workflows() -> None:
    # A gate that checks nothing reports green forever.
    assert set(R.REQUEST_TO_TALK_PURPOSES) == set(REQUEST_LINES)
    for purpose in PURPOSES:
        node = R.route("sampark", purpose).node_id
        assert node not in ("node_sampark_general", R.SAFE_EXIT_NODE), purpose


@pytest.mark.parametrize("purpose", PURPOSES)
def test_guardian_question_names_no_concern(purpose: str) -> None:
    """Played by the bridge before the listener is verified (router: re-ask, end_call refusal)."""
    q = _call(purpose).guardian_question()
    assert "Pema" in q and "parent or guardian" in q
    assert _spoken_problems(q) == [], q


def test_guardian_question_is_the_same_for_every_concern() -> None:
    """Before verification the listener cannot tell one concern call from another."""
    assert len({_call(p).guardian_question() for p in PURPOSES}) == 1


@pytest.mark.parametrize("purpose", PURPOSES)
def test_prerendered_lines_name_no_concern(purpose: str) -> None:
    for line in _call(purpose).fixed_lines():
        assert _spoken_problems(line) == [], line


@pytest.mark.parametrize("purpose", PURPOSES)
def test_node_scripts_no_concern_and_carries_no_example(purpose: str) -> None:
    prompt = _call(purpose).node["additional_prompt"]
    for line in _scripted_lines(prompt):
        assert _spoken_problems(line) == [], line
    # Unscripted instructions may say what never to mention, but never name the category,
    # an observation or a subject (examples are what the model repeats).
    assert _named(prompt, CATEGORY_PHRASES + SUBJECTS + OBSERVATIONS) == []


@pytest.mark.parametrize("purpose", PURPOSES)
def test_node_lets_riya_say_she_has_no_details(purpose: str) -> None:
    """Asked "what is it about?", Riya says the class teacher will explain; she is never told to
    pretend she knows ("Do not say 'I don't have information'" made the model restate the concern)."""
    prompt = _call(purpose).node["additional_prompt"]
    lines = _scripted_lines(prompt)
    assert any("class teacher will explain" in x and "don't have the details" in x for x in lines)
    assert not re.search(r"do not say \"i don'?t have", prompt, re.IGNORECASE)


@pytest.mark.parametrize("purpose", PURPOSES)
def test_unlock_cue_hands_over_only_the_request(purpose: str) -> None:
    var, line = REQUEST_LINES[purpose]
    cue = _call(purpose).unlock_cue()
    assert line in cue
    assert _spoken_problems(cue.replace(var, "")) == [], cue
    assert "exactly those words" in cue


@pytest.mark.parametrize("purpose", PURPOSES)
def test_instruction_runtime_notes_name_no_concern(purpose: str) -> None:
    text = _call(purpose).instruction()
    runtime = text.split("# Runtime notes for this phone line", 1)[1]
    assert _named(runtime, CONCERN_WORDS + CATEGORY_PHRASES) == [], runtime
    assert "request to talk" in runtime
    workflow = text.split("# Current call workflow", 1)[1].split("# Runtime notes", 1)[0]
    for scripted in _scripted_lines(workflow):
        assert _spoken_problems(scripted) == [], scripted


def test_other_purposes_get_no_request_to_talk_note() -> None:
    c = RiyaCall({**BASE, "call_purpose": "ptm_invitation"}, product_context="sampark")
    assert "request to talk" not in c.instruction().split("# Runtime notes", 1)[1]


@pytest.mark.parametrize("purpose", PURPOSES)
def test_model_never_sees_the_purpose_or_its_variable_names(purpose: str) -> None:
    """call_purpose (classroom_behaviour) and the variable names (behaviour_summary) ARE the
    category. Routing reads them; nothing the model reads may carry them (review 2026-11-15:
    the base prompt rendered "the call purpose: classroom_behaviour" from the first word)."""
    var, _line = REQUEST_LINES[purpose]
    c = _call(purpose)
    for text in (c.instruction(), c.instruction(opener_spoken=False), c.unlock_cue(), c.correction_cue("5 May")):
        assert _named(text.replace("_", " "), CATEGORY_PHRASES) == [], text
        assert purpose not in text and var not in text, text
    assert R.NEUTRAL_CALL_PURPOSE in c.instruction()


@pytest.mark.parametrize("purpose", PURPOSES)
def test_base_instruction_to_say_what_the_call_is_about_is_overridden(purpose: str) -> None:
    text = _call(purpose).instruction()
    # Base prompt §8. If that wording changes, check the override below still answers it.
    assert "say what the call is about" in text
    assert "replaces any instruction above to say what the call is about" in text


@pytest.mark.parametrize("purpose", PURPOSES)
def test_code_guard_mutes_the_category_before_verification(purpose: str) -> None:
    """The prompt is not the only guard: before verification the bridge mutes concern words."""
    from sahayakai_agents.telephony.router import _riya_protected

    c = _call(purpose)
    guard = _riya_protected(c)
    for line in (
        "Thank you, I'm calling on behalf of the class teacher about your child's behaviour in class.",
        "It is about Pema's marks.",
        "This is about your child's academic progress.",
        "It is about attendance.",
    ):
        assert guard.leaks(line), line
    assert guard.leaks(c.guardian_question()) == []
    assert guard.leaks(c.first_message()) == []
    assert guard.leaks("Would you prefer English or Hindi?") == []


def test_code_guard_adds_no_concern_words_to_other_purposes() -> None:
    from sahayakai_agents.telephony.router import _riya_protected

    c = RiyaCall({**BASE, "call_purpose": "ptm_invitation"}, product_context="sampark")
    assert _riya_protected(c).leaks("It is about attendance.") == []
