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
#   Phase 0 — preflight:
#             * HARD PRECONDITION: legacy trigger `sahayakai-main-deploy`
#               must NOT exist (run scripts/teardown-legacy-triggers.sh
#               first). While it exists, a release branch cut from main tip
#               shares its SHORT_SHA with the main-triggered build: both
#               builds push AR :<short-sha> and write Cloud Run tag
#               sha-<short-sha> with DIFFERENT image digests (TOCTOU).
#             * per region: resolve the revision carrying tag sha-<sha>;
#               require Ready
#             * image digests must be identical across the two regions
#             * provenance: each revision's image digest must equal the
#               digest Artifact Registry currently holds for
#               :<short-sha>. Residual ambiguity: if two pipelines pushed
#               the same AR tag, the tag points at the LAST pusher, so a
#               digest match proves consistency with AR, not which
#               pipeline built it — that is why the legacy-trigger
#               teardown above is a hard precondition, and why builds
#               should be cross-checked against the Cloud Build images
#               list when in doubt.
#             * new revision maxScale >= serving revision maxScale
#               (a silent capacity halving is how the A1 quota bites —
#               docs/SCALING_AND_RELIABILITY.md); UNKNOWN maxScale is
#               treated as a capacity drop (fail closed)
#             * firestore.indexes.json diff check (serving sha → new sha)
#             * smoke-test.sh against each region's tagged zero-traffic URL
#   Phase 1 — record currently-serving revisions to a rollback file
#             (refuses to run if a region ALREADY serves the promoting sha —
#              a half-completed earlier attempt would poison the baseline;
#              recover with --rollback-to <file> from the original attempt)
#   Phase 2 — flip Singapore → SG tagged-URL smoke + LB smoke →
#             flip Mumbai → Mumbai tagged-URL smoke + LB smoke
#             (flips pin the exact preflighted REVISION via --to-revisions,
#              never tag indirection; any post-flip smoke failure in --auto
#              mode auto-rolls-back BOTH regions)
#             GEO-ROUTING CAVEAT (minor-9): the LB smoke hits
#             www.sahayakai.com, and the global LB may geo-route this
#             machine to EITHER region — after the SG flip the LB smoke
#             might actually exercise Mumbai (still on the old revision).
#             That is why each flip is followed by a TAGGED-URL smoke too:
#             the sha- tagged URL resolves to the flipped region's service
#             directly and cannot be geo-routed away.
#   Phase 3 — audit-deployments.sh both regions + prune old sha- tags
#             (keep the newest 2 per region)
#   Phase 4 — git tag release-YYYY-MM-DD[.N] + push
#   Phase 5 — print rollback one-liners
#
# Usage:
#   bash scripts/release/promote-release.sh --sha <short-sha> [options]
#   bash scripts/release/promote-release.sh --rollback-to /tmp/rollback-<ts>.txt
#
# Options:
#   --sha <short-sha>        REQUIRED (except with --rollback-to). The 7-char
#                            SHA the release build tagged.
#   --project <id>           GCP project (default sahayakai-b4248).
#   --auto                   Non-interactive: no prompts; index-diff hits run
#                            the firestore index deploy; LB smoke failure
#                            auto-rolls-back both regions and exits 1.
#   --skip-index-check       Skip the firestore.indexes.json diff gate.
#   --accept-capacity-drop   Allow new revision maxScale < serving maxScale.
#   --rollback-to <file>     Recovery mode: restore BOTH regions' traffic to
#                            the revisions recorded in a rollback file from a
#                            previous run, then exit. No other phases run.
#   --help                   This text.
#
# FIRESTORE INDEX CAVEATS (M2):
#   * The index deploy runs `firebase-tools deploy --only firestore:indexes
#     --force`, which PRUNES composite indexes absent from
#     firestore.indexes.json — any index created ad-hoc in the Firebase
#     console gets DELETED. Never hotfix indexes via the console; always
#     land them in firestore.indexes.json.
#   * `firebase deploy` returns before index BACKFILL completes. When the
#     diff gate fired, this script polls
#     `gcloud firestore indexes composite list` and waits until no index is
#     CREATING before flipping traffic, so queries do not 500 mid-backfill.
#
# COVERAGE GAP (S6): none of the smokes here (tagged-URL or LB) exercise the
# Twilio / parent-call path — that needs real credentials and a real call.
# A green promotion says nothing about voice calling; verify manually after
# releases touching the call stack.
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
ROLLBACK_TO=""

