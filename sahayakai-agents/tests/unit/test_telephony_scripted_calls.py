"""Scripted calls, end to end through the bridge's own loops.

Each scenario replays what Gemini Live sends (transcriptions, audio, tool
calls, turn ends) and checks what the BRIDGE does with it: the transcript a
teacher will read, whether the call is allowed to end, which cues are sent,
what the lookups return. The model's wording is not under test here — that is
`scripts/telephony_conversation_eval.py`, against the real model.

Scenarios: a normal question, a correction, a topic change, code-mixed speech,
a long pause, repeated interruptions, unavailable information and a graceful
close.
"""

from __future__ import annotations

import asyncio
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.dialogue import DialogueState
from sahayakai_agents.telephony.school_data import CallScope, SchoolDataTools

MESSAGE = "Ravi missed two homework submissions this week and his science marks dropped."


def _c(**kw: Any) -> SimpleNamespace:
    f = {"interrupted": False, "turn_complete": False, "input_transcription": None,
         "output_transcription": None}
    f.update(kw)
    return SimpleNamespace(data=None, server_content=SimpleNamespace(**f), tool_call=None)


def agent(text: str) -> list[SimpleNamespace]:
    return [_c(output_transcription=SimpleNamespace(text=f" {text}")),
            SimpleNamespace(data=b"\x10\x00" * 480, server_content=None, tool_call=None),
            _c(turn_complete=True)]


def parent(text: str) -> SimpleNamespace:
    return _c(input_transcription=SimpleNamespace(text=text))


def tool(name: str, call_id: str, **args: Any) -> SimpleNamespace:
    return SimpleNamespace(
        data=None, server_content=None,
        tool_call=SimpleNamespace(function_calls=[SimpleNamespace(id=call_id, name=name, args=args)]),
    )


def interrupted() -> SimpleNamespace:
    return _c(interrupted=True)


class _Reader:
    def class_teacher(self, _c: str) -> str:
        return "t1"

    def student_exists(self, _c: str, _s: str) -> bool:
        return True

    def attendance_since(self, _c: str, _since: str) -> list[dict[str, Any]]:
        return [{"date": "2026-10-08", "records": {"ravi": "absent"}},
                {"date": "2026-10-09", "records": {"ravi": "present"}}]

    def assessments(self, *_a: Any) -> list[dict[str, Any]]:
        return []  # nothing recent: "unavailable" path


class _Session:
    def __init__(self, turns: list[list[SimpleNamespace]]) -> None:
        self.turns, self.i = turns, 0
        self.cues: list[str] = []
        self.tool_responses: list[Any] = []

    def receive(self) -> Any:
        turn = self.turns[self.i] if self.i < len(self.turns) else []
        self.i += 1

        async def gen() -> Any:
            for m in turn:
                yield m
                await asyncio.sleep(0)

        return gen()

    async def send_client_content(self, **kw: Any) -> None:
        self.cues.append(kw["turns"].parts[0].text)

    async def send_tool_response(self, **kw: Any) -> None:
        self.tool_responses.extend(kw["function_responses"])


class _Ws:
    async def send_text(self, _t: str) -> None:
        return None


