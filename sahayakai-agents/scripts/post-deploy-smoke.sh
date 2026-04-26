#!/usr/bin/env bash
# Post-deploy smoke test for sahayakai-agents Cloud Run service.
#
# Verifies after a fresh `gcloud run services replace` that:
#   1. /healthz returns 200 (basic liveness)
#   2. /readyz returns 200 with key-pool counts (config sane)
#   3. /.well-known/agent-card.json returns the A2A card (v0.3 spec)
#   4. POST /v1/parent-call/reply rejects with 401 when called WITHOUT
#      an ID token (proves IAM invoker auth is on)
#   5. POST /v1/parent-call/reply rejects with 401 when called WITH a
#      token issued for the wrong audience (proves audience binding works)
#   6. (Optional) POST /v1/parent-call/reply succeeds when called with
#      the correct audience token AND a fake-mode payload — only run
#      if the caller has impersonation rights.
#
# Usage:
#   bash scripts/post-deploy-smoke.sh \
#       --url https://sahayakai-agents-staging-abc-as.a.run.app \
#       --invoker-sa sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com \
#       [--with-impersonation]
#
# Required permissions for the caller:
#   - roles/run.invoker on the service (otherwise step 6 will skip)
#   - iam.serviceAccountTokenCreator on --invoker-sa for step 6
#   - Cloud Run service must be deployed and reachable from the local
#     network. (No VPC SC carve-out is required for the public URL.)
#
# Exit codes:
#   0 — all required checks passed
#   1 — required check failed
#   2 — usage error (missing flag, etc.)
#
# Round-2 audit reference: P0 IAM-1 (invoker auth must be live before
# any traffic), P1 SMOKE-1 (post-deploy contract verified before flag
# flip).

set -euo pipefail

SERVICE_URL=""
INVOKER_SA=""
WITH_IMPERSONATION=0

usage() {
  echo "Usage: $0 --url <service-url> --invoker-sa <sa-email> [--with-impersonation]" >&2
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)
      SERVICE_URL="$2"
      shift 2
      ;;
    --invoker-sa)
      INVOKER_SA="$2"
      shift 2
      ;;
    --with-impersonation)
      WITH_IMPERSONATION=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

[[ -z "$SERVICE_URL" ]] && usage
[[ -z "$INVOKER_SA" ]] && usage

# Strip trailing slash so concatenation is clean.
SERVICE_URL="${SERVICE_URL%/}"

ok() { printf '\e[32m✓\e[0m %s\n' "$*"; }
fail() { printf '\e[31m✗\e[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\e[34m→\e[0m %s\n' "$*"; }

# ── 1. /healthz ─────────────────────────────────────────────────────────
info "1/6 GET ${SERVICE_URL}/healthz"
HEALTHZ_STATUS=$(curl -s -o /tmp/healthz.body -w '%{http_code}' "${SERVICE_URL}/healthz")
[[ "$HEALTHZ_STATUS" == "200" ]] || fail "/healthz returned $HEALTHZ_STATUS"
ok "/healthz returned 200"

# ── 2. /readyz ──────────────────────────────────────────────────────────
info "2/6 GET ${SERVICE_URL}/readyz"
READYZ_STATUS=$(curl -s -o /tmp/readyz.body -w '%{http_code}' "${SERVICE_URL}/readyz")
[[ "$READYZ_STATUS" == "200" ]] || fail "/readyz returned $READYZ_STATUS — check secrets, key pool, Firestore connectivity"
ok "/readyz returned 200"
info "    body: $(cat /tmp/readyz.body)"

# ── 3. /.well-known/agent-card.json ─────────────────────────────────────
info "3/6 GET ${SERVICE_URL}/.well-known/agent-card.json"
CARD_STATUS=$(curl -s -o /tmp/card.body -w '%{http_code}' "${SERVICE_URL}/.well-known/agent-card.json")
[[ "$CARD_STATUS" == "200" ]] || fail "A2A card returned $CARD_STATUS"
# Spot-check the card schema: must have name + version + securitySchemes.
python3 - <<'PYEOF' < /tmp/card.body
import json, sys
card = json.load(sys.stdin)
required = {"name", "version", "securitySchemes"}
missing = required - set(card.keys())
if missing:
    print(f"A2A card missing keys: {sorted(missing)}", file=sys.stderr)
    sys.exit(1)
