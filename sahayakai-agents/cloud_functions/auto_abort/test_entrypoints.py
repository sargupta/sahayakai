"""End-to-end tests for `auto_abort_pubsub` + `auto_abort_http`.

The 30-agent review (group E2) flagged that the entrypoint functions
themselves were 0% covered — only the `_demote` helper had tests. The
transactional logic, recovery skip, unknown-policy bail, dedupe write,
and HTTP dry-run path were all untested code paths.

These tests exercise the entrypoints against a fake Firestore that
records mutations, so we verify:
- correct demote on a fresh fire
- recovery notifications no-op
- unknown_policy no-op
- dedupe sentinel write on demote
- second fire of same incident_id no-ops via dedupe
- no-flag-doc path returns no_op_no_doc
- already-at-floor (off, 0) returns no_op_at_floor
- HTTP dry-run returns the computed demotion WITHOUT writing
- HTTP fresh fire writes the demoted state
"""
from __future__ import annotations

import base64
import json
import os
from typing import Any
from unittest.mock import MagicMock

import pytest

os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "test")

from cloud_functions.auto_abort import main  # noqa: E402

pytestmark = pytest.mark.unit


# ── Fake Firestore — minimal shape that satisfies the function ────────────


class _FakeSnap:
    def __init__(self, data: dict[str, Any] | None) -> None:
        self._data = data

    @property
    def exists(self) -> bool:
        return self._data is not None

    def to_dict(self) -> dict[str, Any] | None:
        return dict(self._data) if self._data is not None else None


class _FakeDocRef:
    def __init__(self, store: _FakeStore, path: tuple[str, ...]) -> None:
        self.store = store
        self.path = path

    def get(self, transaction: Any | None = None) -> _FakeSnap:
        return _FakeSnap(self.store.docs.get(self.path))

    def set(self, data: dict[str, Any], merge: bool = False) -> None:
        if merge and self.path in self.store.docs:
            self.store.docs[self.path].update(data)
        else:
            self.store.docs[self.path] = dict(data)

    def update(self, data: dict[str, Any]) -> None:
        existing = self.store.docs.setdefault(self.path, {})
        existing.update(data)


class _FakeColRef:
    def __init__(self, store: _FakeStore, path: tuple[str, ...]) -> None:
        self.store = store
        self.path = path

    def document(self, doc_id: str) -> _FakeDocRef:
        return _FakeDocRef(self.store, self.path + (doc_id,))


class _FakeTxn:
    def __init__(self, store: _FakeStore) -> None:
        self.store = store

    def update(self, ref: _FakeDocRef, data: dict[str, Any]) -> None:
        ref.update(data)


class _FakeStore:
    def __init__(self) -> None:
        self.docs: dict[tuple[str, ...], dict[str, Any]] = {}

    def collection(self, name: str) -> _FakeColRef:
        return _FakeColRef(self, (name,))

    def transaction(self) -> _FakeTxn:
        return _FakeTxn(self)


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch) -> _FakeStore:
    store = _FakeStore()
    monkeypatch.setattr(main, "_get_db", lambda: store)
    # Bypass the @admin_firestore.transactional decorator: in production
    # it wraps the function with retry-on-conflict semantics from the
    # google-cloud-firestore SDK; here we just call the inner function
    # directly with our fake transaction. This is the same shim the
    # tests/unit/fake_firestore.py module uses for SessionStore.
    def _passthrough_transactional(fn: Any) -> Any:
        # Same shape as `firestore.transactional` decorator: takes a
        # function, returns a callable that accepts a transaction
        # argument and invokes the function with it.
        def _runner(txn: Any) -> Any:
            return fn(txn)
        return _runner

    monkeypatch.setattr(
        main.admin_firestore,  # type: ignore[attr-defined]
        "transactional",
        _passthrough_transactional,
    )
    # SERVER_TIMESTAMP sentinel — replace with a string so dict equality
    # in assertions works.
    monkeypatch.setattr(
        main.admin_firestore,  # type: ignore[attr-defined]
        "SERVER_TIMESTAMP",
        "<<server-timestamp>>",
    )
    return store


def _seed_flag(
    store: _FakeStore, mode: str = "shadow", percent: int = 25
) -> None:
    store.docs[("system_config", "feature_flags")] = {
        "parentCallSidecarMode": mode,
        "parentCallSidecarPercent": percent,
    }


def _envelope(
    *,
    policy: str = "policies/test-error-rate",
    incident_id: str | None = "INC-1",
    state: str | None = None,
) -> dict[str, Any]:
    incident: dict[str, Any] = {"policy_name": policy}
    if incident_id is not None:
        incident["incident_id"] = incident_id
    if state is not None:
        incident["state"] = state
    body = {"incident": incident}
    return {"data": base64.b64encode(json.dumps(body).encode()).decode()}


# ── auto_abort_pubsub ─────────────────────────────────────────────────────


