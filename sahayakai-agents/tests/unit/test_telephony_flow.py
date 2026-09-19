"""Conversation shape: when the call reacts, and when it ends.

A system instruction says how to behave; it does not say WHEN to do anything.
The first version of this route injected one turn — "the parent answered, greet
them" — and nothing after it. So if the parent said nothing VIDYA sat silent,
and if the parent said goodbye VIDYA neither closed nor hung up: the line simply
stayed open until an idle timeout killed it. From the parent's side that is a
call that starts oddly and then dies for no reason.

The riskiest piece is goodbye detection, because a false positive hangs up on a
parent mid-sentence. That is much worse than missing a goodbye and letting the
conversation run its course, and the tests are weighted accordingly.
"""

from __future__ import annotations

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.flow import (
    CLOSE,
    KICKOFF_AFTER_OPENER,
    KICKOFF_NO_OPENER,
    NO_RESPONSE_CLOSE,
    OPTOUT_CLOSE,
    POST_OPENER_NUDGE,
    SILENCE_NUDGE,
    is_goodbye,
    is_optout,
)


class TestGoodbye:
    @pytest.mark.parametrize(
        "said",
        [
            "thank you",
            "ok bye",
            "thanks, see you",
            "ধন্যবাদ",
            "আচ্ছা, রাখছি",
            "धन्यवाद, रखती हूँ",
            "ठीक है ठीक है",
            "நன்றி",
            "ధన్యవాదాలు",
            "ನಧನ್ಯವಾದ",
            "നന്ദി",
            "આભાર",
            "ਧੰਨਵਾਦ",
            "ଧନ୍ୟବାଦ",
        ],
    )
    def test_recognises_a_parent_signing_off(self, said: str) -> None:
        assert is_goodbye(said)

    @pytest.mark.parametrize(
        "said",
        [
            "Thank you, but when is the parent teacher meeting?",
            "thanks — what did he score?",
            "ধন্যবাদ, কিন্তু পরীক্ষা কখন?",
            "धन्यवाद, लेकिन फीस कब देनी है?",
            "நன்றி, தேர்வு எப்போது?",
        ],
    )
    def test_gratitude_inside_a_question_is_not_a_goodbye(self, said: str) -> None:
        # Hanging up on a parent who just asked something is the rudest thing
        # this call can do, and "thank you, but..." is how people actually talk.
        assert not is_goodbye(said)

    @pytest.mark.parametrize(
        "said",
        ["namaste", "haan boliye", "achha", "হ্যাঁ বলুন", "हाँ बताइए", "", "   "],
    )
    def test_ordinary_conversation_is_not_a_goodbye(self, said: str) -> None:
        assert not is_goodbye(said)

    def test_handles_nothing_at_all(self) -> None:
        assert not is_goodbye(None)


class TestOptOut:
    @pytest.mark.parametrize(
        "said",
        [
            "please don't call me again",
            "stop calling",
            "remove my number",
            "फोन मत करो",
            "কল করবেন না",
            "ফোন করবেন না",
            "फोन करू नका",
            "விளிக்காதீங்க" if False else "போன் பண்ணாதீங்க",
        ],
    )
    def test_recognises_a_request_not_to_be_called(self, said: str) -> None:
        assert is_optout(said)

    def test_outranks_a_question_in_the_same_breath(self) -> None:
        # "Why are you calling? Don't call again" is an opt-out, even though the
        # question veto would suppress a goodbye. Consent beats curiosity.
        assert is_optout("why are you calling? don't call again")

    @pytest.mark.parametrize("said", ["call me tomorrow", "can the teacher call me?", "कल फोन करना"])
    def test_does_not_fire_on_a_request_to_be_called(self, said: str) -> None:
        # The opposite meaning. Suppressing a parent who WANTS contact would be
        # a silent, permanent failure.
        assert not is_optout(said)


