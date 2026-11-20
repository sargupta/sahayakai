"""The call's state machine and the identity gate (dialogue.py), plus transcript order.

Gates the classes of defect from the 2026-10-11 handset call (Vobiz 41534a41-...):
- the teacher's message given to a caller who only said "Hello" and "What";
- "Wait" answered with a new reply each time ("Yes, please tell me." twice);
- "Repeat" refused;
- a six-utterance ceiling that counted "wait"/"what"/"repeat"/"yeah";
and from earlier calls: transcript lines filed out of order, sub-word joins.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.dialogue import (
    Action,
    DialogueState,
    Floor,
    Identity,
    Kind,
    Stage,
    classify,
)

MESSAGE = (
    "Ravi's science performance has declined recently, and he missed two homework "
    "submissions this week."
)


def _state() -> DialogueState:
    d = DialogueState(student_name="Ravi Test", school_name="Sahayak Test School", message=MESSAGE)
    d.on_identity_question_asked()
    return d


class TestClassification:
    @pytest.mark.parametrize(
        ("said", "kind"),
        [
            ("Wait", Kind.YIELD),
            ("wait wait, one minute please", Kind.YIELD),
            ("Hold on", Kind.YIELD),
            ("Stop.", Kind.YIELD),
            ("let me speak", Kind.YIELD),
            ("ek minute", Kind.YIELD),
            ("रुकिए", Kind.YIELD),
            ("Repeat", Kind.REPEAT_LAST),
            ("can you say that again?", Kind.REPEAT_LAST),
            ("repeat the message please", Kind.REPEAT_MESSAGE),
            ("dobara boliye pura message", Kind.REPEAT_MESSAGE),
            ("What?", Kind.CLARIFY),
            ("Sorry?", Kind.CLARIFY),
            ("I didn't hear that", Kind.CLARIFY),
            ("Hello", Kind.CLARIFY),
            ("yeah", Kind.ACK),
            ("okay", Kind.ACK),
            ("haan ji", Kind.ACK),
            ("Okay, thank you so much, bye.", Kind.GOODBYE),
            ("I'm driving, call me later", Kind.BUSY),
            ("please don't call me again", Kind.OPT_OUT),
            ("who is this?", Kind.WHO),
            ("What marks did he get in science?", Kind.SUBSTANTIVE),
            ("Wait, I have a question about his marks, actually.", Kind.SUBSTANTIVE),
            ("", Kind.EMPTY),
        ],
    )
    def test_kinds(self, said: str, kind: Kind) -> None:
        assert classify(said) is kind


class TestTheIdentityGate:
    """The caller must NAME the child; nothing else verifies."""

    @pytest.mark.parametrize(
        "said",
        ["Hello", "What", "What?", "Yes", "Yes, I'm the mother", "Repeat the message",
         "Wait", "Who is this?", "haan ji boliye", "", "What is his attendance?"],
    )
    def test_nothing_but_the_childs_name_unlocks(self, said: str) -> None:
        d = _state()
        decision = d.on_parent(said)
        assert not d.may_share_student_data, said
        assert decision.action is not Action.DELIVER_MESSAGE
        assert decision.action in (Action.ASK_IDENTITY, Action.YIELD_FLOOR, Action.IGNORE)

    @pytest.mark.parametrize(
        "said", ["Ravi", "His name is Ravi", "Yes, I'm Ravi's mother", "haan ji, Ravee", "रवि"]
    )
    def test_the_childs_name_verifies(self, said: str) -> None:
        d = _state()
        decision = d.on_parent(said)
        assert d.may_share_student_data, said
        assert decision.action is Action.DELIVER_MESSAGE
        assert d.stage is Stage.MESSAGE_DELIVERY

    def test_another_name_does_not(self) -> None:
        d = _state()
        assert d.on_parent("Rahul").action is Action.ASK_IDENTITY
        assert not d.may_share_student_data

    def test_a_denial_fails_closed(self) -> None:
        d = _state()
        decision = d.on_parent("No, you have the wrong number")
        assert decision.action is Action.CLOSE and decision.detail == "wrong_person"
        assert d.identity is Identity.DENIED
        assert d.on_parent("Ravi").action is not Action.DELIVER_MESSAGE
        assert not d.may_share_student_data

    def test_attempts_run_out_and_the_call_ends_safely(self) -> None:
        d = _state()
        for _ in range(d.max_identity_attempts - 1):
            assert d.on_parent("Hello").action is Action.ASK_IDENTITY
            d.on_identity_question_asked()
        decision = d.on_parent("What?")
        assert decision.action is Action.CLOSE and decision.detail == "unverified"
        assert d.identity is Identity.FAILED and d.stage is Stage.GOODBYE
        assert d.floor is Floor.HANGING_UP and not d.may_share_student_data

    def test_the_name_only_counts_after_the_question(self) -> None:
        d = DialogueState(student_name="Ravi Test")
        assert d.check_identity("Ravi") is None
        assert not d.may_share_student_data

    def test_the_re_ask_matches_what_was_said(self) -> None:
        d = _state()
        assert d.on_parent("Yes").detail == "name_please"
        assert d.on_parent("Who is this?").detail == "who"
        assert d.on_parent("Hello").detail == "retry"

    def test_verified_stages_are_unreachable_before_verification(self) -> None:
        d = _state()
        for stage in (Stage.MESSAGE_DELIVERY, Stage.PARENT_RESPONSE, Stage.TOOL_LOOKUP, Stage.FOLLOW_UP):
            assert not d.goto(stage)
        assert d.refused_transitions == 4


class TestAfterVerification:
    def _verified(self) -> DialogueState:
        d = _state()
        d.on_parent("Ravi")
        d.on_agent_turn(f"Thank you. {MESSAGE} Do you have any questions about this?", scripted=True)
        d.on_message_delivered()
        return d

    def test_wait_yields_the_floor_without_a_reply(self) -> None:
        d = self._verified()
        decision = d.on_parent("Wait", vidya_speaking=True)
        assert decision.action is Action.YIELD_FLOOR
        assert d.floor is Floor.WAITING_FOR_PARENT

    def test_repeat_after_the_message_repeats_the_message(self) -> None:
        d = self._verified()
        assert d.on_parent("Repeat").action is Action.REPEAT_MESSAGE
        assert d.on_parent("Please repeat the message").action is Action.REPEAT_MESSAGE

    def test_what_repeats_the_last_answer(self) -> None:
        d = self._verified()
        d.on_agent_turn("He was absent on the eighth.")
        assert d.on_parent("What?").action is Action.REPEAT_LAST

    def test_haan_while_speaking_resumes(self) -> None:
        d = self._verified()
        assert d.on_parent("haan", vidya_speaking=True).action is Action.RESUME

    def test_okay_after_a_statement_is_just_listening(self) -> None:
        d = self._verified()
        d.on_agent_turn("He was absent on the eighth.")
        assert d.on_parent("okay").action is Action.IGNORE

    def test_a_second_yeah_does_not_start_a_loop(self) -> None:
        d = self._verified()  # last turn ended "Do you have any questions about this?"
        assert d.on_parent("yeah").action is Action.RESPOND
        d.last_reply_was_to_ack = True
        d.on_agent_turn("Sure, what would you like to know?")
        assert d.on_parent("yeah").action is Action.IGNORE

    def test_questions_are_meaningful_exchanges(self) -> None:
        d = self._verified()
        for q in ("What marks did he get?", "How is his attendance?"):
            assert d.on_parent(q).action is Action.RESPOND
        for noise in ("wait", "what?", "repeat", "okay"):
            d.on_parent(noise)
        assert d.meaningful_exchanges == 2

    def test_goodbye_and_busy_close(self) -> None:
        assert self._verified().on_parent("Okay thank you, bye").detail == "goodbye"
        assert self._verified().on_parent("I'm busy, call later").detail == "busy"

    def test_opt_out_closes_at_any_stage(self) -> None:
        assert _state().on_parent("don't call me again").detail == "opt_out"
        assert self._verified().on_parent("stop calling me").detail == "opt_out"


class TestCues:
    def test_unverified_cue_forbids_sharing(self) -> None:
        assert "NOT verified" in _state().cue_context()

    def test_verified_cue(self) -> None:
        d = _state()
        d.on_parent("Ravi")
        d.on_message_delivered()
        ctx = d.cue_context()
        assert "verified" in ctx and "delivered" in ctx
        assert "Ravi" not in ctx  # the state line never carries child data


class TestRepeatedIntroductions:
    def test_the_first_model_intro_is_not_a_repeat(self) -> None:
        d = _state()  # the question was "asked" (Live: just before the model spoke)
        d.on_agent_turn("I'm calling from Sahayak Test School on behalf of Ms. Rao.")
        assert d.repeat_intros == 0

    def test_a_second_model_intro_is(self) -> None:
        d = _state()
        d.on_agent_turn("I'm calling from Sahayak Test School on behalf of Ms. Rao.")
        d.on_agent_turn("As I said, I'm calling from Sahayak Test School.")
        assert d.repeat_intros == 1

    def test_scripted_re_asks_are_not_repeats(self) -> None:
        d = _state()
        d.on_agent_turn("I'm calling from Sahayak Test School on behalf of Ms. Rao.", scripted=True)
        d.on_agent_turn("I'm calling from Sahayak Test School. Your child's name?", scripted=True)
        assert d.repeat_intros == 0


# ---------------------------------------------------------------------------
# Transcript order and joining, through the real pump
# ---------------------------------------------------------------------------


def _content(**kw: Any) -> SimpleNamespace:
    fields = {"interrupted": False, "turn_complete": False, "input_transcription": None,
              "output_transcription": None}
    fields.update(kw)
    return SimpleNamespace(data=None, server_content=SimpleNamespace(**fields))


def _said(text: str) -> SimpleNamespace:
    return _content(output_transcription=SimpleNamespace(text=text))


def _heard(text: str) -> SimpleNamespace:
    return _content(input_transcription=SimpleNamespace(text=text))


class _Session:
    def __init__(self, turns: list[list[Any]]) -> None:
        self.turns, self.i = turns, 0
        self.cues: list[Any] = []
        self.tool_responses: list[Any] = []

    def receive(self) -> Any:
        turn = self.turns[self.i] if self.i < len(self.turns) else []
        self.i += 1

        async def gen() -> Any:
            for m in turn:
                yield m

        return gen()

    async def send_client_content(self, **kw: Any) -> None:
        self.cues.append(kw)

    async def send_tool_response(self, **kw: Any) -> None:
        self.tool_responses.append(kw)


class _Ws:
    async def send_text(self, _t: str) -> None:
        return None


@pytest.fixture(autouse=True)
def _no_firestore(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _noop(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(telephony, "_persist_transcript", _noop)


async def _run(session: _Session) -> Any:
    b = telephony._Bridge(_Ws(), "o-dialogue", call_uuid="")  # type: ignore[arg-type]
    b.stream_id = "s"
    b.dialogue = _state()
    task = asyncio.create_task(telephony._pump_live_to_carrier(b, session))
    for _ in range(300):
        await asyncio.sleep(0)
        if session.i > len(session.turns):
            break
    b.stop = True
    await asyncio.wait_for(task, timeout=2)
    for t in list(b.background):
        t.cancel()
    return b


@pytest.mark.asyncio
class TestTranscript:
    async def test_late_parent_transcription_is_filed_before_the_reply(self) -> None:
        # The exact shape of the 2026-10-10 call: the reply's first word arrives
        # BEFORE the parent's transcription of the question it answers.
        session = _Session([
            [_said(" Would you like the teacher to call you?"), _content(turn_complete=True)],
            [_said(" I"), _heard("What is his attendance lately?"),
             _said(" don't have that right now."), _content(turn_complete=True)],
        ])
        b = await _run(session)
        texts = [(t["role"], t["text"]) for t in b.transcript]
        assert texts == [
            ("agent", "Would you like the teacher to call you?"),
            ("parent", "What is his attendance lately?"),
            ("agent", "I don't have that right now."),
        ]

    async def test_sub_word_fragments_are_joined_without_spaces(self) -> None:
        session = _Session([[
            _said(" I'm calling from Sah"), _said("ayak Test School for Ms"), _said("."),
            _said(" Test Teacher"), _content(turn_complete=True),
        ]])
        b = await _run(session)
        assert b.transcript[0]["text"] == "I'm calling from Sahayak Test School for Ms. Test Teacher"

    async def test_the_dialogue_sees_each_whole_turn(self) -> None:
        session = _Session([
            [_said(" I'm calling from Sahayak Test School."), _content(turn_complete=True)],
            [_said(" I'm calling from Sahayak Test School again."), _content(turn_complete=True)],
        ])
        b = await _run(session)
        assert b.dialogue.agent_turns == 2
        assert b.dialogue.repeat_intros == 1




@pytest.mark.asyncio
class TestTheModelForgettingEndCall:
    async def _farewell(self, monkeypatch: pytest.MonkeyPatch, *, parent_speaks: bool) -> Any:
        monkeypatch.setattr(telephony, "_FAREWELL_GRACE_SECONDS", 0.1)
        monkeypatch.setattr(telephony, "_PREBUFFER_SECONDS", 0.0)
        b = telephony._Bridge(_Ws(), "o", call_uuid="")  # type: ignore[arg-type]
        b.agent_turn_text = " My apologies, I have the wrong number. Goodbye."
        telephony._commit_agent_turn(b)
        if parent_speaks:
            import time as _t
            b.last_parent_voice_at = _t.monotonic() + 0.01
        await asyncio.sleep(0.8)
        return b

    async def test_a_spoken_goodbye_ends_the_call(self, monkeypatch: pytest.MonkeyPatch) -> None:
        b = await self._farewell(monkeypatch, parent_speaks=False)
        assert b.closing and b.stop

    async def test_the_parent_speaking_after_it_keeps_the_call(self, monkeypatch: pytest.MonkeyPatch) -> None:
        b = await self._farewell(monkeypatch, parent_speaks=True)
        assert not b.closing and not b.stop

    def test_only_a_goodbye_at_the_end_counts(self) -> None:
        assert telephony._is_agent_farewell("Thank you for your time. Goodbye!")
        assert telephony._is_agent_farewell("धन्यवाद, नमस्ते।")
        assert not telephony._is_agent_farewell("Goodbye isn't what I meant — any questions?")
        assert not telephony._is_agent_farewell("Thank you. Ms. Rao wanted you to know Ravi did well.")

