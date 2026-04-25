#!/usr/bin/env bash
# setup-build-trigger.sh
#
# Creates the Cloud Build trigger that fires on every push to main and
# runs cloudbuild.yaml. Run ONCE after the Cloud Build GitHub App has
# been installed on the sargupta/sahayakai repository (see DEPLOY.md).
#
# Idempotent: deletes any existing trigger with the same name before
# creating, so updating the config (file path, branch, included files)
# is a single re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
TRIGGER_NAME="${TRIGGER_NAME:-sahayakai-main-deploy}"
GITHUB_OWNER="${GITHUB_OWNER:-sargupta}"
GITHUB_REPO="${GITHUB_REPO:-sahayakai}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^main$}"
BUILD_CONFIG="${BUILD_CONFIG:-sahayakai-main/cloudbuild.yaml}"
INCLUDED_FILES="${INCLUDED_FILES:-sahayakai-main/**}"

echo "Project:           $PROJECT_ID"
echo "Trigger:           $TRIGGER_NAME"
echo "Repo:              github.com/$GITHUB_OWNER/$GITHUB_REPO"
echo "Branch pattern:    $BRANCH_PATTERN"
echo "Build config:      $BUILD_CONFIG"
echo "Included files:    $INCLUDED_FILES"
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
    --description="On push to main: build & deploy sahayakai-hotfix-resilience with --no-traffic. Operator flips traffic manually."

echo
echo "Trigger created. Verify in console:"
echo "  https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo
echo "Test fire (uses HEAD of main):"
echo "  gcloud beta builds triggers run $TRIGGER_NAME --branch=main --project=$PROJECT_ID"
