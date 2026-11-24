#!/usr/bin/env bash
# setup-grow-persona-pool-cron.sh
#
# Creates/updates the Cloud Scheduler job that fires
# POST /api/jobs/grow-persona-pool?count=5 once a week. Each weekly
# run adds ~5 new AI teacher personas to the runtime pool, simulating
# organic teacher onboarding so the community doesn't look like the
# same fixed set of names cycling forever.
#
# Idempotent. Safe to rerun.
#
# Usage:
#   SERVICE_URL=https://sahayakai-hotfix-resilience-<n>.asia-southeast1.run.app \
#   SA_EMAIL=640589855975-compute@developer.gserviceaccount.com \
#   ./scripts/setup-grow-persona-pool-cron.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SCHEDULER_REGION="${SCHEDULER_REGION:-asia-south1}"
JOB_NAME="${JOB_NAME:-sahayakai-grow-persona-pool}"
# Every Monday at 04:00 IST — quiet time, finished before peak posting hours.
SCHEDULE="${SCHEDULE:-0 4 * * 1}"
TIME_ZONE="${TIME_ZONE:-Asia/Kolkata}"
COUNT="${COUNT:-5}"

: "${SERVICE_URL:?Set SERVICE_URL to the Cloud Run service URL}"
: "${SA_EMAIL:?Set SA_EMAIL to a service account with roles/run.invoker on the service}"

TARGET_URI="${SERVICE_URL%/}/api/jobs/grow-persona-pool?count=${COUNT}"

echo "Project:          $PROJECT_ID"
echo "Scheduler region: $SCHEDULER_REGION"
echo "Job name:         $JOB_NAME"
echo "Schedule (cron):  $SCHEDULE ($TIME_ZONE) == Monday 04:00 IST"
echo "Target:           $TARGET_URI"
echo "Invoker SA:       $SA_EMAIL"
echo "Personas/run:     $COUNT"
echo

if gcloud scheduler jobs describe "$JOB_NAME" \
      --project="$PROJECT_ID" \
      --location="$SCHEDULER_REGION" >/dev/null 2>&1; then
    echo "Existing job found — deleting for clean re-create."
    gcloud scheduler jobs delete "$JOB_NAME" \
        --project="$PROJECT_ID" \
        --location="$SCHEDULER_REGION" \
        --quiet
fi

echo "Creating job..."
gcloud scheduler jobs create http "$JOB_NAME" \
    --project="$PROJECT_ID" \
    --location="$SCHEDULER_REGION" \
    --schedule="$SCHEDULE" \
    --time-zone="$TIME_ZONE" \
    --uri="$TARGET_URI" \
    --http-method=POST \
    --oidc-service-account-email="$SA_EMAIL" \
    --oidc-token-audience="$SERVICE_URL" \
    --attempt-deadline=180s

echo
echo "Done. Verify with:"
echo "  gcloud scheduler jobs describe $JOB_NAME --location=$SCHEDULER_REGION --project=$PROJECT_ID"
echo "Force a manual run with:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$SCHEDULER_REGION --project=$PROJECT_ID"
