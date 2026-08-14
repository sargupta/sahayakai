#!/usr/bin/env bash
# promote-release.sh
#
# Gated two-region prod traffic promotion for SahayakAI.
#
# cloudbuild-release.yaml deploys the release image to BOTH prod regions
# (asia-southeast1 Singapore, asia-south1 Mumbai) with --no-traffic and a
# sha-<short-sha> revision tag. This script is the ONLY sanctioned way to
# give those revisions traffic:
#
#   Phase 0 — preflight, per region:
#             * resolve the revision carrying tag sha-<sha>; require Ready
#             * image digests must be identical across the two regions
#             * new revision maxScale >= serving revision maxScale
#               (a silent capacity halving is how the A1 quota bites —
#               docs/SCALING_AND_RELIABILITY.md)
#             * firestore.indexes.json diff check (serving sha → new sha)
#             * smoke-test.sh against each region's tagged zero-traffic URL
#   Phase 1 — record currently-serving revisions to a rollback file
#   Phase 2 — flip Singapore → LB smoke → flip Mumbai → LB smoke
#             (LB smoke failure in --auto mode auto-rolls-back BOTH regions)
#   Phase 3 — audit-deployments.sh both regions
#   Phase 4 — git tag release-YYYY-MM-DD[.N] + push
#   Phase 5 — print rollback one-liners
#
# Usage:
#   bash scripts/release/promote-release.sh --sha <short-sha> [options]
#
# Options:
#   --sha <short-sha>        REQUIRED. The 7-char SHA the release build tagged.
#   --project <id>           GCP project (default sahayakai-b4248).
#   --auto                   Non-interactive: no prompts; index-diff hits run
#                            the firestore index deploy; LB smoke failure
#                            auto-rolls-back both regions and exits 1.
#   --skip-index-check       Skip the firestore.indexes.json diff gate.
#   --accept-capacity-drop   Allow new revision maxScale < serving maxScale.
#   --help                   This text.
#
# NOTE: written for bash 3.2 (macOS stock) — no associative arrays.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SMOKE="$SCRIPT_DIR/../smoke-test.sh"
AUDIT="$SCRIPT_DIR/../audit-deployments.sh"
REPO_ROOT=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)

SERVICE="${SERVICE:-sahayakai-hotfix-resilience}"
REGION_SG="asia-southeast1"
REGION_MUM="asia-south1"
LB_BASE="${LB_BASE:-https://www.sahayakai.com}"

PROJECT="sahayakai-b4248"
SHA=""
AUTO=0
SKIP_INDEX_CHECK=0
ACCEPT_CAPACITY_DROP=0

usage() { sed -n '2,40p' "$0"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sha)                  SHA="${2:-}"; shift 2 ;;
        --project)              PROJECT="${2:-}"; shift 2 ;;
        --auto)                 AUTO=1; shift ;;
        --skip-index-check)     SKIP_INDEX_CHECK=1; shift ;;
        --accept-capacity-drop) ACCEPT_CAPACITY_DROP=1; shift ;;
        --help|-h)              usage; exit 0 ;;
        *) echo "✗ unknown argument: $1"; usage; exit 1 ;;
    esac
done

if [[ -z "$SHA" ]]; then
    echo "✗ ABORT: --sha <short-sha> is required."
    usage
    exit 1
fi
if ! [[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]]; then
    echo "✗ ABORT: --sha '$SHA' does not look like a git SHA."
    exit 1
fi
TAG="sha-$SHA"

confirm() {
    # $1 = prompt. Returns 0 on yes. Callers branch on AUTO before calling.
    local ans
    read -r -p "$1 [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]]
}