usage() { sed -n '2,66p' "$0"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --sha)                  SHA="${2:-}"; shift 2 ;;
        --project)              PROJECT="${2:-}"; shift 2 ;;
        --auto)                 AUTO=1; shift ;;
        --skip-index-check)     SKIP_INDEX_CHECK=1; shift ;;
        --accept-capacity-drop) ACCEPT_CAPACITY_DROP=1; shift ;;
        --rollback-to)          ROLLBACK_TO="${2:-}"; shift 2 ;;
        --help|-h)              usage; exit 0 ;;
        *) echo "✗ unknown argument: $1"; usage; exit 1 ;;
    esac
done

# ── Recovery mode: --rollback-to <file> ──────────────────────────────────────
# Restores both regions to the revisions recorded by a previous run's Phase 1
# file, then exits. This is the ONLY sanctioned way to recover from a
# half-completed promotion (see the poisoned-baseline abort below).
if [[ -n "$ROLLBACK_TO" ]]; then
    if [[ ! -f "$ROLLBACK_TO" ]]; then
        echo "✗ ABORT: rollback file '$ROLLBACK_TO' not found."
        exit 1
    fi
    echo "▸ recovery mode: restoring traffic from $ROLLBACK_TO"
    sed 's/^/    /' "$ROLLBACK_TO"
    RB_FAILED=0
    for REGION in "$REGION_SG" "$REGION_MUM"; do
        REV=$(sed -n "s/^$REGION=//p" "$ROLLBACK_TO" | head -1)
        if [[ -z "$REV" ]]; then
            echo "  ✗ no revision recorded for $REGION in $ROLLBACK_TO — skipping."
            RB_FAILED=1
            continue
        fi
        echo "  ▸ $REGION → $REV..."
        if gcloud run services update-traffic "$SERVICE" --region="$REGION" \
                --project="$PROJECT" --to-revisions "$REV=100" --quiet; then
            echo "  ✓ $REGION restored to $REV."
        else
            echo "  ✗ $REGION restore FAILED — retry manually:"
            echo "      gcloud run services update-traffic $SERVICE --region=$REGION --project=$PROJECT --to-revisions $REV=100"
            RB_FAILED=1
        fi
    done
    if [[ "$RB_FAILED" -eq 1 ]]; then
        echo "✗ recovery incomplete — see failures above."
        exit 1
    fi
    echo "✓ recovery complete — both regions restored."
    exit 0
fi

if [[ -z "$SHA" ]]; then
    echo "✗ ABORT: --sha <short-sha> is required."
    usage
    exit 1
fi
# 7-9 chars only (minor-11): the Cloud Run tag was written as
# sha-$SHORT_SHA (7 chars). A full 40-char sha builds a tag that NEVER
# matches, and preflight would time out / abort confusingly.
if ! [[ "$SHA" =~ ^[0-9a-f]{7,9}$ ]]; then
    echo "✗ ABORT: --sha '$SHA' must be the 7-9 char SHORT sha (Cloud Build's"
    echo "  \$SHORT_SHA is 7 chars — the revision tag is sha-<short-sha>, so a"
    echo "  full 40-char sha would never match any tag). Try:"
    echo "    git rev-parse --short=7 <ref>"
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

