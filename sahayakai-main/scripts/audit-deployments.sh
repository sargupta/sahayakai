#!/usr/bin/env bash
# audit-deployments.sh
#
# Audits the Cloud Run service to surface deploy races, orphaned
# revisions, and cross-region drift. Runs four checks:
#
#   1. Lists the last N revisions with creation time, image SHA, and
#      registry path. Two distinct registry paths in recent history
#      typically means two distinct deploy mechanisms are racing.
#   2. Identifies the revision currently serving 100 % of traffic.
#   3. Probes each region's live URL for known feature endpoints —
#      flags any that are missing in production despite being on
#      origin/main.
#   4. REGION PARITY: fails if the regions are serving different
#      builds.
#
# On check 4 — prod is multi-region behind one load balancer, and
# Next.js keys its static assets on a per-build hash. When the regions
# serve different builds, a user given HTML by one region requests
# chunks the other 404s, so the page dies with a ChunkLoadError. That
# ran for 11 days in Aug 2026 because safe-deploy.sh ships
# --no-traffic and the operator promoted only one region, and because
# this audit looked at a single region and so could not see it.
#
# Read-only. Safe to run anytime. No writes to GCP, no deploys.
#
# Exit code is non-zero when the regions have drifted, so CI can gate
# on it.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
SERVICE="${SERVICE:-sahayakai-hotfix-resilience}"
# Every region serving production. Drift between them is the failure
# this audit exists to catch, so the default must list them all.
REGIONS="${REGIONS:-asia-south1 asia-southeast1}"
N="${N:-12}"

# The revision actually serving users. NOT status.traffic[0] — that is
# merely the first traffic entry, and tagged revisions pinned at 0 %
# sort ahead of the live one, so traffic[0] reports a revision no user
# is being served. That misreport is part of why the Aug 2026 drift
# stayed invisible.
#
# `|| true` throughout: a no-match grep exits 1, which under
# `set -euo pipefail` would abort the whole audit silently instead of
# reporting the region as unknown.
live_revision() {
    { gcloud run services describe "$SERVICE" --region="$1" --project="$PROJECT_ID" \
        --format="value(status.traffic)" 2>/dev/null \
        | tr ';' '\n' | grep "'percent': 100" \
        | grep -o "'revisionName': '[^']*'" | head -1 | cut -d"'" -f4; } || true
}

# The git sha a revision was built from, normalised to 7 chars. Image
# digests differ per region because each region has its own registry,
# so a sha is the only cross-region comparable build identity.
#
# Two sources, because neither covers both regions: Cloud Run traffic
# tags (`sha-<sha>`, written by safe-deploy.sh) exist in asia-south1,
# and Artifact Registry tags exist in asia-southeast1. asia-south1's
# registry images carry only `latest`. Returns "unknown" when neither
# source has one — that is not evidence of drift, only absence of
# evidence, and the parity verdict below treats it as such.
revision_sha() {
    local region="$1" revision="$2" tag image digest
    [[ -z "$revision" ]] && { echo "unknown"; return 0; }

    # Source 1: the Cloud Run traffic tag on this revision.
    tag=$({ gcloud run services describe "$SERVICE" --region="$region" --project="$PROJECT_ID" \
        --format="value(status.traffic)" 2>/dev/null \
        | tr ';' '\n' | grep -F "'$revision'" \
        | grep -o "'tag': 'sha-[^']*'" | head -1 | cut -d"'" -f4; } || true)
    if [[ -n "$tag" ]]; then
        echo "${tag#sha-}" | cut -c1-7
        return 0
    fi

    # Source 2: Artifact Registry tags on the image digest.
    image=$(gcloud run revisions describe "$revision" --region="$region" --project="$PROJECT_ID" \
        --format="value(spec.containers[0].image)" 2>/dev/null) || image=""
    digest="${image##*@}"
    if [[ -z "$digest" || "$digest" == "$image" ]]; then
        echo "unknown"
        return 0
    fi
    tag=$({ gcloud artifacts docker images list "${image%@*}" --include-tags --project="$PROJECT_ID" \
        --filter="version=$digest" --format="value(tags)" 2>/dev/null \
        | tr ',' '\n' | sed 's/^ *//' | grep -v '^latest$' | grep -v '^$' | head -1; } || true)
    echo "${tag:-unknown}" | sed 's/^sha-//' | cut -c1-7
}

probe() {
    local url="$1"; local label="$2"; local method="$3"; local path="$4"; local needle="$5"; local kind="$6"
    if [[ "$kind" == "status" ]]; then
        local code
        code=$(curl -sS -o /dev/null -w "%{http_code}" -X "$method" "$url$path" --max-time 12 2>/dev/null)
        local verdict
        if [[ "$code" == "$needle" ]]; then verdict="✓"; else verdict="✗"; fi
        printf "  %s  %-50s  %s (expected %s)\n" "$verdict" "$label" "$code" "$needle"
    else
        local body
        body=$(curl -sS "$url$path" --max-time 12 2>/dev/null)
        if echo "$body" | grep -qF "$needle"; then
            printf "  ✓  %-50s  found '%.40s'\n" "$label" "$needle"
        else
            printf "  ✗  %-50s  MISSING '%.40s'\n" "$label" "$needle"
        fi
    fi
}

declare -a PARITY_REGION=() PARITY_SHA=() PARITY_ASSET=()

