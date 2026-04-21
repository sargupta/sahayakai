# SahayakAI Monitoring

Production observability — Cloud Monitoring dashboard + log-based metrics.

## Dashboard

The dashboard JSON in `dashboard.json` is 9 widgets laid out in a 4-row mosaic:

| Widget | Shows | Use when |
|--------|-------|----------|
| Request rate by status class | Traffic by 2xx/3xx/4xx/5xx per minute | Spotting traffic spikes or sudden failure waves |
| Error rate (5xx) | Raw 5xx per minute with alert thresholds | On-call debugging |
| Latency p50/p95/p99 | Request latency distribution | Catch tail-latency regressions after deploys |
| CPU / memory utilization | Container resource usage | Right-sizing; spot memory leaks |
| Gemini 429 quota errors | Daily/per-minute quota hits | Know when to upgrade tier or add keys |
| Razorpay webhook failures | Billing provisioning failures | Every hit = likely stuck paid user |
| Cold starts | Container startup rate | Tune `--min-instances` if high |
| Instance count (scaling) | Active / idle split | Capacity planning |
| Bot scan log panel | `.env`, `.git`, `wp-admin` probes | Awareness of attack patterns |

## Install

```bash
# One-time: create the log-based metrics referenced by the dashboard
# (see docs/ALERTS.md for the full recipes — this creates the two
# metrics used on this dashboard)

gcloud logging metrics create gemini_429_quota \
  --project=sahayakai-b4248 \
  --description="Gemini API returned 429 RESOURCE_EXHAUSTED" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="sahayakai-hotfix-resilience"
    AND textPayload=~"429.*Resource exhausted"'

gcloud logging metrics create razorpay_webhook_failed \
  --project=sahayakai-b4248 \
  --description="Razorpay webhook processing failed" \
  --log-filter='resource.type="cloud_run_revision"
    AND resource.labels.service_name="sahayakai-hotfix-resilience"
    AND textPayload=~"\[Webhook\] Error processing"'

# Then deploy the dashboard
gcloud monitoring dashboards create \
  --project=sahayakai-b4248 \
  --config-from-file=monitoring/dashboard.json
```

Dashboard URL after install:
`https://console.cloud.google.com/monitoring/dashboards?project=sahayakai-b4248`

## Updating the dashboard

1. Edit `dashboard.json` locally
2. Get the dashboard name: `gcloud monitoring dashboards list --project=sahayakai-b4248 --filter='displayName:"SahayakAI — Production Health"' --format="value(name)"`
3. Update: `gcloud monitoring dashboards update $NAME --config-from-file=monitoring/dashboard.json`

## Why these specific widgets

- **Not in dashboard:** per-route error breakdown (noisy on dashboard, better as an on-demand log query).
- **Thresholds on error rate widget:** yellow at 1 err/min, red at 5 err/min. Tune down if you want more alerts, up if you get too many.
- **Bot scan log panel:** no aggregate metric because the URLs vary; a rolling log pane is actually more useful for spotting new patterns.

## Alerts

Alerts (separate from dashboards) are documented in `/docs/ALERTS.md`. Start with
Razorpay webhook failures — every hit there is a stuck paying user.
