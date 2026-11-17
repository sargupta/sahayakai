"""Scripted parent-call conversations against the REAL Gemini Live model.

The unit tests prove what the bridge does with the model's output. This proves
what the model does with the bridge's prompt, cues and tools: does it introduce
itself once, deliver the message, check identity before reading records, look
things up instead of guessing, offer a callback when it has nothing, keep turns
short, and end the call when the parent is done?

Parent turns are sent as TEXT (no phone, no audio input), the system
instruction, cues and tool declarations are the bridge's own, and lookups run
through the real `SchoolDataTools` against an in-memory school. Nothing is
written anywhere; no call is placed.

Run (needs Vertex AI ADC for project sahayakai-b4248):
    PYTHONUTF8=1 PYTHONPATH=src python scripts/telephony_conversation_eval.py [--out results.json]

Automatic checks are deliberately mechanical (counts, digits, tool calls).
They catch the failures seen on real calls; they do not grade warmth.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.dialogue import DialogueState
from sahayakai_agents.telephony.flow import KICKOFF_AFTER_OPENER, is_goodbye
from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction
from sahayakai_agents.telephony.school_data import CallScope, SchoolDataTools

MODEL = os.environ.get("VOBIZ_LIVE_MODEL", "gemini-live-2.5-flash")
LOCATION = os.environ.get("VOBIZ_LIVE_LOCATION", "global")
PROJECT = os.environ.get("GOOGLE_CLOUD_PROJECT", "sahayakai-b4248")

MESSAGE = (
    "Ravi's science performance has declined recently, and he missed two homework "
    "submissions this week. Ms. Test Teacher would like to work with you to support him."
)
CONTEXT = CallContext(
    student_name="Ravi Test",
    teacher_name="Ms. Test Teacher",
    class_name="Class 7 - Call Test",
    school_name="Sahayak Test School",
    reason="poor_performance",
    subject="Science",
    language="English",
    message=MESSAGE,
)
TODAY = date(2026, 10, 10)


class _School:
    """One child's records: 2 absences in the last fortnight, two recent tests."""

    def class_teacher(self, _c: str) -> str:
        return "t1"

    def student_exists(self, _c: str, _s: str) -> bool:
        return True

    def attendance_since(self, _c: str, since: str) -> list[dict[str, Any]]:
        days = {
            "2026-09-29": "present",
            "2026-09-30": "present",
            "2026-10-01": "absent",
            "2026-10-05": "present",
            "2026-10-06": "present",
            "2026-10-07": "late",
            "2026-10-08": "absent",
            "2026-10-09": "present",
        }
        return [{"date": d, "records": {"ravi": s}} for d, s in days.items() if d >= since]

    def assessments(self, *_a: Any) -> list[dict[str, Any]]:
        return [
            {
                "date": "2026-09-26",
                "subject": "Science",
                "name": "Unit Test 2",
                "marksObtained": 17,
                "maxMarks": 50,
            },
            {
                "date": "2026-08-22",
                "subject": "Science",
                "name": "Unit Test 1",
                "marksObtained": 31,
                "maxMarks": 50,
            },
        ]


@dataclass
class Scenario:
    name: str
    parent: list[str]
    expect_tools: set[str] = field(default_factory=set)
    expect_end: str | None = None
    forbid_tools: set[str] = field(default_factory=set)


