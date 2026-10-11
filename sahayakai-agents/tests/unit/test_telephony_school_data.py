"""School-data tools: bound to the call, gated on identity, minimal, never invented.

The class of bug gated here is "a voice on the phone reads out a record it
should not": another child's, a record from a class that changed hands, a
record before the parent said who they are, a stale record as if current, or
a guess where there is no record at all.
"""

from __future__ import annotations

import asyncio
import json
import time
from datetime import date
from types import SimpleNamespace
from typing import Any

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.school_data import (
    TOOL_NAMES,
    CallScope,
    SchoolDataTools,
    tool_declarations,
)

TODAY = date(2026, 10, 10)
SCOPE = CallScope("o1", "teacher-1", "class-1", "ravi")


class _Reader:
    def __init__(self, *, teacher: str = "teacher-1", student: bool = True, delay: float = 0.0) -> None:
        self.teacher, self.student, self.delay = teacher, student, delay
        self.attendance: list[dict[str, Any]] = []
        self.rows: list[dict[str, Any]] = []
        self.reads: list[str] = []

    def class_teacher(self, class_id: str) -> str | None:
        self.reads.append(f"class:{class_id}")
        return self.teacher

    def student_exists(self, class_id: str, student_id: str) -> bool:
        self.reads.append(f"student:{class_id}/{student_id}")
        return self.student

    def attendance_since(self, class_id: str, since: str) -> list[dict[str, Any]]:
        if self.delay:
            time.sleep(self.delay)
        self.reads.append(f"attendance:{class_id}>={since}")
        return [r for r in self.attendance if r["date"] >= since]

    def assessments(self, class_id: str, student_id: str, limit: int) -> list[dict[str, Any]]:
        self.reads.append(f"assessments:{class_id}/{student_id}")
        return self.rows[:limit]


def _day(d: str, ravi: str | None, other: str = "present") -> dict[str, Any]:
    records = {"someone-else": other}
    if ravi:
        records["ravi"] = ravi
    return {"date": d, "classId": "class-1", "records": records}


def _tools(reader: _Reader, **kw: Any) -> SchoolDataTools:
    return SchoolDataTools(SCOPE, lambda: reader, today=TODAY, **kw)


@pytest.mark.asyncio
class TestAuthorisation:
    async def test_nothing_before_identity_is_confirmed(self) -> None:
        reader = _Reader()
        out = await _tools(reader).run("get_attendance_summary", {}, may_share=False)
        assert out["available"] is False and out["reason"] == "identity_not_confirmed"
        assert reader.reads == [], "a record was read before the parent confirmed"

    async def test_a_class_that_changed_hands_reads_nothing(self) -> None:
        reader = _Reader(teacher="someone-else")
        reader.attendance = [_day("2026-10-09", "absent")]
        out = await _tools(reader).run("get_attendance_summary", {}, may_share=True)
        assert out["reason"] == "not_authorised"
        assert not any(r.startswith("attendance") for r in reader.reads)

    async def test_a_removed_student_reads_nothing(self) -> None:
        reader = _Reader(student=False)
        out = await _tools(reader).run("get_recent_assessments", {}, may_share=True)
        assert out["reason"] == "not_authorised"

    async def test_the_model_cannot_name_another_student(self) -> None:
        reader = _Reader()
        out = await _tools(reader).run(
            "get_attendance_summary", {"student_id": "someone-else"}, may_share=True
        )
        assert out["reason"] == "invalid_arguments"
        assert reader.reads == []

    async def test_no_declaration_takes_an_id(self) -> None:
        for decl in tool_declarations():
            props = (decl.parameters.properties or {}) if decl.parameters else {}
            assert not any("id" in name.lower() for name in props), decl.name
        assert {d.name for d in tool_declarations()} == set(TOOL_NAMES)

    async def test_unknown_tools_are_refused(self) -> None:
        out = await _tools(_Reader()).run("get_fees", {}, may_share=True)
        assert out["reason"] == "unknown_tool"

    async def test_no_scope_means_no_reads(self) -> None:
        tools = SchoolDataTools(None, _Reader, today=TODAY)
        assert (await tools.run("get_attendance_summary", {}, may_share=True))["reason"] == "no_call_scope"

    def test_scope_comes_only_from_a_complete_outreach_record(self) -> None:
        assert CallScope.from_outreach("o", {"teacherUid": "t", "classId": "c", "studentId": "s"})
        assert CallScope.from_outreach("o", {"teacherUid": "t", "classId": "c"}) is None
        assert CallScope.from_outreach("o", {"teacherUid": "t", "classId": " ", "studentId": "s"}) is None


