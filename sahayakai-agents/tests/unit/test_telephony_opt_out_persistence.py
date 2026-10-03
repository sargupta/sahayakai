"""A spoken opt-out must outlive the call.

The bridge told parents "it has been noted" and then only logged it, so the
teacher's next click called them again. These tests pin the write, and the hash
shared with the web app (`call-suppression.ts`).
"""

from __future__ import annotations

import hashlib
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from sahayakai_agents.telephony import router as telephony
from sahayakai_agents.telephony.suppression import (
    SUPPRESSION_COLLECTION,
    phone_suppression_id,
)

# Shared fixture: the TS test asserts the identical digest.
FIXTURE_PHONE = "+919876543210"
FIXTURE_DIGEST = "f3a47ce5ce3d4ca8ad15225a245b2759022f79489f5c62719b8c9490f7aab90e"


def test_hash_matches_shared_fixture() -> None:
    assert phone_suppression_id(FIXTURE_PHONE) == hashlib.sha256(FIXTURE_PHONE.encode()).hexdigest()
    assert phone_suppression_id(FIXTURE_PHONE) == FIXTURE_DIGEST


def _fake_client(outreach: dict | None):
    docs: dict[tuple[str, str], MagicMock] = {}

    def collection(name: str):
        coll = MagicMock()

        def document(doc_id: str):
            key = (name, doc_id)
            if key not in docs:
                d = MagicMock()
                snap = SimpleNamespace(exists=outreach is not None, to_dict=lambda: outreach)
                d.get.return_value = snap
                docs[key] = d
            return docs[key]

        coll.document.side_effect = document
        return coll

    client = MagicMock()
    client.collection.side_effect = collection
    return client, docs


def _bridge() -> SimpleNamespace:
    return SimpleNamespace(outreach_id="out1")


@pytest.mark.asyncio
async def test_writes_flag_and_suppression_without_raw_phone_in_id() -> None:
    outreach = {
        "parentPhone": FIXTURE_PHONE,
        "teacherUid": "t1",
        "classId": "c1",
        "studentId": "s1",
    }
    client, docs = _fake_client(outreach)
    with patch("google.cloud.firestore.Client", return_value=client):
        assert await telephony._persist_opt_out(_bridge()) is True

    docs[("parent_outreach", "out1")].update.assert_called_once()
    flag = docs[("parent_outreach", "out1")].update.call_args.args[0]
    assert flag["optedOut"] is True and flag["optedOutAt"]

    key = (SUPPRESSION_COLLECTION, FIXTURE_DIGEST)
    assert key in docs
    record = docs[key].set.call_args.args[0]
    assert record["teacherUid"] == "t1"
    assert record["classId"] == "c1"
    assert record["studentId"] == "s1"
    assert record["reason"] == "opt_out"
    assert record["createdAt"]
    for _coll, doc_id in docs:
        assert "9876543210" not in doc_id
    assert FIXTURE_PHONE not in repr(record)


@pytest.mark.asyncio
async def test_firestore_failure_is_not_fatal() -> None:
    with patch("google.cloud.firestore.Client", side_effect=RuntimeError("down")):
        assert await telephony._persist_opt_out(_bridge()) is False


@pytest.mark.asyncio
async def test_missing_phone_still_flags_outreach_but_reports_failure() -> None:
    client, docs = _fake_client({"teacherUid": "t1"})
    with patch("google.cloud.firestore.Client", return_value=client):
        assert await telephony._persist_opt_out(_bridge()) is False
    docs[("parent_outreach", "out1")].update.assert_called_once()


def test_teardown_persists_opt_out_after_hangup() -> None:
    source = Path(telephony.__file__).read_text()
    hangup = source.index("await _hangup(bridge.call_uuid)")
    persist = source.index("await _persist_opt_out(bridge)")
    assert hangup < persist
    assert "if bridge.opted_out:" in source[persist - 80 : persist]
