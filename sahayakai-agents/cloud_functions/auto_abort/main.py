"""Auto-abort Cloud Function for parent-call sidecar rollout.

Receives Cloud Monitoring alert notifications and demotes the
`parentCallSidecarMode` / `parentCallSidecarPercent` fields in the
Firestore feature-flags document. The TwiML route's dispatcher reads
that document on every turn (with a 5-min cache TTL on the read side),
so a flag flip propagates within ~5 minutes without any redeploy.

Six abort conditions wired via separate Cloud Monitoring policies — see
`policy_templates/` for the corresponding alert YAML:

  1. Sidecar error rate > 2% over any 15-minute window
  2. Sidecar p95 latency > 3.5s over 15 minutes
  3. Behavioural-guard 502 rate > 0.5%
  4. Shadow-diff mean LaBSE < 0.75 over any 500-call window
  5. Firestore SessionConflictError 409 rate > 0.1%
  6. Sidecar Gemini spend > 2x projected daily budget

Each policy notifies the same Cloud Pub/Sub topic; this function is
the topic's only subscriber. The function:

  1. Verifies the message is a Cloud Monitoring alert payload
  2. Extracts the policy name to identify which condition tripped
  3. Reads the current feature-flags doc
  4. Computes the demoted state (one step less aggressive)
  5. Writes back atomically with a transaction
  6. Logs the action structurally and emits a Cloud Monitoring event

Demotion ladder (one step per fire):
  full / 100% → canary / 100%
  canary / 100% → canary / 50%
  canary / 50% → canary / 25%
  canary / 25% → canary / 5%
  canary / 5% → shadow / 25%
  shadow / 25% → shadow / 5%
  shadow / 5% → shadow / 1%
  shadow / 1% → off / 0%
  off → off (no-op, idempotent)

The ladder mirrors the planned ramp in reverse: any abort takes us back
exactly one step from the most-recent step-up, never further. Operators
can still manually flip to off via Firestore Console at any time.

Round-2 audit reference: P0 ABORT-1 (auto-abort must be in place before
the first shadow-mode flag flip).
"""
from __future__ import annotations

import base64
import json
import logging
import os
from typing import Any

import firebase_admin
from firebase_admin import firestore as admin_firestore

# ---- Constants ------------------------------------------------------------

PROJECT_ID = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
FLAG_DOC_PATH = "system_config/feature_flags"

# Demotion ladder: each entry is the NEXT state given the current state.
# Tuple key is (mode, percent). When the operator's last manual percent
# is not on this ladder we fall through to the closest lower step.
_DEMOTE_TABLE: dict[tuple[str, int], tuple[str, int]] = {
    ("full", 100): ("canary", 100),
    ("canary", 100): ("canary", 50),
    ("canary", 50): ("canary", 25),
    ("canary", 25): ("canary", 5),
    ("canary", 5): ("shadow", 25),
    ("shadow", 25): ("shadow", 5),
    ("shadow", 5): ("shadow", 1),
    ("shadow", 1): ("off", 0),
    ("shadow", 0): ("off", 0),
    ("off", 0): ("off", 0),
}

_VALID_MODES = {"off", "shadow", "canary", "full"}

log = logging.getLogger("sahayakai.auto_abort")
log.setLevel(logging.INFO)


# ---- Firebase Admin singleton --------------------------------------------


def _get_db() -> Any:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return admin_firestore.client()


# ---- Demotion logic ------------------------------------------------------


def _demote(mode: str, percent: int) -> tuple[str, int]:
    """Return the (next_mode, next_percent) one step down the ladder.

    Falls through to the closest lower step when the current state is
    not exactly on the ladder (e.g. operator manually set 75%).
    """
    mode = mode if mode in _VALID_MODES else "off"
    percent = max(0, min(100, int(percent)))

    # Direct ladder hit.
    if (mode, percent) in _DEMOTE_TABLE:
        return _DEMOTE_TABLE[(mode, percent)]

    # Fall-through: collapse to the closest lower step within the same mode.
    rungs_for_mode = sorted(
        (p for (m, p) in _DEMOTE_TABLE if m == mode and p <= percent),
        reverse=True,
    )
    if rungs_for_mode:
        return _DEMOTE_TABLE[(mode, rungs_for_mode[0])]

    # No lower rung in same mode — drop to next-safer mode entirely.
    fallback = {
        "full": ("canary", 100),
        "canary": ("shadow", 25),
        "shadow": ("off", 0),
        "off": ("off", 0),
    }
    return fallback[mode]


# ---- Alert payload parsing -----------------------------------------------


