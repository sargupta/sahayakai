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

import asyncio

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


class TestTranscriptIsKept:
    """A call nobody can review is a call nobody can improve.

    The Twilio path has always written `transcript` to the outreach record, and
    the rest of the app reads it. This route kept its turns in memory and dropped
    them at hangup, so a 125-second conversation — including a message the
    founder spoke specifically so it would be read back — left nothing behind.
    """

    class _B:
        def __init__(self) -> None:
            self.transcript: list[dict[str, str]] = []
            self.transcript_saved_at = 99_999  # never triggers a background flush
            self.outreach_id = "test"

    def test_records_both_sides(self) -> None:
        b = self._B()
        telephony._record_turn(b, "agent", "Namaste.")       # type: ignore[arg-type]
        telephony._record_turn(b, "parent", "Haan ji.")      # type: ignore[arg-type]
        assert [t["role"] for t in b.transcript] == ["agent", "parent"]

    def test_merges_fragments_into_readable_turns(self) -> None:
        # Transcription arrives in pieces; appending each one gives a transcript
        # of broken half-sentences that nobody can read.
        b = self._B()
        for frag in ("theek", "hai thank", "you so much"):
            telephony._record_turn(b, "parent", frag)        # type: ignore[arg-type]
        assert len(b.transcript) == 1
        assert b.transcript[0]["text"] == "theek hai thank you so much"

    def test_a_speaker_change_starts_a_new_turn(self) -> None:
        b = self._B()
        telephony._record_turn(b, "parent", "haan")          # type: ignore[arg-type]
        telephony._record_turn(b, "agent", "achha")          # type: ignore[arg-type]
        telephony._record_turn(b, "parent", "theek hai")     # type: ignore[arg-type]
        assert len(b.transcript) == 3

    def test_every_turn_is_timestamped(self) -> None:
        b = self._B()
        telephony._record_turn(b, "parent", "hello")         # type: ignore[arg-type]
        assert b.transcript[0]["timestamp"].endswith("Z")


class TestItSoundsLikeAPerson:
    """The prompt rules that separate a call a parent is glad they took from one
    they endure. Asserted because they are the first things to get edited away."""

    INSTRUCTION = None

    @classmethod
    def setup_class(cls) -> None:
        from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

        cls.INSTRUCTION = build_parent_call_instruction(
            CallContext(student_name="Aarav", language="Hindi", message="Doing well.")
        )

    def test_forbids_the_two_phrases_that_give_away_a_machine(self) -> None:
        assert "I understand your concern" in self.INSTRUCTION
        assert "thank you for sharing that" in self.INSTRUCTION

    def test_forbids_a_question_every_turn(self) -> None:
        # An interview, not a conversation.
        assert "DO NOT ask a question at the end of every turn" in self.INSTRUCTION

    def test_allows_a_short_reply(self) -> None:
        assert "four-word reply" in self.INSTRUCTION

    def test_forbids_summarising_back(self) -> None:
        assert "Do not summarise the conversation back" in self.INSTRUCTION

    def test_keeps_the_message_verbatim_rule(self) -> None:
        # Naturalness must not be allowed to erode the one thing that has to be
        # said exactly: the teacher's own words.
        assert "ESSENTIALLY AS WRITTEN" in self.INSTRUCTION

    def test_tells_the_model_the_call_is_short(self) -> None:
        assert "at most six exchanges" in self.INSTRUCTION

    def test_covers_the_missing_keypad(self) -> None:
        # There is no "press 2" on this carrier, so a spoken request to go is
        # the parent's only exit and must be obeyed at once.
        assert "NO KEYPAD ESCAPE" in self.INSTRUCTION

    def test_handles_an_answering_machine(self) -> None:
        assert "ANSWERING MACHINE" in self.INSTRUCTION


