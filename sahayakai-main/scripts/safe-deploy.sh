#!/usr/bin/env bash
# safe-deploy.sh
#
# Wraps `gcloud run deploy` with four guardrails that prevent
# concurrent deploys from clobbering each other:
#
#   1. Refuses to deploy if a Cloud Build job for this project is
#      currently in flight.
#   2. Refuses if a Cloud Run revision was created in the last
#      MIN_REVISION_AGE_SECONDS (default 90 s) — tells you another
#      session probably just deployed.
#   3. Refuses tracked-file drift from HEAD (commit or stash first).
#   4. Refuses non-prod, non-preview branches. Maps:
#         main     → sahayakai-hotfix-resilience (PROD)
#         develop  → sahayakai-preview            (PREVIEW)
#         hotfix/* → sahayakai-hotfix-resilience (PROD, emergency)
#      Any other branch (feature/*, fix/*, etc.) is rejected — open
#      a PR to develop or main first.
#
#   5. Defaults to --no-traffic. The new revision is created and
#      kept warm, but traffic routing must be flipped manually with
#      `gcloud run services update-traffic --to-latest`. This makes
#      racing harmless: each agent's deploy creates its own revision,
#      none of them silently take over production traffic.
#
# Pass --route-immediately to skip the --no-traffic safety and route
# 100 % traffic to the new revision (the historical default behaviour).
#
# Usage:
#   git checkout main
#   ./scripts/safe-deploy.sh                       # safe — prod, no-traffic
#
#   git checkout develop
#   ./scripts/safe-deploy.sh                       # safe — preview, no-traffic
#
#   ./scripts/safe-deploy.sh --route-immediately   # legacy — risky
#
# Environment overrides (precedence: env var > branch-derived default):
#   PROJECT_ID, SERVICE, REGION, MIN_REVISION_AGE_SECONDS
#   If SERVICE is set explicitly, the branch check is bypassed.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
PROD_SERVICE="${PROD_SERVICE:-sahayakai-hotfix-resilience}"
PREVIEW_SERVICE="${PREVIEW_SERVICE:-sahayakai-preview}"
REGION="${REGION:-asia-southeast1}"
MIN_REVISION_AGE_SECONDS="${MIN_REVISION_AGE_SECONDS:-90}"

# Branch-aware service selection. Computed after we read HEAD_BRANCH.
# May be overridden by setting SERVICE in the environment.
SERVICE_EXPLICIT="${SERVICE:-}"
SERVICE=""

ROUTE_IMMEDIATELY=0
I_KNOW=0
for arg in "$@"; do
    case "$arg" in
        --route-immediately) ROUTE_IMMEDIATELY=1 ;;
        --i-know-what-im-doing) I_KNOW=1 ;;
        --help|-h)
            sed -n '2,30p' "$0"
            exit 0
            ;;
    esac
done

echo "▸ safe-deploy starting (project=$PROJECT_ID region=$REGION)"

