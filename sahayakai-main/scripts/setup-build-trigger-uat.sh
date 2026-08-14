#!/usr/bin/env bash
# setup-build-trigger-uat.sh  (formerly setup-build-trigger-preview.sh)
#
# Creates the Cloud Build trigger that fires on every push to main and
# runs cloudbuild-uat.yaml (build → no-traffic deploy → tagged-URL smoke
# → traffic flip on the UAT service). Run ONCE after the Cloud Build
# GitHub App has been installed on the sargupta/sahayakai repository
# (the same install used by setup-build-trigger.sh).
#
# develop is retired (2026-08) — trunk is main, see docs/BRANCHING.md.
# The prod trigger (release/* → cloudbuild-release.yaml) is
# scripts/setup-build-trigger.sh.
#
# ONE-TIME MIGRATION (MAJOR-4) — do this BEFORE the trigger's first fire:
# the retired preview pipeline left SAHAYAKAI_AGENTS_AUDIENCE as a LITERAL
# env var on sahayakai-preview; cloudbuild-uat.yaml binds the same name via
# --update-secrets and gcloud rejects a literal→secret type change in one
# deploy. Strip the literal once (harmless if already gone):
#   gcloud run services update sahayakai-preview \
#     --region=asia-southeast1 --project=sahayakai-b4248 \
#     --remove-env-vars=SAHAYAKAI_AGENTS_AUDIENCE
#
# Idempotent: deletes any existing trigger with the same name before
# creating, so updating the config (file path, branch, included files)
# is a single re-run.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
PROJECT_NUMBER="${PROJECT_NUMBER:-640589855975}"
TRIGGER_NAME="${TRIGGER_NAME:-sahayakai-uat-deploy}"
GITHUB_OWNER="${GITHUB_OWNER:-sargupta}"
GITHUB_REPO="${GITHUB_REPO:-sahayakai}"
BRANCH_PATTERN="${BRANCH_PATTERN:-^main$}"
BUILD_CONFIG="${BUILD_CONFIG:-sahayakai-main/cloudbuild-uat.yaml}"
INCLUDED_FILES="${INCLUDED_FILES:-sahayakai-main/**}"
# Dedicated least-privilege deployer SA (created 2026-05-24, Task 21).
# Has the minimal roles needed for Cloud Build → Cloud Run deploy. See
# setup-build-trigger.sh for the role list. Previously used the default
# compute SA with roles/editor (overprivileged).
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
    --description="On push to main: build & deploy sahayakai-preview (UAT tier) with --no-traffic, smoke the tagged revision, then flip traffic."

echo
echo "Trigger created. Verify in console:"
echo "  https://console.cloud.google.com/cloud-build/triggers?project=$PROJECT_ID"
echo
echo "ONE-TIME MIGRATION before the first fire (see header, MAJOR-4):"
echo "  gcloud run services update sahayakai-preview \\"
echo "    --region=asia-southeast1 --project=$PROJECT_ID \\"
echo "    --remove-env-vars=SAHAYAKAI_AGENTS_AUDIENCE"
echo "  (the retired preview pipeline left this as a LITERAL env var;"
echo "   cloudbuild-uat.yaml re-binds it as a secret — gcloud rejects the"
echo "   literal→secret type change unless the literal is removed first)"
echo
echo "Test fire (uses HEAD of main):"
echo "  gcloud beta builds triggers run $TRIGGER_NAME --branch=main --project=$PROJECT_ID"
