"""Dialogue state, transcript order and the identity gate.

Gates the classes of defect seen on real calls:
- a second introduction (counted, and every cue reminds the model it is done);
- the message re-delivered after "haan ji, boliye" (cues say it is delivered);
- transcript lines filed out of order — the 2026-10-10 live transcript put the
  first word of each reply at the end of the previous one ("…further? I");
- sub-word fragments joined with spaces ("Sah ayak", "Ms .");
- student data reachable before the parent has said who they are.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.dialogue import DialogueState, Identity, Phase

MESSAGE = (
    "Ravi's science performance has declined recently, and he missed two homework "
    "submissions this week."
)


def _state() -> DialogueState:
    return DialogueState(school_name="Sahayak Test School", message=MESSAGE)


class TestPhases:
    def test_the_happy_path(self) -> None:
        d = _state()
        assert d.phase is Phase.OPENING
        d.on_agent_turn("I'm calling from Sahayak Test School on behalf of Ms. Rao. Am I speaking with Ravi's parent?")
        assert d.introduced and d.phase is Phase.IDENTITY
        assert d.confirm_identity("confirmed", parent_turns=1) == (True, "confirmed")
        assert d.phase is Phase.MESSAGE
        d.on_agent_turn(
            "Ms. Rao wanted you to know Ravi's science performance has declined recently, "
            "and he missed two homework submissions this week."
        )
        assert d.message_delivered and d.phase is Phase.CONVERSATION
        d.begin_closing()
        d.on_agent_turn("Thank you for your time.")
        assert d.phase is Phase.CLOSING

    def test_a_second_introduction_is_counted(self) -> None:
        d = _state()
        d.on_agent_turn("I'm calling from Sahayak Test School on behalf of Ms. Rao.")
        d.on_agent_turn("Sorry — I'm calling from Sahayak Test School, on behalf of Ms. Rao.")
        assert d.repeat_intros == 1

    def test_a_first_turn_in_another_language_still_counts_as_the_intro(self) -> None:
        d = _state()
        d.on_agent_turn("नमस्ते, मैं स्कूल से बोल रही हूँ।")
        assert d.introduced and d.repeat_intros == 0

    def test_a_partial_mention_is_not_delivery(self) -> None:
        d = _state()
        d.on_agent_turn("It's about Ravi's science.")
        assert not d.message_delivered


class TestIdentityGate:
    def test_confirmed_needs_the_parent_to_have_spoken(self) -> None:
        d = _state()
        d.on_agent_turn("Am I speaking with Ravi's parent?")
        assert d.confirm_identity("confirmed", parent_turns=0) == (False, "parent_has_not_answered")
        assert not d.may_share_student_data

    def test_confirmed_needs_the_question_to_have_been_asked(self) -> None:
        d = _state()
        assert d.confirm_identity("confirmed", parent_turns=1)[0] is False

    def test_unsure_shares_nothing(self) -> None:
        d = _state()
        d.on_agent_turn("Am I speaking with Ravi's parent?")
        assert d.confirm_identity("unsure", parent_turns=1) == (False, "unsure")
        assert not d.may_share_student_data

    def test_wrong_person_is_sticky(self) -> None:
        d = _state()
        d.on_agent_turn("Am I speaking with Ravi's parent?")
        d.confirm_identity("wrong_person", parent_turns=1)
        assert d.identity is Identity.DENIED
        assert d.confirm_identity("confirmed", parent_turns=2) == (False, "already_denied")
        assert not d.may_share_student_data
        assert "share nothing" in d.cue_context()


class TestCues:
    def test_nothing_to_say_before_the_call_starts(self) -> None:
        assert _state().cue_context() == ""

    def test_cues_remind_the_model_what_is_done(self) -> None:
        d = _state()
        d.on_agent_turn("I'm calling from Sahayak Test School. " + MESSAGE)
        ctx = d.cue_context()
        assert "ALREADY introduced" in ctx
        assert "do not repeat it" in ctx


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
class TestIdentityTool:
    async def test_the_tool_reports_and_the_bridge_checks(self) -> None:
        from google.genai import types as genai_types  # noqa: F401 — real FunctionResponse

        b = telephony._Bridge(_Ws(), "o", call_uuid="")  # type: ignore[arg-type]
        b.dialogue = _state()
        b.dialogue.on_agent_turn("Am I speaking with Ravi's parent?")
        session = _Session([])
        call = SimpleNamespace(function_calls=[
            SimpleNamespace(id="1", name="confirm_parent_identity", args={"status": "confirmed"})
        ])
        await telephony._handle_tool_call(b, session, call)
        # The parent has not spoken: the claim is refused.
        assert session.tool_responses[-1]["function_responses"][0].response == {
            "status": "parent_has_not_answered"
        }
        b.parent_said.append("haan ji, main Ravi ki mummy")
        await telephony._handle_tool_call(b, session, call)
        assert session.tool_responses[-1]["function_responses"][0].response == {"status": "confirmed"}
        assert b.dialogue.may_share_student_data

    async def test_wrong_number_end_call_denies_identity(self) -> None:
        b = telephony._Bridge(_Ws(), "o", call_uuid="")  # type: ignore[arg-type]
        b.dialogue = _state()
        b.dialogue.on_agent_turn("Am I speaking with Ravi's parent?")
        call = SimpleNamespace(function_calls=[
            SimpleNamespace(id="1", name="end_call", args={"reason": "wrong_number"})
        ])
        await telephony._handle_tool_call(b, _Session([]), call)
        assert b.dialogue.identity is Identity.DENIED
        for t in list(b.background):
            t.cancel()

    async def test_an_unknown_tool_is_refused(self) -> None:
        b = telephony._Bridge(_Ws(), "o", call_uuid="")  # type: ignore[arg-type]
        session = _Session([])
        call = SimpleNamespace(function_calls=[
            SimpleNamespace(id="9", name="google_search", args={"q": "Ravi marks"})
        ])
        await telephony._handle_tool_call(b, session, call)
        assert session.tool_responses[-1]["function_responses"][0].response == {"error": "unknown_tool"}