# ── JSON helpers (python3 — jq is not guaranteed on operator machines) ───────
json_traffic_rev_for_tag() {   # stdin: service json; $1: tag
    python3 -c '
import json, sys
d = json.load(sys.stdin)
for t in (d.get("status", {}).get("traffic") or []):
    if t.get("tag") == sys.argv[1]:
        print(t.get("revisionName", "")); break
' "$1"
}
json_serving_rev() {           # stdin: service json → revision with max percent
    python3 -c '
import json, sys
d = json.load(sys.stdin)
best = ("", 0)
for t in (d.get("status", {}).get("traffic") or []):
    p = t.get("percent") or 0
    if p > best[1]:
        best = (t.get("revisionName", ""), p)
print(best[0])
'
}
json_sha_tag_of_rev() {        # stdin: service json; $1: revisionName → short sha of its sha- tag
    python3 -c '
import json, sys
d = json.load(sys.stdin)
for t in (d.get("status", {}).get("traffic") or []):
    if t.get("revisionName") == sys.argv[1] and str(t.get("tag", "")).startswith("sha-"):
        print(t["tag"][4:]); break
' "$1"
}
json_service_url() {           # stdin: service json
    python3 -c 'import json,sys; print(json.load(sys.stdin).get("status",{}).get("url",""))'
}
json_rev_field() {             # stdin: revision json; $1: ready|digest|maxScale
    python3 -c '
import json, sys
d = json.load(sys.stdin)
f = sys.argv[1]
if f == "ready":
    for c in (d.get("status", {}).get("conditions") or []):
        if c.get("type") == "Ready":
            print(c.get("status", "Unknown")); break
    else:
        print("Unknown")
elif f == "digest":
    dig = d.get("status", {}).get("imageDigest", "")
    print(dig.split("@", 1)[-1] if dig else "")
elif f == "maxScale":
    print((d.get("metadata", {}).get("annotations") or {}).get("autoscaling.knative.dev/maxScale", ""))
' "$1"
}

svc_json()  { gcloud run services  describe "$SERVICE" --region="$1" --project="$PROJECT" --format=json; }
rev_json()  { gcloud run revisions describe "$2"       --region="$1" --project="$PROJECT" --format=json; }

echo "════════════════════════════════════════════════════════════════"
echo "  promote-release: $SERVICE → $TAG"
echo "  project=$PROJECT  regions=$REGION_SG,$REGION_MUM  auto=$AUTO"
echo "════════════════════════════════════════════════════════════════"

# ═════ Phase 0 — preflight ═══════════════════════════════════════════════════
# Per-region results land in <VAR>_SG / <VAR>_MUM (bash-3.2-safe; read back
# via ${!indirection}).
NEW_REV_SG=""; NEW_REV_MUM=""
SERVING_REV_SG=""; SERVING_REV_MUM=""
DIGEST_SG=""; DIGEST_MUM=""
NEW_MAX_SG=""; NEW_MAX_MUM=""
SERVING_MAX_SG=""; SERVING_MAX_MUM=""
SVC_URL_SG=""; SVC_URL_MUM=""

for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    echo
    echo "▸ [preflight/$REGION] resolving revisions..."
    SJSON=$(svc_json "$REGION")

    NEW_REV=$(printf '%s' "$SJSON" | json_traffic_rev_for_tag "$TAG")
    if [[ -z "$NEW_REV" ]]; then
        echo "✗ ABORT: no revision carries tag '$TAG' in $REGION."
        echo "  Has the release Cloud Build finished? Check:"
        echo "    gcloud builds list --project=$PROJECT --limit=5"
        exit 2
    fi
    SERVING_REV=$(printf '%s' "$SJSON" | json_serving_rev)
    SVC_URL=$(printf '%s' "$SJSON" | json_service_url)
    echo "  new revision:     $NEW_REV"
    echo "  serving revision: ${SERVING_REV:-<none>}"

    RJSON=$(rev_json "$REGION" "$NEW_REV")
    READY=$(printf '%s' "$RJSON" | json_rev_field ready)
    if [[ "$READY" != "True" ]]; then
        echo "✗ ABORT: revision $NEW_REV in $REGION is not Ready (Ready=$READY)."
        exit 2
    fi
    echo "  ✓ Ready"
    DIGEST=$(printf '%s' "$RJSON" | json_rev_field digest)
    NEW_MAX=$(printf '%s' "$RJSON" | json_rev_field maxScale)
    SERVING_MAX=""
    if [[ -n "$SERVING_REV" ]]; then
        SERVING_MAX=$(rev_json "$REGION" "$SERVING_REV" | json_rev_field maxScale)
    fi

    printf -v "NEW_REV_$KEY"     '%s' "$NEW_REV"
    printf -v "SERVING_REV_$KEY" '%s' "$SERVING_REV"
    printf -v "DIGEST_$KEY"      '%s' "$DIGEST"
    printf -v "NEW_MAX_$KEY"     '%s' "$NEW_MAX"
    printf -v "SERVING_MAX_$KEY" '%s' "$SERVING_MAX"
    printf -v "SVC_URL_$KEY"     '%s' "$SVC_URL"
done

# ── digests must match across regions ────────────────────────────────────────
echo
echo "▸ [preflight] image digest parity..."
echo "  $REGION_SG:  ${DIGEST_SG:-<empty>}"
echo "  $REGION_MUM: ${DIGEST_MUM:-<empty>}"
if [[ -z "$DIGEST_SG" || "$DIGEST_SG" != "$DIGEST_MUM" ]]; then
    echo "✗ ABORT: image digests differ (or are empty) across regions — the two"
    echo "  tagged revisions were not built from the same image. Re-run the"
    echo "  release build; never promote mismatched regions."
    exit 2
