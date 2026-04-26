#!/usr/bin/env bash
# Track C pre-work — IAM + Secret Manager foundation for the parent-call
# sidecar pilot.
#
# This script provisions the GCP resources Track C (first sidecar deploy)
# requires before `gcloud builds submit` can succeed and the Next.js
# runtime can invoke the sidecar with an ID token. It is items 1-3 of
# the pre-work checklist in the execution plan:
#
#   /Users/sargupta/.claude/plans/prepare-a-detailed-execution-iridescent-hamming.md
#
# Items 4-6 (Firestore rules + TTL, dual-deploy SA wiring) are handled
# elsewhere — see `apply-firestore-ttl.sh` and the Track C section of
# the runbook. This script intentionally does NOT touch Firestore,
# Pub/Sub, Cloud Functions, or alert policies; for the full Track D
# bootstrap (auto-abort, shadow rollup, alerts) run
# `bootstrap-track-d.sh` AFTER this script.
#
# What this script does (in order):
#
#   1. Creates two service accounts (idempotent):
#        sahayakai-agents-runtime          — sidecar Cloud Run runtime
#        sahayakai-hotfix-resilience-runtime — Next.js Cloud Run runtime
#      The Next.js SA replaces the default Compute SA so the sidecar's
#      `roles/run.invoker` binding is scoped to a known identity, not
#      the project-wide compute account.
#
#   2. Creates three Secret Manager secret containers (idempotent):
#        SAHAYAKAI_REQUEST_SIGNING_KEY     — HMAC-SHA256 body-digest key
#        SAHAYAKAI_AGENTS_AUDIENCE         — Cloud Run URL (post-deploy)
#        GOOGLE_GENAI_SHADOW_API_KEY       — disjoint Gemini key for
#                                            shadow-mode traffic
#      `GOOGLE_GENAI_API_KEY` is assumed to already exist (live Next.js
#      app uses it). The script skips creating it but binds the sidecar
#      runtime SA as accessor if found.
#
#   3. Generates a fresh 256-bit HMAC key and writes it as the first
#      enabled version of SAHAYAKAI_REQUEST_SIGNING_KEY (only if no
#      enabled version already exists — re-running is non-destructive).
#
#   4. Writes a placeholder version `pending-deploy` into
#      SAHAYAKAI_AGENTS_AUDIENCE if the secret has no enabled version.
#      Operator runs `hydrate-audience-secret.sh` after the first Cloud
#      Run deploy to overwrite it with the real URL.
#
#   5. Prompts the operator to paste a Gemini API key DISJOINT from the
#      live pool and writes it as a version of GOOGLE_GENAI_SHADOW_API_KEY
#      (only if no enabled version already exists). The script cannot
#      auto-generate this — only the operator can mint a Gemini key from
#      Google AI Studio.
#
#   6. Grants the sidecar runtime SA:
#        roles/secretmanager.secretAccessor   per-secret (NOT project-wide)
#          on: GOOGLE_GENAI_API_KEY (if exists), GOOGLE_GENAI_SHADOW_API_KEY,
#              SAHAYAKAI_REQUEST_SIGNING_KEY, SAHAYAKAI_AGENTS_AUDIENCE
#        roles/datastore.user                 (project-level)
#        roles/cloudtrace.agent               (project-level)
#        roles/logging.logWriter              (project-level)
#
#   7. Grants the Next.js runtime SA:
#        roles/secretmanager.secretAccessor   on SAHAYAKAI_REQUEST_SIGNING_KEY
#                                             only (Next.js does not need
#                                             the shadow key, audience, or
#                                             live Gemini key)
#      `roles/run.invoker` on the sidecar service is intentionally NOT
#      granted here because the service does not yet exist. After Track
#      C deploys the sidecar, run `grant-nextjs-invoker.sh` to apply
#      that binding.
#
#   8. Final verification block — prints SAs, secrets, secret versions,
#      and the Next.js runtime SA's IAM bindings on each secret. Each
#      block is delimited by `===` headers so the operator can grep
#      success at a glance.
#
# Why per-secret accessor bindings (not project-wide):
#   The previous default of `roles/secretmanager.secretAccessor` at the
#   project level gave every Cloud Run runtime read access to ALL
#   secrets — including ones that should be sidecar-only or Next.js-only.
#   A leaked Next.js token could exfiltrate the shadow Gemini key and
#   double-charge our quota. Per-secret bindings limit the blast radius.
#
# Why two service accounts:
#   The sidecar's `roles/run.invoker` policy must enumerate the *exact*
#   identity allowed to invoke it. If Next.js runs as the default
#   Compute SA, the binding is wider than needed and any Cloud Function
#   in the project could call the sidecar. A dedicated Next.js runtime
#   SA tightens the policy to one identity.
#
# Idempotent — safe to re-run on a partially-applied state. Every
# `gcloud ... create` call is preceded by a `describe` check; existing
# resources are left alone.
#
# ──────────────────────────────────────────────────────────────────────
# Prerequisites
# ──────────────────────────────────────────────────────────────────────
#
#   1. `gcloud auth login` as a user with the following project roles:
#        - roles/iam.serviceAccountAdmin   (create SAs)
#        - roles/iam.securityAdmin         (grant project-level roles)
#        - roles/secretmanager.admin       (create secrets, grant SM IAM)
#
#   2. `gcloud config set project sahayakai-b4248`
#
#   3. `openssl` available on PATH (any modern macOS / Linux ships it).
#
# Usage:
#   bash scripts/track-c-prework.sh
#
# Exit codes:
#   0 — all resources created and verified
#   1 — prerequisite missing, or a gcloud call failed
#
# ──────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Hardcoded — do NOT customise per teacher / per environment ─────────
readonly PROJECT_ID="sahayakai-b4248"
readonly PROJECT_NUMBER="640589855975"
readonly REGION="asia-southeast1"

