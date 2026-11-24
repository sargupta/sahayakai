#!/usr/bin/env bash
# Reproducible Cloud Armor setup for SahayakAI.
#
# Run from anywhere with gcloud authenticated to the sahayakai-b4248 project.
# Idempotent: gracefully handles "already exists" by continuing.
#
# Policy protects the Cloud Run LB backend `sahayakai-backend-service` from:
#   1. Scanner probes for secrets / admin paths (/.env, /wp-admin, /.git, etc.)
#   2. Known malicious IPs observed in logs
#   3. Brute-force attempts on /api/auth/* (rate-limited)

set -eu
PROJECT=sahayakai-b4248
POLICY=sahayakai-bot-block
BACKEND=sahayakai-backend-service

# --- Create policy if missing -----------------------------------------------
gcloud compute security-policies describe "$POLICY" --project="$PROJECT" >/dev/null 2>&1 \
  || gcloud compute security-policies create "$POLICY" --project="$PROJECT" \
        --description="Block common bot scans and rate-limit auth"

# --- Rule 1000: block secret/admin path scans (case-insensitive) ------------
# Non-capturing groups required — RE2 engine in Cloud Armor rejects capture groups.
# The `(?i)` inline flag enables case-insensitive matching for variants like
# /phpMyAdmin, /PHPMyAdmin, etc.
RULE1000_EXPR='request.path.matches("(?i)^/(?:\\.env|\\.env\\.[a-z]+|\\.git/|wp-admin|wp-login|phpmyadmin|admin\\.php|xmlrpc\\.php|\\.aws/|\\.ssh/|\\.docker/|backend/\\.env|api/\\.env|server-status|server-info)") || request.path.matches("(?i)^/(?:phpunit|vendor/phpunit|webroot/\\.env)")'

gcloud compute security-policies rules describe 1000 --security-policy="$POLICY" --project="$PROJECT" >/dev/null 2>&1 \
  && gcloud compute security-policies rules update 1000 \
       --project="$PROJECT" --security-policy="$POLICY" \
       --expression="$RULE1000_EXPR" \
  || gcloud compute security-policies rules create 1000 \
       --project="$PROJECT" --security-policy="$POLICY" \
       --expression="$RULE1000_EXPR" \
       --action="deny-403" \
       --description="Block secret/admin path scans"

# --- Rule 2000: block known scanner IPs (add more as they appear in logs) ---
# Update this list quarterly; sources from Cloud Armor enforcement logs.
SCANNER_IPS="195.178.110.104/32,170.64.141.43/32"

gcloud compute security-policies rules describe 2000 --security-policy="$POLICY" --project="$PROJECT" >/dev/null 2>&1 \
  && gcloud compute security-policies rules update 2000 \
       --project="$PROJECT" --security-policy="$POLICY" \
       --src-ip-ranges="$SCANNER_IPS" \
  || gcloud compute security-policies rules create 2000 \
       --project="$PROJECT" --security-policy="$POLICY" \
       --src-ip-ranges="$SCANNER_IPS" \
       --action="deny-403" \
       --description="Known scanner IPs (source: enforcement logs)"

# --- Rule 3000: rate-limit /api/auth/* (anti-brute-force) -------------------
# 30 req/min/IP permitted; exceeding bans that IP for 10 minutes with 429.
gcloud compute security-policies rules describe 3000 --security-policy="$POLICY" --project="$PROJECT" >/dev/null 2>&1 \
  || gcloud compute security-policies rules create 3000 \
       --project="$PROJECT" --security-policy="$POLICY" \
       --expression='request.path.matches("^/api/auth/.*")' \
       --action=rate-based-ban \
       --rate-limit-threshold-count=30 \
       --rate-limit-threshold-interval-sec=60 \
       --ban-duration-sec=600 \
       --conform-action=allow \
       --exceed-action=deny-429 \
       --enforce-on-key=IP \
       --description="Rate-limit auth: 30 req/min/IP, ban 10 min"

# --- Attach policy to LB backend --------------------------------------------
gcloud compute backend-services update "$BACKEND" \
  --project="$PROJECT" \
  --security-policy="$POLICY" \
  --global

echo ""
echo "✅ Cloud Armor policy '$POLICY' applied to backend '$BACKEND'."
echo "   Test:   curl -I https://sahayakai.com/.env         (expect 403)"
echo "   Test:   curl -I https://sahayakai.com/api/health   (expect 200)"
echo ""
echo "   Propagation: ~30-90 seconds globally."
