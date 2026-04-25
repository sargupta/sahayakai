#!/usr/bin/env bash
# setup-community-agent-cron.sh
#
# Creates/updates the Cloud Scheduler job that fires
# POST /api/jobs/ai-community-agent every 3 hours. Each run posts
# 1-2 Staff Room chats, 1 group post, and 2-3 likes from random AI
# teacher personas — keeps the community feed organically active
# between real-teacher activity.
#
# Idempotent. Safe to rerun.
#
# Usage:
#   SERVICE_URL=https://sahayakai-hotfix-resilience-<n>.asia-southeast1.run.app \
#   SA_EMAIL=640589855975-compute@developer.gserviceaccount.com \
#   ./scripts/setup-community-agent-cron.sh

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SCHEDULER_REGION="${SCHEDULER_REGION:-asia-south1}"
JOB_NAME="${JOB_NAME:-sahayakai-community-agent}"
# Every 3 hours on the hour, IST. Roughly 8 firings per day, covering
# typical Indian-teacher waking hours plus a couple of overnight runs.
SCHEDULE="${SCHEDULE:-0 */3 * * *}"
TIME_ZONE="${TIME_ZONE:-Asia/Kolkata}"

: "${SERVICE_URL:?Set SERVICE_URL to the Cloud Run service URL}"
: "${SA_EMAIL:?Set SA_EMAIL to a service account with roles/run.invoker on the service}"

TARGET_URI="${SERVICE_URL%/}/api/jobs/ai-community-agent"

echo "Project:          $PROJECT_ID"
echo "Scheduler region: $SCHEDULER_REGION"
echo "Job name:         $JOB_NAME"
echo "Schedule (cron):  $SCHEDULE ($TIME_ZONE) == every 3 h"
echo "Target:           $TARGET_URI"
echo "Invoker SA:       $SA_EMAIL"
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
    --attempt-deadline=120s

echo
echo "Done. Verify with:"
echo "  gcloud scheduler jobs describe $JOB_NAME --location=$SCHEDULER_REGION --project=$PROJECT_ID"
echo "Force a manual run with:"
echo "  gcloud scheduler jobs run $JOB_NAME --location=$SCHEDULER_REGION --project=$PROJECT_ID"
