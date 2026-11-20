"""CLASS GATE — at most one media stream per outreach and dial attempt.

Independent review #1: the web app's answer webhook mints a NEW stream token on
every request, and its own answer token is reusable for minutes. Single use
keyed on the stream token therefore did not make the stream single-use:
replaying the answer URL yielded fresh tokens, each a "first use", each able
to hear the greeting, overwrite the record and (then) write a do-not-call
(today: an opt-out note on the outreach).

The class is "a stream credential the attacker can re-mint". The gate keys the
single-use record on (outreach, dial attempt), where the dial attempt is the
`callSid` the web call route stamps from Vobiz's response at dial time. Two
tokens from two answer replays open one stream; a genuine new dial opens a new
one; and the stop flow on the one stream records once.
"""

from __future__ import annotations

import asyncio

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    ScriptedRunner,
    TranscriptionFrame,
    count_context_loads,
    import_main,
    mint_stream_token,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, opt_out_requests, suppressions

OID = "OutreachFs0000000001"


def _db(call_sid: str | None):
    record = dict(RECORD)
    if call_sid is not None:
        record["callSid"] = call_sid
    return FakeAsyncFirestore({("parent_outreach", OID): record})


def _open_streams(db, tokens, tmp_path, monkeypatch, *, stop=False, between=None):
    closed = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        loads = count_context_loads(main)

        async def live():
            if stop:
                guard = run_from_recorder().processor("StopRequestGuard")
                await guard.process_frame(TranscriptionFrame(text="दोबारा फ़ोन मत करना"), FrameDirection.DOWNSTREAM)
                await asyncio.sleep(0)

        ScriptedRunner.script = live
        main.WorkerRunner = ScriptedRunner
        try:
            async def go():
                for i, token in enumerate(tokens):
                    if between and i in between:
                        between[i]()
                    RECORDER.instances.clear()  # one pipeline at a time for run_from_recorder
                    ws = await run_vobiz_path(main, db, outreach_id=OID, token=token)
                    closed.append(ws.closed)
            asyncio.run(go())
        finally:
            ScriptedRunner.script = None
    return closed, loads


def test_two_answer_replays_open_one_stream_and_record_one_opt_out(tmp_path, monkeypatch):
    db = _db("req-dial-attempt-1")
    first, replay = mint_stream_token(OID, ttl=300), mint_stream_token(OID, ttl=301)
    assert first != replay, "two answer requests really minted two different tokens"
    closed, loads = _open_streams(db, [first, replay], tmp_path, monkeypatch, stop=True)
    assert closed == [None, (1008, "Stream already used")]
    assert loads == [OID], "the replayed stream loaded call context"
    assert len(opt_out_requests(db)) == 1 and suppressions(db) == []
    [use] = [w[3] for w in db.writes if w[1] == "vobiz_stream_tokens"]
    assert use["boundTo"] == "dial_attempt"


def test_a_genuine_new_dial_gets_a_new_stream(tmp_path, monkeypatch):
    db = _db("req-dial-attempt-1")

    def redial():
        db.docs[("parent_outreach", OID)]["callSid"] = "req-dial-attempt-2"

    tokens = [mint_stream_token(OID, ttl=300), mint_stream_token(OID, ttl=301)]
    closed, loads = _open_streams(db, tokens, tmp_path, monkeypatch, between={1: redial})
    assert closed == [None, None] and loads == [OID, OID]


def test_without_a_stamped_dial_attempt_single_use_falls_back_to_the_token(tmp_path, monkeypatch):
    db = _db(None)
    a, b = mint_stream_token(OID, ttl=300), mint_stream_token(OID, ttl=301)
    closed, _loads = _open_streams(db, [a, a, b], tmp_path, monkeypatch)
    assert closed == [None, (1008, "Stream already used"), None]