SCENARIOS = [
    Scenario(
        "normal_question",
        [
            "Yes, I'm Ravi's mother.",
            "Haan ji, boliye.",
            "Oh. How has his attendance been?",
            "Okay, thank you, bye.",
        ],
        expect_tools={"confirm_parent_identity", "get_attendance_summary"},
        expect_end="parent_finished",
    ),
    Scenario(
        "marks_then_homework",
        [
            "Yes, speaking. I'm his father.",
            "Go ahead.",
            "What marks did he get in science?",
            "And has he submitted his homework since?",
            "Alright, thanks. Goodbye.",
        ],
        expect_tools={"get_recent_assessments", "get_homework_status"},
        expect_end="parent_finished",
    ),
    Scenario(
        "correction_and_topic_change",
        [
            "Yes, I'm his mother.",
            "Okay.",
            "He was unwell on Tuesday — no sorry, it was Wednesday.",
            "Actually, when is the next parent-teacher meeting?",
            "Okay thank you.",
        ],
        expect_end="parent_finished",
    ),
    Scenario(
        "code_mixed",
        [
            "Haan ji, main Ravi ki mummy bol rahi hoon.",
            "Haan boliye.",
            "Achha, uska attendance kaisa hai?",
            "Theek hai, thank you, namaste.",
        ],
        expect_tools={"get_attendance_summary"},
        expect_end="parent_finished",
    ),
    Scenario(
        "wrong_person",
        ["No, there's no Ravi here. You have the wrong number."],
        forbid_tools={"get_attendance_summary", "get_recent_assessments"},
        expect_end="wrong_number",
    ),
    Scenario(
        "busy_parent",
        ["Yes, but I'm driving right now, can you call later?"],
        forbid_tools={"get_attendance_summary", "get_recent_assessments"},
        expect_end="call_back_later",
    ),
    Scenario(
        "lookup_before_identity",
        ["What is his attendance?"],
        forbid_tools={"get_attendance_summary"},
    ),
    Scenario(
        "unavailable_information",
        ["Yes, I'm his father.", "Okay.", "What did he score in Hindi?", "Okay, fine. Bye."],
        expect_end="parent_finished",
    ),
]

_DIGITS = re.compile(r"\d+")


async def _turn(  # noqa: PLR0912 — one branch per Live message kind
    session: Any,
    tools: SchoolDataTools,
    dialogue: DialogueState,
    parent_turns: int,
    log: dict[str, Any],
) -> tuple[str, float | None]:
    """Collect one model turn, answering tool calls; returns (text, ms to first audio)."""
    from google.genai import types as t

    text, first_audio, t0 = "", None, time.monotonic()
    # After a lookup the model speaks the answer in a FOLLOWING turn; the bridge
    # listens continuously, so the eval must too or it records an empty reply.
    awaiting_answer = False
    while True:
        async for resp in session.receive():
            if resp.data and first_audio is None:
                first_audio = (time.monotonic() - t0) * 1000
            sc = resp.server_content
            if sc and sc.output_transcription and sc.output_transcription.text:
                text += sc.output_transcription.text
            if resp.tool_call:
                responses = []
                for fc in resp.tool_call.function_calls or []:
                    args = dict(fc.args or {})
                    log["tools"].append({"name": fc.name, "args": args})
                    if fc.name == "confirm_parent_identity":
                        last = next(
                            (x["text"] for x in reversed(log["turns"]) if x["role"] == "parent"),
                            None,
                        )
                        _, outcome = dialogue.confirm_identity(
                            str(args.get("status")), parent_turns=parent_turns, parent_reply=last
                        )
                        result: dict[str, Any] = {"status": outcome}
                    elif fc.name == "end_call":
                        log["end"] = args.get("reason")
                        result = {"status": "ok"}
                    else:
                        result = await tools.run(
                            fc.name, args, may_share=dialogue.may_share_student_data
                        )
                    log["tool_results"].append(result)
                    responses.append(t.FunctionResponse(id=fc.id, name=fc.name, response=result))
                    if fc.name != "end_call":
                        awaiting_answer = True
                await session.send_tool_response(function_responses=responses)
            if sc and sc.turn_complete:
                if awaiting_answer:
                    awaiting_answer = False
                    break  # re-enter receive() for the answer turn
                return text.strip(), first_audio
        else:
            if text or log.get("end"):
                return text.strip(), first_audio


