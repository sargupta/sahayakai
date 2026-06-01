# Production Error Alerts

Cloud Monitoring alert policies that fire on the error patterns observed in
the 2026-06-01 GCP log audit. Pages you within minutes of a regression
instead of the days-of-silence loop we just experienced.

**Project**: `sahayakai-b4248`
**Region**: `asia-southeast1` (Cloud Run service `sahayakai-hotfix-resilience`)
**SSR service**: `ssrsahayakaib4248` (Firebase Hosting backend, same region)

Three policies, layered by severity:

| Policy | Trigger | Severity | Why |
|---|---|---|---|
| `prod-error-rate-spike` | >5 ERROR logs in 10 min | warning | Post-2026-06-01 baseline is near-zero; any sustained rate = regression |
| `prod-cloud-run-oom` | Any Cloud Run OOM kill | warning | Was running silently for 7+ days |
| `prod-typeerror-any` | **Any** TypeError in 5 min | critical | Zero-tolerance: every TypeError = a real user got a 500 |

Threshold posture is **zero-tolerance**, not "noise floor". The user's standard
is that every single error signature deserves attention — alert thresholds
are tightened to match. If a policy fires too often after a deploy, the
correct response is to fix the regression, not to raise the threshold.

Total install cost: $0/month (under free tier — same as existing
billing-alerts).

---

## Install (one-shot script)

```bash
cd monitoring
./install-prod-error-alerts.sh abhi.ist.15@gmail.com
```

That's it. The script creates the notification channel, two log-based
metrics, and three alert policies. Re-runnable — `gcloud` returns
`ALREADY_EXISTS` on the second run, which the script swallows.

To verify after install:

```bash
gcloud alpha monitoring policies list --project=sahayakai-b4248 \
  --format="table(displayName,enabled,conditions[0].displayName)" \
  | grep prod-
```

---

## Manual install (if you prefer step-by-step)

### 1. Create the notification channel

```bash
gcloud alpha monitoring channels create \
  --project=sahayakai-b4248 \
  --display-name="Prod Errors Email — Abhishek" \
  --type=email \
  --channel-labels=email_address=abhi.ist.15@gmail.com
```

Save the returned channel name (`projects/sahayakai-b4248/notificationChannels/NNNNNNNN`) — every policy below needs it.

### 2. Create log-based metrics

```bash
# Counts every ERROR-severity log in the project.
gcloud logging metrics create prod_error_count \
  --project=sahayakai-b4248 \
  --description="All ERROR-severity logs (last 7d audit showed 682/wk)" \
  --log-filter='severity>=ERROR'

# Counts Cloud Run OOM kills specifically.
gcloud logging metrics create prod_cloud_run_oom \
  --project=sahayakai-b4248 \
  --description="Cloud Run container exceeded memory limit" \
  --log-filter='resource.type="cloud_run_revision"
    AND textPayload:"Memory limit of"
    AND textPayload:"exceeded"'

# Counts TypeError app-level errors (Genkit / Next.js handlers).
gcloud logging metrics create prod_typeerror_count \
  --project=sahayakai-b4248 \
  --description="App-level TypeErrors (undefined-property crashes)" \
  --log-filter='severity>=ERROR
    AND jsonPayload.error.name="TypeError"'
```

### 3. Create alert policies

Replace `CHANNEL_NAME` in each YAML with the channel from step 1.

**Policy A — error rate spike** (`policy-error-rate-spike.yaml`):

```yaml
displayName: prod-error-rate-spike
documentation:
  content: |
    Total ERROR-severity logs exceeded 50/hour. Open Logs Explorer to
    see the signature breakdown:
    https://console.cloud.google.com/logs/query;query=severity%3E%3DERROR;timeRange=PT1H?project=sahayakai-b4248
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: ERROR logs > 50 per hour
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/prod_error_count"
        AND resource.type="global"'
      aggregations:
        - alignmentPeriod: 3600s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 50
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 604800s  # 7d
notificationChannels:
  - CHANNEL_NAME
```

