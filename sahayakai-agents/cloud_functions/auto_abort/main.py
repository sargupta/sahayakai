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
import binascii
import json
import logging
import os
from datetime import UTC, datetime, timedelta
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

    Round-2 audit P0 LADDER-1 fix (30-agent review, group C1):
    the previous fall-through "collapse to lowest rung in same mode"
    PROMOTED `canary @ 0` (operator paused) to `shadow @ 25` because
    no canary rung is ≤ 0. The auto-abort function MUST never promote
    a rollout, ever — its entire job is to dampen.

    New fall-through rules:
    - direct ladder hit → demote per table
    - off-ladder percent: collapse to the next LOWER rung in same mode
    - if current percent is BELOW the lowest rung of the current mode
      (operator paused), the safest move is `off / 0` — never bump
      back up to a higher-traffic mode

    Examples:
    - `canary, 0` → `off, 0` (was: `shadow, 25`)
    - `canary, -5` (clamped to 0) → `off, 0` (was: `shadow, 25`)
    - `canary, 75` → `canary, 25` (closest lower rung)
    - `shadow, 0` → `off, 0` (mapped explicitly in table)
    - `shadow, -10` (clamped to 0) → `off, 0`
    - `garbage, 50` → `off, 0` (unknown mode → off; defensive)
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

    # No lower rung in same mode (e.g. canary @ 0, shadow @ 0). Demote
    # to off — NEVER promote to a higher-traffic mode.
    return ("off", 0)


# ---- Alert payload parsing -----------------------------------------------


def _parse_alert_envelope(envelope: dict[str, Any]) -> dict[str, Any] | None:
    """Decode the Cloud Monitoring alert payload from either:

    - **Pub/Sub** envelope: `{"data": <base64-encoded-JSON>}`. Used by the
      gen2 Pub/Sub-trigger path (`auto_abort_pubsub`).
    - **HTTP webhook** envelope: the alert JSON delivered directly as
      the request body, no `data`/`message` wrapper. Used by the
      manual-test path (`auto_abort_http`).
    - **Push subscription** envelope: `{"message": {"data": "..."}}`,
      where `message.data` is base64-encoded.

    Returns the parsed `incident` dict (or any top-level alert payload)
    or None if the envelope can't be decoded.
    """
    # Push-subscription envelope: unwrap `message.data` first.
    if isinstance(envelope.get("message"), dict):
        envelope = envelope["message"]

    data_b64 = envelope.get("data")
    if data_b64:
        try:
            decoded = base64.b64decode(data_b64).decode("utf-8")
            parsed: Any = json.loads(decoded)
            return parsed if isinstance(parsed, dict) else None
        except (ValueError, json.JSONDecodeError, binascii.Error):
            return None

    # Webhook delivers the body directly. If it has an `incident` key or
    # `policy_name`, treat it as the alert payload.
    if "incident" in envelope or "policy_name" in envelope:
        return envelope
    return None


def _extract_policy_name(envelope: dict[str, Any]) -> str | None:
    """Backwards-compat: returns just the policy_name string (or None)."""
    body = _parse_alert_envelope(envelope)
    if not body:
        return None
    incident = body.get("incident") or body
    name = incident.get("policy_name")
    return str(name) if name else None


def _is_recovery(envelope: dict[str, Any]) -> bool:
    """Cloud Monitoring sends a SECOND notification when an incident
    closes (state=closed). Without this check we would demote on
    RESOLVE — exact opposite of intent.

    Round-2 audit P0 RECOVERY-1 fix (30-agent review, group C4).
    """
    body = _parse_alert_envelope(envelope)
    if not body:
        return False
    incident = body.get("incident") or body
    state = str(incident.get("state") or "").lower()
    if state in {"closed", "resolved", "ok"}:
        return True
    return bool(incident.get("ended_at") or incident.get("closed_at"))