# M2: `firebase deploy --only firestore:indexes` returns before the index
# BACKFILL finishes. Flipping traffic while a composite index is still
# CREATING would 500 every query that needs it. Poll until no index is
# CREATING (max ~30 min), warn-and-continue on poll errors (the gcloud
# surface is best-effort here; the operator sees every iteration).
wait_for_index_builds() {
    echo "  ▸ waiting for Firestore composite index builds (state != CREATING)..."
    local i creating
    for i in $(seq 1 60); do
        creating=$(gcloud firestore indexes composite list --project "$PROJECT" \
            --format='value(state)' 2>/dev/null | grep -c CREATING || true)
        if [[ -z "$creating" || "$creating" -eq 0 ]]; then
            echo "  ✓ no composite index in CREATING state."
            return 0
        fi
        echo "    $creating index(es) still CREATING — waiting 30s ($i/60)..."
        sleep 30
    done
    echo "  ⚠ index build wait timed out after 30 min — indexes may still be"
    echo "    backfilling. Verify before relying on new queries:"
    echo "      gcloud firestore indexes composite list --project $PROJECT"
    return 0
}

echo "════════════════════════════════════════════════════════════════"
echo "  promote-release: $SERVICE → $TAG"
echo "  project=$PROJECT  regions=$REGION_SG,$REGION_MUM  auto=$AUTO"
echo "════════════════════════════════════════════════════════════════"

# ═════ Phase 0 — preflight ═══════════════════════════════════════════════════

# ── HARD PRECONDITION: legacy main trigger must be gone (CRITICAL-1) ─────────
# While `sahayakai-main-deploy` exists, every push to main ALSO builds and
# pushes AR :<short-sha> / writes Cloud Run tag sha-<short-sha> toward prod.
# A release branch cut from main tip has the SAME short sha, so the tag and
# AR reference this script resolves could belong to EITHER build (different
# digests). No amount of in-script checking removes that ambiguity — the
# legacy trigger has to go.
echo
echo "▸ [preflight] legacy trigger check (sahayakai-main-deploy must not exist)..."
LEGACY_ERR=$(gcloud beta builds triggers describe sahayakai-main-deploy \
    --project="$PROJECT" 2>&1 >/dev/null) && LEGACY_EXISTS=1 || LEGACY_EXISTS=0
if [[ "$LEGACY_EXISTS" -eq 1 ]]; then
    echo "✗ ABORT: legacy Cloud Build trigger 'sahayakai-main-deploy' still exists."
    echo "  It double-builds every main push with the same SHORT_SHA the release"
    echo "  pipeline uses — tag/AR provenance is ambiguous until it is deleted."
    echo "  Run first:"
    echo "    bash sahayakai-main/scripts/teardown-legacy-triggers.sh"
    exit 2
elif echo "$LEGACY_ERR" | grep -qi "NOT_FOUND\|not found"; then
    echo "  ✓ legacy trigger absent."
else
    echo "  ⚠ could not verify trigger absence (describe failed: ${LEGACY_ERR:-unknown error})."
    echo "    Proceeding — but confirm manually that 'sahayakai-main-deploy' is deleted:"
    echo "      gcloud beta builds triggers list --project=$PROJECT"
fi
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

# ── poisoned-baseline guard (M1) ─────────────────────────────────────────────
# If a region ALREADY serves the promoting revision, a previous attempt
# half-completed. Recording the CURRENT (split) serving state as the
# rollback baseline would make "rollback" re-flip that region onto the very
# revision being promoted — the baseline is poisoned. Refuse; recover with
# the ORIGINAL attempt's rollback file instead.
echo
if [[ "$NEW_REV_SG" == "$SERVING_REV_SG" && "$NEW_REV_MUM" == "$SERVING_REV_MUM" ]]; then
    echo "✓ Both regions already serve $TAG ($NEW_REV_SG / $NEW_REV_MUM) — nothing to promote."
    exit 0
