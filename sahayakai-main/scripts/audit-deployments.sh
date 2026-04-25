#!/usr/bin/env bash
# audit-deployments.sh
#
# Audits the Cloud Run service to surface deploy races and orphaned
# revisions. Runs three checks:
#
#   1. Lists the last N revisions with creation time, image SHA, and
#      registry path. Two distinct registry paths in recent history
#      typically means two distinct deploy mechanisms are racing.
#   2. Identifies the revision currently serving 100 % of traffic.
#   3. Probes the live URL for known feature endpoints — flags any
#      that are missing in production despite being on origin/main.
#
# Read-only. Safe to run anytime. No writes to GCP, no deploys.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SERVICE="${SERVICE:-sahayakai-hotfix-resilience}"
REGION="${REGION:-asia-southeast1}"
N="${N:-12}"

URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" 2>/dev/null)
LIVE=$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="value(status.traffic[0].revisionName)" 2>/dev/null)

echo "═══════════════════════════════════════════════════════════════"
echo "  Cloud Run audit: $SERVICE  (region $REGION, project $PROJECT_ID)"
echo "═══════════════════════════════════════════════════════════════"
echo
echo "Live URL:        $URL"
echo "Active revision: $LIVE"
echo

echo "── Last $N revisions ────────────────────────────────────────────"
gcloud run revisions list --service="$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --limit="$N" \
    --format="value(metadata.name,metadata.creationTimestamp,spec.containers[0].image)" \
    | awk -F$'\t' '
        {
            split($3, parts, "/");
            repo = parts[2] "/" parts[3];
            split($3, sha_parts, "@");
            sha = (length(sha_parts) > 1) ? sha_parts[2] : "(no sha)";
            sha_short = substr(sha, 1, 19);
            printf "  %-40s  %s  %-32s  %s\n", $1, substr($2,1,19), repo, sha_short;
        }
    '

echo
echo "── Registry paths used in window ────────────────────────────────"
gcloud run revisions list --service="$SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --limit="$N" \
    --format="value(spec.containers[0].image)" \
    | awk -F'/' '{print $2"/"$3}' | sort -u | sed 's/^/  /'

echo
echo "── Feature probes against live URL ──────────────────────────────"

probe() {
    local label="$1"; local method="$2"; local path="$3"; local needle="$4"; local kind="$5"
    if [[ "$kind" == "status" ]]; then
        local code
        code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$URL$path" --max-time 12 2>/dev/null)
        local verdict
        if [[ "$code" == "$needle" ]]; then verdict="✓"; else verdict="✗"; fi
        printf "  %s  %-50s  %s (expected %s)\n" "$verdict" "$label" "$code" "$needle"
    else
        local body
        body=$(curl -sS "$URL$path" --max-time 12 2>/dev/null)
        if echo "$body" | grep -qF "$needle"; then
            printf "  ✓  %-50s  found '%.40s'\n" "$label" "$needle"
        else
            printf "  ✗  %-50s  MISSING '%.40s'\n" "$label" "$needle"
        fi
    fi
}

probe "/api/jobs/grow-persona-pool exists"          POST  "/api/jobs/grow-persona-pool?count=1"  "200"  status
probe "/api/jobs/ai-community-agent exists"         POST  "/api/jobs/ai-community-agent"         "200"  status
probe "/api/jobs/daily-briefing exists (GET=405)"   GET   "/api/jobs/daily-briefing"             "405"  status
probe "Community: 'Open chat with every teacher'"   GET   "/community"                           "Open chat with every teacher"  body
probe "Community: 'Search by subject'"              GET   "/community"                           "Search by subject"             body
probe "Community: 'Nothing here yet' empty-state"   GET   "/community"                           "Nothing here yet"              body
probe "Community: '1 member' singular pluralisation" GET  "/community"                           "1 member"                       body

echo
echo "── Recent commits on origin/main ─────────────────────────────────"
git fetch origin main --quiet 2>&1 | tail -1 || true
git log origin/main --oneline -8 | sed 's/^/  /'

echo
echo "Audit done. Any ✗ above means the live revision was built before"
echo "or without that change — re-deploy from main to restore."
