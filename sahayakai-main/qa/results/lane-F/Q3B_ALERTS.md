# Q3B — Production Alerting for ADK Migration

Branch: `feature/q3b-prod-alerts` (off `develop`).
Project: `sahayakai-b4248` (region `asia-southeast1`).
Sidecar service: `sahayakai-agents`. Web service: `sahayakai-hotfix-resilience`.

## Layout

```
infra/monitoring/
  01-sidecar-5xx-rate.yaml
  02-sidecar-p95-vs-genkit.yaml
  03-genkit-fallback-rate.yaml
  04-appcheck-verification-failure.yaml
  05-sidecar-memory-utilization.yaml
  06-sidecar-cold-start-latency.yaml
  07-prod-health-non-200.yaml
  08-per-agent-5xx-spike.yaml

scripts/deploy-alerts.sh   # idempotent; plan by default, --apply to commit
```

## Notification channels

Resolved from `gcloud alpha monitoring channels list`:

| Channel                              | ID                                                                 | Use |
|--------------------------------------|--------------------------------------------------------------------|-----|
| Abhishek G (email)                   | `projects/sahayakai-b4248/notificationChannels/14759337832897576982` | WARN |
| parent-call auto-abort (Pub/Sub)     | `projects/sahayakai-b4248/notificationChannels/6266857225070447300`  | PAGE + SECURITY |

**To set up before going live:**
1. A dedicated pager channel (PagerDuty / Opsgenie webhook). The auto-abort
   Pub/Sub topic is fine as a fallback that drives the auto-rollback Cloud
   Function, but it does NOT page a human. Create a webhook channel and pass
   it as `PAGE_CHANNEL=…` to `deploy-alerts.sh`.
2. A dedicated security channel for policy 4 (`SECURITY_CHANNEL=…`). Ideally
   posts to `#security-alerts` in Slack via webhook.
3. Optional Slack #ai-canary channel for WARN-tier (`WARN_CHANNEL=…`).

Until those exist, the script falls back to the existing two channels above.

## Policies — summary

| # | DisplayName | Severity | Window | Logic |
|---|-------------|----------|--------|-------|
| 01 | `sahayakai-agents sidecar — 5xx ratio > 1% (5m)` | PAGE | 5m | MQL ratio: `5xx_count / total_count > 0.01` |
| 02 | `sahayakai-agents sidecar — p95 > 1.5× Genkit p95 (10m)` | WARN | 10m | MQL ratio of log-based distributions (`dispatcher_complete_sidecar_latency` p95 / `dispatcher_complete_genkit_latency` p95) > 1.5 |
| 03 | `dispatcher — Genkit fallback rate > 5% per agent (10m)` | WARN | 10m | MQL ratio per `metric.agent`: `dispatcher_complete_fallback / dispatcher_complete_total > 0.05` |
| 04 | `sahayakai-agents sidecar — AppCheck failures > 0 (1h)` | CRITICAL | 60s | Counter `sidecar_appcheck_failed` rate > 0 |
| 05 | `sahayakai-agents sidecar — memory util > 80% (5m)` | WARN | 5m | `run.googleapis.com/container/memory/utilizations` p99 > 0.8 |
| 06 | `sahayakai-agents sidecar — cold-start > 5s (5m)` | WARN | 5m | `run.googleapis.com/container/startup_latencies` p95 > 5000ms |
| 07 | `sahayakai prod — /api/health non-200` | PAGE | 60s | Uptime check `sahayakai-prod-api-health` fails in ≥ 2 regions |
| 08 | `dispatcher — per-agent 5xx > 5% (5m)` | PAGE | 5m | MQL ratio per agent: `dispatcher_error_5xx / dispatcher_complete_total > 0.05`; alert label carries failing agent |

All policies set `alertStrategy.autoClose = 86400s` (24h) except policy 4 = 1h.

## Log-based metrics created by `deploy-alerts.sh`

| Metric | Kind | Source |
|---|---|---|
| `dispatcher_complete_sidecar_latency` | DISTRIBUTION (ms) | `jsonPayload.event="dispatcher.complete" AND jsonPayload.source="sidecar"` → `EXTRACT(jsonPayload.elapsedMs)` |
| `dispatcher_complete_genkit_latency` | DISTRIBUTION (ms) | `jsonPayload.event="dispatcher.complete" AND jsonPayload.source="genkit_fallback"` → `EXTRACT(jsonPayload.elapsedMs)` |
| `dispatcher_complete_total` | COUNTER | `jsonPayload.event="dispatcher.complete"` — label `agent` |
| `dispatcher_complete_fallback` | COUNTER | `jsonPayload.event="dispatcher.complete" AND jsonPayload.source="genkit_fallback"` — label `agent` |
| `dispatcher_error_5xx` | COUNTER | `jsonPayload.event="dispatcher.error" AND jsonPayload.status>=500` — label `agent` |
| `sidecar_appcheck_failed` | COUNTER | sidecar 401s and AppCheck verify-failed events |