elif [[ "$NEW_REV_SG" == "$SERVING_REV_SG" || "$NEW_REV_MUM" == "$SERVING_REV_MUM" ]]; then
    echo "✗ ABORT: SPLIT STATE — one region already serves $TAG:"
    echo "    $REGION_SG:  serving=$SERVING_REV_SG  new=$NEW_REV_SG"
    echo "    $REGION_MUM: serving=$SERVING_REV_MUM  new=$NEW_REV_MUM"
    echo
    echo "  A previous promotion attempt half-completed. This run will NOT record"
    echo "  the split state as a rollback baseline (it would be poisoned)."
    echo "  Either:"
    echo "    a) roll back to the pre-promotion state using the ORIGINAL attempt's"
    echo "       rollback file:"
    echo "         bash $0 --rollback-to /tmp/rollback-<ts-of-first-attempt>.txt"
    echo "       then re-run this promotion from scratch; or"
    echo "    b) finish the flip manually if the promoted revision is known-good:"
    if [[ "$NEW_REV_SG" != "$SERVING_REV_SG" ]]; then
        echo "         gcloud run services update-traffic $SERVICE --region=$REGION_SG --project=$PROJECT --to-revisions $NEW_REV_SG=100"
    else
        echo "         gcloud run services update-traffic $SERVICE --region=$REGION_MUM --project=$PROJECT --to-revisions $NEW_REV_MUM=100"
    fi
    exit 2
fi

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

# ── provenance: revision digest must match Artifact Registry :<sha> ──────────
# (CRITICAL-1) The revisions must be running the image AR currently holds
# for this short sha. A mismatch means the tag/revision was written by a
# different build than the one that owns the AR tag (e.g. the legacy main
# trigger raced the release build before teardown). NOTE the residual
# ambiguity: an AR tag records only the LAST push — a digest match proves
# consistency with AR, not which pipeline pushed it. The legacy-trigger
# precondition above is what makes this check meaningful; when in doubt,
# cross-check the digest against the release build's `images` output:
#   gcloud builds list --project=$PROJECT --filter='substitutions.SHORT_SHA=<sha>'
echo
echo "▸ [preflight] provenance: Artifact Registry digest for :$SHA..."
AR_IMAGE="asia-southeast1-docker.pkg.dev/$PROJECT/cloud-run-source-deploy/$SERVICE:$SHA"
AR_DIGEST=$(gcloud artifacts docker images describe "$AR_IMAGE" \
    --format='value(image_summary.digest)' 2>/dev/null) || AR_DIGEST=""
if [[ -z "$AR_DIGEST" ]]; then
    echo "✗ ABORT: could not resolve $AR_IMAGE in Artifact Registry."
    echo "  The release build should have pushed this tag. Verify the build:"
    echo "    gcloud builds list --project=$PROJECT --limit=5"
    exit 2
fi
echo "  AR:        $AR_DIGEST"
echo "  revisions: $DIGEST_SG"
if [[ "$AR_DIGEST" != "$DIGEST_SG" ]]; then
    echo "✗ ABORT: revision image digest does not match Artifact Registry's :$SHA."
    echo "  The revisions were built by a DIFFERENT build than the one that owns"
    echo "  the AR tag (legacy-trigger race / stale revision). Re-run the release"
    echo "  build and do not promote until digests agree."
    exit 2
fi
echo "  ✓ revision provenance matches Artifact Registry"

