#!/usr/bin/env bash
# Parent-call log-based metrics and alert policies (sahayakai-b4248).
#
# NOT run automatically. An operator applies this once, after review:
#   PROJECT=sahayakai-b4248 NOTIFICATION_CHANNEL=projects/.../notificationChannels/... \
#     bash sahayakai-agents/deploy/monitoring/parent-call-monitoring.sh
#
# Idempotent: existing metrics are updated, not duplicated. Signals come from
# the telephony bridge (structlog JSON, event name in jsonPayload.event) and the
# web app's Vobiz webhooks. See docs/calling/PARENT_CALL_AUDIT_2026-10-08.md §7.
set -euo pipefail
PROJECT="${PROJECT:?set PROJECT}"
TEL='resource.type="cloud_run_revision" AND resource.labels.service_name="sahayakai-telephony"'

metric() { # name, description, filter
  if gcloud logging metrics describe "$1" --project "$PROJECT" >/dev/null 2>&1; then
    gcloud logging metrics update "$1" --project "$PROJECT" --description "$2" --log-filter "$3"
  else
    gcloud logging metrics create "$1" --project "$PROJECT" --description "$2" --log-filter "$3"
  fi
}

# The 2026-10-08 outage: the media socket opened >3 s after the parent answered.
metric parent_call_slow_admit \
  "Parent call media socket accepted >3s after answer (cold start / overload)" \
  "$TEL AND jsonPayload.event=\"telephony.slow_admit\""

# The conversation engine (Gemini Live) never came up; the parent heard only the opener.
metric parent_call_live_unavailable \
  "Parent call: conversation engine failed to connect" \
  "$TEL AND jsonPayload.event=\"telephony.call_failed\" AND jsonPayload.reason=\"live_unavailable\""

# Any bridge error mid-call.
metric parent_call_bridge_error \
  "Parent call: bridge error after connect" \
  "$TEL AND jsonPayload.event=\"telephony.call_failed\" AND jsonPayload.reason=\"error\""

# Opt-outs that could not be saved (compliance: the parent may be re-dialled).
metric parent_call_opt_out_lost \
  "Parent call: opt-out not persisted" \
  "$TEL AND jsonPayload.event=(\"telephony.opt_out_lost\" OR \"telephony.opt_out_no_phone\")"

# Every finished call, for the success/failure dashboard (group by jsonPayload.reason).
metric parent_call_closed \
  "Parent call closed (any reason)" \
  "$TEL AND jsonPayload.event=\"telephony.call_closed\""

if [[ -n "${NOTIFICATION_CHANNEL:-}" ]]; then
  for m in parent_call_slow_admit parent_call_live_unavailable parent_call_opt_out_lost; do
    sed -e "s#__METRIC__#$m#g" -e "s#__CHANNEL__#$NOTIFICATION_CHANNEL#g" \
      "$(dirname "$0")/alert-policy.template.json" > "/tmp/$m-policy.json"
    gcloud alpha monitoring policies create --project "$PROJECT" --policy-from-file "/tmp/$m-policy.json"
  done
else
  echo "NOTIFICATION_CHANNEL unset: metrics created, alert policies skipped."
fi