def _extract_policy_name(envelope: dict[str, Any]) -> str | None:
    """Pull the alerting policy display name out of a Cloud Monitoring
    notification envelope. Cloud Monitoring delivers alerts as Pub/Sub
    messages whose data field is base64-encoded JSON; the JSON body
    follows the documented `incident.policy_name` schema.
    """
    # Pub/Sub envelope wraps the alert in `data` (base64).
    data_b64 = envelope.get("data")
    if not data_b64:
        return None
    try:
        decoded = base64.b64decode(data_b64).decode("utf-8")
        body = json.loads(decoded)
    except (ValueError, json.JSONDecodeError):
        return None
    incident = body.get("incident") or {}
    name = incident.get("policy_name")
    return str(name) if name else None


# ---- Main entrypoints ----------------------------------------------------


def auto_abort_pubsub(event: dict[str, Any], context: Any) -> None:
    """Cloud Function entrypoint — Pub/Sub trigger.

    `event` is the Pub/Sub message envelope; `context` is the
    `google.cloud.functions.Context` (unused here, kept for parity with
    the function-framework signature).
    """
    _ = context  # noqa: F841 — required by function-framework signature
    policy_name = _extract_policy_name(event) or "unknown_policy"

    db = _get_db()
    flag_ref = db.collection(FLAG_DOC_PATH.split("/", maxsplit=1)[0]).document(
        FLAG_DOC_PATH.split("/")[1]
    )

    transaction = db.transaction()

    @admin_firestore.transactional
    def _txn(txn: Any) -> dict[str, Any]:
        snap = flag_ref.get(transaction=txn)
        if not snap.exists:
            log.warning(
                "auto_abort.no_flag_doc",
                extra={"policy": policy_name, "path": FLAG_DOC_PATH},
            )
            return {"action": "no_op_no_doc"}

        data = snap.to_dict() or {}
        current_mode = str(data.get("parentCallSidecarMode") or "off")
        current_percent = int(data.get("parentCallSidecarPercent") or 0)

        next_mode, next_percent = _demote(current_mode, current_percent)

        if (next_mode, next_percent) == (current_mode, current_percent):
            log.info(
                "auto_abort.already_at_floor",
                extra={
                    "policy": policy_name,
                    "mode": current_mode,
                    "percent": current_percent,
                },
            )
            return {
                "action": "no_op_at_floor",
                "mode": current_mode,
                "percent": current_percent,
            }

        txn.update(
            flag_ref,
            {
                "parentCallSidecarMode": next_mode,
                "parentCallSidecarPercent": next_percent,
                "updatedAt": admin_firestore.SERVER_TIMESTAMP,
                "updatedBy": f"auto-abort:{policy_name}",
            },
        )
        return {
            "action": "demoted",
            "policy": policy_name,
            "fromMode": current_mode,
            "fromPercent": current_percent,
            "toMode": next_mode,
            "toPercent": next_percent,
        }

    result = _txn(transaction)

    # Single structured log line; Cloud Logging exporters key off `event`.
    log.info(json.dumps({"event": "parent_call.auto_abort", **result}))


def auto_abort_http(request: Any) -> tuple[str, int]:
    """Cloud Function entrypoint — HTTP trigger (for manual testing
    and dry-runs). Body is expected to be the same envelope shape the
    Pub/Sub trigger sees, so the same policy-name extraction logic runs.

    Returns the action JSON plus 200 on success.
    """
    try:
        envelope = request.get_json(silent=True) or {}
    except Exception:
        envelope = {}
    policy_name = _extract_policy_name(envelope) or envelope.get(
        "policy_name", "manual_test"
    )

    db = _get_db()
    flag_ref = db.collection(FLAG_DOC_PATH.split("/", maxsplit=1)[0]).document(
        FLAG_DOC_PATH.split("/")[1]
    )
    snap = flag_ref.get()
    if not snap.exists:
        return (
            json.dumps({"action": "no_op_no_doc", "policy": policy_name}),
            404,
        )
    data = snap.to_dict() or {}
    current_mode = str(data.get("parentCallSidecarMode") or "off")
    current_percent = int(data.get("parentCallSidecarPercent") or 0)
    next_mode, next_percent = _demote(current_mode, current_percent)

    dry_run = bool(envelope.get("dry_run"))

    if not dry_run and (next_mode, next_percent) != (current_mode, current_percent):
        flag_ref.update(
            {
                "parentCallSidecarMode": next_mode,
                "parentCallSidecarPercent": next_percent,
                "updatedAt": admin_firestore.SERVER_TIMESTAMP,
                "updatedBy": f"auto-abort-http:{policy_name}",
            }
        )

    body = {
        "policy": policy_name,
        "dryRun": dry_run,
        "fromMode": current_mode,
        "fromPercent": current_percent,
        "toMode": next_mode,
        "toPercent": next_percent,
    }
    return json.dumps(body), 200
