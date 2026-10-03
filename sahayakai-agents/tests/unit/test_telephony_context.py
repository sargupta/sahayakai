"""The call context is one half of a contract with the web app's writer.

`/api/attendance/outreach` writes the `parent_outreach` document; the telephony
bridge reads it. The bridge once read `message`, a field nothing writes, so any
record without a `spokenScript` reached the model as "no specific message"
while the teacher's letter sat unread under `generatedMessage`.

The instance is one wrong field name. The class is: the bridge must read every
field the writer uses to carry the message text. The gate below reads the
writer's source, so renaming a field on EITHER side fails this test instead of
silently degrading calls.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from sahayakai_agents.telephony.router import context_from_outreach

REPO_ROOT = Path(__file__).resolve().parents[3]
WRITERS = [
    REPO_ROOT / "sahayakai-main/src/app/api/attendance/outreach/route.ts",
    REPO_ROOT / "sahayakai-main/src/server/attendance.ts",
]

#: Fields a writer may use to carry the words of the call. If a writer starts
#: carrying a new one, add it here AND to `context_from_outreach`.
MESSAGE_FIELDS = ("spokenScript", "generatedMessage")


class TestMessageResolution:
    def test_reads_the_letter_when_there_is_no_spoken_script(self) -> None:
        ctx = context_from_outreach({"generatedMessage": "Riya was absent."}, "English")
        assert ctx.message == "Riya was absent."

    def test_prefers_the_spoken_script(self) -> None:
        ctx = context_from_outreach(
            {"spokenScript": "Hello, about Riya.", "generatedMessage": "Dear Parent,"},
            "English",
        )
        assert ctx.message == "Hello, about Riya."

    def test_an_empty_spoken_script_falls_back_to_the_letter(self) -> None:
        ctx = context_from_outreach(
            {"spokenScript": "", "generatedMessage": "Dear Parent,"}, "English"
        )
        assert ctx.message == "Dear Parent,"

    def test_older_records_that_used_message_still_work(self) -> None:
        ctx = context_from_outreach({"message": "old record"}, "English")
        assert ctx.message == "old record"

    def test_no_message_anywhere_is_none_not_an_error(self) -> None:
        assert context_from_outreach({"studentName": "Riya"}, "English").message is None

    @pytest.mark.parametrize("field", MESSAGE_FIELDS)
    def test_every_writer_field_reaches_the_model(self, field: str) -> None:
        ctx = context_from_outreach({field: "words"}, "English")
        assert ctx.message == "words", (
            f"`{field}` is written by the web app but the bridge ignores it — "
            "calls on records that carry only this field say 'no specific message'."
        )


class TestOtherFields:
    def test_parent_language_on_the_record_wins_over_the_query_language(self) -> None:
        ctx = context_from_outreach({"parentLanguage": "Bengali"}, "English")
        assert ctx.language == "Bengali"

    def test_falls_back_to_the_query_language(self) -> None:
        assert context_from_outreach({}, "Hindi").language == "Hindi"

    def test_marks_are_capped_at_three_subjects(self) -> None:
        subjects = [
            {"subject": s, "marksObtained": 40, "maxMarks": 100}
            for s in ("Maths", "Science", "English", "Hindi")
        ]
        ctx = context_from_outreach(
            {"performanceContext": {"subjectBreakdown": subjects, "latestPercentage": 40.4}},
            "English",
        )
        assert ctx.performance_summary == (
            "Maths: 40/100, Science: 40/100, English: 40/100 · overall 40%"
        )


class TestWriterContract:
    """Class gate: the web writer and this reader agree on the field names."""

    def test_the_writer_still_writes_the_fields_the_bridge_reads(self) -> None:
        sources = [p.read_text() for p in WRITERS if p.exists()]
        if not sources:
            pytest.skip("web app sources not present in this checkout")
        text = "\n".join(sources)
        written = {f for f in MESSAGE_FIELDS if re.search(rf"\b{f}\b", text)}
        assert "generatedMessage" in written, (
            "the web writer no longer writes `generatedMessage`; update "
            "context_from_outreach in telephony/router.py to read its replacement"
        )

    def test_the_bridge_does_not_depend_on_a_field_nothing_writes_alone(self) -> None:
        sources = [p.read_text() for p in WRITERS if p.exists()]
        if not sources:
            pytest.skip("web app sources not present in this checkout")
        text = "\n".join(sources)
        # `message` is kept only as a last-resort legacy fallback; the primary
        # path must be a field the writer really uses.
        primary = [f for f in MESSAGE_FIELDS if re.search(rf"\b{f}\b", text)]
        assert primary, "none of the bridge's primary message fields is written by the web app"