fi
echo "  ✓ digests identical"

# ── capacity: new maxScale >= serving maxScale ───────────────────────────────
echo
echo "▸ [preflight] capacity check (maxScale, per region)..."
for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    _new_var="NEW_MAX_$KEY";     NEW="${!_new_var}"
    _old_var="SERVING_MAX_$KEY"; OLD="${!_old_var}"
    echo "  $REGION: serving=${OLD:-?} → new=${NEW:-?}"
    if [[ -z "$NEW" || -z "$OLD" ]]; then
        echo "  ⚠ maxScale annotation missing on one side — cannot compare; continuing."
        continue
    fi
    if [[ "$NEW" -lt "$OLD" ]]; then
        if [[ "$ACCEPT_CAPACITY_DROP" -eq 1 ]]; then
            echo "  ⚠ capacity DROP accepted via --accept-capacity-drop ($OLD → $NEW)."
        else
            echo "✗ ABORT: new revision maxScale ($NEW) < serving ($OLD) in $REGION."
            echo "  This is the A1 quota silently halving capacity (see"
            echo "  docs/SCALING_AND_RELIABILITY.md). Re-deploy with the right"
            echo "  _MAX_INSTANCES, or pass --accept-capacity-drop if intentional."
            exit 2
        fi
    fi
done

# ── firestore.indexes.json gate ──────────────────────────────────────────────
echo
if [[ "$SKIP_INDEX_CHECK" -eq 1 ]]; then
    echo "▸ [preflight] firestore index check SKIPPED (--skip-index-check)."
else
    echo "▸ [preflight] firestore.indexes.json diff (serving → $SHA)..."
    git -C "$REPO_ROOT" fetch --quiet origin || true
    SERVING_SHA=$(svc_json "$REGION_SG" | json_sha_tag_of_rev "$SERVING_REV_SG")
    INDEX_TOUCHED="unknown"
    if [[ -n "$SERVING_SHA" ]]; then
        if CHANGED=$(git -C "$REPO_ROOT" diff --name-only "$SERVING_SHA..$SHA" -- \
                sahayakai-main/firestore.indexes.json 2>/dev/null); then
            if [[ -n "$CHANGED" ]]; then INDEX_TOUCHED="yes"; else INDEX_TOUCHED="no"; fi
        fi
    fi
    case "$INDEX_TOUCHED" in
        no)
            echo "  ✓ firestore.indexes.json unchanged ($SERVING_SHA..$SHA)."
            ;;
        yes|unknown)
            if [[ "$INDEX_TOUCHED" == "yes" ]]; then
                echo "  ⚠ firestore.indexes.json CHANGED between $SERVING_SHA and $SHA."
            else
                echo "  ⚠ could not determine serving SHA / diff — treating as changed."
            fi
            if [[ "$AUTO" -eq 1 ]]; then
                echo "  ▸ --auto: deploying firestore indexes now..."
                ( cd "$REPO_ROOT/sahayakai-main" && \
                  npx --yes firebase-tools deploy --only firestore:indexes \
                      --project "$PROJECT" --non-interactive --force )
            else
                if ! confirm "  Have the new Firestore indexes been deployed AND finished building?"; then
                    echo "✗ ABORT: deploy indexes first (npx firebase-tools deploy --only firestore:indexes --project $PROJECT)"
                    echo "  or re-run with --skip-index-check / --auto."
                    exit 2
                fi
            fi
            ;;
    esac
fi

# ── per-region tagged-URL smoke ──────────────────────────────────────────────
for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    _url_var="SVC_URL_$KEY";   SVC_URL="${!_url_var}"
    HOST="${SVC_URL#https://}"
    TAG_URL="https://$TAG---$HOST"
    echo
    echo "▸ [preflight/$REGION] smoke against tagged revision: $TAG_URL"
    BASE="$TAG_URL" WAIT_SECS=0 bash "$SMOKE"
done

# ═════ Phase 1 — record rollback state ═══════════════════════════════════════
STAMP=$(date +%Y%m%d-%H%M%S)
ROLLBACK_FILE="/tmp/rollback-$STAMP.txt"
{
    echo "# promote-release rollback state — $STAMP"
    echo "service=$SERVICE"
    echo "project=$PROJECT"
    echo "promoting=$TAG"
    echo "$REGION_SG=$SERVING_REV_SG"
    echo "$REGION_MUM=$SERVING_REV_MUM"
} | tee "$ROLLBACK_FILE"
echo "▸ rollback state written to $ROLLBACK_FILE"