class TestDirectorTurns:
    @pytest.mark.parametrize(
        "cue",
        [
            KICKOFF_AFTER_OPENER,
            KICKOFF_NO_OPENER,
            POST_OPENER_NUDGE,
            SILENCE_NUDGE,
            CLOSE,
            OPTOUT_CLOSE,
            NO_RESPONSE_CLOSE,
        ],
    )
    def test_every_cue_is_a_stage_direction_not_speech(self, cue: str) -> None:
        # The model renders these in the parent's language; if one ever leaked
        # verbatim the parent would hear an English instruction read aloud.
        assert cue.startswith("(") and cue.endswith(")")

    @pytest.mark.parametrize("cue", [POST_OPENER_NUDGE, SILENCE_NUDGE])
    def test_nudges_forbid_narrating_the_silence(self, cue: str) -> None:
        # "You haven't said anything" makes a parent feel watched, and it is the
        # tell that gives away a machine.
        assert "not mention" in cue.lower() or "do not mention" in cue.lower()

    def test_the_post_opener_cue_invites_without_repeating(self) -> None:
        # The recorded line already delivered "an important message from your
        # child's school". Re-delivering it at a parent who simply paused is how
        # a call starts to feel like a machine reading a script.
        assert "not repeat" in POST_OPENER_NUDGE
        assert "go ahead" in POST_OPENER_NUDGE

    def test_the_kickoff_after_a_recording_forbids_greeting_twice(self) -> None:
        assert "NOT greet" in KICKOFF_AFTER_OPENER

    def test_the_optout_close_does_not_argue(self) -> None:
        assert "not ask why" in OPTOUT_CLOSE and "not try to continue" in OPTOUT_CLOSE

    def test_closings_end_the_talking(self) -> None:
        for cue in (CLOSE, OPTOUT_CLOSE, NO_RESPONSE_CLOSE):
            assert "nothing further" in cue

    def test_no_cue_uses_an_assistant_or_product_name(self) -> None:
        # The shipped prompt is explicit: the caller is the SCHOOL, never a
        # named assistant. A cue that reintroduces a persona would undo that on
        # the very first turn.
        for cue in (KICKOFF_AFTER_OPENER, KICKOFF_NO_OPENER, POST_OPENER_NUDGE,
                    SILENCE_NUDGE, CLOSE, OPTOUT_CLOSE, NO_RESPONSE_CLOSE):
            for banned in ("Vidya", "Sahayak", "SahayakAI", "assistant named"):
                assert banned not in cue

    def test_the_silent_parent_is_told_the_message_landed(self) -> None:
        # They stayed quiet but they still HEARD it. Closing as though the call
        # failed would be both wrong and discouraging.
        assert "delivered" in NO_RESPONSE_CLOSE


class TestTimings:
    def test_waits_long_enough_for_a_parent_to_answer_the_greeting(self) -> None:
        # Shorter and we talk over someone drawing breath; much longer and the
        # line feels dead.
        assert 3.0 <= telephony._POST_OPENER_SILENCE <= 8.0

    def test_gives_up_rather_than_talking_at_an_empty_line(self) -> None:
        assert telephony._UNANSWERED_GIVE_UP > telephony._POST_OPENER_SILENCE

    def test_a_conversational_lull_is_longer_than_a_thinking_pause(self) -> None:
        assert telephony._CONVERSATION_SILENCE >= 6.0

    def test_stops_nudging_rather_than_nagging(self) -> None:
        assert 1 <= telephony._MAX_SILENCE_NUDGES <= 3

    def test_a_goodbye_is_allowed_to_finish_before_the_line_drops(self) -> None:
        # Cutting the line mid-goodbye is its own small rudeness, and it is what
        # makes a call feel like it crashed rather than ended.
        assert telephony._CLOSING_GRACE_SECONDS >= 5.0