# ── capacity: new maxScale >= serving maxScale ───────────────────────────────
echo
echo "▸ [preflight] capacity check (maxScale, per region)..."
for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    _new_var="NEW_MAX_$KEY";     NEW="${!_new_var}"
    _old_var="SERVING_MAX_$KEY"; OLD="${!_old_var}"
    echo "  $REGION: serving=${OLD:-?} → new=${NEW:-?}"
    if [[ -z "$NEW" || -z "$OLD" ]]; then
        # Fail CLOSED (minor-7): an unknown maxScale could be hiding a
        # capacity drop (the A1 quota failure mode this gate exists for).
        if [[ "$ACCEPT_CAPACITY_DROP" -eq 1 ]]; then
            echo "  ⚠ maxScale UNKNOWN on one side — accepted via --accept-capacity-drop."
            continue
        fi
        echo "✗ ABORT: maxScale annotation missing (serving='${OLD:-}' new='${NEW:-}') in $REGION —"
        echo "  cannot prove the new revision is not a capacity drop. Inspect both"
        echo "  revisions, then re-run with --accept-capacity-drop if intentional."
        exit 2
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
                # NOTE: --force prunes composite indexes that are missing from
                # firestore.indexes.json — console-created hotfix indexes get
                # DELETED (see header). Never hotfix indexes via the console.
                echo "  ▸ --auto: deploying firestore indexes now..."
                ( cd "$REPO_ROOT/sahayakai-main" && \
                  npx --yes firebase-tools deploy --only firestore:indexes \
                      --project "$PROJECT" --non-interactive --force )
                wait_for_index_builds
            else
                if ! confirm "  Have the new Firestore indexes been deployed AND finished building?"; then
                    echo "✗ ABORT: deploy indexes first (npx firebase-tools deploy --only firestore:indexes --project $PROJECT)"
                    echo "  (--force prunes console-created indexes — land them in firestore.indexes.json)"
                    echo "  or re-run with --skip-index-check / --auto."
                    exit 2
                fi
                # Trust but verify: even after a "yes", make sure nothing is
                # still backfilling before we flip traffic onto queries that
                # need the new indexes.
                wait_for_index_builds
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

print_rollback_oneliners() {
    if [[ -n "$SERVING_REV_SG" ]]; then
        echo "  gcloud run services update-traffic $SERVICE --region=$REGION_SG --project=$PROJECT --to-revisions $SERVING_REV_SG=100"
    else
        echo "  ($REGION_SG: no recorded serving revision — inspect: gcloud run revisions list --service=$SERVICE --region=$REGION_SG --project=$PROJECT --limit=5)"
    fi
    if [[ -n "$SERVING_REV_MUM" ]]; then
        echo "  gcloud run services update-traffic $SERVICE --region=$REGION_MUM --project=$PROJECT --to-revisions $SERVING_REV_MUM=100"
    else
        echo "  ($REGION_MUM: no recorded serving revision — inspect: gcloud run revisions list --service=$SERVICE --region=$REGION_MUM --project=$PROJECT --limit=5)"
    fi
}

# H1: rollback must be failure-tolerant. Print the manual one-liners BEFORE
# attempting anything (if this function dies, the operator still has them),
# attempt BOTH regions regardless of individual failures, and report
# per-region success/fail. Never let a transient gcloud error on Singapore
# leave Mumbai un-attempted under set -e.
rollback_both() {
    echo
    echo "‼‼‼ ROLLING BACK BOTH REGIONS to pre-promotion revisions ‼‼‼"
    echo "  Manual one-liners (in case this process dies mid-rollback):"
    print_rollback_oneliners
    local rc_sg=0 rc_mum=0
    # minor-8: guard empty recorded revisions — never issue a malformed
    # `--to-revisions "=100"`; skip that region with a loud warning instead.
    if [[ -z "$SERVING_REV_SG" ]]; then
        echo "  ✗ NO recorded serving revision for $REGION_SG — cannot roll it back"
        echo "    automatically. Inspect and fix manually:"
        echo "      gcloud run revisions list --service=$SERVICE --region=$REGION_SG --project=$PROJECT --limit=5"
        rc_sg=1
    else
        echo "  ▸ rolling back $REGION_SG → $SERVING_REV_SG..."
        gcloud run services update-traffic "$SERVICE" --region="$REGION_SG" --project="$PROJECT" \
            --to-revisions "$SERVING_REV_SG=100" --quiet || rc_sg=$?
        if [[ "$rc_sg" -eq 0 ]]; then
            echo "  ✓ $REGION_SG rolled back."
        else
            echo "  ✗ $REGION_SG ROLLBACK FAILED (gcloud exit $rc_sg) — run its one-liner above NOW."
        fi
    fi
    if [[ -z "$SERVING_REV_MUM" ]]; then
        echo "  ✗ NO recorded serving revision for $REGION_MUM — cannot roll it back"
        echo "    automatically. Inspect and fix manually:"
        echo "      gcloud run revisions list --service=$SERVICE --region=$REGION_MUM --project=$PROJECT --limit=5"
        rc_mum=1
    else
        echo "  ▸ rolling back $REGION_MUM → $SERVING_REV_MUM..."
        gcloud run services update-traffic "$SERVICE" --region="$REGION_MUM" --project="$PROJECT" \
            --to-revisions "$SERVING_REV_MUM=100" --quiet || rc_mum=$?
        if [[ "$rc_mum" -eq 0 ]]; then
            echo "  ✓ $REGION_MUM rolled back."
        else
            echo "  ✗ $REGION_MUM ROLLBACK FAILED (gcloud exit $rc_mum) — run its one-liner above NOW."
        fi
    fi
    if [[ "$rc_sg" -eq 0 && "$rc_mum" -eq 0 ]]; then
        echo "‼ rollback complete — both regions back on pre-promotion revisions."
    else
        echo "‼‼ ROLLBACK INCOMPLETE — at least one region needs manual attention above."
    fi
}