# Guard 0: branch-aware service selection. Done FIRST so subsequent guards
# query the right service.
echo "▸ guard 0/4: branch-aware service selection..."
HEAD_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ -n "$SERVICE_EXPLICIT" ]]; then
    # SERVICE override is fine when the operator is on a known deploy
    # branch (just retargeting to a different service for testing).
    # But from a feature/fix/* branch combined with --route-immediately,
    # it can ship random WIP straight to prod. Require an explicit
    # --i-know-what-im-doing flag for that combination.
    case "$HEAD_BRANCH" in
        main|develop|hotfix/*) ;;
        *)
            if [[ "$I_KNOW" -ne 1 ]]; then
                echo "✗ ABORT: SERVICE explicitly set to '$SERVICE_EXPLICIT' from non-deploy branch '$HEAD_BRANCH'."
                echo
                echo "  This combination bypasses the branch check. Confirm intent:"
                echo "    SERVICE='$SERVICE_EXPLICIT' bash scripts/safe-deploy.sh --i-know-what-im-doing"
                echo
                echo "  Or open a PR to develop / main and deploy from the canonical branch."
                exit 6
            fi
            echo "  ⚠ --i-know-what-im-doing acknowledged — proceeding from '$HEAD_BRANCH'."
            ;;
    esac
    SERVICE="$SERVICE_EXPLICIT"
    echo "  ⚠ SERVICE explicitly set to '$SERVICE' via env — bypassing branch check."
elif [[ "$HEAD_BRANCH" == "main" ]] || [[ "$HEAD_BRANCH" == hotfix/* ]]; then
    SERVICE="$PROD_SERVICE"
    echo "  ✓ branch '$HEAD_BRANCH' → PROD service '$SERVICE'"
elif [[ "$HEAD_BRANCH" == "develop" ]]; then
    SERVICE="$PREVIEW_SERVICE"
    echo "  ✓ branch '$HEAD_BRANCH' → PREVIEW service '$SERVICE'"
else
    echo "✗ ABORT: branch '$HEAD_BRANCH' is not a deploy source."
    echo
    echo "  Deploy sources:"
    echo "    main      → $PROD_SERVICE (production)"
    echo "    develop   → $PREVIEW_SERVICE (preview)"
    echo "    hotfix/*  → $PROD_SERVICE (production, emergency)"
    echo
    echo "  For feature/fix/chore work, open a PR to develop first."
    echo "  Develop pushes auto-deploy to preview via Cloud Build."
    echo
    echo "  To override (NOT recommended), set SERVICE=<name> in the env."
    exit 5
fi

# Guard 1: ongoing builds. Filter by the target service so a preview build
# doesn't block a prod deploy and vice versa.
#
# The OR-filter catches two cases:
#   a) Builds with substitutions._SERVICE set (canonical — set by our
#      cloudbuild.yaml + cloudbuild-preview.yaml).
#   b) Builds that DON'T set the substitution but DO push to the
#      service's image path (manual `gcloud builds submit`, externally
#      triggered builds, legacy YAMLs). Without the OR, those would be
#      invisible to the guard and the race window would re-open.
#
# `images:<prefix>` is a substring match against the build's images list.
echo "▸ guard 1/4: checking for ongoing Cloud Build jobs targeting $SERVICE..."
build_filter="(substitutions._SERVICE=$SERVICE) OR (images:asia-southeast1-docker.pkg.dev/$PROJECT_ID/cloud-run-source-deploy/$SERVICE)"
ongoing=$(gcloud builds list --ongoing --project="$PROJECT_ID" \
    --filter="$build_filter" \
    --format="value(id)" 2>/dev/null | wc -l | tr -d '[:space:]')
if [[ "$ongoing" -gt 0 ]]; then
    echo "✗ ABORT: $ongoing Cloud Build job(s) for $SERVICE are running:"
    gcloud builds list --ongoing --project="$PROJECT_ID" \
        --filter="$build_filter" \
        --format="table(id,createTime,status)" | head -10
    echo "  Wait for them to finish, then retry. If you must override, run:"
    echo "    gcloud builds cancel <BUILD_ID> --project=$PROJECT_ID"
    exit 2
fi
echo "  ✓ no ongoing builds targeting $SERVICE."

# Guard 2: too-recent revision.
#
# Hotfix exception: when deploying from a hotfix/* branch, the operator
# is responding to a live incident — they cannot wait 90s for the
# baseline threshold if a normal release just shipped. Relax to 10s.
# That's still long enough to detect two hotfixes racing within seconds
# of each other.
echo "▸ guard 2/4: checking last revision age for $SERVICE..."
age_threshold="$MIN_REVISION_AGE_SECONDS"
if [[ "$HEAD_BRANCH" == hotfix/* ]]; then
    age_threshold=10
    echo "  ▸ hotfix branch — relaxing revision-age threshold to ${age_threshold}s"
fi
last_iso=$(gcloud run revisions list \
    --service="$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --limit=1 --format="value(metadata.creationTimestamp)" 2>/dev/null)

if [[ -n "$last_iso" ]]; then
    # Cross-platform ISO-8601 parse. BSD `date -j -u -f` only works on
    # macOS; GNU `date -d` only works on Linux. python3 ships on macOS,
    # Cloud Build builders, GH Actions Linux runners. Fail-soft: if
    # python3 missing or parse fails, skip the age check rather than
    # block deploy.
    last_epoch=$(python3 -c "
from datetime import datetime
ts = '$last_iso'
if '.' in ts:
    ts = ts.split('.', 1)[0]
if ts.endswith('Z'):
    ts = ts[:-1] + '+00:00'
print(int(datetime.fromisoformat(ts).timestamp()))
" 2>/dev/null)
    if [[ -n "$last_epoch" ]]; then
        now_epoch=$(date -u +%s)
        age=$(( now_epoch - last_epoch ))
        if [[ "$age" -lt "$age_threshold" ]]; then
            echo "✗ ABORT: last revision was created $age s ago (< ${age_threshold} s)."
            echo "  Another session probably just deployed. Wait, then verify via:"
            echo "    gcloud run revisions list --service=$SERVICE --region=$REGION --project=$PROJECT_ID --limit=3"
            exit 3
        fi
        echo "  ✓ last revision is $age s old (≥ ${age_threshold} s)."
    else
        echo "  ⚠ could not parse revision timestamp ($last_iso) — proceeding anyway."
    fi
fi

# Guard 3: tracked files clean — i.e. nothing modified or staged that
# differs from HEAD. We deliberately do NOT block on untracked files
# because parallel sessions and worktrees often leave junk lying around;
# untracked items are excluded from the deploy via .gcloudignore.
echo "▸ guard 3/4: checking git tracked files..."
if ! git diff --quiet HEAD --; then
    echo "✗ ABORT: tracked files differ from HEAD:"
    git diff --name-status HEAD -- | head -10
    echo "  Commit or stash these before deploying."
    exit 4
fi
HEAD_SHA=$(git rev-parse --short HEAD)
echo "  ✓ clean tree at $HEAD_BRANCH @ $HEAD_SHA"

echo "▸ guard 4/4: target confirmed → $SERVICE (from branch $HEAD_BRANCH)"

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
