#!/usr/bin/env bash
# setup-build-trigger.sh
#
# Creates the Cloud Build trigger that fires on every push to a
# release/* branch and runs cloudbuild-release.yaml (two-region prod
# deploy, --no-traffic; promotion via scripts/release/promote-release.sh).
# Run ONCE after the Cloud Build GitHub App has been installed on the
# sargupta/sahayakai repository (see DEPLOY.md).
#
# The companion UAT trigger (push to main → cloudbuild-uat.yaml) is
# scripts/setup-build-trigger-uat.sh.
#
# Idempotent: deletes any existing trigger with the same name before
# creating, so updating the config (file path, branch, included files)
# is a single re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
PROJECT_NUMBER="${PROJECT_NUMBER:-640589855975}"
TRIGGER_NAME="${TRIGGER_NAME:-sahayakai-release-deploy}"
GITHUB_OWNER="${GITHUB_OWNER:-sargupta}"
GITHUB_REPO="${GITHUB_REPO:-sahayakai}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^release/.*$}"
BUILD_CONFIG="${BUILD_CONFIG:-sahayakai-main/cloudbuild-release.yaml}"
INCLUDED_FILES="${INCLUDED_FILES:-sahayakai-main/**}"
# Dedicated least-privilege deployer SA (created 2026-05-24, Task 21).
# Has the minimal roles needed for Cloud Build → Cloud Run deploy:
#   roles/cloudbuild.builds.builder
#   roles/run.admin
#   roles/artifactregistry.writer
#   roles/logging.logWriter
#   roles/secretmanager.secretAccessor
#   roles/iam.serviceAccountUser (on the Cloud Run runtime SA — compute SA)
# Previously used the default compute SA with roles/editor (overprivileged).
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-projects/$PROJECT_ID/serviceAccounts/cloudbuild-deployer@$PROJECT_ID.iam.gserviceaccount.com}"

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
    --description="On push to release/*: build & deploy sahayakai-hotfix-resilience to BOTH prod regions with --no-traffic. Promote via scripts/release/promote-release.sh."

echo
echo "Trigger created. Verify in console:"
echo "  https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo
echo "Test fire (uses HEAD of a release branch):"
echo "  gcloud beta builds triggers run $TRIGGER_NAME --branch=release/<date> --project=$PROJECT_ID"