# M1: if the operator (or a CI timeout) interrupts mid-promotion, make the
# recovery path impossible to lose: print where the state file is and the
# exact rollback commands before dying.
on_interrupt() {
    trap - INT TERM
    echo
    echo "‼ promote-release INTERRUPTED — traffic may be mid-flip."
    echo "  Rollback state file: $ROLLBACK_FILE"
    echo "  Verify serving revisions, and roll back if needed:"
    print_rollback_oneliners
    echo "  (or: bash $0 --rollback-to $ROLLBACK_FILE)"
    exit 130
}
trap on_interrupt INT TERM

lb_smoke() {
    BASE="$LB_BASE" WAIT_SECS=30 bash "$SMOKE"
}

# minor-9: the LB smoke can be geo-routed to EITHER region, so after each
# flip we ALSO smoke the flipped region's sha- tagged URL — that URL
# resolves to the regional service directly and cannot be geo-routed away.
region_tagged_smoke() {
    # $1 = KEY (SG|MUM)
    local _url_var="SVC_URL_$1" svc_url host
    svc_url="${!_url_var}"
    host="${svc_url#https://}"
    BASE="https://$TAG---$host" WAIT_SECS=0 bash "$SMOKE"
}

on_post_flip_smoke_failure() {
    # $1 = which smoke failed (for the message)
    echo
    echo "✗✗✗ POST-FLIP SMOKE FAILED: $1 ✗✗✗"
    if [[ "$AUTO" -eq 1 ]]; then
        rollback_both
        echo "✗ promotion FAILED and was auto-rolled-back. Investigate before retrying."
        exit 1
    fi
    echo "  NOT auto-rolling-back (interactive mode). To roll back both regions:"
    print_rollback_oneliners
    echo "  (or: bash $0 --rollback-to $ROLLBACK_FILE)"
    exit 1
}

# ═════ Phase 2 — flip (SG → smokes → Mumbai → smokes) ════════════════════════
echo
if [[ "$AUTO" -ne 1 ]]; then
    if ! confirm "▸ Preflight green. Flip PROD traffic to $TAG in BOTH regions?"; then
        echo "✗ aborted by operator — no traffic changed."
        exit 0
    fi
fi

# H2: flip by REVISION NAME (--to-revisions), never by tag indirection
# (--to-tags). Between preflight and flip a concurrent build could re-point
# the sha- tag at a different, UNSMOKED revision; the revision name resolved
# and smoked in preflight is immutable.
echo "▸ [flip 1/2] $REGION_SG → $NEW_REV_SG ($TAG)..."
gcloud run services update-traffic "$SERVICE" --region="$REGION_SG" --project="$PROJECT" \
    --to-revisions "$NEW_REV_SG=100" --quiet
