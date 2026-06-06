#!/usr/bin/env bash
# Deploy Cloud Monitoring alert policies for the ADK migration.
#
# Usage:
#   bash scripts/deploy-alerts.sh                # plan (dry-run, default)
#   bash scripts/deploy-alerts.sh --apply        # create/update policies + log metrics
#   bash scripts/deploy-alerts.sh --apply --only 04   # only policy 04
#
# Idempotent: looks up an existing policy by displayName; updates in place
# if found, otherwise creates. Same logic for log-based metrics and the
# uptime check.
#
# Prereqs:
#   - gcloud auth with monitoring.alertPolicies.{list,create,update}
#   - PROJECT_ID (default sahayakai-b4248)
#   - Notification channels (page + email). Override via env vars:
#       PAGE_CHANNEL=projects/<p>/notificationChannels/<id>
#       WARN_CHANNEL=projects/<p>/notificationChannels/<id>
#       SECURITY_CHANNEL=projects/<p>/notificationChannels/<id>
#
# If channels are not set, the script falls back to the existing channels:
#   - PAGE / SECURITY  → parent-call auto-abort pubsub (6266857225070447300)
#   - WARN             → Abhishek G email (14759337832897576982)
#
# Run `gcloud config set auth/impersonate_service_account ...` first if
# you need to impersonate a service account.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
REGION="${REGION:-asia-southeast1}"
PROD_HOST="${PROD_HOST:-sahayakai.com}"
PROD_HEALTH_PATH="${PROD_HEALTH_PATH:-/api/health}"

# Default channels (resolved from `gcloud alpha monitoring channels list`).
DEFAULT_PAGE_CHANNEL="projects/${PROJECT_ID}/notificationChannels/6266857225070447300"
DEFAULT_EMAIL_CHANNEL="projects/${PROJECT_ID}/notificationChannels/14759337832897576982"

PAGE_CHANNEL="${PAGE_CHANNEL:-$DEFAULT_PAGE_CHANNEL}"
WARN_CHANNEL="${WARN_CHANNEL:-$DEFAULT_EMAIL_CHANNEL}"
SECURITY_CHANNEL="${SECURITY_CHANNEL:-$DEFAULT_PAGE_CHANNEL}"

APPLY=0
ONLY=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --only) ONLY="$2"; shift ;;
    -h|--help)
      sed -n '1,30p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
  shift
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
POLICY_DIR="${ROOT}/infra/monitoring"

run() {
  if [[ $APPLY -eq 1 ]]; then
    echo "+ $*"
    eval "$@"
  else
    echo "[plan] $*"
  fi
}

# ---------------------------------------------------------------------------
# 1. Ensure log-based metrics exist.
# ---------------------------------------------------------------------------
ensure_distribution_metric() {
  local name="$1" description="$2" filter="$3" extractor="$4"
  if gcloud logging metrics describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "metric $name exists — skipping"
    return
  fi
  echo "creating distribution metric $name"
  run "gcloud logging metrics create '$name' --project='$PROJECT_ID' --description='$description' --log-filter='$filter' --value-extractor='$extractor' --metric-descriptor-unit=ms --metric-descriptor-metric-kind=DELTA --metric-descriptor-value-type=DISTRIBUTION"
}

ensure_counter_metric() {
  local name="$1" description="$2" filter="$3"
  local labels="${4:-}"
  if gcloud logging metrics describe "$name" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "metric $name exists — skipping"
    return
  fi
  echo "creating counter metric $name"
  local label_flag=""
  if [[ -n "$labels" ]]; then
    label_flag="--label-extractors='$labels'"
  fi
  run "gcloud logging metrics create '$name' --project='$PROJECT_ID' --description='$description' --log-filter='$filter' $label_flag"
}

echo "== ensuring log-based metrics =="

ensure_distribution_metric \
  "dispatcher_complete_sidecar_latency" \
  "elapsedMs from dispatcher.complete events where source=sidecar" \
  'jsonPayload.event="dispatcher.complete" AND jsonPayload.source="sidecar"' \
  'EXTRACT(jsonPayload.elapsedMs)'

ensure_distribution_metric \
  "dispatcher_complete_genkit_latency" \
  "elapsedMs from dispatcher.complete events where source=genkit_fallback" \
  'jsonPayload.event="dispatcher.complete" AND jsonPayload.source="genkit_fallback"' \
  'EXTRACT(jsonPayload.elapsedMs)'

ensure_counter_metric \
  "dispatcher_complete_total" \
  "total dispatcher.complete events per agent" \
  'jsonPayload.event="dispatcher.complete"' \
  'agent:EXTRACT(jsonPayload.agent)'