for REGION in $REGIONS; do
    URL=$(gcloud run services describe "$SERVICE" --region="$REGION" --project="$PROJECT_ID" --format="value(status.url)" 2>/dev/null) || URL=""
    LIVE=$(live_revision "$REGION")
    SHA=$(revision_sha "$REGION" "$LIVE")

    echo "═══════════════════════════════════════════════════════════════"
    echo "  Cloud Run audit: $SERVICE  (region $REGION, project $PROJECT_ID)"
    echo "═══════════════════════════════════════════════════════════════"
    echo
    echo "Live URL:        $URL"
    echo "Active revision: $LIVE"
    echo "Built from:      ${SHA:-(unknown)}"
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
    echo "── Feature probes against $REGION ───────────────────────────────"

    # API endpoints — present/absent is a hard signal regardless of auth.
    probe "$URL" "/api/jobs/grow-persona-pool exists"          POST  "/api/jobs/grow-persona-pool?count=1"  "200"  status
    probe "$URL" "/api/jobs/ai-community-agent exists"         POST  "/api/jobs/ai-community-agent"         "200"  status
    probe "$URL" "/api/jobs/daily-briefing exists (GET=405)"   GET   "/api/jobs/daily-briefing"             "405"  status

    # UI strings — these MUST be in the SSR HTML even for unauthenticated
    # users. The action tiles render unconditionally inside the page
    # component, so missing here means the latest community/page.tsx did
    # not get deployed.
    probe "$URL" "Community: 'Open chat with every teacher'"   GET   "/community"                           "Open chat with every teacher"  body
    probe "$URL" "Community: 'Search by subject'"              GET   "/community"                           "Search by subject"             body

    # Served by the app, not the CDN, and among the assets that silently
    # diverged in Aug 2026 — a 404 here means this region is behind.
    probe "$URL" "Android App Links: /.well-known/assetlinks.json" GET "/.well-known/assetlinks.json"       "200"  status

    # NOTE: We deliberately do NOT probe for "Nothing here yet" or "1
    # member" here. Those strings only render server-side for an
    # authenticated user with an empty feed or a 1-member group. An
    # unauthenticated curl will always show them as missing — they are
    # false negatives and cause noisy audits. Verify those manually in
    # a logged-in browser session against the live URL above.

    PARITY_REGION+=("$REGION")
    PARITY_SHA+=("${SHA:-unknown}")
    # The build hash Next.js keys static assets on — the thing that has to
    # match for a cross-region request to resolve.
    PARITY_ASSET+=("$({ curl -sS "$URL/" --max-time 15 2>/dev/null | grep -o 'webpack-[a-z0-9]*\.js' | head -1; } || true)")
    echo
done

echo "── REGION PARITY ────────────────────────────────────────────────"
#
# The asset hash is the verdict, not the sha. It is what Next.js keys
# static chunks on, so two regions sharing it cannot 404 each other's
# assets — which is the user-visible failure this check exists to
# catch. It is also always observable, whereas sha coverage depends on
# which region's pipeline happened to write a tag.
#
# An unknown sha therefore never fails the audit on its own. Failing on
# absence of evidence would have this alarm firing on every asia-south1
# deploy, and an audit that cries wolf is one nobody reruns.
PARITY_FAIL=0
PARITY_UNREACHABLE=0
declare -a KNOWN_SHAS=()

for i in "${!PARITY_REGION[@]}"; do
    printf "  %-18s sha=%-10s asset=%s\n" \
        "${PARITY_REGION[$i]}" "${PARITY_SHA[$i]:-unknown}" "${PARITY_ASSET[$i]:-(unreachable)}"

    if [[ -z "${PARITY_ASSET[$i]}" ]]; then
        PARITY_UNREACHABLE=1
    elif [[ "${PARITY_ASSET[$i]}" != "${PARITY_ASSET[0]}" ]]; then
        PARITY_FAIL=1
    fi

    case "${PARITY_SHA[$i]}" in
        ''|unknown|untagged) ;;
        *) KNOWN_SHAS+=("${PARITY_SHA[$i]}") ;;
    esac
done

# Corroborating signal: two regions that both reported a sha must agree.
for sha in "${KNOWN_SHAS[@]:-}"; do
    [[ -n "$sha" && "$sha" != "${KNOWN_SHAS[0]}" ]] && PARITY_FAIL=1
done

echo
if [[ "$PARITY_FAIL" -eq 1 ]]; then
    echo "  ✗  REGIONS HAVE DRIFTED — they are serving different builds."
    echo "     Users load HTML from one region and its chunks from the other,"
    echo "     which 404s and kills the page with a ChunkLoadError."
    echo "     Promote the lagging region to its newest ready revision:"
    echo "       gcloud run services update-traffic $SERVICE --region=<region> --project=$PROJECT_ID --to-latest"
elif [[ "$PARITY_UNREACHABLE" -eq 1 ]]; then
    echo "  ?  A region did not serve a page — parity could not be established."
    echo "     Treat as unverified, not as healthy."
    PARITY_FAIL=1
else
    echo "  ✓  All regions serving the same build."
    if [[ "${#KNOWN_SHAS[@]}" -lt "${#PARITY_REGION[@]}" ]]; then
        echo "     (Some regions publish no sha tag; the asset hash carried the check.)"
    fi
fi

echo
echo "── Recent commits on origin/main ─────────────────────────────────"
git fetch origin main --quiet 2>&1 | tail -1 || true
git log origin/main --oneline -8 | sed 's/^/  /'

echo
echo "Audit done. Any ✗ above means the live revision was built before"
echo "or without that change — re-deploy from main to restore."

exit "$PARITY_FAIL"
