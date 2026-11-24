#!/usr/bin/env bash
# setup-daily-briefing-cron.sh
#
# Creates/updates the Cloud Scheduler job that fires POST /api/jobs/daily-briefing
# every day at 8:00 AM IST. Without this job nothing posts AI briefings to the
# daily_briefing community group.
#
# Idempotent: if the job exists it is deleted and re-created with the latest
# config, so you can rerun after changing URL / schedule / service account.
#
# Pre-requisites:
#   - gcloud SDK installed and authenticated
#   - Cloud Scheduler API enabled on the project
#   - The Cloud Run service has already been deployed once (need its URL)
#   - A service account exists with roles/run.invoker on the service
#
# Usage:
#   SERVICE_URL=https://sahayakai-<hash>-<region>.run.app \
#   SA_EMAIL=sahayakai-scheduler@sahayakai-b4248.iam.gserviceaccount.com \
#   ./scripts/setup-daily-briefing-cron.sh
#
# Override schedule / region / project by exporting those env vars too.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SCHEDULER_REGION="${SCHEDULER_REGION:-asia-south1}"   # Mumbai — closest to IST users
JOB_NAME="${JOB_NAME:-sahayakai-daily-briefing}"
SCHEDULE="${SCHEDULE:-30 2 * * *}"                     # 02:30 UTC == 08:00 IST daily
TIME_ZONE="${TIME_ZONE:-Asia/Kolkata}"

: "${SERVICE_URL:?Set SERVICE_URL to the Cloud Run service URL, e.g. https://sahayakai-<hash>-asia-southeast1.run.app}"
: "${SA_EMAIL:?Set SA_EMAIL to a service account with roles/run.invoker on the service}"

TARGET_URI="${SERVICE_URL%/}/api/jobs/daily-briefing"

echo "Project:          $PROJECT_ID"
echo "Scheduler region: $SCHEDULER_REGION"
echo "Job name:         $JOB_NAME"
echo "Schedule (cron):  $SCHEDULE ($TIME_ZONE) == 08:00 IST"
echo "Target:           $TARGET_URI"
echo "Invoker SA:       $SA_EMAIL"
echo

# Delete first so this script can run repeatedly with updated config.
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
