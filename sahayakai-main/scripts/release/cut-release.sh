#!/usr/bin/env bash
# cut-release.sh
#
# Cuts a release branch from a UAT-verified main SHA. The release branch
# push fires the `sahayakai-release-deploy` Cloud Build trigger
# (cloudbuild-release.yaml), which builds once and deploys to BOTH prod
# regions with --no-traffic. Promotion is a separate, explicit step
# (scripts/release/promote-release.sh).
#
# Gate: the commit MUST carry a GitHub commit status
#   context = uat/verified, state = success
# — set by QA (or the UAT verification job) after validating the UAT
# deployment of that SHA. No status, no release branch.
#
# Usage:
#   bash scripts/release/cut-release.sh            # cut from origin/main tip
#   bash scripts/release/cut-release.sh <sha>      # cut from a specific SHA
#
# Branch naming: release/YYYY.MM.DD, with a .N suffix bump when a branch
# for today already exists (release/2026.08.14, release/2026.08.14.1, ...).

set -euo pipefail

REPO="${REPO:-sargupta/sahayakai}"

command -v gh >/dev/null 2>&1 || {
    echo "✗ ABORT: gh CLI is required (brew install gh; gh auth login)." >&2
    exit 1
}

echo "▸ fetching origin main..."
git fetch origin main

SHA_INPUT="${1:-origin/main}"
SHA=$(git rev-parse "$SHA_INPUT")
SHORT=$(git rev-parse --short "$SHA")
echo "▸ candidate SHA: $SHA ($SHORT)"

# ── Gate: uat/verified commit status ─────────────────────────────────────────
echo "▸ checking commit status 'uat/verified' on $SHORT..."
STATE=$(gh api "repos/$REPO/commits/$SHA/status" \
    --jq '[.statuses[]|select(.context=="uat/verified")][0].state' 2>/dev/null || true)

if [[ "$STATE" != "success" ]]; then
    echo "✗ ABORT: commit $SHORT has no successful 'uat/verified' status (found: '${STATE:-none}')."
    echo
    echo "  A release can only be cut from a SHA that QA has verified on UAT."
    echo "  Flow:"
    echo "    1. Merge to main → cloudbuild-uat.yaml deploys + smokes + flips UAT."
    echo "    2. QA validates the UAT deployment of $SHORT."
    echo "    3. Mark it verified:"
    echo "         gh api repos/$REPO/statuses/$SHA \\"
    echo "             -f state=success -f context=uat/verified \\"
    echo "             -f description='UAT verified by <name>'"
    echo "    4. Re-run this script."
    exit 2
fi
echo "  ✓ uat/verified = success"

# ── Branch name: release/YYYY.MM.DD with .N bump ─────────────────────────────
DATE=$(date +%Y.%m.%d)
BR="release/$DATE"
N=0
while git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1 \
      || git show-ref --verify --quiet "refs/heads/$BR"; do
    N=$((N + 1))
    BR="release/$DATE.$N"
done
echo "▸ release branch: $BR"

# ── Create + push ────────────────────────────────────────────────────────────
git branch "$BR" "$SHA"
git push -u origin "$BR"

echo
echo "✓ $BR pushed at $SHORT."
echo
echo "Next steps:"
echo "  1. Cloud Build trigger 'sahayakai-release-deploy' is now building +"
echo "     deploying sha-$SHORT to BOTH prod regions with --no-traffic. Watch:"
echo "       gcloud builds list --ongoing --project=sahayakai-b4248"
echo "  2. When both regional revisions are Ready, promote (preflight + flip"
echo "     + LB smoke + rollback recording):"
echo "       bash sahayakai-main/scripts/release/promote-release.sh --sha $SHORT"
echo "     (Or let .github/workflows/release-promote.yml do it automatically"
echo "      if the GCP_DEPLOYER_KEY secret is wired.)"