rollback_both() {
    echo
    echo "‼‼‼ ROLLING BACK BOTH REGIONS to pre-promotion revisions ‼‼‼"
    gcloud run services update-traffic "$SERVICE" --region="$REGION_SG" --project="$PROJECT" \
        --to-revisions "$SERVING_REV_SG=100" --quiet
    gcloud run services update-traffic "$SERVICE" --region="$REGION_MUM" --project="$PROJECT" \
        --to-revisions "$SERVING_REV_MUM=100" --quiet
    echo "‼ rollback complete — both regions back on pre-promotion revisions."
}

print_rollback_oneliners() {
    echo "  gcloud run services update-traffic $SERVICE --region=$REGION_SG --project=$PROJECT --to-revisions $SERVING_REV_SG=100"
    echo "  gcloud run services update-traffic $SERVICE --region=$REGION_MUM --project=$PROJECT --to-revisions $SERVING_REV_MUM=100"
}

lb_smoke() {
    BASE="$LB_BASE" WAIT_SECS=30 bash "$SMOKE"
}

on_lb_smoke_failure() {
    # $1 = which flip just happened (for the message)
    echo
    echo "✗✗✗ LB SMOKE FAILED after $1 flip ✗✗✗"
    if [[ "$AUTO" -eq 1 ]]; then
        rollback_both
        echo "✗ promotion FAILED and was auto-rolled-back. Investigate before retrying."
        exit 1
    fi
    echo "  NOT auto-rolling-back (interactive mode). To roll back both regions:"
    print_rollback_oneliners
    exit 1
}

# ═════ Phase 2 — flip traffic (SG → LB smoke → Mumbai → LB smoke) ════════════
echo
if [[ "$AUTO" -ne 1 ]]; then
    if ! confirm "▸ Preflight green. Flip PROD traffic to $TAG in BOTH regions?"; then
        echo "✗ aborted by operator — no traffic changed."
        exit 0
    fi
fi

echo "▸ [flip 1/2] $REGION_SG → $TAG..."
gcloud run services update-traffic "$SERVICE" --region="$REGION_SG" --project="$PROJECT" \
    --to-tags "$TAG=100" --quiet
echo "▸ [smoke] LB ($LB_BASE) after Singapore flip..."
if ! lb_smoke; then on_lb_smoke_failure "Singapore"; fi

echo "▸ [flip 2/2] $REGION_MUM → $TAG..."
gcloud run services update-traffic "$SERVICE" --region="$REGION_MUM" --project="$PROJECT" \
    --to-tags "$TAG=100" --quiet
echo "▸ [smoke] LB ($LB_BASE) after Mumbai flip..."
if ! lb_smoke; then on_lb_smoke_failure "Mumbai"; fi

# ═════ Phase 3 — audit both regions ══════════════════════════════════════════
echo
for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    echo "▸ [audit/$REGION]"
    if ! SERVICE="$SERVICE" REGION="$REGION" PROJECT_ID="$PROJECT" bash "$AUDIT"; then
        echo "  ⚠ audit-deployments.sh reported issues for $REGION — review above."
    fi
done

# ═════ Phase 4 — git release tag ═════════════════════════════════════════════
echo
DATE=$(date +%Y-%m-%d)
RELEASE_TAG="release-$DATE"
N=0
while git -C "$REPO_ROOT" rev-parse -q --verify "refs/tags/$RELEASE_TAG" >/dev/null 2>&1 \
      || git -C "$REPO_ROOT" ls-remote --exit-code --tags origin "$RELEASE_TAG" >/dev/null 2>&1; do
    N=$((N + 1))
    RELEASE_TAG="release-$DATE.$N"
done
echo "▸ tagging $SHA as $RELEASE_TAG..."
git -C "$REPO_ROOT" tag -a "$RELEASE_TAG" "$SHA" -m "Promoted $TAG to prod ($REGION_SG + $REGION_MUM)"
git -C "$REPO_ROOT" push origin "$RELEASE_TAG"

# ═════ Phase 5 — done; rollback one-liners ═══════════════════════════════════
echo
echo "════════════════════════════════════════════════════════════════"
echo "✓ PROMOTED $TAG to prod in both regions. Tagged $RELEASE_TAG."
echo
echo "  Rollback state: $ROLLBACK_FILE"
echo "  If anything looks wrong, roll back with:"
print_rollback_oneliners
echo "════════════════════════════════════════════════════════════════"
