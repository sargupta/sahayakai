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
    KEYED,
    LEGACY,
    PEPPER_ENV,
    SUPPRESSION_COLLECTION,
    keyed_phone_suppression_id,
    legacy_phone_suppression_id,
    phone_suppression_id,
    phone_suppression_ids,
)

# Shared fixtures: the TS test asserts the identical digests.
FIXTURE_PHONE = "+919800000101"
FIXTURE_DIGEST = "1775163af1a0b1e46b138f7908ca90c7faa36273ae53b36a40640bba2b0ba8bd"
FIXTURE_PEPPER = "test-pepper-not-a-secret"
FIXTURE_KEYED_DIGEST = "9960b183c2a155b03dfad2caddfd303b611cb1f67265828fb07fc862934cc409"


@pytest.fixture(autouse=True)
def _pepper(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(PEPPER_ENV, FIXTURE_PEPPER)


def test_hashes_match_shared_fixtures() -> None:
    assert legacy_phone_suppression_id(FIXTURE_PHONE) == hashlib.sha256(FIXTURE_PHONE.encode()).hexdigest()
    assert legacy_phone_suppression_id(FIXTURE_PHONE) == FIXTURE_DIGEST
    assert keyed_phone_suppression_id(FIXTURE_PHONE, FIXTURE_PEPPER) == FIXTURE_KEYED_DIGEST
    assert phone_suppression_id(FIXTURE_PHONE) == (FIXTURE_KEYED_DIGEST, KEYED)


def test_the_keyed_id_cannot_be_rebuilt_without_the_pepper() -> None:
    # The old id falls to hashing every Indian mobile number; the keyed one does not.
    assert phone_suppression_id(FIXTURE_PHONE)[0] != legacy_phone_suppression_id(FIXTURE_PHONE)
    assert keyed_phone_suppression_id(FIXTURE_PHONE, "another-pepper") != FIXTURE_KEYED_DIGEST


def test_lookup_ids_cover_entries_written_before_the_change() -> None:
    assert phone_suppression_ids(FIXTURE_PHONE) == [FIXTURE_KEYED_DIGEST, FIXTURE_DIGEST]


def test_without_a_pepper_the_opt_out_is_still_saved_under_the_old_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(PEPPER_ENV)
    assert phone_suppression_id(FIXTURE_PHONE) == (FIXTURE_DIGEST, LEGACY)
    assert phone_suppression_ids(FIXTURE_PHONE) == [FIXTURE_DIGEST]


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

    key = (SUPPRESSION_COLLECTION, FIXTURE_KEYED_DIGEST)
    assert key in docs
    assert (SUPPRESSION_COLLECTION, FIXTURE_DIGEST) not in docs
    record = docs[key].set.call_args.args[0]
    assert record["hash"] == KEYED
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
    source = Path(telephony.__file__).read_text(encoding="utf-8")
    hangup = source.index("await _hangup(bridge.call_uuid)")
    persist = source.index("await _persist_opt_out(bridge)")
    assert hangup < persist
    assert "if bridge.opted_out:" in source[persist - 80 : persist]
