"""CLASS GATE — the end-of-call record never waits on an unbounded analysis.

Final review final-0b #5: `_finalize_once` awaited the post-call Gemini
analysis (google-genai sets no client timeout) before the opt-out retry, the
summary note and the transcript write. In the outage the ending watchdog
exists for, a Gemini that accepts connections and never answers, the
analysis hung too: the leg was hung up, but no transcript or summary was
written, a failed optOutRequested was not retried, and the handler held a
Cloud Run slot until the 900 s request timeout.

The class is "the call's record behind an unbounded network wait". The gate:
  * structurally: every analyze_call(...) in src/ is the direct argument of
    bounded_analysis(...), which wraps it in asyncio.wait_for, and the
    Gemini request inside analyze_call is itself under asyncio.wait_for;
  * behaviourally, through the real Vobiz handler with an analyzer that never
    returns: the handler finishes, the transcript and the summary (led by the
    opt-out note) are written, a first optOutRequested write that failed is
    retried and saved, and the leg is hung up once, also when the graceful
    ending stalls;
  * the real analyze_call against a Gemini client that never answers gives
    None within the bound.
"""

from __future__ import annotations

import ast
import asyncio
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from bot_harness import (
    FakeAsyncFirestore,
    FakeCallStore,
    FrameDirection,
    ModelRunner,
    TranscriptionFrame,
    import_main,
    run_from_recorder,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD, call_name, opt_out_requests

SRC = Path(__file__).resolve().parents[1] / "src"
OID = "OutreachFs0000000001"
STOP = "दोबारा फ़ोन मत करना"


def _sources() -> dict[str, str]:
    return {p.name: p.read_text(encoding="utf-8") for p in sorted(SRC.glob("*.py"))}


def unbounded_analyses(sources: dict[str, str]) -> list[str]:
    problems: list[str] = []
    for name, src in sources.items():
        tree = ast.parse(src)
        parents = {id(child): node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and call_name(node) == "analyze_call":
                parent = parents.get(id(node))
                if not (isinstance(parent, ast.Call) and call_name(parent) == "bounded_analysis"
                        and parent.args and parent.args[0] is node):
                    problems.append(f"{name}:{node.lineno}: analyze_call is not awaited through bounded_analysis")
        for fn in ast.walk(tree):
            if isinstance(fn, ast.AsyncFunctionDef) and fn.name == "bounded_analysis":
                if not any(isinstance(n, ast.Call) and call_name(n) == "wait_for" for n in ast.walk(fn)):
                    problems.append(f"{name}: bounded_analysis does not use wait_for")
            if isinstance(fn, ast.AsyncFunctionDef) and fn.name == "analyze_call":
                fparents = {id(c): n for n in ast.walk(fn) for c in ast.iter_child_nodes(n)}
                for n in ast.walk(fn):
                    if isinstance(n, ast.Call) and call_name(n) == "generate_content":
                        wrapper = fparents.get(id(n))
                        if not (isinstance(wrapper, ast.Call) and call_name(wrapper) == "wait_for"):
                            problems.append(f"{name}:{n.lineno}: the Gemini request is not under wait_for")
    return problems


def test_every_analysis_is_bounded():
    assert unbounded_analyses(_sources()) == []


def test_the_checker_sees_both_callers():
    calls = [name for name, src in _sources().items() for n in ast.walk(ast.parse(src))
             if isinstance(n, ast.Call) and call_name(n) == "analyze_call"]
    assert sorted(calls) == ["bot.py", "main.py"]


@pytest.mark.parametrize("name,old,new", [
    ("bot.py", "insights = await bounded_analysis(analyze_call(", "insights = await (analyze_call("),
    ("main.py", "insights = await bounded_analysis(analyze_call(", "insights = await (analyze_call("),
    ("call_analyzer.py", "response = await asyncio.wait_for(client.aio.models.generate_content(",
     "response = await (client.aio.models.generate_content("),
    ("call_analyzer.py", "return await asyncio.wait_for(analysis, ANALYSIS_TIMEOUT_SECONDS)", "return await analysis"),
], ids=["bot unbounded", "main unbounded", "request unbounded", "helper unbounded"])
def test_the_checker_rejects_an_unbounded_analysis(name, old, new):
    sources = _sources()
    assert old in sources[name]
    sources[name] = sources[name].replace(old, new, 1)
    assert unbounded_analyses(sources)


# ── behaviour ────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("ending", ["close after silence", "stalled close"])
def test_a_hanging_analysis_never_holds_the_record(ending, tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", OID): RECORD}, fail_opt_out_requests=1)
    hangups = []
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        from src import bot, call_analyzer

        async def never_answers(*args, **kwargs):
            await asyncio.Event().wait()

        monkeypatch.setattr(bot, "analyze_call", never_answers)
        monkeypatch.setattr(call_analyzer, "ANALYSIS_TIMEOUT_SECONDS", 0.05)
        monkeypatch.setattr(bot, "NOTED_CLOSE_AFTER_SILENCE_SECONDS", 0.01)
        monkeypatch.setattr(bot, "ENDING_BOUND_SECONDS", 0.05)

        async def fake_hangup(call_uuid, auth_id, auth_token):
            hangups.append(call_uuid)

        async def live():
            run = run_from_recorder()
            if ending == "stalled close":
                run.task.stall_end = True
            await run.processor("StopRequestGuard").process_frame(TranscriptionFrame(text=STOP),
                                                                  FrameDirection.DOWNSTREAM)
            await asyncio.sleep(0.05)

        main.hangup_vobiz_call = fake_hangup
        ModelRunner.script = live
        main.WorkerRunner = ModelRunner
        try:
            asyncio.run(asyncio.wait_for(run_vobiz_path(main, db, outreach_id=OID), 3))
        finally:
            ModelRunner.script = None
    assert len(hangups) == 1
    [result] = [w[3] for w in db.writes if w[0] == "set" and w[1] == "parent_outreach" and "transcript" in w[3]]
    assert result["callSummary"]["actionItemsForTeacher"][0].startswith("The parent said they would prefer not")
    [request] = opt_out_requests(db)
    assert request["quote"] == STOP, "the failed first record was retried and saved"


def test_the_real_analyzer_gives_up_on_a_gemini_that_never_answers(monkeypatch):
    with stubbed_runtime():
        import types

        google, genai = types.ModuleType("google"), types.ModuleType("google.genai")
        asked: list = []

        class Client:
            def __init__(self, **kwargs):
                async def generate_content(**kw):
                    asked.append(kw["model"])
                    await asyncio.Event().wait()

                self.aio = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))

        genai.Client = Client
        genai.types = SimpleNamespace(GenerateContentConfig=lambda **kw: kw)
        google.genai = genai
        monkeypatch.setitem(sys.modules, "google", google)
        monkeypatch.setitem(sys.modules, "google.genai", genai)
        from src import call_analyzer

        monkeypatch.setattr(call_analyzer, "ANALYSIS_TIMEOUT_SECONDS", 0.05)
        transcript = [{"role": "agent", "text": "hello"}, {"role": "parent", "text": "yes"}]

        async def go():
            return await asyncio.wait_for(call_analyzer.analyze_call({}, transcript, api_key="k-test"), 2)

        assert asyncio.run(go()) is None
    assert asked == ["gemini-2.0-flash"], "the request was really made, and then given up on"