async def run_scenario(client: Any, sc: Scenario) -> dict[str, Any]:
    from google.genai import types as t

    config = t.LiveConnectConfig(
        response_modalities=[t.Modality.AUDIO],
        system_instruction=t.Content(
            parts=[
                t.Part(text=build_parent_call_instruction(CONTEXT, disclose_ai=True, lookups=True))
            ]
        ),
        speech_config=t.SpeechConfig(
            voice_config=t.VoiceConfig(
                prebuilt_voice_config=t.PrebuiltVoiceConfig(
                    voice_name=os.environ.get("VOBIZ_LIVE_VOICE", "Aoede")
                )
            )
        ),
        output_audio_transcription=t.AudioTranscriptionConfig(),
        tools=[
            t.Tool(
                function_declarations=[
                    t.FunctionDeclaration(
                        name="end_call",
                        description="End the call after your closing line.",
                        parameters=t.Schema(
                            type=t.Type.OBJECT,
                            properties={"reason": t.Schema(type=t.Type.STRING)},
                            required=["reason"],
                        ),
                    ),
                    *telephony._identity_and_lookup_declarations(),
                ]
            )
        ],
    )
    dialogue = DialogueState(school_name=CONTEXT.school_name, message=MESSAGE)
    tools = SchoolDataTools(CallScope("eval", "t1", "c1", "ravi"), _School, today=TODAY)
    log: dict[str, Any] = {
        "scenario": sc.name,
        "turns": [],
        "tools": [],
        "tool_results": [],
        "end": None,
    }
    async with client.aio.live.connect(model=MODEL, config=config) as session:
        await session.send_client_content(
            turns=t.Content(role="user", parts=[t.Part(text=KICKOFF_AFTER_OPENER)]),
            turn_complete=True,
        )
        for i, said in enumerate([None, *sc.parent]):
            if said is not None:
                log["turns"].append({"role": "parent", "text": said})
                # The bridge's own safety net: a goodbye after a real
                # conversation closes the call even if the model forgets to.
                if is_goodbye(said) and i >= 2 and not telephony._ENDS_IN_QUESTION.search(said):
                    log["bridge_close"] = True
                await session.send_client_content(
                    turns=t.Content(role="user", parts=[t.Part(text=said)]), turn_complete=True
                )
            text, ttfa = await asyncio.wait_for(_turn(session, tools, dialogue, i, log), timeout=45)
            dialogue.on_agent_turn(text)
            log["turns"].append(
                {"role": "agent", "text": text, "first_audio_ms": round(ttfa) if ttfa else None}
            )
            if log["end"]:
                break
    log["checks"] = _check(sc, log, dialogue)
    return log


def _check(sc: Scenario, log: dict[str, Any], dialogue: DialogueState) -> dict[str, Any]:
    agent_turns = [x["text"] for x in log["turns"] if x["role"] == "agent"]
    called = {x["name"] for x in log["tools"]}
    allowed_digits = set(_DIGITS.findall(MESSAGE + json.dumps(log["tool_results"])))
    spoken_digits = set(_DIGITS.findall(" ".join(agent_turns)))
    checks = {
        "single_introduction": dialogue.repeat_intros == 0,
        "max_words_per_turn": max((len(a.split()) for a in agent_turns), default=0),
        "no_invented_numbers": spoken_digits <= allowed_digits,
        "invented_numbers": sorted(spoken_digits - allowed_digits),
        "expected_tools_called": sc.expect_tools <= called,
        "forbidden_tools_avoided": not (sc.forbid_tools & called)
        or not any(r.get("available") for r in log["tool_results"]),
        "end_reason_ok": sc.expect_end is None
        or log["end"] == sc.expect_end
        or (sc.expect_end == "parent_finished" and bool(log.get("bridge_close"))),
        "model_called_end_call": log["end"] is not None,
    }
    checks["pass"] = (
        all(v for k, v in checks.items() if isinstance(v, bool) and k != "model_called_end_call")
        and checks["max_words_per_turn"] <= 60
    )
    return checks


async def main() -> int:
    from google import genai

    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="")
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    client = genai.Client(vertexai=True, project=PROJECT, location=LOCATION)
    results = []
    for sc in SCENARIOS:
        if args.only and sc.name != args.only:
            continue
        try:
            res = await run_scenario(client, sc)
        except Exception as exc:  # noqa: BLE001 — report and continue
            res = {
                "scenario": sc.name,
                "error": f"{type(exc).__name__}: {exc}",
                "checks": {"pass": False},
            }
        results.append(res)
        print(json.dumps({"scenario": sc.name, "checks": res["checks"]}), flush=True)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(results, fh, indent=1, ensure_ascii=False)
    passed = sum(1 for r in results if r["checks"].get("pass"))
    print(f"{passed}/{len(results)} scenarios passed")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