ensure_counter_metric \
  "dispatcher_complete_fallback" \
  "dispatcher.complete events using genkit fallback, per agent" \
  'jsonPayload.event="dispatcher.complete" AND jsonPayload.source="genkit_fallback"' \
  'agent:EXTRACT(jsonPayload.agent)'

ensure_counter_metric \
  "dispatcher_error_5xx" \
  "dispatcher.error events with status >= 500, per agent" \
  'jsonPayload.event="dispatcher.error" AND jsonPayload.status>=500' \
  'agent:EXTRACT(jsonPayload.agent)'

ensure_counter_metric \
  "sidecar_appcheck_failed" \
  "sidecar AppCheck verification failures" \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="sahayakai-agents" AND (jsonPayload.event="appcheck.verify_failed" OR httpRequest.status=401)' \
  ""

# ---------------------------------------------------------------------------
# 2. Ensure uptime check exists (policy 7).
# ---------------------------------------------------------------------------
echo "== ensuring uptime check =="
if gcloud monitoring uptime list-configs --project="$PROJECT_ID" --format='value(displayName)' 2>/dev/null | grep -q '^sahayakai-prod-api-health$'; then
  echo "uptime check sahayakai-prod-api-health exists — skipping"
else
  echo "creating uptime check sahayakai-prod-api-health → https://${PROD_HOST}${PROD_HEALTH_PATH}"
  TMP=$(mktemp)
  cat > "$TMP" <<EOF
displayName: sahayakai-prod-api-health
monitoredResource:
  type: uptime_url
  labels:
    host: ${PROD_HOST}
    project_id: ${PROJECT_ID}
httpCheck:
  path: ${PROD_HEALTH_PATH}
  port: 443
  useSsl: true
  validateSsl: true
  requestMethod: GET
  acceptedResponseStatusCodes:
    - statusClass: STATUS_CLASS_2XX
period: 60s
timeout: 10s
selectedRegions:
  - USA
  - EUROPE
  - ASIA_PACIFIC
EOF
  run "gcloud monitoring uptime create-config --config-from-file='$TMP' --project='$PROJECT_ID' || gcloud alpha monitoring uptime create --config-from-file='$TMP' --project='$PROJECT_ID'"
  rm -f "$TMP"
fi

# ---------------------------------------------------------------------------
# 3. Apply alert policies.
# ---------------------------------------------------------------------------
upsert_policy() {
  local yaml="$1" channels="$2"
  local title
  title=$(grep -E '^displayName:' "$yaml" | head -1 | sed -E 's/^displayName:[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/')
  echo "-- $title"

  # Build a temp YAML with notificationChannels injected.
  local tmp; tmp=$(mktemp)
  cp "$yaml" "$tmp"
  {
    echo ""
    echo "notificationChannels:"
    IFS=',' read -ra CHS <<< "$channels"
    for ch in "${CHS[@]}"; do
      echo "  - ${ch}"
    done
  } >> "$tmp"

  # Look up existing by displayName.
  local existing
  existing=$(gcloud monitoring policies list --project="$PROJECT_ID" \
    --filter="displayName=\"$title\"" --format='value(name)' 2>/dev/null | head -1)

  if [[ -n "$existing" ]]; then
    echo "   updating $existing"
    run "gcloud monitoring policies update '$existing' --policy-from-file='$tmp' --project='$PROJECT_ID'"
  else
    echo "   creating new"
    run "gcloud monitoring policies create --policy-from-file='$tmp' --project='$PROJECT_ID'"
  fi
  rm -f "$tmp"
}

channels_for() {
  case "$1" in
    01) echo "$PAGE_CHANNEL,$WARN_CHANNEL" ;;
    02) echo "$WARN_CHANNEL" ;;
    03) echo "$WARN_CHANNEL" ;;
    04) echo "$SECURITY_CHANNEL,$WARN_CHANNEL" ;;
    05) echo "$WARN_CHANNEL" ;;
    06) echo "$WARN_CHANNEL" ;;
    07) echo "$PAGE_CHANNEL,$WARN_CHANNEL" ;;
    08) echo "$PAGE_CHANNEL,$WARN_CHANNEL" ;;
    *)  echo "$WARN_CHANNEL" ;;
  esac
}

echo "== applying policies =="
for yaml in "$POLICY_DIR"/*.yaml; do
  base=$(basename "$yaml")
  num="${base%%-*}"
  if [[ -n "$ONLY" && "$num" != "$ONLY" ]]; then
    continue
  fi
  channels="$(channels_for "$num")"
  upsert_policy "$yaml" "$channels"
done

if [[ $APPLY -eq 0 ]]; then
  echo ""
  echo "Plan complete. Re-run with --apply to create/update policies."
fi
