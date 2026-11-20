"""CLASS GATE — the carrier call id cannot steer an authenticated REST call.

Independent review #2: `cuid` arrives as an unsigned query parameter, and
hangup_vobiz_call put it raw into
`/Account/{auth_id}/Call/{cuid}/` for a DELETE sent with the production Vobiz
credentials. Starlette percent-decodes query values ("..%2F" → "../") and
httpx removes dot segments, so `cuid=../Number/+91…` would have released a
number, and `cuid=..` would have hit the account itself.

The class is "an unsigned value becomes a path segment". The gate: the Vobiz
handler refuses any cuid that is not a call UUID before anything else, with no
Firestore read and no network call; the hang-up builds its URL only from a
call UUID, percent-encoded as one segment; and a real call UUID still works.
"""

from __future__ import annotations

import asyncio

import pytest

from bot_harness import (
    CALL_UUID,
    RECORDER,
    FakeAsyncFirestore,
    FakeCallStore,
    import_main,
    run_vobiz_path,
    stubbed_runtime,
)
from main_ast import RECORD

BAD_CUIDS = [
    "", " ", "..", "../", "../Number/+918000000000", "..%2FNumber%2F%2B918000000000", "%2e%2e",
    "a/b", "x" * 36, CALL_UUID + "0", CALL_UUID + "/..", CALL_UUID + "\n", " " + CALL_UUID,
    CALL_UUID[:-1] + "g", CALL_UUID.replace("-", ""), CALL_UUID.replace("1", "１"),
    "call-uuid-test", "?x=1", "#frag",
]


def _network_calls():
    return [c for c in RECORDER.calls if c[0].startswith("httpx.")]


@pytest.mark.parametrize("cuid", BAD_CUIDS, ids=repr)
def test_the_handler_refuses_a_bad_call_id_before_anything_else(cuid, tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        ws = asyncio.run(run_vobiz_path(main, db, cuid=cuid))
        network = _network_calls()
        built = RECORDER.instances_of("PipelineTask")
    assert ws.closed == (1008, "Bad call id")
    assert db.reads == [] and db.writes == [] and network == [] and built == []


@pytest.mark.parametrize("cuid", BAD_CUIDS, ids=repr)
def test_the_hangup_never_builds_a_url_from_a_bad_call_id(cuid):
    with stubbed_runtime():
        from src import vobiz

        assert vobiz.hangup_url(cuid, "MA_TEST") is None
        asyncio.run(vobiz.hangup_vobiz_call(cuid, "MA_TEST", "token-test"))
        assert _network_calls() == []


def test_a_real_call_uuid_is_one_encoded_segment_under_the_account():
    with stubbed_runtime():
        from src import vobiz

        assert vobiz.hangup_url(CALL_UUID, "MA_TEST") == f"https://api.vobiz.ai/api/v1/Account/MA_TEST/Call/{CALL_UUID}/"
        assert vobiz.hangup_url(CALL_UUID, "MA/../x") == f"https://api.vobiz.ai/api/v1/Account/MA%2F..%2Fx/Call/{CALL_UUID}/"
        asyncio.run(vobiz.hangup_vobiz_call(CALL_UUID, "MA_TEST", "token-test"))
        deletes = [c[1][0] for c in RECORDER.calls if c[0] == "httpx.DELETE"]
    assert deletes == [f"https://api.vobiz.ai/api/v1/Account/MA_TEST/Call/{CALL_UUID}/"], "a valid call UUID must still hang up"


def test_the_handler_accepts_a_real_call_uuid(tmp_path, monkeypatch):
    db = FakeAsyncFirestore({("parent_outreach", "OutreachFs0000000001"): RECORD})
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        main.call_store = FakeCallStore()
        ws = asyncio.run(run_vobiz_path(main, db, cuid=CALL_UUID))
    assert ws.closed is None
