#!/usr/bin/env bash
# Deploy the billing kill-switch Cloud Function (2nd gen).
#
# Prereqs (already done by the launch-hardening infra pass):
#   - Pub/Sub topic `billing-killswitch` exists.
#   - Budget "SahayakAI spend guard" publishes to that topic
#     (gcloud billing budgets update ... --notifications-rule-pubsub-topic=...).
#
# The function's runtime service account needs Firestore write on
# system_config/ai_killswitch. The default compute SA usually has it; if not,
# grant roles/datastore.user.
set -euo pipefail

PROJECT=sahayakai-b4248
REGION=asia-southeast1
TOPIC=billing-killswitch

gcloud functions deploy billing-killswitch \
  --gen2 \
  --project="$PROJECT" \
  --region="$REGION" \
  --runtime=nodejs20 \
  --source=. \
  --entry-point=billingKillSwitch \
  --trigger-topic="$TOPIC" \
  --set-env-vars=TRIP_FRACTION=1.0 \
  --memory=256Mi \
  --max-instances=2

echo
echo "Deployed. Test the chain WITHOUT spending real money:"
echo "  gcloud pubsub topics publish $TOPIC --project=$PROJECT \\"
echo "    --message='{\"budgetDisplayName\":\"TEST\",\"costAmount\":100,\"budgetAmount\":100,\"currencyCode\":\"INR\"}'"
echo "Then confirm Firestore system_config/ai_killswitch.enabled == false."
echo "Re-enable manually:  set system_config/ai_killswitch.enabled = true"
