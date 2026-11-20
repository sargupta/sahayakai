"""CLASS GATE — a media-stream token opens one stream, once.

Security review: verify_stream_token accepted a genuine token any number of
times until it expired (300 s as the web app mints it). The stream URL that
carries it is in Vobiz's answer XML and in the Cloud Run request log, so anyone
who saw it could reconnect, hear the call's greeting and write a transcript
and summary onto that parent's outreach record.

The class is "a verified token is not consumed before the handler acts on
it". The gate: a second connection with the same valid token is refused and
loads and writes nothing; the consumption is atomic and stores only a digest;
a failure to record it refuses the stream (fail closed); and, structurally,
the consumption comes before any context load in the handler.
"""

from __future__ import annotations

import ast
import asyncio
import hashlib

import pytest

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    count_context_loads,
    import_main,
    mint_stream_token,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, SOURCE, call_name, handlers
from src.stream_tokens import (
    CONSUMED_COLLECTION,
    StreamUse,
    consume_stream_token,
    parse_stream_token,
    stream_token_id,
)

OID = "OutreachSt0000000001"


def _outreach_reads(db):
    return [r for r in db.reads if r[0] == "parent_outreach"]


# ── the consumption itself ───────────────────────────────────────────────────


def test_first_use_consumes_and_a_replay_is_refused():
    db = FakeAsyncFirestore()
    token = mint_stream_token("OutreachSt0000000001")
    assert asyncio.run(consume_stream_token(db, token, "OutreachSt0000000001")) is StreamUse.FIRST
    assert asyncio.run(consume_stream_token(db, token, "OutreachSt0000000001")) is StreamUse.REPLAY
    assert asyncio.run(consume_stream_token(db, mint_stream_token("OutreachSt0000000001", ttl=301), "OutreachSt0000000001")) is StreamUse.FIRST


def test_only_a_digest_of_the_token_is_stored():
    db = FakeAsyncFirestore()
    token = mint_stream_token("OutreachSt0000000001")
    asyncio.run(consume_stream_token(db, token, "OutreachSt0000000001"))
    [(kind, coll, doc_id, data, _)] = db.writes
    assert (kind, coll) == ("create", CONSUMED_COLLECTION)
    assert doc_id == stream_token_id(parse_stream_token(token))
    assert doc_id != hashlib.sha256(token.encode()).hexdigest(), "keyed on the claims, not the raw string"
    assert token not in repr(db.writes) and token.split(".")[2] not in repr(db.writes)
    assert data["outreachId"] == "OutreachSt0000000001" and data["expiresAt"] > data["consumedAt"]


@pytest.mark.parametrize("failure", [RuntimeError("firestore down"), PermissionError("denied")])
def test_a_failure_to_record_the_use_fails_closed(failure):
    token = mint_stream_token(OID)
    assert asyncio.run(consume_stream_token(FakeAsyncFirestore(fail=failure), token, OID)) is StreamUse.ERROR


def test_the_real_sdk_exception_shape_counts_as_a_replay():
    class Conflict(Exception):
        code = 409

    class AlreadyExists(Conflict):
        pass

    class Doc:
        async def create(self, data):
            raise AlreadyExists("409 Document already exists")

    class Db:
        def collection(self, name):
            return type("C", (), {"document": lambda self, i: Doc()})()

    assert asyncio.run(consume_stream_token(Db(), mint_stream_token(OID), OID)) is StreamUse.REPLAY


# ── the handler ──────────────────────────────────────────────────────────────


def test_a_second_connection_with_the_same_token_is_refused_and_touches_nothing(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD})
    token = mint_stream_token("OutreachFs0000000001")
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        loads = count_context_loads(main)

        async def go():
            first = await run_vobiz_path(main, db, token=token)
            reads, writes, bots = len(loads), list(db.writes), len(RECORDER.instances_of("PipelineTask"))
            second = await run_vobiz_path(main, db, token=token)
            return first, second, reads, writes, bots

        first, second, reads, writes, bots = asyncio.run(go())
        bots_after = len(RECORDER.instances_of("PipelineTask"))

    assert first.closed is None and reads == 1 and bots == 1
    assert second.closed == (1008, "Stream already used")
    assert len(loads) == reads, "the replay loaded call context"
    assert db.writes == writes, "the replay wrote something"
    assert bots_after == bots, "the replay started a pipeline"


def test_if_the_use_cannot_be_recorded_the_stream_is_refused(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        from src.stream_tokens import StreamUse as Use  # the stubbed runtime's own copy

        async def unrecordable(*args, **kwargs):
            return Use.ERROR

        main.consume_stream_token_firestore = unrecordable
        loads = count_context_loads(main)
        ws = asyncio.run(run_vobiz_path(main, db))
    assert ws.closed == (1011, "Could not verify stream")
    assert loads == [], "no call context is loaded for a stream whose use was not recorded"


def test_the_handler_consumes_the_token_before_loading_any_context():
    fn = next(f for f in handlers(ast.parse(SOURCE)) if f.name == "handle_vobiz_call")
    lines = {}
    for node in ast.walk(fn):
        name = call_name(node)
        if name:
            lines.setdefault(name, node.lineno)
        if isinstance(node, ast.Name) and node.id == "_TEST_SCENARIOS":
            lines.setdefault("_TEST_SCENARIOS", node.lineno)
    assert "consume_stream_token_firestore" in lines, "the Vobiz handler no longer consumes its token"
    first_load = min(lines[k] for k in ("fetch_context_firestore", "_TEST_SCENARIOS") if k in lines)
    assert lines["verify_stream_token"] < lines["consume_stream_token_firestore"] < first_load