class TestIndicWordBoundaries:
    r"""`\b` cannot be used to match a whole word in an Indic script.

    Python defines `\w` by `str.isalnum()`, and Devanagari vowel signs are
    combining marks — `'ा'.isalnum()` is False — so the engine sees a word
    boundary in the MIDDLE of a word. The Marathi question word `का\b` matched
    inside `नमस्कार`, so a parent saying "namaskar" as a farewell was read as
    asking a question. The goodbye was vetoed and they stayed on the phone.

    This is a whole class of bug for an app that speaks eleven Indic languages,
    not one bad pattern.
    """

    def test_a_question_word_does_not_match_inside_another_word(self) -> None:
        import re

        from sahayakai_agents.telephony.flow import indic_word

        # The exact false positive, and the reason \b cannot be trusted here.
        assert re.search(r"का\b", "नमस्कार"), "\\b is still broken, as expected"
        assert not re.search(indic_word("का"), "नमस्कार")

    def test_it_still_matches_the_real_standalone_word(self) -> None:
        import re

        from sahayakai_agents.telephony.flow import indic_word

        for sentence in ("मी काय करू", "हे का झाले", "का"):
            if "का" in sentence.split() or sentence == "का":
                assert re.search(indic_word("का"), sentence), sentence

    def test_the_farewell_that_was_being_missed(self) -> None:
        assert is_goodbye("ठीक है। थैंक यू सो मच। नमस्कार।")
        assert is_goodbye("नमस्कार")

    def test_a_marathi_question_is_still_not_a_goodbye(self) -> None:
        assert not is_goodbye("मी काय करू?")

    def test_transliterated_english_goodbyes_are_caught(self) -> None:
        # The recogniser returns speech in the hinted script, so an English
        # goodbye on a Hindi-hinted call arrives in Devanagari.
        for said in ("थैंक यू", "थैंक्स", "ओके बाय"):
            assert is_goodbye(said), said


@pytest.mark.asyncio
class TestTheWatchdogDoesNotTalkOverTheSchool:
    """A director cue delivered mid-utterance becomes part of that utterance.

    On a live call the parent heard one 55-word block ending "...Please go
    ahead, I am listening" — the post-opener nudge's own words, welded onto the
    end of the opening because the cue fired while the model was still
    composing. Their verdict, recorded in the transcript, was "This is very
    bad."
    """

    class _B:
        def __init__(self, **kw: object) -> None:
            import asyncio as _a

            self.stop = False
            self.closing = False
            self.engaged = False
            self.outreach_id = "t"
            self.parent_said: list[str] = []
            self.recent_speech = ""
            self.out: _a.Queue = _a.Queue()
            self.model_has_spoken = False
            self.model_last_audio = 0.0
            self.last_activity = 0.0
            for k, v in kw.items():
                setattr(self, k, v)

    async def _nudges_sent(self, bridge: object, seconds: float = 1.6) -> int:
        sent: list[str] = []

        class _S:
            async def send_client_content(self, **kw: object) -> None:
                sent.append("cue")

        task = asyncio.create_task(telephony._conversation_watchdog(bridge, _S()))  # type: ignore[arg-type]
        await asyncio.sleep(seconds)
        bridge.stop = True  # type: ignore[attr-defined]
        await asyncio.wait_for(task, timeout=2)
        return len(sent)

    async def test_stays_silent_while_the_model_has_not_spoken_yet(self) -> None:
        # Composing the opening is not silence.
        bridge = self._B(last_activity=0.0, model_has_spoken=False)
        assert await self._nudges_sent(bridge) == 0

    async def test_stays_silent_while_audio_is_still_queued(self) -> None:
        bridge = self._B(last_activity=0.0, model_has_spoken=True, model_last_audio=0.0)
        bridge.out.put_nowait((0, b"\x01" * 160))
        assert await self._nudges_sent(bridge) == 0

    async def test_stays_silent_immediately_after_the_model_stops(self) -> None:
        # The parent is still hearing the last sentence through the pacer.
        import time as _t

        bridge = self._B(last_activity=0.0, model_has_spoken=True, model_last_audio=_t.monotonic())
        # Watch for less than the settle window: the point is that the cue is
        # held back while the parent is still hearing the last sentence, not
        # that it is suppressed forever.
        assert await self._nudges_sent(bridge, seconds=telephony._MODEL_SETTLE_SECONDS - 0.6) == 0

    async def test_nudges_once_the_line_is_genuinely_quiet(self) -> None:
        import time as _t

        now = _t.monotonic()
        bridge = self._B(
            last_activity=now - telephony._POST_OPENER_SILENCE - 1,
            model_has_spoken=True,
            model_last_audio=now - telephony._MODEL_SETTLE_SECONDS - 1,
        )
        assert await self._nudges_sent(bridge) >= 1