**Policy B — Cloud Run OOM** (`policy-cloud-run-oom.yaml`):

```yaml
displayName: prod-cloud-run-oom
documentation:
  content: |
    A Cloud Run container hit its memory limit and was killed. SSR
    service (ssrsahayakaib4248) was running on 256 MiB which is too
    tight for Next.js — bump to 512 MiB if you haven't already:
      gcloud run services update ssrsahayakaib4248 \
        --region=asia-southeast1 --memory=512Mi \
        --project=sahayakai-b4248
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: Any OOM in 10 min
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/prod_cloud_run_oom"
        AND resource.type="cloud_run_revision"'
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 0
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 86400s  # 1d
notificationChannels:
  - CHANNEL_NAME
```

**Policy C — TypeError burst** (`policy-typeerror-burst.yaml`):

```yaml
displayName: prod-typeerror-burst
documentation:
  content: |
    More than 5 TypeErrors logged in 10 min. These are undefined-property
    crashes hitting real users. Most recent root cause (2026-06-01) was
    cfg.features?.[name] in feature-flags.ts — patched, but a regression
    here usually means a new feature flag site missed the optional chain.
  mimeType: text/markdown
combiner: OR
conditions:
  - displayName: TypeError > 5 per 10 min
    conditionThreshold:
      filter: 'metric.type="logging.googleapis.com/user/prod_typeerror_count"
        AND resource.type="cloud_run_revision"'
      aggregations:
        - alignmentPeriod: 600s
          perSeriesAligner: ALIGN_SUM
      comparison: COMPARISON_GT
      thresholdValue: 5
      duration: 0s
      trigger:
        count: 1
alertStrategy:
  autoClose: 86400s
notificationChannels:
  - CHANNEL_NAME
```

Apply each:

```bash
gcloud alpha monitoring policies create \
  --project=sahayakai-b4248 \
  --policy-from-file=policy-error-rate-spike.yaml

gcloud alpha monitoring policies create \
  --project=sahayakai-b4248 \
  --policy-from-file=policy-cloud-run-oom.yaml

gcloud alpha monitoring policies create \
  --project=sahayakai-b4248 \
  --policy-from-file=policy-typeerror-burst.yaml
```

---

## Tuning notes

- **Threshold of 5/10 min for total errors** (not 50/hour): the 2026-06-01
  patches dropped the baseline to near-zero. Any sustained rate above
  this floor is a regression worth investigating immediately.
- **OOM at threshold 0**: any OOM at all is worth knowing about. The
  `autoClose: 86400s` means you don't get re-paged every 10 minutes if it's
  a sustained issue — one alert, then quiet for a day.
- **TypeError threshold 0 (any occurrence)**: every TypeError = a real
  user got a 500 because some code path read a property on undefined.
  Cosmic-ray-rare crashes don't exist in this category — every one is a
  bug to fix. If you find yourself silencing this policy, the right
  answer is to ship the patch, not raise the threshold.

---

## Adding Slack or PagerDuty later

Once email is working, add a Slack channel:

```bash
# Slack expects an incoming webhook URL from Slack's app config.
gcloud alpha monitoring channels create \
  --project=sahayakai-b4248 \
  --display-name="Prod Errors Slack" \
  --type=slack \
  --channel-labels=channel_name=#prod-alerts \
  --channel-labels=url=https://hooks.slack.com/services/XXX/YYY/ZZZ
```

Then `gcloud alpha monitoring policies update <POLICY_NAME>
--add-notification-channels=<NEW_CHANNEL_NAME>` for each policy.

PagerDuty: same flow but `--type=pagerduty
--channel-labels=service_key=<32-char-integration-key>`. See `docs/ALERTS.md`
section 1, option B, for the in-code PagerDuty trigger pattern (different —
direct API call from the route handler — useful for billing-critical paths
where you don't want to wait for the log → metric → alert lag of ~2-3 min).
