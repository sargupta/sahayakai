#!/usr/bin/env bash
# setup-build-trigger-preview.sh
#
# Creates the Cloud Build trigger that fires on every push to develop
# and runs cloudbuild-preview.yaml. Run ONCE after the Cloud Build
# GitHub App has been installed on the sargupta/sahayakai repository
# (the same install used by setup-build-trigger.sh).
#
# Idempotent: deletes any existing trigger with the same name before
# creating, so updating the config (file path, branch, included files)
# is a single re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
PROJECT_NUMBER="${PROJECT_NUMBER:-640589855975}"
TRIGGER_NAME="${TRIGGER_NAME:-sahayakai-preview-deploy}"
GITHUB_OWNER="${GITHUB_OWNER:-sargupta}"
GITHUB_REPO="${GITHUB_REPO:-sahayakai}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^develop$}"
BUILD_CONFIG="${BUILD_CONFIG:-sahayakai-main/cloudbuild-preview.yaml}"
INCLUDED_FILES="${INCLUDED_FILES:-sahayakai-main/**}"
# Org policy requires a user-managed service account (no Google-managed
# default). Same compute SA prod uses — has the roles needed for
# Cloud Build + Cloud Run deploy.
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-projects/$PROJECT_ID/serviceAccounts/$PROJECT_NUMBER-compute@developer.gserviceaccount.com}"

echo "Project:           $PROJECT_ID"
echo "Trigger:           $TRIGGER_NAME"
echo "Repo:              github.com/$GITHUB_OWNER/$GITHUB_REPO"
echo "Branch pattern:    $BRANCH_PATTERN"
echo "Build config:      $BUILD_CONFIG"
echo "Included files:    $INCLUDED_FILES"
echo "Build SA:          $BUILD_SERVICE_ACCOUNT"
echo

if gcloud beta builds triggers describe "$TRIGGER_NAME" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Existing trigger found — deleting for clean re-create."
    gcloud beta builds triggers delete "$TRIGGER_NAME" --project="$PROJECT_ID" --quiet
fi

echo "Creating trigger..."
gcloud beta builds triggers create github \
    --project="$PROJECT_ID" \
    --name="$TRIGGER_NAME" \
    --repo-owner="$GITHUB_OWNER" \
    --repo-name="$GITHUB_REPO" \
    --branch-pattern="$BRANCH_PATTERN" \
    --build-config="$BUILD_CONFIG" \
    --included-files="$INCLUDED_FILES" \
    --service-account="$BUILD_SERVICE_ACCOUNT" \
    --description="On push to develop: build & deploy sahayakai-preview (staging tier). Routes 100% traffic immediately — preview is low-stakes."

echo
echo "Trigger created. Verify in console:"
echo "  https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo
echo "Test fire (uses HEAD of develop):"
echo "  gcloud beta builds triggers run $TRIGGER_NAME --branch=develop --project=$PROJECT_ID"