@pytest.mark.asyncio
class TestAttendance:
    async def test_counts_only_this_child(self) -> None:
        reader = _Reader()
        reader.attendance = [
            _day("2026-10-01", "present", other="absent"),
            _day("2026-10-05", "late"),
            _day("2026-10-08", "absent"),
            _day("2026-10-09", "absent"),
            _day("2026-10-07", None),  # not marked for Ravi that day
        ]
        out = await _tools(reader).run("get_attendance_summary", {"days": 30}, may_share=True)
        assert out == {
            "available": True, "period_days": 30, "school_days_marked": 4, "present": 1,
            "absent": 2, "late": 1, "attendance_percent": 50, "current_absence_streak": 2,
            "last_marked_date": "2026-10-09", "stale": False,
        }

    async def test_old_records_are_flagged_stale(self) -> None:
        reader = _Reader()
        reader.attendance = [_day("2026-09-10", "present")]
        out = await _tools(reader).run("get_attendance_summary", {"days": 60}, may_share=True)
        assert out["stale"] is True

    async def test_no_records_is_unavailable_not_zero(self) -> None:
        out = await _tools(_Reader()).run("get_attendance_summary", {}, may_share=True)
        assert out == {"available": False, "reason": "no_attendance_recorded", "say": out["say"]}
        assert "Do not guess" in out["say"]

    async def test_window_is_bounded(self) -> None:
        out = await _tools(_Reader()).run("get_attendance_summary", {"days": 365}, may_share=True)
        assert out["reason"] == "invalid_arguments"


def _row(d: str, subject: str = "Science", got: float = 18, mx: float = 50, **extra: Any) -> dict[str, Any]:
    return {"date": d, "subject": subject, "name": f"Unit Test {d}", "marksObtained": got,
            "maxMarks": mx, "remarks": "private teacher note", "studentId": "ravi", **extra}


@pytest.mark.asyncio
class TestAssessments:
    async def test_minimal_fields_at_most_three(self) -> None:
        reader = _Reader()
        reader.rows = [_row(f"2026-09-{d:02d}") for d in (30, 20, 10, 5)]
        out = await _tools(reader).run("get_recent_assessments", {}, may_share=True)
        assert len(out["assessments"]) == 3
        first = out["assessments"][0]
        assert set(first) == {"name", "subject", "marks_obtained", "max_marks", "percent", "date"}
        assert first["percent"] == 36
        assert "private teacher note" not in json.dumps(out)

    async def test_old_marks_are_not_recent(self) -> None:
        reader = _Reader()
        reader.rows = [_row("2026-01-15")]
        out = await _tools(reader).run("get_recent_assessments", {}, may_share=True)
        assert out["reason"] == "no_recent_assessments"

    async def test_subject_filter_and_aliases(self) -> None:
        reader = _Reader()
        reader.rows = [_row("2026-09-30", "Mathematics", 40, 50), _row("2026-09-29", "Science")]
        out = await _tools(reader).run("get_recent_assessments", {"subject": "maths"}, may_share=True)
        assert [a["subject"] for a in out["assessments"]] == ["Mathematics"]
        bad = await _tools(reader).run("get_recent_assessments", {"subject": "Astrology"}, may_share=True)
        assert bad["reason"] == "unknown_subject"

    async def test_malformed_rows_are_skipped_not_spoken(self) -> None:
        reader = _Reader()
        reader.rows = [_row("2026-09-30", mx=0), {"date": "2026-09-29", "subject": "Science"}]
        out = await _tools(reader).run("get_recent_assessments", {}, may_share=True)
        assert out["reason"] == "no_recent_assessments"


