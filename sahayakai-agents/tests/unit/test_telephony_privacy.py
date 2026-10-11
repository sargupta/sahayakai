"""The non-LLM privacy layer (privacy.py): name matching and the output guard.

Gates, as classes of defect:
- a stranger's word, a near-miss name or a short-name substring verifying the
  caller (a false match reads a child's record to a stranger);
- a child-specific word or number getting past the guard before verification;
- the guard blocking the call's own introduction (a child whose surname is a
  word in the school's or teacher's name got a call that never began).
"""

from __future__ import annotations

import pytest

from sahayakai_agents.telephony.flow import LINES
from sahayakai_agents.telephony.privacy import ProtectedTerms, fuzzy_name_in, norm_tokens, romanise

MESSAGE = (
    "Ravi's science performance has declined recently, and he missed two homework "
    "submissions this week. His unit test score was 11 out of 25."
)


def _terms(student: str = "Ravi Kumar", school: str = "Sahayak Test School", teacher: str = "Ms. Rao") -> ProtectedTerms:
    return ProtectedTerms.build(
        student_name=student,
        class_name="Class 5B",
        message=MESSAGE,
        extra="Science 11/25 in the unit test",
        allowed=f"{school} {teacher}",
    )


class TestNameMatching:
    @pytest.mark.parametrize(
        "said", ["Ravi", "ravi", "His name is Ravi.", "Ravee", "Raavi", "रवि", "haan ji, Ravi"]
    )
    def test_the_name_as_people_say_and_recognisers_spell_it(self, said: str) -> None:
        assert fuzzy_name_in("Ravi", said), said

    @pytest.mark.parametrize("said", ["Rahul", "Ravan", "Rajesh", "hello", "", "the river"])
    def test_other_words_do_not_match(self, said: str) -> None:
        assert not fuzzy_name_in("Ravi", said), said

    def test_short_names_must_match_exactly(self) -> None:
        assert fuzzy_name_in("Om", "Om")
        assert not fuzzy_name_in("Om", "Oh")
        assert not fuzzy_name_in("Om", "Omkar")

    def test_devanagari_is_romanised_for_comparison(self) -> None:
        assert norm_tokens(romanise("रवि")) == ["ravi"]


class TestTheGuard:
    @pytest.mark.parametrize(
        "text",
        [
            "Ravi has a message from his teacher.",
            "Kumar's teacher asked me to call.",
            "His science marks have dropped.",
            "He missed two homework submissions.",
            "He scored 11 in the test.",
            "This is about Class 5B.",
        ],
    )
    def test_child_specific_words_and_numbers_are_caught(self, text: str) -> None:
        assert _terms().leaks(text), text

    def test_every_pre_verification_line_passes(self) -> None:
        terms = _terms()
        for language in ("English", "Hindi"):
            for key in ("identity_first", "identity_retry", "identity_name_please", "identity_who",
                        "wait_prompt", "close_unverified", "close_silence", "close_wrong_person",
                        "close_opt_out", "close_busy"):
                text = LINES[language][key].format(school="Sahayak Test School", teacher="Ms. Rao", ai="")
                assert terms.leaks(text) == [], (language, key, text)

    @pytest.mark.parametrize(
        ("student", "school", "teacher"),
        [
            ("Ravi Test", "Sahayak Test School", "Ms. Rao"),  # surname in the school's name
            ("Ravi Sharma", "Sahayak Public School", "Ms. Sharma"),  # surname shared with the teacher
        ],
    )
    def test_the_introduction_is_never_blocked_by_a_shared_word(
        self, student: str, school: str, teacher: str
    ) -> None:
        terms = _terms(student, school, teacher)
        intro = LINES["English"]["identity_first"].format(school=school, teacher=teacher, ai="")
        assert terms.leaks(intro) == []
        # ...and the child's first name is still protected.
        assert terms.leaks("Ravi is here.") == ["ravi"]