echo "▸ [smoke] $REGION_SG tagged URL after Singapore flip..."
if ! region_tagged_smoke SG; then on_post_flip_smoke_failure "$REGION_SG tagged-URL after SG flip"; fi
echo "▸ [smoke] LB ($LB_BASE) after Singapore flip..."
if ! lb_smoke; then on_post_flip_smoke_failure "LB after Singapore flip"; fi

echo "▸ [flip 2/2] $REGION_MUM → $NEW_REV_MUM ($TAG)..."
gcloud run services update-traffic "$SERVICE" --region="$REGION_MUM" --project="$PROJECT" \
    --to-revisions "$NEW_REV_MUM=100" --quiet
echo "▸ [smoke] $REGION_MUM tagged URL after Mumbai flip..."
if ! region_tagged_smoke MUM; then on_post_flip_smoke_failure "$REGION_MUM tagged-URL after Mumbai flip"; fi
echo "▸ [smoke] LB ($LB_BASE) after Mumbai flip..."
if ! lb_smoke; then on_post_flip_smoke_failure "LB after Mumbai flip"; fi

# ═════ Phase 3 — audit both regions + prune old sha- tags ════════════════════
# M3: sha- traffic tags accumulate forever otherwise (one per release build).
# Keep the newest 2 per region — the just-promoted one and its predecessor
# (the rollback target) — and remove the rest. Non-fatal: a cleanup failure
# never fails a promotion that already flipped successfully.
cleanup_old_sha_tags() {
    local region="$1" svc_f rev_f remove
    svc_f=$(mktemp) || return 0
    rev_f=$(mktemp) || { rm -f "$svc_f"; return 0; }
    if ! gcloud run services describe "$SERVICE" --region="$region" --project="$PROJECT" \
            --format=json > "$svc_f" 2>/dev/null; then
        echo "  ⚠ tag cleanup: service describe failed for $region — skipping."
        rm -f "$svc_f" "$rev_f"; return 0
    fi
    gcloud run revisions list --service="$SERVICE" --region="$region" --project="$PROJECT" \
        --format=json > "$rev_f" 2>/dev/null || true
    remove=$(python3 - "$svc_f" "$rev_f" <<'PY'
import json, sys
svc = json.load(open(sys.argv[1]))
try:
    revs = json.load(open(sys.argv[2]))
except Exception:
    revs = []
created = {r.get("metadata", {}).get("name", ""): r.get("metadata", {}).get("creationTimestamp", "")
           for r in revs}
sha_tags = []
for t in (svc.get("status", {}).get("traffic") or []):
    tag = t.get("tag") or ""
    if tag.startswith("sha-"):
        sha_tags.append((created.get(t.get("revisionName", ""), ""), tag))
sha_tags.sort(reverse=True)  # ISO timestamps sort lexically; newest first
print(",".join(tag for _, tag in sha_tags[2:]))
PY
) || remove=""
    rm -f "$svc_f" "$rev_f"
    if [[ -n "$remove" ]]; then
        echo "  ▸ removing old sha- tags in $region (keeping newest 2): $remove"
        gcloud run services update-traffic "$SERVICE" --region="$region" --project="$PROJECT" \
            --remove-tags "$remove" --quiet \
            || echo "  ⚠ tag cleanup failed in $region (non-fatal — retry any time)."
    else
        echo "  ✓ no old sha- tags to remove in $region."
    fi
}

echo
for KEY in SG MUM; do
    _region_var="REGION_$KEY"; REGION="${!_region_var}"
    echo "▸ [audit/$REGION]"
    if ! SERVICE="$SERVICE" REGION="$REGION" PROJECT_ID="$PROJECT" bash "$AUDIT"; then
        echo "  ⚠ audit-deployments.sh reported issues for $REGION — review above."
    fi
    echo "▸ [tag-cleanup/$REGION]"
    cleanup_old_sha_tags "$REGION"
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
echo "  (or: bash $0 --rollback-to $ROLLBACK_FILE)"
echo "════════════════════════════════════════════════════════════════"
