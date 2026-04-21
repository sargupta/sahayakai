# Billing Monitoring System

## Quick Reference

| # | Alert | Severity | Trigger | Channel |
|---|-------|----------|---------|---------|
| 1 | Webhook absence | P1/CRITICAL | 0 webhooks in 6h | Email+Slack |
| 2 | Payment failure rate | P1/CRITICAL | >15% failures/day | Email+Slack |
| 3 | Plan mismatch | P2/ERROR | Any occurrence | Email+Slack |
| 4 | Negative credits | P2/ERROR | Any occurrence | Email+Slack |
| 5 | API latency P95 | P2/ERROR | >5s for 10min | Email+Slack |
| 6 | MRR drop | P2/ERROR | >20% day-over-day | Email+Slack |
| 7 | Firestore write fail | P1/CRITICAL | Any occurrence | Email+Slack |

## Cost: ~$0/month

All monitoring uses log-based metrics (free tier: 100 metrics) and alerting policies (free tier: 500). No uptime checks or custom metrics API calls needed.

## Setup

### 1. Instrument your billing endpoints

Import and use `emitBillingMetric` and `trackBillingLatency` from `@/lib/billing-metrics` in every billing API route:

```typescript
// In /api/webhooks/razorpay/route.ts
import { emitBillingMetric, trackBillingLatency } from '@/lib/billing-metrics';

export async function POST(req: NextRequest) {
  const endLatency = trackBillingLatency('/api/webhooks/razorpay');

  emitBillingMetric({ event: 'webhook_received', razorpayEvent: body.event });

  // ... process webhook ...

  // On Firestore write failure:
  try {
    await db.collection('users').doc(userId).update({ plan: 'pro' });
  } catch (err) {
    emitBillingMetric({
      event: 'firestore_write_failure',
      firestoreCollection: 'users',
      userId,
      errorMessage: err.message,
    });
  }

  // On plan mismatch detection (in reconciliation job):
  emitBillingMetric({
    event: 'plan_mismatch_detected',
    userId,
    currentPlan: firestorePlan,
    expectedPlan: razorpayPlan,
  });

  // On negative credits (in credit deduction logic):
  if (newBalance < 0) {
    emitBillingMetric({
      event: 'credit_balance_negative',
      userId,
      creditBalance: newBalance,
    });
  }

  endLatency(); // emits api_latency metric
}
```

### 2. Deploy Terraform

```bash
cd monitoring/
terraform init
terraform plan -var="notification_email=sar@sargvision.com"
terraform apply -var="notification_email=sar@sargvision.com"

# With Slack:
terraform apply \
  -var="notification_email=sar@sargvision.com" \
  -var="slack_webhook_url=xoxb-your-slack-token"
```

### 3. Set up daily revenue summary

Create a Cloud Scheduler job to hit your summary endpoint daily:

```bash
gcloud scheduler jobs create http billing-daily-summary \
  --location=asia-southeast1 \
  --schedule="0 6 * * *" \
  --uri="https://sahayakai.app/api/jobs/billing-daily-summary" \
  --http-method=POST \
  --headers="Authorization=Bearer $(gcloud auth print-identity-token)" \
  --oidc-service-account-email=640589855975-compute@developer.gserviceaccount.com \
  --oidc-token-audience=https://sahayakai.app
```

### 4. Verify alerts are working

After deploying, test each alert:

```bash
# Test webhook absence: simply wait 6h without webhooks (or temporarily
# set the threshold to 5min for testing)

# Test other alerts: emit test log entries from your app:
curl -X POST https://sahayakai.app/api/webhooks/razorpay \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'
```

## Dashboard

After terraform apply, find the dashboard at:
https://console.cloud.google.com/monitoring/dashboards?project=sahayakai-b4248

Look for "SahayakAI Billing Health".
