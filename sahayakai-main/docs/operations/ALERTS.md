# Production Alerts Setup

Covers critical alerts that catch money/security bugs BEFORE users complain.

---

## 1. Razorpay Webhook Failures (highest priority)

**Why**: When a webhook fails, a paying user may have been charged but not
upgraded. Every minute a failure sits undetected = angry user + refund load.

### Signal

Firestore docs in `webhook_events` collection with `status: 'failed'`.

### Option A — Cloud Monitoring log-based metric + email/Slack

```bash
gcloud logging metrics create razorpay_webhook_failed \
  --project=sahayakai-b4248 \
  --description="Razorpay webhook processing failed" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="sahayakai-hotfix-resilience"
    AND textPayload=~"\\[Webhook\\] Error processing"'
```

Then in Cloud Console → Monitoring → Alerting → Create Policy:
- Condition: `logging.googleapis.com/user/razorpay_webhook_failed` > 0 over 5 min
- Notification channel: your Slack webhook or email

### Option B — PagerDuty integration

1. In PagerDuty, create a service: "SahayakAI Billing" with an Events API v2 integration. Copy the **Integration Key** (32-char string).
2. Add env var to Cloud Run:
   ```bash
   gcloud run services update sahayakai-hotfix-resilience \
     --region=asia-southeast1 --project=sahayakai-b4248 \
     --update-env-vars=PAGERDUTY_ROUTING_KEY=<your-32-char-key>
   ```
3. Add the webhook-failure alert at the top of the `catch` block in
   `src/app/api/webhooks/razorpay/route.ts` (where we already log `[Webhook]
   Error processing`):
   ```typescript
   // Fire-and-forget PagerDuty alert (don't block the catch)
   if (process.env.PAGERDUTY_ROUTING_KEY) {
     fetch('https://events.pagerduty.com/v2/enqueue', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         routing_key: process.env.PAGERDUTY_ROUTING_KEY,
         event_action: 'trigger',
         dedup_key: eventId,
         payload: {
           summary: `Razorpay webhook failed: ${event.event}`,
           severity: 'error',
           source: 'sahayakai-hotfix-resilience',
           custom_details: { eventId, event: event.event, error: String(err) },
         },
       }),
     }).catch(() => {});
   }
   ```

---

## 2. Gemini API 403 / Key Denied (all AI features broken)

**Why**: Happened once already (2026-04-18). Google revoked the key; we didn't
notice until users complained.

```bash
gcloud logging metrics create gemini_403_denied \
  --project=sahayakai-b4248 \
  --description="Google GenAI returned 403 Forbidden" \
  --log-filter='resource.type="cloud_run_revision"
    AND textPayload=~"403 Forbidden.*Your project has been denied access"'
```

Alert: > 0 occurrences in 5 min → page immediately. This is
catastrophic — ALL content generation is down until the key rotates.

---

## 3. Quota Rollback Failures (usage counters drifting)

**Why**: After the atomic-reservation fix, rollback failures mean a user lost
a quota unit for a failed call. Rare but if it spikes, Firestore is degraded.

```bash
gcloud logging metrics create usage_rollback_failed \
  --project=sahayakai-b4248 \
  --description="rollbackQuota failed — usage drift" \
  --log-filter='resource.type="cloud_run_revision"
    AND textPayload=~"\\[UsageCounters\\] rollbackQuota failed"'
```

Alert: > 5 occurrences in 10 min → Slack warning (not page).

---

## 4. Twilio Call 5xx Rate

**Why**: Spikes in Twilio 502s suggest Twilio region issues or misconfigured
credentials. Also catches the new "outreach has no valid parent phone" 422s
if they unexpectedly spike (data quality issue).

```bash
gcloud logging metrics create attendance_call_errors \
  --project=sahayakai-b4248 \
  --log-filter='resource.type="cloud_run_revision"
    AND httpRequest.requestUrl=~"/api/attendance/call"
    AND httpRequest.status>=400'
```

Alert: > 10 errors in 10 min → Slack.

---

## 5. Feature Flag Read Failures (gating would be failing-closed)

Post-fix, a Firestore outage means all users see 429 until Firestore recovers.
Worth knowing about but not paging severity.

```bash
gcloud logging metrics create feature_flag_read_failed \
  --project=sahayakai-b4248 \
  --log-filter='resource.type="cloud_run_revision"
    AND textPayload=~"\\[plan-guard\\] Failed to read feature_flags"'
```

Alert: > 20 in 5 min → Slack.

---

## 6. Billing Reconciliation Delta

**Why**: After the Bug 6 fix, the monthly reconciliation report includes a real
delta between Razorpay revenue and Firestore subscription records. A non-zero
delta = money received but not provisioned (or vice versa).

The monthly job writes a doc to `billing_reports/{yearMonth}`. Add a nightly
check (separate from the reconciliation cron):

```typescript
// In src/app/api/jobs/reconciliation-alert/route.ts (new)
const report = await db.collection('billing_reports').doc(currentMonth).get();
if (report.exists && Math.abs(report.data()!.delta) > 100_00) {
    // > ₹100 mismatch → alert
    sendPagerDutyAlert('Reconciliation delta > ₹100', { month, delta });
}
```

Schedule: Cloud Scheduler → runs at 06:00 IST daily.

---

## Dashboard

After creating the metrics, add them all to a single Cloud Monitoring dashboard:

```bash
gcloud monitoring dashboards create --config-from-file=docs/monitoring-dashboard.json
```

(Dashboard JSON not included in this repo yet — create manually in Console.)

---

## Minimum viable setup

If you only set up ONE thing, set up **Alert #1 (Razorpay webhook failures)**.
Every other alert is defense-in-depth; that one is a direct money-leak signal.