readonly SIDECAR_SA_NAME="sahayakai-agents-runtime"
readonly NEXTJS_SA_NAME="sahayakai-hotfix-resilience-runtime"
readonly SIDECAR_SA="${SIDECAR_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
readonly NEXTJS_SA="${NEXTJS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

readonly SECRET_SIGNING_KEY="SAHAYAKAI_REQUEST_SIGNING_KEY"
readonly SECRET_AUDIENCE="SAHAYAKAI_AGENTS_AUDIENCE"
readonly SECRET_SHADOW_KEY="GOOGLE_GENAI_SHADOW_API_KEY"
readonly SECRET_LIVE_KEY="GOOGLE_GENAI_API_KEY"

# Pretty output helpers (match style of sibling scripts).
ok()      { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail()    { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info()    { printf '\e[34m→\e[0m %s\n' "$*"; }
section() { printf '\n\e[1m── %s ──\e[0m\n' "$*"; }
header()  { printf '\n=== %s ===\n' "$*"; }

# ── Sanity checks ──────────────────────────────────────────────────────
command -v gcloud >/dev/null 2>&1 || fail "gcloud not found on PATH"
command -v openssl >/dev/null 2>&1 || fail "openssl not found on PATH"

ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [[ "${ACTIVE_PROJECT}" != "${PROJECT_ID}" ]]; then
  fail "Active gcloud project is '${ACTIVE_PROJECT}'; expected '${PROJECT_ID}'. Run: gcloud config set project ${PROJECT_ID}"
fi
ok "gcloud configured for project ${PROJECT_ID}"

# ──────────────────────────────────────────────────────────────────────
# Step 1 — Service accounts
# ──────────────────────────────────────────────────────────────────────
section "1/8  Service accounts"

if gcloud iam service-accounts describe "${SIDECAR_SA}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "  ${SIDECAR_SA} already exists"
else
  gcloud iam service-accounts create "${SIDECAR_SA_NAME}" \
    --project="${PROJECT_ID}" \
    --description="Sidecar Cloud Run runtime — sahayakai-agents (parent-call ADK Python pilot)" \
    --display-name="${SIDECAR_SA_NAME}" >/dev/null
  ok "  created ${SIDECAR_SA}"
fi

if gcloud iam service-accounts describe "${NEXTJS_SA}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "  ${NEXTJS_SA} already exists"
else
  gcloud iam service-accounts create "${NEXTJS_SA_NAME}" \
    --project="${PROJECT_ID}" \
    --description="Next.js Cloud Run runtime — invokes the sidecar (replaces default Compute SA)" \
    --display-name="${NEXTJS_SA_NAME}" >/dev/null
  ok "  created ${NEXTJS_SA}"
fi

# ──────────────────────────────────────────────────────────────────────
# Step 2 — Secret Manager containers
# ──────────────────────────────────────────────────────────────────────
section "2/8  Secret Manager containers"

ensure_secret_container() {
  local secret="$1"
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    info "  ${secret} already exists"
  else
    gcloud secrets create "${secret}" \
      --project="${PROJECT_ID}" \
      --replication-policy=automatic >/dev/null
    ok "  created ${secret}"
  fi
}

ensure_secret_container "${SECRET_SIGNING_KEY}"
ensure_secret_container "${SECRET_AUDIENCE}"
ensure_secret_container "${SECRET_SHADOW_KEY}"

if gcloud secrets describe "${SECRET_LIVE_KEY}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  info "  ${SECRET_LIVE_KEY} already exists (live Next.js Gemini key)"
else
  info "  ${SECRET_LIVE_KEY} not found — sidecar will not be able to read live key until created"
  info "    (this script does NOT create it; the live Next.js app owns its lifecycle)"
fi

# ──────────────────────────────────────────────────────────────────────
# Step 3 — Generate HMAC signing key (first version only)
# ──────────────────────────────────────────────────────────────────────
section "3/8  HMAC signing key — generate + store"

# Has any enabled version yet?
EXISTING_SIGNING_VERSION=$(gcloud secrets versions list "${SECRET_SIGNING_KEY}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --format='value(name)' 2>/dev/null | head -1 || true)

if [[ -n "${EXISTING_SIGNING_VERSION}" ]]; then
  info "  ${SECRET_SIGNING_KEY} already has enabled version ${EXISTING_SIGNING_VERSION}; skipping generation"
  info "  (to rotate, run scripts/generate-signing-key.sh)"
else
  NEW_KEY=$(openssl rand -base64 32)
  if [[ ${#NEW_KEY} -lt 32 ]]; then
    fail "generated key is suspiciously short (${#NEW_KEY} chars)"
  fi
  echo -n "${NEW_KEY}" | gcloud secrets versions add "${SECRET_SIGNING_KEY}" \
    --project="${PROJECT_ID}" \
    --data-file=- >/dev/null
  ok "  generated 256-bit HMAC key and stored as version 1 of ${SECRET_SIGNING_KEY}"
  unset NEW_KEY
fi

# ──────────────────────────────────────────────────────────────────────
# Step 4 — Audience placeholder
# ──────────────────────────────────────────────────────────────────────
section "4/8  Audience secret placeholder"

EXISTING_AUDIENCE_VERSION=$(gcloud secrets versions list "${SECRET_AUDIENCE}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --format='value(name)' 2>/dev/null | head -1 || true)

if [[ -n "${EXISTING_AUDIENCE_VERSION}" ]]; then
  info "  ${SECRET_AUDIENCE} already has enabled version ${EXISTING_AUDIENCE_VERSION}; skipping"
else
  echo -n "pending-deploy" | gcloud secrets versions add "${SECRET_AUDIENCE}" \
    --project="${PROJECT_ID}" \
    --data-file=- >/dev/null
  ok "  wrote placeholder 'pending-deploy' as first version of ${SECRET_AUDIENCE}"
  info "  hydrate with the real Cloud Run URL after first deploy via:"
  info "    bash scripts/hydrate-audience-secret.sh --service sahayakai-agents-staging --region ${REGION} --project ${PROJECT_ID}"
fi

# ──────────────────────────────────────────────────────────────────────
# Step 5 — Shadow Gemini API key (operator paste)
# ──────────────────────────────────────────────────────────────────────
section "5/8  Shadow Gemini API key — operator paste"

EXISTING_SHADOW_VERSION=$(gcloud secrets versions list "${SECRET_SHADOW_KEY}" \
  --project="${PROJECT_ID}" \
  --filter="state=ENABLED" \
  --format='value(name)' 2>/dev/null | head -1 || true)

if [[ -n "${EXISTING_SHADOW_VERSION}" ]]; then
  info "  ${SECRET_SHADOW_KEY} already has enabled version ${EXISTING_SHADOW_VERSION}; skipping prompt"
  info "  to verify it is DISJOINT from the live pool, run:"
  info "    diff <(gcloud secrets versions access latest --secret=${SECRET_LIVE_KEY} --project=${PROJECT_ID}) \\"
  info "         <(gcloud secrets versions access latest --secret=${SECRET_SHADOW_KEY} --project=${PROJECT_ID})"
else
  cat <<EOF

  ⚠  Operator action required.

  Mint a NEW Gemini API key in Google AI Studio (https://aistudio.google.com/apikey)
  for the SahayakAI project. This key MUST be different from the one stored
  in ${SECRET_LIVE_KEY}; otherwise shadow-mode traffic will double-count
  against the live key's per-minute quota and the auto-abort spend alert
  will trip during the very first ramp.

  Paste the key below (input is hidden). Press Enter when done.
EOF

  PASTED_KEY=""
  read -r -s -p "  shadow Gemini key: " PASTED_KEY
  echo
  if [[ -z "${PASTED_KEY}" ]]; then
    fail "no key entered; aborting. Re-run the script when you have a key ready."
  fi
  if [[ ${#PASTED_KEY} -lt 30 ]]; then
    fail "pasted key is suspiciously short (${#PASTED_KEY} chars). Gemini API keys are typically 39 chars. Aborting."
  fi
  echo -n "${PASTED_KEY}" | gcloud secrets versions add "${SECRET_SHADOW_KEY}" \
    --project="${PROJECT_ID}" \
    --data-file=- >/dev/null
  ok "  shadow key stored as version 1 of ${SECRET_SHADOW_KEY}"
  unset PASTED_KEY
fi

# ──────────────────────────────────────────────────────────────────────
# Step 6 — Sidecar runtime SA: per-secret + project IAM
# ──────────────────────────────────────────────────────────────────────
section "6/8  Sidecar runtime SA — IAM"

bind_secret_accessor() {
  local secret="$1"
  local sa="$2"
  if ! gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    info "    ${secret} not present; skipping accessor bind for ${sa}"
    return 0
  fi
  # `add-iam-policy-binding` is itself idempotent (no-op if binding exists).
  gcloud secrets add-iam-policy-binding "${secret}" \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${sa}" \
    --role=roles/secretmanager.secretAccessor \
    --condition=None \
    --quiet >/dev/null
  ok "    bound ${sa} as secretAccessor on ${secret}"
}

info "  per-secret accessor bindings"
bind_secret_accessor "${SECRET_LIVE_KEY}"      "${SIDECAR_SA}"
bind_secret_accessor "${SECRET_SHADOW_KEY}"    "${SIDECAR_SA}"
bind_secret_accessor "${SECRET_SIGNING_KEY}"   "${SIDECAR_SA}"
bind_secret_accessor "${SECRET_AUDIENCE}"      "${SIDECAR_SA}"

bind_project_role() {
  local sa="$1"
  local role="$2"
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${sa}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null
  ok "    bound ${sa} as ${role} (project)"
}

info "  project-level role bindings"
bind_project_role "${SIDECAR_SA}" "roles/datastore.user"
bind_project_role "${SIDECAR_SA}" "roles/cloudtrace.agent"
bind_project_role "${SIDECAR_SA}" "roles/logging.logWriter"

# ──────────────────────────────────────────────────────────────────────
# Step 7 — Next.js runtime SA: signing-key accessor only
# ──────────────────────────────────────────────────────────────────────
section "7/8  Next.js runtime SA — IAM"

info "  per-secret accessor bindings (tight scope — signing key only)"
bind_secret_accessor "${SECRET_SIGNING_KEY}" "${NEXTJS_SA}"

info "  roles/run.invoker on the sidecar service is intentionally NOT bound here"
info "  the Cloud Run service does not yet exist; after Track C deploy run:"
info "    bash scripts/grant-nextjs-invoker.sh \\"
info "        --project ${PROJECT_ID} --region ${REGION} \\"
info "        --service sahayakai-agents-staging \\"
info "        --invoker-sa ${NEXTJS_SA}"

# ──────────────────────────────────────────────────────────────────────
# Step 8 — Final verification
# ──────────────────────────────────────────────────────────────────────
section "8/8  Verification"

header "Service accounts"
gcloud iam service-accounts list \
  --project="${PROJECT_ID}" \
  --filter="email~'^(${SIDECAR_SA_NAME}|${NEXTJS_SA_NAME})@'" \
  --format='table(email,displayName,disabled)'

header "Secret containers"
gcloud secrets list \
  --project="${PROJECT_ID}" \
  --filter="name~'(${SECRET_SIGNING_KEY}|${SECRET_AUDIENCE}|${SECRET_SHADOW_KEY}|${SECRET_LIVE_KEY})$'" \
  --format='table(name,createTime,replication.policy)'

for secret in "${SECRET_SIGNING_KEY}" "${SECRET_AUDIENCE}" "${SECRET_SHADOW_KEY}" "${SECRET_LIVE_KEY}"; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    header "Versions: ${secret}"
    gcloud secrets versions list "${secret}" \
      --project="${PROJECT_ID}" \
      --format='table(name,state,createTime)' \
      --limit=5
  fi
done

header "Per-secret IAM (sidecar SA)"
for secret in "${SECRET_SIGNING_KEY}" "${SECRET_AUDIENCE}" "${SECRET_SHADOW_KEY}" "${SECRET_LIVE_KEY}"; do
  if gcloud secrets describe "${secret}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
    printf '  %s →\n' "${secret}"
    gcloud secrets get-iam-policy "${secret}" \
      --project="${PROJECT_ID}" \
      --format='value(bindings.members)' \
      --flatten="bindings[].members" \
      --filter="bindings.role=roles/secretmanager.secretAccessor AND bindings.members~'(${SIDECAR_SA_NAME}|${NEXTJS_SA_NAME})@'" \
      | sed 's/^/    /'
  fi
done

header "Sidecar service IAM (run.invoker — should be empty until first deploy)"
if gcloud run services describe sahayakai-agents-staging \
    --region="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud run services get-iam-policy sahayakai-agents-staging \
    --region="${REGION}" --project="${PROJECT_ID}" \
    --format='table(bindings.role,bindings.members)' \
    --flatten="bindings[]" \
    --filter="bindings.role=roles/run.invoker"
else
  printf '  Cloud Run service sahayakai-agents-staging not yet deployed — expected.\n'
  printf '  After deploy, run: bash scripts/grant-nextjs-invoker.sh ...\n'
fi

# ──────────────────────────────────────────────────────────────────────
# Summary
# ──────────────────────────────────────────────────────────────────────
echo
echo "──────────────────────────────────────────"
ok "Track C pre-work complete."
echo "──────────────────────────────────────────"
echo
echo "Next steps (in order):"
echo "  1. Apply Firestore rules + TTL:"
echo "       cd sahayakai-main && firebase deploy --only firestore:rules"
echo "       bash sahayakai-agents/scripts/apply-firestore-ttl.sh --project ${PROJECT_ID}"
echo "  2. (Optional) Run full Track D bootstrap for auto-abort + shadow rollup:"
echo "       bash sahayakai-agents/scripts/bootstrap-track-d.sh --project ${PROJECT_ID} --region ${REGION}"
echo "  3. Deploy the sidecar:"
echo "       cd sahayakai-agents && gcloud builds submit --config=deploy/cloudbuild.yaml"
echo "  4. Hydrate the audience secret with the resolved Cloud Run URL:"
echo "       bash scripts/hydrate-audience-secret.sh \\"
echo "           --service sahayakai-agents-staging --region ${REGION} --project ${PROJECT_ID}"
echo "  5. Grant run.invoker to the Next.js SA on the sidecar service:"
echo "       bash scripts/grant-nextjs-invoker.sh \\"
echo "           --project ${PROJECT_ID} --region ${REGION} \\"
echo "           --service sahayakai-agents-staging \\"
echo "           --invoker-sa ${NEXTJS_SA}"
echo "  6. Smoke + preflight, then flip the flag (see RUNBOOK.md)."
