#!/usr/bin/env bash
# F1-04 — Twilio creds in plaintext Cloud Run env vars (should be Secret Manager).
# Anyone with run.services.get IAM on the project can read these.
set -euo pipefail
gcloud run services describe sahayakai-hotfix-resilience \
  --region asia-southeast1 \
  --project sahayakai-b4248 \
  --format='value(spec.template.spec.containers[0].env)' \
  | tr ';' '\n' | grep -E 'TWILIO_|GOOGLE_GENAI|FIREBASE_SERVICE'
