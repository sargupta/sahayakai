#!/usr/bin/env bash
# safe-deploy.sh
#
# Wraps `gcloud run deploy` with three guardrails that prevent
# concurrent deploys from clobbering each other:
#
#   1. Refuses to deploy if a Cloud Build job for this project is
#      currently in flight.
#   2. Refuses if a Cloud Run revision was created in the last
#      MIN_REVISION_AGE_SECONDS (default 90 s) — tells you another
#      session probably just deployed.
#   3. Defaults to --no-traffic. The new revision is created and
#      kept warm, but traffic routing must be flipped manually with
#      `gcloud run services update-traffic --to-latest`. This makes
#      racing harmless: each agent's deploy creates its own revision,
#      none of them silently take over production traffic.
#
# Pass --route-immediately to skip the --no-traffic safety and route
# 100 % traffic to the new revision (the historical default behaviour).
#
# Usage:
#   ./scripts/safe-deploy.sh                       # safe — no-traffic
#   ./scripts/safe-deploy.sh --route-immediately   # legacy — risky
#
# Environment overrides:
#   PROJECT_ID, SERVICE, REGION, MIN_REVISION_AGE_SECONDS

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SERVICE="${SERVICE:-sahayakai-hotfix-resilience}"
REGION="${REGION:-asia-southeast1}"
MIN_REVISION_AGE_SECONDS="${MIN_REVISION_AGE_SECONDS:-90}"

ROUTE_IMMEDIATELY=0
for arg in "$@"; do
    case "$arg" in
        --route-immediately) ROUTE_IMMEDIATELY=1 ;;
        --help|-h)
            sed -n '2,30p' "$0"
            exit 0
            ;;
    esac
done

echo "▸ safe-deploy starting (project=$PROJECT_ID service=$SERVICE region=$REGION)"

# Guard 1: ongoing builds
echo "▸ guard 1/3: checking for ongoing Cloud Build jobs..."
ongoing=$(gcloud builds list --ongoing --project="$PROJECT_ID" --format="value(id)" 2>/dev/null | wc -l | tr -d '[:space:]')
if [[ "$ongoing" -gt 0 ]]; then
    echo "✗ ABORT: $ongoing Cloud Build job(s) are currently running:"
    gcloud builds list --ongoing --project="$PROJECT_ID" --format="table(id,createTime,status)" | head -10
    echo "  Wait for them to finish, then retry. If you must override, run:"
    echo "    gcloud builds cancel <BUILD_ID> --project=$PROJECT_ID"
    exit 2
fi
echo "  ✓ no ongoing builds."

# Guard 2: too-recent revision
echo "▸ guard 2/3: checking last revision age..."
last_iso=$(gcloud run revisions list \
    --service="$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --limit=1 --format="value(metadata.creationTimestamp)" 2>/dev/null)

if [[ -n "$last_iso" ]]; then
    # Strip nanoseconds + Z, then convert to epoch (BSD date — macOS)
    last_clean="${last_iso:0:19}"
    if last_epoch=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "$last_clean" +%s 2>/dev/null); then
        now_epoch=$(date -u +%s)
        age=$(( now_epoch - last_epoch ))
        if [[ "$age" -lt "$MIN_REVISION_AGE_SECONDS" ]]; then
            echo "✗ ABORT: last revision was created $age s ago (< $MIN_REVISION_AGE_SECONDS s)."
            echo "  Another session probably just deployed. Wait, then verify via:"
            echo "    gcloud run revisions list --service=$SERVICE --region=$REGION --project=$PROJECT_ID --limit=3"
            exit 3
        fi
        echo "  ✓ last revision is $age s old (≥ $MIN_REVISION_AGE_SECONDS s)."
    else
        echo "  ⚠ could not parse revision timestamp — proceeding anyway."
    fi
fi

# Guard 3: working tree clean (we don't want to ship stray local changes)
echo "▸ guard 3/3: checking git working tree..."
if [[ -n "$(git status --porcelain)" ]]; then
    echo "✗ ABORT: uncommitted changes in working tree:"
    git status --short | head -10
    echo "  Commit or stash before deploying — `gcloud run deploy --source .` would ship these."
    exit 4
fi
HEAD_SHA=$(git rev-parse --short HEAD)
HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "  ✓ clean tree at $HEAD_BRANCH @ $HEAD_SHA"

# Optional: confirm we are on main
if [[ "$HEAD_BRANCH" != "main" ]]; then
    echo "  ⚠ deploying from $HEAD_BRANCH (not main). Continuing in 3 s..."
    sleep 3
fi

DEPLOY_FLAGS=(
    --region="$REGION"
    --source=.
    --project="$PROJECT_ID"
    --quiet
)

if [[ "$ROUTE_IMMEDIATELY" -eq 0 ]]; then
    DEPLOY_FLAGS+=( --no-traffic --tag="dep-$HEAD_SHA" )
    echo "▸ deploying with --no-traffic (revision will NOT auto-receive traffic)."
    echo "  After deploy, flip traffic explicitly:"
    echo "    gcloud run services update-traffic $SERVICE --region=$REGION --project=$PROJECT_ID --to-latest"
else
    echo "▸ deploying with --route-immediately (legacy behaviour — full risk of clobbering)."
fi

echo
gcloud run deploy "$SERVICE" "${DEPLOY_FLAGS[@]}"
echo
echo "✓ deploy complete."
