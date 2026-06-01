#!/usr/bin/env bash
###############################################################################
# Install production error alerts for sahayakai-b4248.
#
# Usage:   ./install-prod-error-alerts.sh <notification-email>
# Example: ./install-prod-error-alerts.sh abhi.ist.15@gmail.com
#
# Idempotent — re-runnable. ALREADY_EXISTS errors from gcloud are swallowed.
# See prod-error-alerts.md for the full breakdown of what each policy does.
###############################################################################
set -uo pipefail  # NOT -e: we WANT to continue past ALREADY_EXISTS errors

PROJECT_ID="sahayakai-b4248"
EMAIL="${1:-}"

if [[ -z "$EMAIL" ]]; then
  echo "Usage: $0 <notification-email>"
  echo "Example: $0 abhi.ist.15@gmail.com"
  exit 1
fi

if ! command -v gcloud &>/dev/null; then
  echo "ERROR: gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
  exit 1
fi

ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null)"
if [[ -z "$ACTIVE_ACCOUNT" ]]; then
  echo "ERROR: no active gcloud account. Run: gcloud auth login"
  exit 1
fi

echo "→ Project:   $PROJECT_ID"
echo "→ Email:     $EMAIL"
echo "→ As:        $ACTIVE_ACCOUNT"
echo

# ─── 1. Notification channel ────────────────────────────────────────────────
echo "[1/4] Creating email notification channel…"
CHANNEL_NAME="$(
  gcloud alpha monitoring channels list \
    --project="$PROJECT_ID" \
    --filter="type=email AND labels.email_address=$EMAIL" \
    --format="value(name)" 2>/dev/null | head -n1
)"

if [[ -z "$CHANNEL_NAME" ]]; then
  CHANNEL_NAME="$(
    gcloud alpha monitoring channels create \
      --project="$PROJECT_ID" \
      --display-name="Prod Errors Email — Abhishek" \
      --type=email \
      --channel-labels=email_address="$EMAIL" \
      --format="value(name)"
  )"
  echo "    created: $CHANNEL_NAME"
else
  echo "    reusing: $CHANNEL_NAME"
fi
echo

# ─── 2. Log-based metrics ───────────────────────────────────────────────────
echo "[2/4] Creating log-based metrics…"

create_metric() {
  local name="$1"; shift
  local desc="$1"; shift
  local filter="$1"; shift
  if gcloud logging metrics describe "$name" --project="$PROJECT_ID" &>/dev/null; then
    echo "    exists:  $name"
  else
    gcloud logging metrics create "$name" \
      --project="$PROJECT_ID" \
      --description="$desc" \
      --log-filter="$filter" \
      && echo "    created: $name"
  fi
}

create_metric "prod_error_count" \
  "All ERROR-severity logs (7d audit showed 682/wk)" \
  'severity>=ERROR'

create_metric "prod_cloud_run_oom" \
  "Cloud Run container exceeded memory limit" \
  'resource.type="cloud_run_revision"
   AND textPayload:"Memory limit of"
   AND textPayload:"exceeded"'

create_metric "prod_typeerror_count" \
  "App-level TypeErrors (undefined-property crashes)" \
  'severity>=ERROR
   AND jsonPayload.error.name="TypeError"'
echo

# ─── 3. Alert policies ──────────────────────────────────────────────────────
echo "[3/4] Creating alert policies…"

TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

create_policy() {
  local display="$1"; shift
  local yaml_file="$1"; shift

  if gcloud alpha monitoring policies list \
       --project="$PROJECT_ID" \
       --filter="displayName=$display" \
       --format="value(name)" 2>/dev/null | grep -q .; then
    echo "    exists:  $display"
    return
  fi

  gcloud alpha monitoring policies create \
    --project="$PROJECT_ID" \
    --policy-from-file="$yaml_file" \
    && echo "    created: $display"
}

