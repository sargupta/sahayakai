#!/usr/bin/env python3
"""DPDP right-to-erasure helper.

Deletes ALL personal data the parent-call sidecar persists for one
parent's call(s):

  agent_sessions/{call_sid}                    (root metadata)
  agent_sessions/{call_sid}/turns/**           (transcript turns)
  agent_shadow_diffs/{date}/shadow_calls/{call_sid}__{turn:04d}
  agent_voice_sessions/{call_sid}              (Phase 2 placeholder)

Operator workflow:

  1. Receive a parent erasure request (DPDP Act s.12).
  2. Look up the parent's `callSid` values via the relevant
     `parent_outreach/*` doc(s) in the main app's Firestore (those are
     governed by separate erasure logic in sahayakai-main and not
     touched here).
  3. Run this script with each callSid the parent's number is
     associated with.
  4. Log the erasure for the audit trail (this script writes a
     single structured log line per call_sid).

Round-2 audit P1 DPDP-2 fix (30-agent review, group G2): without an
erasure helper, the system cannot satisfy a parent's right-to-erasure
request — TTL alone (24h on `agent_sessions`, 14d on shadow diffs)
is INSUFFICIENT for DPDP. The Act requires action on request, not
eventual decay.

Usage:
  python scripts/erase-parent-data.py \\
      --project sahayakai-b4248 \\
      --call-sid CAxxxxxxxxxxxxxxxx
      [--dry-run]
      [--include-shadow-diffs]   # also delete shadow_diffs entries
      [--include-voice-sessions] # Phase 2 voice (when applicable)

Required permissions for the caller:
  - roles/datastore.user (or a custom role with delete on the listed
    collection groups)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime, timedelta
from typing import Any

import firebase_admin
from firebase_admin import firestore as admin_firestore


def _get_db() -> Any:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return admin_firestore.client()


def _delete_call_session(db: Any, call_sid: str, *, dry_run: bool) -> int:
    """Delete `agent_sessions/{call_sid}` and all turn subcollection docs."""
    deleted = 0
    session_ref = db.collection("agent_sessions").document(call_sid)
    snap = session_ref.get()
    if not snap.exists:
        return 0
    turns_ref = session_ref.collection("turns")
    for doc in turns_ref.stream():
        if not dry_run:
            doc.reference.delete()
        deleted += 1
    if not dry_run:
        session_ref.delete()
    deleted += 1
    return deleted


def _delete_shadow_diffs(
    db: Any, call_sid: str, *, lookback_days: int, dry_run: bool
) -> int:
    """Delete shadow-diff entries for one call_sid across the lookback
    window. Doc IDs are `{call_sid}__{turn:04d}` so we can compute paths
    deterministically without scanning the whole window."""
    deleted = 0
    today = datetime.now(UTC).date()
    days = [today - timedelta(days=d) for d in range(lookback_days + 1)]
    for day in days:
        date_str = day.isoformat()
        shadow_ref = (
            db.collection("agent_shadow_diffs")
            .document(date_str)
            .collection("shadow_calls")
        )
        # Match all docs with the call_sid prefix.
        for snap in shadow_ref.where("callSid", "==", call_sid).stream():
            if not dry_run:
                snap.reference.delete()
            deleted += 1
    return deleted


def _delete_voice_session(db: Any, call_sid: str, *, dry_run: bool) -> int:
    """Phase 2 placeholder. Returns 0 if the doc doesn't exist."""
    voice_ref = db.collection("agent_voice_sessions").document(call_sid)
    snap = voice_ref.get()
    if not snap.exists:
        return 0
    if not dry_run:
        voice_ref.delete()
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0] if __doc__ else "")
    parser.add_argument("--project", required=True, help="GCP project id")
    parser.add_argument(
        "--call-sid",
        required=True,
        help="Twilio Call SID — root key for the session and shadow diffs",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Count what would be deleted but do not actually delete",
    )
    parser.add_argument(
        "--include-shadow-diffs",
        action="store_true",
        help="Also delete agent_shadow_diffs/*/shadow_calls/{call_sid}__*",
    )
    parser.add_argument(
        "--shadow-lookback-days",
        type=int,
        default=14,
        help="Days back to scan for shadow-diff entries (default: 14, matches TTL)",
    )
    parser.add_argument(
        "--include-voice-sessions",
        action="store_true",
        help="Also delete agent_voice_sessions/{call_sid} (Phase 2 placeholder)",
    )

    args = parser.parse_args(argv)

    import os

    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", args.project)
    db = _get_db()

    sessions_deleted = _delete_call_session(db, args.call_sid, dry_run=args.dry_run)
    shadow_deleted = 0
    voice_deleted = 0
    if args.include_shadow_diffs:
        shadow_deleted = _delete_shadow_diffs(
            db, args.call_sid, lookback_days=args.shadow_lookback_days, dry_run=args.dry_run
        )
    if args.include_voice_sessions:
        voice_deleted = _delete_voice_session(db, args.call_sid, dry_run=args.dry_run)

    summary = {
        "event": "parent_call.dpdp_erasure",
        "callSid": args.call_sid,
        "dryRun": args.dry_run,
        "sessionDocsDeleted": sessions_deleted,
        "shadowDiffsDeleted": shadow_deleted,
        "voiceSessionsDeleted": voice_deleted,
        "completedAt": datetime.now(UTC).isoformat(),
    }
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
