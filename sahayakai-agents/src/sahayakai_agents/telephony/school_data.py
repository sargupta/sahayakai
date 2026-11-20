"""Read-only school-data lookups a parent call may make, and nothing else.

THE AUTHORISATION MODEL

The model never names a student, a class or a school. None of the tools take an
id. Every lookup is bound to the `CallScope` built from the call's own
`parent_outreach` record — the record the signed stream token points at — and
that scope is checked against Firestore before the first read:

    classes/{classId}.teacherUid == outreach.teacherUid
    classes/{classId}/students/{studentId} exists

so a record whose class has changed hands, or whose student has been removed,
reads nothing. On top of that the bridge refuses every lookup until the parent
has confirmed they are this child's parent (`DialogueState.identity`).

WHAT IS STORED, AND WHAT IS NOT

- Attendance: `attendance/{classId}/records/{YYYY-MM-DD}`, `records[studentId]`
  = present | absent | late. Real and per-day.
- Assessments: `classes/{classId}/students/{studentId}/assessments`. Real.
- Homework: the app does NOT store homework submissions anywhere. The tool
  exists so the model has a definite answer ("not recorded") instead of a gap
  it might fill by guessing; it does no I/O.
- Follow-up status: not stored reliably (a summary's `followUpNeeded` is an
  LLM opinion, not a tracked task), so there is deliberately no tool for it.

Responses carry the minimum: counts, dates, marks. No remarks, no other
students, no phone numbers. Logs carry tool name, outcome and duration only.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any, Literal, Protocol

import structlog
from pydantic import BaseModel, ConfigDict, Field, ValidationError

log = structlog.get_logger(__name__)

__all__ = [
    "TOOL_NAMES",
    "CallScope",
    "FirestoreSchoolData",
    "SchoolDataReader",
    "SchoolDataTools",
    "tool_declarations",
]

#: The whole allowlist. Anything else the model calls is refused.
TOOL_NAMES = ("get_attendance_summary", "get_recent_assessments", "get_homework_status")

#: The parent must not sit in silence for a slow read. Past this, the tool
#: answers "unavailable" and the model offers a teacher callback.
LOOKUP_TIMEOUT_SECONDS = 2.5
#: Answers are reused within a call for this long. A call is a few minutes;
#: re-reading on every rephrased question would only add latency.
CACHE_SECONDS = 60.0
#: Attendance older than this is reported as stale, not as "current".
ATTENDANCE_STALE_DAYS = 14
#: Assessments older than this are not quoted as "recent".
ASSESSMENT_RECENT_DAYS = 120

#: Mirrors `SUBJECTS` in sahayakai-main/src/types/index.ts.
_SUBJECTS = (
    "Mathematics", "Science", "Social Science", "History", "Geography", "Civics",
    "English", "Hindi", "Sanskrit", "Kannada", "Computer Science",
    "Environmental Studies (EVS)", "General",
)


# ---- scope ----------------------------------------------------------------


@dataclass(frozen=True)
class CallScope:
    """What this call is authorised to read. Built only from the outreach doc."""

    outreach_id: str
    teacher_uid: str
    class_id: str
    student_id: str

    @classmethod
    def from_outreach(cls, outreach_id: str, data: dict[str, Any]) -> CallScope | None:
        fields = (data.get("teacherUid"), data.get("classId"), data.get("studentId"))
        if not all(isinstance(f, str) and f.strip() for f in fields):
            return None
        teacher_uid, class_id, student_id = (str(f) for f in fields)
        return cls(outreach_id, teacher_uid, class_id, student_id)


# ---- the reader (Firestore in production, a fake in tests) ----------------


class SchoolDataReader(Protocol):
    def class_teacher(self, class_id: str) -> str | None: ...
    def student_exists(self, class_id: str, student_id: str) -> bool: ...
    def attendance_since(self, class_id: str, since: str) -> list[dict[str, Any]]: ...
    def assessments(self, class_id: str, student_id: str, limit: int) -> list[dict[str, Any]]: ...


class FirestoreSchoolData:
    """Synchronous Firestore reads; the tools run them off the event loop."""

    def __init__(self, project: str, database: str) -> None:
        from google.cloud import firestore

        self._db = firestore.Client(project=project, database=database)

    def class_teacher(self, class_id: str) -> str | None:
        snap = self._db.collection("classes").document(class_id).get()
        data = snap.to_dict() if snap.exists else None
        teacher = (data or {}).get("teacherUid")
        return teacher if isinstance(teacher, str) else None

    def student_exists(self, class_id: str, student_id: str) -> bool:
        ref = self._db.collection("classes").document(class_id).collection("students")
        return bool(ref.document(student_id).get().exists)

    def attendance_since(self, class_id: str, since: str) -> list[dict[str, Any]]:
        q = (
            self._db.collection("attendance").document(class_id).collection("records")
            .where("date", ">=", since)
        )
        return [d.to_dict() or {} for d in q.stream()]

    def assessments(self, class_id: str, student_id: str, limit: int) -> list[dict[str, Any]]:
        q = (
            self._db.collection("classes").document(class_id)
            .collection("students").document(student_id)
            .collection("assessments")
            .order_by("date", direction="DESCENDING")
            .limit(limit)
        )
        return [d.to_dict() or {} for d in q.stream()]


# ---- argument and response schemas ----------------------------------------


class _Args(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AttendanceArgs(_Args):
    days: int = Field(default=30, ge=7, le=60)


class AssessmentArgs(_Args):
    subject: str | None = None


class HomeworkArgs(_Args):
    pass


class Unavailable(BaseModel):
    available: Literal[False] = False
    reason: str
    say: str = (
        "Say briefly that you do not have that information right now and offer to "
        "have the teacher call back about it. Do not guess."
    )


class AttendanceSummary(BaseModel):
    available: Literal[True] = True
    period_days: int
    school_days_marked: int
    present: int
    absent: int
    late: int
    attendance_percent: int
    current_absence_streak: int
    last_marked_date: str
    stale: bool


class AssessmentItem(BaseModel):
    name: str
    subject: str
    marks_obtained: float
    max_marks: float
    percent: int
    date: str


class RecentAssessments(BaseModel):
    available: Literal[True] = True
    assessments: list[AssessmentItem]


_ARGS: dict[str, type[_Args]] = {
    "get_attendance_summary": AttendanceArgs,
    "get_recent_assessments": AssessmentArgs,
    "get_homework_status": HomeworkArgs,
}


def tool_declarations() -> list[Any]:
    """Gemini Live function declarations for the allowlist. No id parameters."""
    from google.genai import types as t

    return [
        t.FunctionDeclaration(
            name="get_attendance_summary",
            description=(
                "Look up THIS child's attendance (present/absent/late counts and the "
                "current absence streak) for the last N days. Only after the parent "
                "has confirmed who they are, and only when they ask about attendance."
            ),
            parameters=t.Schema(
                type=t.Type.OBJECT,
                properties={
                    "days": t.Schema(
                        type=t.Type.INTEGER, description="Look-back window, 7 to 60. Default 30."
                    )
                },
            ),
        ),
        t.FunctionDeclaration(
            name="get_recent_assessments",
            description=(
                "Look up THIS child's most recent test marks (at most three), optionally "
                "for one subject. Only after the parent has confirmed who they are, and "
                "only when they ask about marks or tests."
            ),
            parameters=t.Schema(
                type=t.Type.OBJECT,
                properties={
                    "subject": t.Schema(
                        type=t.Type.STRING, description="Optional subject, e.g. Science."
                    )
                },
            ),
        ),
        t.FunctionDeclaration(
            name="get_homework_status",
            description=(
                "Check whether homework submissions are recorded for THIS child. Use "
                "when the parent asks about homework."
            ),
            parameters=t.Schema(type=t.Type.OBJECT, properties={}),
        ),
    ]


# ---- the tools ------------------------------------------------------------


class SchoolDataTools:
    """Executes allowlisted lookups for exactly one call."""

    def __init__(
        self,
        scope: CallScope | None,
        reader_factory: Any,
        *,
        today: date | None = None,
        timeout: float = LOOKUP_TIMEOUT_SECONDS,
    ) -> None:
        self._scope = scope
        self._reader_factory = reader_factory
        self._reader: SchoolDataReader | None = None
        self._authorised: bool | None = None
        self._today = today
        self._timeout = timeout
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}
        #: The warm-up and a first lookup may race; one of them does the setup.
        self._setup_lock = asyncio.Lock()

    async def warm(self) -> None:
        """Build the client and check the scope now, not on the first question.

        Measured against Firestore: the first lookup of a call — client
        construction plus the two authorisation reads plus the query — took
        longer than the 2.5 s budget and answered "unavailable"; the next took
        250 ms. Run at call start, in the background, so the parent's first
        question gets the warm path. Never raises.
        """
        if self._scope is None:
            return
        started = time.monotonic()
        try:
            await self._authorised_reader()
        except Exception as exc:  # noqa: BLE001 — a lookup will report it properly later
            self._reader = None
            self._authorised = None
            log.warning("telephony.tool_warm_failed", error_type=type(exc).__name__)
            return
        log.info(
            "telephony.tool_warm",
            outreach_id=self._scope.outreach_id,
            authorised=self._authorised,
            duration_ms=round((time.monotonic() - started) * 1000),
        )

    def _now_date(self) -> date:
        return self._today or datetime.now(UTC).date()

    async def run(
        self, name: str, raw_args: dict[str, Any] | None, *, may_share: bool
    ) -> dict[str, Any]:
        """One tool call -> a JSON-able response. Never raises."""
        started = time.monotonic()
        outcome = "ok"
        try:
            result = await self._run(name, raw_args or {}, may_share=may_share)
            if not result.get("available", False):
                outcome = str(result.get("reason") or "unavailable")
            return result
        except asyncio.CancelledError:
            outcome = "cancelled"
            raise
        except Exception as exc:  # noqa: BLE001 — a lookup must never break the call
            outcome = f"error:{type(exc).__name__}"
            return Unavailable(reason="lookup_failed").model_dump()
        finally:
            log.info(
                "telephony.tool",
                outreach_id=self._scope.outreach_id if self._scope else None,
                tool=name,
                outcome=outcome,
                duration_ms=round((time.monotonic() - started) * 1000),
            )

    async def _run(  # noqa: PLR0911 — one early answer per refusal reason
        self, name: str, raw_args: dict[str, Any], *, may_share: bool
    ) -> dict[str, Any]:
        if name not in _ARGS:
            return Unavailable(reason="unknown_tool").model_dump()
        try:
            args = _ARGS[name].model_validate(raw_args)
        except ValidationError:
            return Unavailable(reason="invalid_arguments").model_dump()

        if name == "get_homework_status":
            # Not stored by the app at all; answering needs no read and no identity.
            return Unavailable(reason="not_recorded_by_school").model_dump()

        if not may_share:
            return Unavailable(
                reason="identity_not_confirmed",
                say=(
                    "Do not share the child's details yet. First confirm you are speaking "
                    "with the child's parent."
                ),
            ).model_dump()
        if self._scope is None:
            return Unavailable(reason="no_call_scope").model_dump()

        key = f"{name}:{args.model_dump_json()}"
        hit = self._cache.get(key)
        if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
            return hit[1]

        try:
            result = await asyncio.wait_for(self._lookup(name, args), timeout=self._timeout)
        except TimeoutError:
            return Unavailable(reason="lookup_timeout").model_dump()
        self._cache[key] = (time.monotonic(), result)
        return result

    async def _lookup(self, name: str, args: _Args) -> dict[str, Any]:
        reader = await self._authorised_reader()
        if reader is None:
            return Unavailable(reason="not_authorised").model_dump()
        assert self._scope is not None
        if name == "get_attendance_summary":
            assert isinstance(args, AttendanceArgs)
            return await asyncio.to_thread(self._attendance, reader, args.days)
        assert isinstance(args, AssessmentArgs)
        return await asyncio.to_thread(self._assessments, reader, args.subject)

    async def _authorised_reader(self) -> SchoolDataReader | None:
        async with self._setup_lock:
            return await self._authorised_reader_locked()

    async def _authorised_reader_locked(self) -> SchoolDataReader | None:
        if self._authorised is False:
            return None
        if self._reader is None:
            self._reader = await asyncio.to_thread(self._reader_factory)
        reader = self._reader
        assert reader is not None
        if self._authorised is None:
            scope = self._scope
            assert scope is not None
            teacher = await asyncio.to_thread(reader.class_teacher, scope.class_id)
            exists = await asyncio.to_thread(
                reader.student_exists, scope.class_id, scope.student_id
            )
            self._authorised = teacher == scope.teacher_uid and exists
            if not self._authorised:
                log.warning("telephony.tool_scope_rejected", outreach_id=scope.outreach_id)
        return reader if self._authorised else None

    def _attendance(self, reader: SchoolDataReader, days: int) -> dict[str, Any]:
        assert self._scope is not None
        today = self._now_date()
        since = (today - timedelta(days=days)).isoformat()
        records = sorted(
            (r for r in reader.attendance_since(self._scope.class_id, since)
             if isinstance(r.get("date"), str)),
            key=lambda r: r["date"],
        )
        marks = [
            (r["date"], (r.get("records") or {}).get(self._scope.student_id))
            for r in records
        ]
        marks = [(d, s) for d, s in marks if s in ("present", "absent", "late")]
        if not marks:
            return Unavailable(reason="no_attendance_recorded").model_dump()
        present = sum(1 for _, s in marks if s == "present")
        absent = sum(1 for _, s in marks if s == "absent")
        late = sum(1 for _, s in marks if s == "late")
        streak = 0
        for _, s in reversed(marks):
            if s != "absent":
                break
            streak += 1
        last = marks[-1][0]
        stale = (today - date.fromisoformat(last)).days > ATTENDANCE_STALE_DAYS
        return AttendanceSummary(
            period_days=days,
            school_days_marked=len(marks),
            present=present,
            absent=absent,
            late=late,
            attendance_percent=round(100 * (present + late) / len(marks)),
            current_absence_streak=streak,
            last_marked_date=last,
            stale=stale,
        ).model_dump()

    def _assessments(self, reader: SchoolDataReader, subject: str | None) -> dict[str, Any]:
        assert self._scope is not None
        wanted = _normalise_subject(subject)
        if subject and wanted is None:
            return Unavailable(reason="unknown_subject").model_dump()
        cutoff = (self._now_date() - timedelta(days=ASSESSMENT_RECENT_DAYS)).isoformat()
        rows = reader.assessments(self._scope.class_id, self._scope.student_id, 10)
        items: list[AssessmentItem] = []
        for r in rows:
            if not isinstance(r.get("date"), str) or r["date"] < cutoff:
                continue
            if wanted and str(r.get("subject", "")).lower() != wanted.lower():
                continue
            try:
                obtained, maximum = float(r["marksObtained"]), float(r["maxMarks"])
            except (KeyError, TypeError, ValueError):
                continue
            if maximum <= 0:
                continue
            items.append(
                AssessmentItem(
                    name=str(r.get("name") or "a test")[:80],
                    subject=str(r.get("subject") or ""),
                    marks_obtained=obtained,
                    max_marks=maximum,
                    percent=round(100 * obtained / maximum),
                    date=r["date"],
                )
            )
            if len(items) == 3:
                break
        if not items:
            return Unavailable(reason="no_recent_assessments").model_dump()
        return RecentAssessments(assessments=items).model_dump()


def _normalise_subject(subject: str | None) -> str | None:
    if not subject:
        return None
    s = subject.strip().lower()
    aliases = {"maths": "Mathematics", "math": "Mathematics",
               "evs": "Environmental Studies (EVS)",
               "environmental studies": "Environmental Studies (EVS)",
               "social studies": "Social Science", "sst": "Social Science",
               "computer": "Computer Science", "computers": "Computer Science"}
    if s in aliases:
        return aliases[s]
    for known in _SUBJECTS:
        if known.lower() == s:
            return known
    return None
