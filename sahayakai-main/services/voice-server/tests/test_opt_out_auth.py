"""CLASS GATE — no handler writes an opt-out record for an unauthenticated id.

The instance (security review of 67839bbb6): /ws/call passed
`_opt_out_writer(outreach_id)` with the id read from the socket's own,
unauthenticated `start` event, so anyone could silence calls to someone
else's family. The engine no longer blocks numbers at all
(test_opt_out_never_suppresses.py), but it still records `optOutRequested`
on the outreach, and a forged id must not plant that note in another
teacher's record either. The web app cannot supply a signed token for
/ws/call today and the live service has no TWILIO_AUTH_TOKEN to check
Twilio's signature, so that route gets no writer at all (and therefore no
stop check and no "I will let the class teacher know").

Checked structurally over the AST of main.py, so a new handler is covered the
day it is written: every create_bot(on_opt_out_request=...) must be None or
_opt_out_request_writer(<name>) where every assignment to <name> in that
handler comes from an authenticator (verify_stream_token), and nothing else
may call the record writers. A self-test proves the checker rejects the
original bug. Then behaviourally: a stranger naming a real outreach on
/ws/call and saying "stop" changes nothing, and a forged Vobiz token is
refused before any read.
"""

from __future__ import annotations

import ast
import asyncio

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    ScriptedRunner,
    import_main,
    mint_stream_token,
    run_from_recorder,
    run_twilio_path,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, SOURCE, call_name, handlers, say, suppressions

# Calls that turn untrusted input into an authenticated outreach id.
AUTHENTICATORS = {"verify_stream_token"}
# Writes keyed by the outreach id. Each may only be reached through its writer.
WRITER_FOR = {
    "on_opt_out_request": "_opt_out_request_writer",
}
WRITERS = {"record_opt_out_request_firestore", "record_opt_out_request",
           "persist_opt_out_firestore", "persist_opt_out"}


def _assignments(fn: ast.AST, name: str) -> list[ast.AST]:
    """Every value assigned to `name` inside fn (None for tuple-unpacking/loops/params)."""
    values: list = []
    for node in ast.walk(fn):
        if isinstance(node, (ast.Assign, ast.AnnAssign, ast.AugAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            for t in targets:
                if isinstance(t, ast.Name) and t.id == name:
                    values.append(node.value)
                elif isinstance(t, (ast.Tuple, ast.List)) and any(
                    isinstance(e, ast.Name) and e.id == name for e in ast.walk(t)
                ):
                    values.append(None)
        elif isinstance(node, (ast.For, ast.AsyncFor, ast.With, ast.AsyncWith, ast.NamedExpr)):
            for e in ast.walk(getattr(node, "target", node)):
                if isinstance(e, ast.Name) and e.id == name and isinstance(e.ctx, ast.Store):
                    values.append(None)
    if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)):
        if name in {a.arg for a in fn.args.args + fn.args.kwonlyargs}:
            values.append(None)
    return values


def _is_authenticated(fn: ast.AST, name: str) -> bool:
    values = _assignments(fn, name)
    return bool(values) and all(
        v is not None and call_name(v) in AUTHENTICATORS for v in values
    )


def unauthenticated_writes(source: str) -> list[str]:
    """Places where an opt-out record could be written for an unauthenticated id."""
    tree = ast.parse(source)
    problems: list[str] = []
    approved: set[int] = set()

    for fn in handlers(tree):
        for node in ast.walk(fn):
            if call_name(node) != "create_bot":
                continue
            for kw in node.keywords:
                if kw.arg not in WRITER_FOR:
                    continue
                v = kw.value
                if isinstance(v, ast.Constant) and v.value is None:
                    continue
                if call_name(v) == WRITER_FOR[kw.arg] and len(v.args) == 1 and \
                        isinstance(v.args[0], ast.Name) and _is_authenticated(fn, v.args[0].id):
                    approved.add(id(v))
                    continue
                problems.append(f"{fn.name}: {kw.arg}={ast.unparse(v)} is not built from an authenticated id")

    # Each writer is only ever an authenticated create_bot's matching argument.
    for node in ast.walk(tree):
        if call_name(node) in WRITER_FOR.values() and id(node) not in approved:
            problems.append(f"{call_name(node)} used outside an authenticated create_bot: {ast.unparse(node)}")
    # Nothing but the writers touches the Firestore writes.
    for fn in tree.body:
        if isinstance(fn, (ast.FunctionDef, ast.AsyncFunctionDef)) and fn.name not in WRITER_FOR.values():
            for node in ast.walk(fn):
                if call_name(node) in WRITERS:
                    problems.append(f"{fn.name}: calls {call_name(node)} directly")
    return problems



def test_the_checkers_see_both_handlers():
    names = [fn.name for fn in handlers(ast.parse(SOURCE))]
    assert {"handle_call", "handle_vobiz_call"} <= set(names), names


def test_no_handler_writes_opt_out_records_for_an_unauthenticated_id():
    assert unauthenticated_writes(SOURCE) == []


def test_the_vobiz_handler_is_recognised_as_authenticated():
    """Guards against the gate passing only because nothing writes at all."""
    tree = ast.parse(SOURCE)
    vobiz = next(fn for fn in handlers(tree) if fn.name == "handle_vobiz_call")
    assert _is_authenticated(vobiz, "outreach_id")
    writers = [kw.value for n in ast.walk(vobiz) if call_name(n) == "create_bot"
               for kw in n.keywords if kw.arg == "on_opt_out_request"]
    assert [call_name(w) for w in writers] == ["_opt_out_request_writer"]


def test_the_auth_checker_rejects_the_original_bug():
    bad = SOURCE.replace("on_opt_out_request=None,", "on_opt_out_request=_opt_out_request_writer(outreach_id),", 1)
    assert bad != SOURCE
    assert any("handle_call" in p for p in unauthenticated_writes(bad))


# ── behaviour ────────────────────────────────────────────────────────────────


def test_ws_call_cannot_record_anything_for_a_named_outreach(tmp_path, monkeypatch):
    """Anyone can open /ws/call and claim an outreach id; saying "stop" must change nothing."""
    db = FakeAsyncFirestore({("parent_outreach", "VictimOutreach000001"): RECORD})
    web_ctx = {"studentName": "Aarav", "reason": "", "requestToTalk": True, "parentLanguage": "Hindi"}
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import vobiz

        vobiz._db = lambda project: db
        ScriptedRunner.script = lambda: say("please don't call me again")
        main.WorkerRunner = ScriptedRunner
        try:
            asyncio.run(run_twilio_path(main, web_ctx, outreach_id="VictimOutreach000001"))
            run = run_from_recorder()
        finally:
            ScriptedRunner.script = None
    assert suppressions(db) == [] and db.writes == []
    assert "StopRequestGuard" not in [type(p).__name__ for p in run.processors]
    assert run.task.queued == [], "no 'I will let the class teacher know' on an unauthenticated route"


def test_vobiz_rejects_a_forged_token_before_reading_anything(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "VictimOutreach000001"): RECORD})
    forged = mint_stream_token("VictimOutreach000001", key="not-the-real-key")
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        ws = asyncio.run(run_vobiz_path(main, db, outreach_id="VictimOutreach000001", token=forged))
    assert ws.closed == (1008, "Unauthorized")
    assert db.reads == [] and db.writes == []