# Policy A — any sustained error rate (zero-tolerance posture)
# Threshold = 5 per 10 min, NOT 50/hour. Rationale: after the 2026-06-01
# patches the baseline drops to <1/hour. Anything sustaining above ~5 per
# 10 minutes is a real regression, not noise — page immediately so no
# error signature gets to "let's look at it next week".
cat > "$TMPDIR/policy-error-rate-spike.yaml" <<EOF
displayName: prod-error-rate-spike
documentation:
  content: |
    More than 5 ERROR logs in 10 minutes. Post-2026-06-01 baseline is
    near-zero; any sustained error rate is a regression. Open Logs Explorer:
    https://console.cloud.google.com/logs/query;query=severity%3E%3DERROR;timeRange=PT10M?project=sahayakai-b4248
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: ERROR logs > 5 per 10 min
    conditionThreshold:
      filter: |
        metric.type="logging.googleapis.com/user/prod_error_count"
        AND resource.type="global"
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 5
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 604800s
notificationChannels:
  - $CHANNEL_NAME
EOF

# Policy B — Cloud Run OOM
cat > "$TMPDIR/policy-cloud-run-oom.yaml" <<EOF
displayName: prod-cloud-run-oom
documentation:
  content: |
    A Cloud Run container hit its memory limit. SSR service
    (ssrsahayakaib4248) was on 256 MiB — bump to 512 MiB if not done:
      gcloud run services update ssrsahayakaib4248 \\
        --region=asia-southeast1 --memory=512Mi --project=sahayakai-b4248
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: Any OOM in 10 min
    conditionThreshold:
      filter: |
        metric.type="logging.googleapis.com/user/prod_cloud_run_oom"
        AND resource.type="cloud_run_revision"
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 86400s
notificationChannels:
  - $CHANNEL_NAME
EOF

# Policy C — any TypeError (zero-tolerance)
# Threshold = 0 (any occurrence). Every undefined-property crash hits a
# real user with a 500 — these don't deserve a tolerance window. If this
# fires too often post-deploy, the right answer is to fix the regression,
# not to raise the threshold.
cat > "$TMPDIR/policy-typeerror-burst.yaml" <<EOF
displayName: prod-typeerror-any
documentation:
  content: |
    A TypeError was logged. Every TypeError = a real user got a 500
    because some code path read a property on undefined. Open the log
    entry, get the stack, find the call site, ship the optional-chain
    guard. Past root causes: cfg.features?.[name] in feature-flags.ts,
    new PassThrough() in /api/export (already fixed).
    Filter:
    https://console.cloud.google.com/logs/query;query=severity%3E%3DERROR%20AND%20jsonPayload.error.name%3D%22TypeError%22;timeRange=PT1H?project=sahayakai-b4248
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: Any TypeError in 5 min
    conditionThreshold:
      filter: |
        metric.type="logging.googleapis.com/user/prod_typeerror_count"
        AND resource.type="cloud_run_revision"
      aggregations:
        - alignmentPeriod: 300s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 86400s
notificationChannels:
  - $CHANNEL_NAME
EOF

create_policy "prod-error-rate-spike"  "$TMPDIR/policy-error-rate-spike.yaml"
create_policy "prod-cloud-run-oom"     "$TMPDIR/policy-cloud-run-oom.yaml"
create_policy "prod-typeerror-any"     "$TMPDIR/policy-typeerror-burst.yaml"
echo

# ─── 4. Verify ──────────────────────────────────────────────────────────────
echo "[4/4] Installed policies:"
gcloud alpha monitoring policies list \
  --project="$PROJECT_ID" \
  --filter="displayName:prod-" \
  --format="table(displayName,enabled,conditions[0].displayName)"

echo
echo "Done. First email will arrive the next time a threshold trips."
echo "To test the email channel now (sends a sample to $EMAIL):"
echo "  gcloud alpha monitoring channels verify $CHANNEL_NAME --project=$PROJECT_ID"