def _extract_incident_id(envelope: dict[str, Any]) -> str | None:
    """Cloud Monitoring includes a unique `incident_id` per alert. Used
    as the dedupe key so multiple Pub/Sub deliveries (at-least-once) +
    multiple alert policies firing on the same root cause don't cascade
    multiple demotions.

    Round-2 audit P0 DEDUPE-1 fix (30-agent review, group C1, C2).
    """
    body = _parse_alert_envelope(envelope)
    if not body:
        return None
    incident = body.get("incident") or body
    iid = incident.get("incident_id") or incident.get("incident_id_v2")
    return str(iid) if iid else None


# ---- Main entrypoints ----------------------------------------------------


DEDUPE_COLLECTION = "agent_auto_abort_seen"
DEDUPE_TTL_HOURS = 24  # incidents stay open hours; 24h is a safe upper bound


def auto_abort_pubsub(event: dict[str, Any], context: Any) -> None:
    """Cloud Function entrypoint — Pub/Sub trigger.

    `event` is the Pub/Sub message envelope; `context` is the
    `google.cloud.functions.Context` (unused here, kept for parity with
    the function-framework signature).
    """
    _ = context  # noqa: F841 — required by function-framework signature

    # Round-2 audit P0 RECOVERY-1: skip recovery / "incident closed"
    # notifications. Cloud Monitoring sends one notification on FIRE
    # and another on RESOLVE; the resolve event still includes
    # policy_name + incident_id but the resolve notification means the
    # alert condition cleared — definitely not a reason to demote.
    if _is_recovery(event):
        log.info(
            json.dumps(
                {
                    "event": "parent_call.auto_abort.recovery_ignored",
                    "policy": _extract_policy_name(event) or "unknown",
                }
            )
        )
        return

    policy_name = _extract_policy_name(event)

    # Round-2 audit P0 UNKNOWN-1: bail when policy_name is missing.
    # `unknown_policy` previously demoted production traffic for any
    # malformed payload (test pings, schema drift, manual curl). The
    # safer default is a no-op — a malformed envelope means we have
    # NO signal, not a fire signal.
    if not policy_name:
        log.warning(
            json.dumps(
                {
                    "event": "parent_call.auto_abort.unknown_policy",
                    "envelope_keys": sorted(event.keys()) if isinstance(event, dict) else None,
                }
            )
        )
        return

    db = _get_db()

    # Round-2 audit P0 DEDUPE-1: incident-id dedupe. Multiple Pub/Sub
    # deliveries (at-least-once) + multiple alert policies firing on
    # the same root cause used to cascade multiple demotions per
    # incident, blowing through several rungs of the ladder in seconds.
    # Now: a successful demote writes `incident_id` to a sentinel doc
    # with TTL; subsequent fires for the same incident no-op.
    incident_id = _extract_incident_id(event)
    if incident_id:
        seen_ref = db.collection(DEDUPE_COLLECTION).document(incident_id)
        seen_snap = seen_ref.get()
        if seen_snap.exists:
            log.info(
                json.dumps(
                    {
                        "event": "parent_call.auto_abort.duplicate_ignored",
                        "incident_id": incident_id,
                        "policy": policy_name,
                    }
                )
            )
            return

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

    # Mark the incident as processed so subsequent at-least-once
    # deliveries no-op. TTL via `expireAt` so the sentinel collection
    # doesn't grow unbounded — Firestore TTL purges after the window.
    if incident_id and result.get("action") == "demoted":
        seen_ref = db.collection(DEDUPE_COLLECTION).document(incident_id)
        seen_ref.set(
            {
                "policy": policy_name,
                "demotedAt": datetime.now(UTC),
                "expireAt": datetime.now(UTC) + timedelta(hours=DEDUPE_TTL_HOURS),
            }
        )

    # Single structured log line; Cloud Logging exporters key off `event`.
    log.info(
        json.dumps({"event": "parent_call.auto_abort", "incidentId": incident_id, **result})
    )


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