class TestDetectionAcrossFragments:
    """Speech arrives in pieces, so detection must not assume whole sentences.

    Live input transcription emits fragments — "theek", "hai thank", "you so
    much" — and a phrase almost never lands inside one of them. The first
    version matched each fragment on its own and therefore never fired: a live
    test said "theek hai, thank you so much, namaskar" and the call did not
    close, because no single fragment contained a goodbye. From the parent's
    side, they said goodbye and were talked at until a timeout.
    """

    @staticmethod
    def _accumulate(fragments: list[str], tail_chars: int = telephony._SPEECH_TAIL_CHARS) -> list[str]:
        tail, seen = "", []
        for f in fragments:
            tail = f"{tail} {f}".strip()[-tail_chars:]
            seen.append(tail)
        return seen

    def test_a_goodbye_split_across_fragments_is_caught(self) -> None:
        tails = self._accumulate(["theek", "hai thank", "you so much", "namaskar"])
        assert not any(is_goodbye(f) for f in ["theek", "hai thank", ["you", "so", "much"][0]])
        assert any(is_goodbye(t) for t in tails), "a goodbye said normally would be missed"

    def test_an_optout_split_across_fragments_is_caught(self) -> None:
        tails = self._accumulate(["please", "do not", "call me again"])
        assert any(is_optout(t) for t in tails)

    def test_the_tail_is_bounded_so_an_old_goodbye_cannot_fire_later(self) -> None:
        # Without a bound, "thank you" from the opening minute would still be in
        # the buffer ten turns later and hang up on a parent mid-question.
        tails = self._accumulate(["thank you"] + ["and another thing about his homework"] * 12)
        assert not is_goodbye(tails[-1])

    def test_a_question_later_in_the_tail_still_vetoes(self) -> None:
        # "Thanks ... but when is the meeting?" must not close the call just
        # because "thanks" is still inside the window.
        tails = self._accumulate(["thanks", "but when is the", "parent teacher meeting?"])
        assert not is_goodbye(tails[-1])

    def test_the_window_is_long_enough_for_a_real_sentence(self) -> None:
        assert 80 <= telephony._SPEECH_TAIL_CHARS <= 400


class TestEndingIsGuarded:
    """The model proposes the call is over; the server decides whether it is.

    Left unchecked the model ends calls eagerly. In a live test it hung up 16
    seconds in, immediately after the parent asked "is there anything I should
    do at home?", reading their "achha, that's good to hear" as a sign-off.
    Hanging up on a parent who has just asked about their child is worse than
    staying on the line too long, so an early end is declined and the
    conversation simply continues.
    """

    class _Bridge:
        def __init__(self, turns: int, speech: str) -> None:
            # `speech` is the LATEST utterance; earlier ones are filler.
            self.parent_said = ["earlier"] * (turns - 1) + [speech] if turns else []
            self.recent_speech = " ".join(self.parent_said)

    def test_allows_ending_after_a_real_conversation(self) -> None:
        assert telephony._may_end_yet(self._Bridge(3, "theek hai, bas itna hi"))

    def test_refuses_to_end_on_a_question(self) -> None:
        for speech in (
            "is there anything I should do at home?",
            "what did he score",
            "क्या मैं घर पर कुछ कर सकता हूँ",
            "কখন পরীক্ষা",
        ):
            assert not telephony._may_end_yet(self._Bridge(5, speech))

    def test_refuses_to_end_before_it_was_a_conversation(self) -> None:
        # One "haan" is not a conversation; ending there is a delivery that
        # hangs up, which is exactly what a parent resents about robocalls.
        assert not telephony._may_end_yet(self._Bridge(1, "haan"))
        assert not telephony._may_end_yet(self._Bridge(0, ""))

    def test_allows_a_genuinely_short_call_to_end(self) -> None:
        # Live failure this encodes: the parent said "haan, boliye", heard the
        # message, said "achha, theek hai, thank you" — complete and satisfied
        # in two turns — and the guard refused to let it end, so the school kept
        # talking and THEY had to hang up.
        assert telephony._may_end_yet(self._Bridge(2, "achha theek hai, thank you"))

    def test_an_already_answered_question_does_not_block_the_goodbye(self) -> None:
        # Live failure this encodes: the parent asked something, got an answer,
        # then said goodbye — and the end was declined three times because the
        # earlier question was still inside the rolling window. A question they
        # have already had answered is not a reason to keep them on the phone.
        bridge = self._Bridge(2, "x")
        bridge.parent_said = [
            "is there anything I should do at home?",
            "theek hai, thank you so much, namaskar",
        ]
        bridge.recent_speech = " ".join(bridge.parent_said)
        bridge.parent_said.insert(0, "haan ji boliye")
        assert telephony._may_end_yet(bridge)

    def test_the_minimum_is_small_enough_not_to_trap_a_parent(self) -> None:
        # Too high and a parent who genuinely wants off the phone has to repeat
        # themselves. The opt-out path is exempt from this guard entirely.
        assert 2 <= telephony._MIN_PARENT_TURNS_BEFORE_END <= 4