class TestDoesNotRepeatTheMessage:
    """"Haan ji, boliye" is how Indian parents answer a call, not a request.

    A probe caught the model delivering the teacher's message, hearing the
    parent say "haan ji, boliye" — go ahead — and delivering the entire message
    a second time. Repeating what someone just heard is the clearest possible
    sign that nobody is really on the line.
    """

    @staticmethod
    def _instruction() -> str:
        """The prompt with newlines flattened.

        Prompt text is hard-wrapped, so a phrase almost always spans a line
        break and a literal `in` check fails on text that is plainly present.
        """
        import re

        from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

        text = build_parent_call_instruction(
            CallContext(student_name="Aarav", language="Hindi", message="Doing well.")
        )
        return re.sub(r"\s+", " ", text)

    def test_names_the_phrases_parents_actually_use(self) -> None:
        text = self._instruction()
        for phrase in ("boliye", "bolo", "haan"):
            assert phrase in text, phrase

    def test_says_plainly_it_is_not_a_request_to_repeat(self) -> None:
        assert "NOT asking for it again" in self._instruction()

    def test_says_what_to_do_instead(self) -> None:
        # A rule that only forbids leaves the model with nothing to say.
        assert "moves the conversation on" in self._instruction()


class TestEngagementComesFromAudioNotTranscript:
    """Transcription lags speech by a second or two.

    Deciding "is anyone there" from the transcript meant the line looked silent
    while the parent was mid-sentence: on a probe the parent spoke at 7.0s and
    the post-opener nudge still fired at 9.5s, so the school told a talking
    parent "please go ahead, I am listening".
    """

    class _B:
        engaged = False
        last_activity = 0.0
        loud_frames = 0

    @staticmethod
    def _ulaw(level: int) -> bytes:
        import math
        from array import array

        from sahayakai_agents.telephony.audio import pcm16_to_ulaw

        return pcm16_to_ulaw(
            array("h", [int(level * math.sin(2 * math.pi * 200 * i / 8000)) for i in range(160)])
        )

    def test_silence_is_not_engagement(self) -> None:
        b = self._B()
        for _ in range(50):
            telephony._note_parent_audio(b, self._ulaw(0))  # type: ignore[arg-type]
        assert not b.engaged

    def test_a_voice_is_noticed_within_about_a_tenth_of_a_second(self) -> None:
        b = self._B()
        for _ in range(telephony._PARENT_SPEECH_FRAMES):
            telephony._note_parent_audio(b, self._ulaw(6000))  # type: ignore[arg-type]
        assert b.engaged
        # Five 20ms frames. Fast enough to beat the nudge, slow enough to
        # ignore a click.
        assert telephony._PARENT_SPEECH_FRAMES * 0.02 <= 0.2

    def test_an_isolated_click_is_not_a_conversation(self) -> None:
        b = self._B()
        for _ in range(telephony._PARENT_SPEECH_FRAMES - 1):
            telephony._note_parent_audio(b, self._ulaw(6000))  # type: ignore[arg-type]
        telephony._note_parent_audio(b, self._ulaw(0))  # type: ignore[arg-type]
        assert not b.engaged

    def test_it_beats_the_nudge(self) -> None:
        # Audio detection must be faster than the post-opener wait, or the
        # nudge still lands on a talking parent.
        assert telephony._PARENT_SPEECH_FRAMES * 0.02 < telephony._POST_OPENER_SILENCE


class TestTheOpeningIsSplitInTwo:
    """The message comes AFTER the parent invites it, not before.

    A parent answering a call says "haan ji, boliye" — go ahead. Delivering
    everything first leaves that invitation nowhere to land, and the model
    answers it by repeating the message. Two probes in a row showed exactly
    that, and re-stating what someone just heard is unmistakably a machine.
    """

    @staticmethod
    def _instruction() -> str:
        import re

        from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

        return re.sub(
            r"\s+",
            " ",
            build_parent_call_instruction(
                CallContext(student_name="Aarav", language="English", message="Doing well.")
            ),
        )

    def test_the_first_turn_is_a_check_not_the_message(self) -> None:
        text = self._instruction()
        assert "TWO STEPS, NOT ONE" in text
        assert "Then STOP and wait" in text

    def test_the_kickoff_cue_withholds_the_message(self) -> None:
        import re

        cue = re.sub(r"\s+", " ", KICKOFF_AFTER_OPENER)
        assert "do NOT deliver the teacher's message yet" in cue

    def test_the_message_is_still_delivered_verbatim_at_step_two(self) -> None:
        # Splitting the opening must not weaken the one rule that matters most.
        assert "ESSENTIALLY AS WRITTEN" in self._instruction()

    def test_it_forbids_inventing_a_family_name(self) -> None:
        # A probe had the school call a parent "Mr. Kumar", which nobody said.
        text = self._instruction()
        assert "NAMES YOU WERE NOT GIVEN" in text
        assert "worse than using none" in text