class TestAutoAbortPubsub:
    def test_demotes_on_fresh_fire(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="canary", percent=50)
        main.auto_abort_pubsub(_envelope(incident_id="INC-1"), context=None)
        flag = fake_db.docs[("system_config", "feature_flags")]
        # canary/50 demotes to canary/25 per the ladder.
        assert flag["parentCallSidecarMode"] == "canary"
        assert flag["parentCallSidecarPercent"] == 25
        assert flag["updatedBy"].startswith("auto-abort:")
        # Dedupe sentinel was written.
        assert ("agent_auto_abort_seen", "INC-1") in fake_db.docs

    def test_recovery_notification_is_no_op(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="canary", percent=50)
        main.auto_abort_pubsub(_envelope(state="closed"), context=None)
        flag = fake_db.docs[("system_config", "feature_flags")]
        assert flag["parentCallSidecarMode"] == "canary"
        assert flag["parentCallSidecarPercent"] == 50

    def test_unknown_policy_is_no_op(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="canary", percent=50)
        # Envelope with no policy_name in the incident.
        body = {"incident": {"foo": "bar"}}
        bad_envelope = {"data": base64.b64encode(json.dumps(body).encode()).decode()}
        main.auto_abort_pubsub(bad_envelope, context=None)
        flag = fake_db.docs[("system_config", "feature_flags")]
        assert flag["parentCallSidecarMode"] == "canary"
        assert flag["parentCallSidecarPercent"] == 50

    def test_duplicate_incident_is_no_op(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="canary", percent=50)
        # First fire: demote canary/50 → canary/25
        main.auto_abort_pubsub(_envelope(incident_id="INC-DUP"), context=None)
        assert fake_db.docs[("system_config", "feature_flags")]["parentCallSidecarPercent"] == 25
        # Second fire of SAME incident: should NO-OP.
        main.auto_abort_pubsub(_envelope(incident_id="INC-DUP"), context=None)
        assert fake_db.docs[("system_config", "feature_flags")]["parentCallSidecarPercent"] == 25

    def test_no_flag_doc_logs_warning(
        self, fake_db: _FakeStore, caplog: pytest.LogCaptureFixture
    ) -> None:
        # No seed — flag doc absent.
        main.auto_abort_pubsub(_envelope(), context=None)
        # No demote happened.
        assert ("system_config", "feature_flags") not in fake_db.docs

    def test_already_at_floor_no_op(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="off", percent=0)
        main.auto_abort_pubsub(_envelope(incident_id="INC-FLOOR"), context=None)
        flag = fake_db.docs[("system_config", "feature_flags")]
        assert flag["parentCallSidecarMode"] == "off"
        assert flag["parentCallSidecarPercent"] == 0
        # No dedupe sentinel because no demote happened.
        assert ("agent_auto_abort_seen", "INC-FLOOR") not in fake_db.docs


# ── auto_abort_http ───────────────────────────────────────────────────────


def _make_http_request(payload: dict[str, Any]) -> Any:
    """Mimic Flask request.get_json for the function-framework runtime."""
    req = MagicMock()
    req.get_json.return_value = payload
    return req


class TestAutoAbortHttp:
    def test_dry_run_returns_demoted_without_writing(
        self, fake_db: _FakeStore
    ) -> None:
        _seed_flag(fake_db, mode="canary", percent=25)
        envelope = {"policy_name": "manual-test", "dry_run": True}
        body, status = main.auto_abort_http(_make_http_request(envelope))
        result = json.loads(body)
        assert status == 200
        assert result["dryRun"] is True
        assert result["fromMode"] == "canary"
        assert result["fromPercent"] == 25
        assert result["toMode"] == "canary"
        assert result["toPercent"] == 5
        # Critical: no write happened despite returning the computed demotion.
        assert fake_db.docs[("system_config", "feature_flags")]["parentCallSidecarPercent"] == 25

    def test_real_run_writes_demoted_state(
        self, fake_db: _FakeStore
    ) -> None:
        _seed_flag(fake_db, mode="canary", percent=25)
        envelope = {"policy_name": "manual-test"}  # dry_run absent
        body, status = main.auto_abort_http(_make_http_request(envelope))
        assert status == 200
        result = json.loads(body)
        assert result["toPercent"] == 5
        # Write actually happened.
        assert fake_db.docs[("system_config", "feature_flags")]["parentCallSidecarPercent"] == 5
        assert fake_db.docs[("system_config", "feature_flags")]["updatedBy"].startswith(
            "auto-abort-http:"
        )

    def test_no_flag_doc_returns_404(self, fake_db: _FakeStore) -> None:
        body, status = main.auto_abort_http(_make_http_request({"policy_name": "x"}))
        assert status == 404
        result = json.loads(body)
        assert result["action"] == "no_op_no_doc"

    def test_already_at_floor_returns_unchanged(self, fake_db: _FakeStore) -> None:
        _seed_flag(fake_db, mode="off", percent=0)
        body, status = main.auto_abort_http(_make_http_request({}))
        assert status == 200
        result = json.loads(body)
        # demote(off, 0) → (off, 0); response shows no change but still 200.
        assert result["fromMode"] == result["toMode"] == "off"
        assert result["fromPercent"] == result["toPercent"] == 0