@pytest.mark.asyncio
class TestHomework:
    async def test_not_recorded_by_the_school_without_any_read(self) -> None:
        reader = _Reader()
        out = await _tools(reader).run("get_homework_status", {}, may_share=False)
        assert out["available"] is False and out["reason"] == "not_recorded_by_school"
        assert reader.reads == []


@pytest.mark.asyncio
class TestTimeoutsAndCache:
    async def test_a_slow_read_answers_unavailable_in_time(self) -> None:
        reader = _Reader(delay=1.0)
        reader.attendance = [_day("2026-10-09", "present")]
        started = time.monotonic()
        out = await _tools(reader, timeout=0.2).run("get_attendance_summary", {}, may_share=True)
        assert out["reason"] == "lookup_timeout"
        assert time.monotonic() - started < 0.6

    async def test_repeat_questions_reuse_the_answer(self) -> None:
        reader = _Reader()
        reader.attendance = [_day("2026-10-09", "present")]
        tools = _tools(reader)
        await tools.run("get_attendance_summary", {}, may_share=True)
        await tools.run("get_attendance_summary", {}, may_share=True)
        assert sum(r.startswith("attendance") for r in reader.reads) == 1

    async def test_a_reader_error_is_unavailable_not_a_crash(self) -> None:
        reader = _Reader()

        def boom(*_a: Any) -> list[dict[str, Any]]:
            raise RuntimeError("firestore down")

        reader.attendance_since = boom  # type: ignore[method-assign]
        out = await _tools(reader).run("get_attendance_summary", {}, may_share=True)
        assert out["reason"] == "lookup_failed"


# ---------------------------------------------------------------------------
# Through the bridge: lookups run as tasks, answer for themselves, can be cancelled
# ---------------------------------------------------------------------------


class _Session:
    def __init__(self) -> None:
        self.tool_responses: list[Any] = []

    async def send_tool_response(self, **kw: Any) -> None:
        self.tool_responses.append(kw)


class _Ws:
    async def send_text(self, _t: str) -> None:
        return None


def _bridge(reader: _Reader) -> Any:
    b = telephony._Bridge(_Ws(), "o1", call_uuid="")  # type: ignore[arg-type]
    b.tools = _tools(reader)
    from sahayakai_agents.telephony.dialogue import DialogueState

    b.dialogue = DialogueState(student_name="Ravi Kumar")
    b.dialogue.on_identity_question_asked()
    b.parent_said.append("haan ji, Ravi")
    b.dialogue.check_identity("haan ji, Ravi")  # verified by the bridge, not the model
    assert b.dialogue.may_share_student_data
    return b


def _call(name: str, call_id: str = "c1", **args: Any) -> Any:
    return SimpleNamespace(function_calls=[SimpleNamespace(id=call_id, name=name, args=args)])