print(f"    card.name={card['name']!r} version={card['version']!r}")
PYEOF
ok "/.well-known/agent-card.json returned a v0.3-shaped card"

# ── 4. POST /v1/parent-call/reply WITHOUT auth → 401 ────────────────────
info "4/6 POST /v1/parent-call/reply (no auth) — expect 401"
NOAUTH_STATUS=$(curl -s -o /tmp/noauth.body -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' \
  -d '{"callSid":"smoke","turnNumber":1,"studentName":"x","className":"x","subject":"x","reason":"x","teacherMessage":"x","parentLanguage":"en","parentSpeech":"x"}' \
  "${SERVICE_URL}/v1/parent-call/reply")
[[ "$NOAUTH_STATUS" == "401" ]] || fail "Unauthenticated POST returned $NOAUTH_STATUS — IAM invoker auth not enforced"
ok "Unauthenticated POST correctly rejected with 401"

# ── 5. POST with token for WRONG audience → 401 ─────────────────────────
info "5/6 POST /v1/parent-call/reply (wrong-audience token) — expect 401"
# Use the bare service URL as audience but flip a character. Cloud Run
# verification rejects this because the `aud` claim mismatch.
WRONG_AUD="${SERVICE_URL}-wrong"
if WRONG_TOKEN=$(gcloud auth print-identity-token \
    --impersonate-service-account="${INVOKER_SA}" \
    --audiences="${WRONG_AUD}" 2>/dev/null); then
  WRONG_STATUS=$(curl -s -o /tmp/wrong.body -w '%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${WRONG_TOKEN}" \
    -d '{}' "${SERVICE_URL}/v1/parent-call/reply")
  [[ "$WRONG_STATUS" == "401" ]] || fail "Wrong-audience POST returned $WRONG_STATUS — audience binding not enforced"
  ok "Wrong-audience POST correctly rejected with 401"
else
  info "    skipped (gcloud impersonation not available)"
fi

# ── 6. POST with correct token (only if --with-impersonation) ───────────
if [[ "$WITH_IMPERSONATION" == "1" ]]; then
  info "6/6 POST /v1/parent-call/reply (correct audience) — expect 200 OR 502 (fake-mode response or guard)"
  if RIGHT_TOKEN=$(gcloud auth print-identity-token \
      --impersonate-service-account="${INVOKER_SA}" \
      --audiences="${SERVICE_URL}" 2>/dev/null); then
    # Send a minimal valid payload. We do NOT assert 200 here because
    # the behavioural guard may legitimately reject a smoke payload;
    # we just want to confirm the auth path lets us through.
    AUTHED_STATUS=$(curl -s -o /tmp/authed.body -w '%{http_code}' \
      -X POST -H 'Content-Type: application/json' \
      -H "Authorization: Bearer ${RIGHT_TOKEN}" \
      -d '{"callSid":"smoke-test","turnNumber":1,"studentName":"x","className":"x","subject":"x","reason":"smoke","teacherMessage":"smoke","parentLanguage":"en","parentSpeech":"smoke test"}' \
      "${SERVICE_URL}/v1/parent-call/reply")
    case "$AUTHED_STATUS" in
      200|502)
        ok "Correctly-authenticated POST reached the handler (status=$AUTHED_STATUS)"
        ;;
      *)
        fail "Correctly-authenticated POST returned $AUTHED_STATUS — auth path is broken"
        ;;
    esac
  else
    info "    skipped (could not mint impersonated token)"
  fi
else
  info "6/6 skipped (--with-impersonation not set)"
fi

echo
ok "Post-deploy smoke complete."