@pytest.fixture(autouse=True)
def _no_io(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _noop(*_a: Any, **_k: Any) -> None:
        return None

    monkeypatch.setattr(telephony, "_persist_transcript", _noop)


async def _call(turns: list[list[SimpleNamespace]], *, lookups: bool = True) -> tuple[Any, _Session]:
    b = telephony._Bridge(_Ws(), "o-script", call_uuid="")  # type: ignore[arg-type]
    b.stream_id = "s"
    b.dialogue = DialogueState(school_name="Sahayak Test School", message=MESSAGE)
    if lookups:
        b.tools = SchoolDataTools(CallScope("o-script", "t1", "c1", "ravi"), _Reader,
                                  today=date(2026, 10, 10))
    session = _Session(turns)
    task = asyncio.create_task(telephony._pump_live_to_carrier(b, session))
    for _ in range(600):
        await asyncio.sleep(0)
        if session.i > len(turns) and not b.tool_tasks:
            break
    for _ in range(200):  # let lookups answer; a close-in-progress is the test's to inspect
        if not b.tool_tasks:
            break
        await asyncio.sleep(0.01)
    b.stop = True
    await asyncio.wait_for(task, timeout=2)
    return b, session


def _roles(b: Any) -> list[str]:
    return [t["role"] for t in b.transcript]


INTRO = agent("I'm calling from Sahayak Test School on behalf of Ms. Rao. Am I speaking with Ravi's parent?")
DELIVER = agent("Ms. Rao says Ravi missed two homework submissions this week and his science marks dropped.")


@pytest.mark.asyncio
class TestScriptedCalls:
    async def test_normal_question_is_answered_from_the_record(self) -> None:
        b, s = await _call([
            INTRO,
            [parent("Haan ji, I am his mother."), tool("confirm_parent_identity", "i1", status="confirmed")],
            DELIVER,
            [parent("How has his attendance been?"), tool("get_attendance_summary", "a1")],
            agent("He was absent on the eighth and present on the ninth."),
        ])
        att = next(r for r in s.tool_responses if r.name == "get_attendance_summary")
        assert att.response["absent"] == 1 and att.response["present"] == 1
        assert _roles(b) == ["agent", "parent", "agent", "parent", "agent"]
        assert b.dialogue.message_delivered and b.dialogue.repeat_intros == 0

    async def test_a_correction_keeps_one_parent_turn(self) -> None:
        # "Tuesday — no, sorry, Wednesday" arrives in fragments: one utterance.
        b, _ = await _call([
            INTRO,
            [parent("He was sick on Tuesday"), parent("no sorry, Wednesday")],
            agent("Got it, Wednesday."),
        ], lookups=False)
        assert b.parent_said == ["He was sick on Tuesday no sorry, Wednesday"]

    async def test_a_topic_change_mid_reply_cancels_and_moves_on(self) -> None:
        b, _ = await _call([
            INTRO,
            [parent("yes")],
            [_c(output_transcription=SimpleNamespace(text=" Ms. Rao says Ravi")), interrupted()],
            [parent("Actually, when is the parent-teacher meeting?")],
            agent("I don't have the date — I'll ask Ms. Rao to call you about it."),
        ], lookups=False)
        assert b.transcript[2]["text"].endswith("…")  # the cut-off reply is marked
        assert b.dialogue.interruptions == 1
        assert b.transcript[-1]["role"] == "agent"

    async def test_code_mixed_goodbye_closes_after_a_real_conversation(self) -> None:
        b, s = await _call([
            INTRO,
            [parent("haan ji boliye")],
            DELIVER,
            [parent("achha theek hai, थैंक यू सो मच")],
        ], lookups=False)
        assert b.closing, "a code-mixed goodbye after two turns must close the call"
        assert any("signing off" in c for c in s.cues)
        assert "ALREADY introduced" in s.cues[-1]
        for t in list(b.background):
            t.cancel()

    async def test_a_goodbye_inside_a_question_does_not_close(self) -> None:
        b, _ = await _call([
            INTRO,
            [parent("yes")],
            DELIVER,
            [parent("thank you, but what should I do at home?")],
        ], lookups=False)
        assert not b.closing

    async def test_unavailable_information_is_reported_not_invented(self) -> None:
        b, s = await _call([
            INTRO,
            [parent("yes I'm his father"), tool("confirm_parent_identity", "i1", status="confirmed")],
            [parent("What were his last test marks?"), tool("get_recent_assessments", "m1")],
            [parent("And his homework?"), tool("get_homework_status", "h1")],
        ])
        by_name = {r.name: r.response for r in s.tool_responses}
        assert by_name["get_recent_assessments"]["reason"] == "no_recent_assessments"
        assert by_name["get_homework_status"]["reason"] == "not_recorded_by_school"
        assert all("teacher call" in r["say"] for n, r in by_name.items() if n.startswith("get_"))

    async def test_repeated_interruptions_keep_the_conversation_state(self) -> None:
        b, _ = await _call([
            INTRO,
            [parent("yes"), tool("confirm_parent_identity", "i1", status="confirmed")],
            [_c(output_transcription=SimpleNamespace(text=" Ms. Rao says")), interrupted()],
            [parent("wait")],
            [_c(output_transcription=SimpleNamespace(text=" Of course. Ms. Rao")), interrupted()],
            [parent("sorry, go on")],
            DELIVER,
        ])
        assert b.dialogue.interruptions == 2
        assert b.dialogue.may_share_student_data, "identity was lost across interruptions"
        assert b.dialogue.message_delivered
        assert b.dialogue.repeat_intros == 0


@pytest.mark.asyncio
class TestLongPause:
    async def test_a_long_pause_gets_one_gentle_nudge_with_state(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(telephony, "_CONVERSATION_SILENCE", 0.3)
        monkeypatch.setattr(telephony, "_MODEL_SETTLE_SECONDS", 0.0)
        b = telephony._Bridge(_Ws(), "o", call_uuid="")  # type: ignore[arg-type]
        b.dialogue = DialogueState(school_name="Sahayak Test School", message=MESSAGE)
        b.dialogue.on_agent_turn("I'm calling from Sahayak Test School. " + MESSAGE)
        b.engaged = True
        b.model_has_spoken = True
        b.parent_said = ["haan"]
        session = _Session([])
        task = asyncio.create_task(telephony._conversation_watchdog(b, session))
        await asyncio.sleep(1.2)
        b.stop = True
        await asyncio.wait_for(task, timeout=2)
        assert session.cues, "no nudge after a long pause"
        assert "do not repeat it" in session.cues[0]
        assert "ALREADY introduced" in session.cues[0]
