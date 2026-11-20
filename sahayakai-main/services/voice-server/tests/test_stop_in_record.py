"""CLASS GATE — a stop request is in the record the teacher sees.

Independent review #11: the guard swallowed the parent's stop before the
conversation context, and the engine's answer was spoken without being added
to it. The persisted transcript and the call summary held no trace of it
(often just the greeting, so no summary at all), and a teacher could not see,
check or act on what the parent had asked.

The class is "something said on the call is missing from its record". The
gate runs the real Vobiz handler through a stop request and requires the
written transcript to hold the parent's words and the engine's line, the
summary to lead with a note quoting the parent, and the outreach to carry
`optOutRequested` with the quote, the time and the source. Nothing is
blocked, and the model never receives the stop (nothing passes the guard).
"""

from __future__ import annotations

import asyncio

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    ScriptedRunner,
    TranscriptionFrame,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, opt_out_requests, suppressions
from src.call_policy import load_call_lines

OID = "OutreachFs0000000001"
STOP = "दोबारा फ़ोन मत करना"


def test_a_stop_reaches_the_transcript_summary_and_outreach(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", OID): RECORD})
    passed = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()

        async def live():
            run = run_from_recorder()
            guard = run.processor("StopRequestGuard")
            before = len(guard.pushed)
            await guard.process_frame(TranscriptionFrame(text=STOP), FrameDirection.DOWNSTREAM)
            passed.extend(guard.pushed[before:])
            await asyncio.sleep(0)

        ScriptedRunner.script = live
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_vobiz_path(main, db, outreach_id=OID))
        finally:
            ScriptedRunner.script = None

    lines = load_call_lines()["hi-IN"]
    [result] = [w[3] for w in db.writes if w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3]]
    said = [(t["role"], t["text"]) for t in result["transcript"]]
    for entry in [("parent", STOP), ("agent", lines["opt_out_noted"])]:
        assert entry in said, (entry, said)
    summary = result["callSummary"]
    assert "would prefer not to receive these calls" in summary["actionItemsForTeacher"][0]
    assert STOP in summary["actionItemsForTeacher"][0]
    assert summary["followUpNeeded"] is True and summary["parentResponse"]

    [request] = opt_out_requests(db)
    assert request["quote"] == STOP and request["source"] == "live" and request["at"]
    outreach = db.docs[("parent_outreach", OID)]
    assert outreach["optOutRequested"] == request
    assert "optedOut" not in outreach
    assert suppressions(db) == []
    assert passed == [], "the stop still never reaches the model"