**Required dispatcher log shape (action item for web codebase):**

```jsonc
// success
{ "event": "dispatcher.complete", "source": "sidecar" | "genkit_fallback",
  "agent": "<agent-name>", "elapsedMs": 1234, "status": 200 }
// failure
{ "event": "dispatcher.error", "source": "sidecar" | "genkit_fallback",
  "agent": "<agent-name>", "status": 500, "errorCode": "..." }
// appcheck (sidecar side)
{ "event": "appcheck.verify_failed", "reason": "..." }
```

If the current `parent-call` dispatcher already emits this shape, the metrics
will start populating immediately. Audit `src/ai/dispatcher.ts` (or equiv.)
and the sidecar's AppCheck middleware before flipping `--apply`.

## Uptime check (policy 7)

`deploy-alerts.sh` creates uptime check `sahayakai-prod-api-health` against
`https://${PROD_HOST}${PROD_HEALTH_PATH}` (defaults: `sahayakai.com` and
`/api/health`), probing every 60s from USA + EUROPE + ASIA_PACIFIC.

## How to deploy

```sh
# auth as service account (required per project memory)
gcloud config set auth/impersonate_service_account \
  firebase-adminsdk-fbsvc@sahayakai-b4248.iam.gserviceaccount.com

# plan
bash scripts/deploy-alerts.sh

# apply (idempotent; updates in place if displayName matches)
bash scripts/deploy-alerts.sh --apply

# apply just one policy (e.g. policy 4)
bash scripts/deploy-alerts.sh --apply --only 04
```

Override channels via env vars before `--apply`:

```sh
PAGE_CHANNEL=projects/sahayakai-b4248/notificationChannels/<pagerduty-id> \
SECURITY_CHANNEL=projects/sahayakai-b4248/notificationChannels/<sec-slack-id> \
WARN_CHANNEL=projects/sahayakai-b4248/notificationChannels/<canary-slack-id> \
bash scripts/deploy-alerts.sh --apply
```

## How to verify each alert fires

| # | Verification steps |
|---|--------------------|
| 01 | Briefly route 5% canary traffic to a known-broken sidecar revision (or add a debug `/_500` route guarded by AppCheck). Send sustained traffic; alert fires within 5–6 min and auto-rollback Cloud Function demotes percent. Restore. |
| 02 | After log shape is verified, slow down a non-prod sidecar revision (e.g. `time.sleep(5)` in a debug agent), route a small canary, confirm `elapsedMs` diverges in logs. |
| 03 | Force sidecar to 5xx for one agent (revoke its AppCheck token in a test env or inject an exception). Fallback rate per `metric.agent` exceeds 5% inside the 10-min window. |
| 04 | `curl -X POST https://<sidecar-host>/v1/parent-call/reply -H 'X-Firebase-AppCheck: bogus'` — sidecar returns 401, log metric increments, alert fires within ~60s. |
| 05 | On a canary revision, lower memory limit (e.g. 512Mi → 256Mi). Util crosses 80% under normal load. Restore after firing. |
| 06 | Set `--min-instances=0` temporarily, wait for scale-down, then send a request. If startup > 5s, alert fires. Restore `--min-instances=1`. |
| 07 | Cloud Monitoring → Uptime checks → `sahayakai-prod-api-health` → "Check now" against a wrong path to force red. |
| 08 | Same as policy 3 but reuse a sidecar route that returns 500. Verify the notification email/page carries `metric.agent=<name>`. |

## Verification status

- [x] All eight YAMLs lint as valid alert policies (consistent shape with the
      existing `parent-call sidecar — error rate > 2%` policy).
- [x] `deploy-alerts.sh` plan run completes cleanly with no errors.
- [ ] `--apply` run — DEFERRED until product owner confirms the dispatcher
      log shape matches the metrics' extractors (otherwise policies 2, 3, 8
      will silently never fire). One web-side audit ticket needed.
- [ ] Replace the auto-abort Pub/Sub fallback with a real pager channel before
      treating "PAGE" policies as on-call-grade.

## Files added

```
infra/monitoring/01-sidecar-5xx-rate.yaml
infra/monitoring/02-sidecar-p95-vs-genkit.yaml
infra/monitoring/03-genkit-fallback-rate.yaml
infra/monitoring/04-appcheck-verification-failure.yaml
infra/monitoring/05-sidecar-memory-utilization.yaml
infra/monitoring/06-sidecar-cold-start-latency.yaml
infra/monitoring/07-prod-health-non-200.yaml
infra/monitoring/08-per-agent-5xx-spike.yaml
scripts/deploy-alerts.sh
qa/results/lane-F/Q3B_ALERTS.md   # this file
```
