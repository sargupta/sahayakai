#!/usr/bin/env bash
# teardown-legacy-triggers.sh
#
# Deletes the RETIRED Cloud Build triggers that the UAT/release pipeline
# rebuild (2026-08) supersedes:
#
#   sahayakai-main-deploy     — main → cloudbuild.yaml (single-region prod).
#                               Superseded by sahayakai-uat-deploy (main →
#                               cloudbuild-uat.yaml) + sahayakai-release-deploy
#                               (release/* → cloudbuild-release.yaml).
#   sahayakai-preview-deploy  — develop → cloudbuild-preview.yaml. develop is
#                               retired; cloudbuild-preview.yaml is deleted.
#
# WHY THIS MUST RUN IN T2: if these legacy triggers survive alongside the
# new ones, every push to main DOUBLE-FIRES — the legacy trigger deploys
# straight toward prod (cloudbuild.yaml) while the UAT trigger deploys the
# UAT tier, re-opening exactly the race the rebuild removes.
#
# Order of operations for T2:
#   1. bash scripts/setup-build-trigger-uat.sh      (create UAT trigger)
#   2. bash scripts/setup-build-trigger.sh          (create release trigger)
#   3. bash scripts/teardown-legacy-triggers.sh     (this script)
#   4. Wire the GCP_DEPLOYER_KEY repo secret for release-promote.yml.
#
# Interactive by default (confirm per trigger); pass --yes for CI use.
# Deleting a trigger does NOT touch Cloud Run services, revisions, images,
# or past builds — it only stops future auto-fires.

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-sahayakai-b4248}"
LEGACY_TRIGGERS=(sahayakai-main-deploy sahayakai-preview-deploy)

YES=0
for arg in "$@"; do
    case "$arg" in
        --yes|-y) YES=1 ;;
        --help|-h)
            sed -n '2,28p' "$0"
            exit 0
            ;;
        *) echo "✗ unknown argument: $arg (supported: --yes, --help)"; exit 1 ;;
    esac
done

echo "▸ teardown-legacy-triggers (project=$PROJECT_ID)"
echo

FAILED=0
for T in "${LEGACY_TRIGGERS[@]}"; do
    if ! gcloud beta builds triggers describe "$T" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "  ✓ trigger '$T' does not exist — nothing to delete."
        continue
    fi
    echo "  ⚠ legacy trigger '$T' EXISTS."
    if [[ "$YES" -ne 1 ]]; then
        read -r -p "    Delete trigger '$T'? [y/N] " ans
        if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
            echo "    skipped '$T' — it will keep double-firing until deleted."
            FAILED=1
            continue
        fi
    fi
    if gcloud beta builds triggers delete "$T" --project="$PROJECT_ID" --quiet; then
        echo "    ✓ deleted '$T'."
    else
        echo "    ✗ FAILED to delete '$T' — delete manually:"
        echo "        gcloud beta builds triggers delete $T --project=$PROJECT_ID"
        FAILED=1
    fi
done

echo
if [[ "$FAILED" -eq 0 ]]; then
    echo "✓ legacy triggers cleaned up. Verify the remaining set:"
else
    echo "⚠ teardown incomplete — legacy triggers remain (see above). Verify:"
fi
echo "  gcloud beta builds triggers list --project=$PROJECT_ID --format='table(name,github.push.branch,filename)'"
[[ "$FAILED" -eq 0 ]] || exit 1