@pytest.mark.asyncio
class TestThroughTheBridge:
    async def test_lookup_answers_its_own_call(self) -> None:
        reader = _Reader()
        reader.attendance = [_day("2026-10-09", "absent")]
        b, session = _bridge(reader), _Session()
        await telephony._handle_tool_call(b, session, _call("get_attendance_summary"))
        assert "c1" in b.tool_tasks
        await asyncio.gather(*b.background)
        resp = session.tool_responses[-1]["function_responses"][0]
        assert resp.id == "c1" and resp.response["absent"] == 1
        assert b.tool_tasks == {}

    async def test_cancellation_during_a_lookup_sends_nothing(self) -> None:
        reader = _Reader(delay=0.5)
        reader.attendance = [_day("2026-10-09", "absent")]
        b, session = _bridge(reader), _Session()
        await telephony._handle_tool_call(b, session, _call("get_attendance_summary"))
        await asyncio.sleep(0.05)
        telephony._cancel_lookups(b, ["c1"])
        await asyncio.sleep(0.6)
        assert session.tool_responses == []
        assert b.tool_tasks == {}

    async def test_lookups_are_refused_when_disabled(self) -> None:
        b = telephony._Bridge(_Ws(), "o1", call_uuid="")  # type: ignore[arg-type]
        session = _Session()
        await telephony._handle_tool_call(b, session, _call("get_recent_assessments"))
        await asyncio.gather(*b.background)
        assert session.tool_responses[-1]["function_responses"][0].response["reason"] == "lookups_disabled"

    async def test_identity_gate_applies_through_the_bridge(self) -> None:
        reader = _Reader()
        b = telephony._Bridge(_Ws(), "o1", call_uuid="")  # type: ignore[arg-type]
        b.tools = _tools(reader)
        session = _Session()
        await telephony._handle_tool_call(b, session, _call("get_attendance_summary"))
        await asyncio.gather(*b.background)
        assert session.tool_responses[-1]["function_responses"][0].response["reason"] == "identity_not_confirmed"
        assert reader.reads == []

    async def test_the_watchdog_treats_a_lookup_as_not_silence(self) -> None:
        reader = _Reader(delay=0.3)
        b, session = _bridge(reader), _Session()
        await telephony._handle_tool_call(b, session, _call("get_attendance_summary"))
        assert b.tool_tasks  # the watchdog's `speaking` check reads this
        await asyncio.gather(*b.background)


def test_flags_default_off_and_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("VOBIZ_SCHOOL_DATA_TOOLS", raising=False)
    monkeypatch.delenv("VOBIZ_LOCAL_BARGE_IN", raising=False)
    assert telephony.school_data_tools_enabled() is False
    assert telephony.local_barge_in_enabled() is True
    monkeypatch.setenv("VOBIZ_SCHOOL_DATA_TOOLS", "true")
    monkeypatch.setenv("VOBIZ_LOCAL_BARGE_IN", "0")
    assert telephony.school_data_tools_enabled() is True
    assert telephony.local_barge_in_enabled() is False


def test_the_prompt_mentions_lookups_only_when_on() -> None:
    from sahayakai_agents.telephony.prompt import CallContext, build_parent_call_instruction

    ctx = CallContext(student_name="Ravi", language="English", message="Hello.")
    assert "confirm_parent_identity" not in build_parent_call_instruction(ctx)
    on = build_parent_call_instruction(ctx, lookups=True)
    assert "confirm_parent_identity" in on and "get_attendance_summary" in on
    # Delivery-only calls never invite a lookup conversation.
    assert "confirm_parent_identity" not in build_parent_call_instruction(ctx, lookups=True, two_way=False)


@pytest.mark.asyncio
class TestWarmUp:
    async def test_warm_does_the_setup_once_and_the_first_lookup_is_warm(self) -> None:
        reader = _Reader()
        reader.attendance = [_day("2026-10-09", "present")]
        tools = _tools(reader)
        await asyncio.gather(
            tools.warm(), tools.run("get_attendance_summary", {}, may_share=True)
        )
        assert reader.reads.count("class:class-1") == 1, "setup ran twice"

    async def test_warm_never_raises(self) -> None:
        def broken() -> _Reader:
            raise RuntimeError("no credentials")

        tools = SchoolDataTools(SCOPE, broken, today=TODAY)
        await tools.warm()  # logged, not raised
        out = await tools.run("get_attendance_summary", {}, may_share=True)
        assert out["available"] is False
