"""CLASS GATE — built-in test scenarios cannot start a billed pipeline by default.

main.py's `__test__NNN` outreach ids load a hard-coded call context, so they
need no record and no credential. On /ws/call, which nothing authenticates,
anyone who opened the socket with such an id got a full Sarvam STT + Gemini +
Sarvam TTS pipeline on the company's accounts.

The class is "a path that builds a pipeline for a caller nobody vouched for".
The gate: unless SAHAYAKAI_ALLOW_TEST_SCENARIOS is set (default off), every
handler refuses a test id before any service is constructed, any context is
loaded or anything is written; structurally, each handler checks the flag
before it first touches the scenarios or create_bot. With the flag on, the
scenarios still work for local testing.
"""

from __future__ import annotations

import ast
import asyncio
from dataclasses import replace

import pytest

from bot_harness import (
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    import_main,
    run_twilio_path,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import SOURCE, call_name, handlers

PIPELINE_PIECES = ("PipelineTask", "Pipeline", "FastAPIWebsocketTransport")


def _services_built() -> list[str]:
    return [name for name, _a, _k in RECORDER.calls
            if name.startswith("pipecat.services.") or name in PIPELINE_PIECES]


def test_the_flag_is_off_unless_set(monkeypatch):
    from src.config import load_config

    monkeypatch.delenv("SAHAYAKAI_ALLOW_TEST_SCENARIOS", raising=False)
    assert load_config().allow_test_scenarios is False
    for value, expected in (("1", True), ("true", True), ("yes", True), ("0", False), ("off", False), ("", False)):
        monkeypatch.setenv("SAHAYAKAI_ALLOW_TEST_SCENARIOS", value)
        assert load_config().allow_test_scenarios is expected, value


@pytest.mark.parametrize("scenario", ["__test__001", "__test__003", "__test__999"])
def test_ws_call_refuses_a_test_id_before_building_anything(scenario, tmp_path, monkeypatch):
    store = FakeCallStore()
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = store
        ws = asyncio.run(run_twilio_path(main, {}, outreach_id=scenario))
        built = _services_built()
    assert ws.closed == (1008, "Test scenarios disabled")
    assert built == [] and store.created == []


def test_vobiz_refuses_a_signed_test_id_before_touching_firestore(tmp_path, monkeypatch):
    db = FakeAsyncFirestore()
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        ws = asyncio.run(run_vobiz_path(main, db, outreach_id="__test__002"))
        built = _services_built()
    assert ws.closed == (1008, "Test scenarios disabled")
    assert built == [] and db.writes == [] and db.reads == []


@pytest.mark.parametrize("path", ["ws_call", "vobiz"])
def test_with_the_flag_on_the_scenarios_still_run(path, tmp_path, monkeypatch):
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        main.config = replace(main.config, allow_test_scenarios=True)
        if path == "ws_call":
            ws = asyncio.run(run_twilio_path(main, {}, outreach_id="__test__002"))
        else:
            ws = asyncio.run(run_vobiz_path(main, FakeAsyncFirestore(), outreach_id="__test__002"))
        built = _services_built()
    assert ws.closed is None
    assert "PipelineTask" in built


def test_every_handler_checks_the_flag_before_the_scenarios_or_a_pipeline():
    for fn in handlers(ast.parse(SOURCE)):
        flag = [n.lineno for n in ast.walk(fn) if isinstance(n, ast.Attribute) and n.attr == "allow_test_scenarios"]
        uses = [n.lineno for n in ast.walk(fn)
                if (isinstance(n, ast.Name) and n.id == "_TEST_SCENARIOS") or call_name(n) == "create_bot"]
        if not uses:
            continue
        assert flag, f"{fn.name} builds a pipeline but never checks allow_test_scenarios"
        assert min(flag) < min(uses), f"{fn.name} reaches the scenarios or create_bot before the flag check"
