# Q3E — Cost attribution & sidecar-vs-Genkit dashboard

How to see **per-agent daily $$** on the ADK Python sidecar vs the Genkit (TS) path, end-to-end. Branch: `feature/cost-attribution-dashboard`.

Two independent signal streams the dashboard joins:

1. **GCP $$**: Cloud Billing → BigQuery export, sliced by Cloud Run service labels. Tells us how much each service (`sahayakai-agents` vs `sahayakai-hotfix-resilience`) costs across all SKUs (compute, egress, Gemini API).
2. **Per-agent token counts**: Cloud Logging → BigQuery sink on the `dispatch.cost` structured event emitted by every dispatcher in `src/lib/sidecar/*-dispatch.ts`. Tells us *which agent* under each path consumed *how many estimated tokens*.

GCP $$ alone can't split by agent (Gemini SKU is per-project, not per-agent). Per-agent tokens alone can't see the egress/compute side of the bill. Together they reconcile.

---

## 1. Cloud Run service labels (cost attribution)

| Service                       | service-tier | cost-bucket   |
| ----------------------------- | ------------ | ------------- |
| `sahayakai-agents`            | sidecar      | adk-prod      |
| `sahayakai-agents-staging`    | sidecar      | adk-staging   |
| `sahayakai-hotfix-resilience` | dispatcher   | prod-web      |
| `sahayakai-preview`           | dispatcher   | preview-web   |

Apply once (idempotent) — covers ALL four services:

```bash
bash infra/labels/apply-dispatcher-labels.sh
```

Re-run after any redeploy if labels look stale.

Verify:
```bash
gcloud run services describe sahayakai-hotfix-resilience \
  --region=asia-southeast1 --format='value(metadata.labels)'
```

The sidecar's `deploy/service.yaml` SHOULD also carry the labels declaratively so they re-apply on every Cloud Build deploy. Concurrent edits to that file during this PR's window prevented the in-repo YAML edit (see lane-F report's Concurrency note). Until that lands, `apply-dispatcher-labels.sh` is the canonical stamp.

---

## 2. Cloud Billing → BigQuery export

### Verify export is configured

```bash
gcloud billing accounts list
gcloud beta billing accounts describe <billing-account-id> --format='value(billingExport)'
```

If empty, configure standard usage export (NOT detailed — ~10× bigger and we don't need per-row SKU detail):

1. Cloud Billing Console → Billing export → BigQuery export:
   <https://console.cloud.google.com/billing/_/export/bigquery>
2. Project `sahayakai-b4248`, dataset `billing_export` (create in `asia-southeast1`).
3. Enable **Standard usage cost data**. Wait 24 h for the first daily roll.

No full gcloud surface for this — Console is the supported path.

### Daily roll-up query

`infra/billing/sidecar-vs-genkit-daily.sql` — substitute `<BILLING_PROJECT>`, `<BILLING_DATASET>`, `<BILLING_ACCOUNT_ID_UND>` before running.

- **Block 1**: per (date, service, sku, service-tier, cost-bucket) — drill-down table.
- **Block 2**: per (date, service-tier) net spend — feeds the stacked-area chart.

---

## 3. Per-agent telemetry (`dispatch.cost`)

### Emit

`src/lib/sidecar/dispatch-cost.ts` defines `logDispatchCost({ agent, source, inputChars, outputChars, … })`. Emits one JSON line per dispatch:

```json
{ "event": "dispatch.cost", "agent": "parent-call", "source": "sidecar",
  "estimated_tokens": 412, "latency_ms": 938 }
```

`estimated_tokens` uses a `chars/4` heuristic. Within ±20 % of billed Gemini tokens for English/Hindi — good enough for trend & 2× drift detection (the alert threshold), not for invoice reconciliation.

### Rollout for all 17 dispatchers

Wire into each of:

```
src/lib/sidecar/dispatch.ts                       (parent-call)
src/lib/sidecar/quiz-dispatch.ts
src/lib/sidecar/avatar-generator-dispatch.ts
src/lib/sidecar/lesson-plan-dispatch.ts
src/lib/sidecar/assessment-scanner-dispatch.ts
src/lib/sidecar/teacher-training-dispatch.ts
src/lib/sidecar/community-persona-message-dispatch.ts
src/lib/sidecar/exam-paper-dispatch.ts
src/lib/sidecar/visual-aid-dispatch.ts
src/lib/sidecar/assignment-assessor-dispatch.ts
src/lib/sidecar/instant-answer-dispatch.ts
src/lib/sidecar/vidya-dispatch.ts
src/lib/sidecar/video-storyteller-dispatch.ts
src/lib/sidecar/parent-message-dispatch.ts
src/lib/sidecar/rubric-dispatch.ts
src/lib/sidecar/worksheet-dispatch.ts
src/lib/sidecar/voice-to-text-dispatch.ts
src/lib/sidecar/virtual-field-trip-dispatch.ts
```

Pattern (per path in the dispatcher — off / shadow / canary / fallback):

```ts
import { logDispatchCost } from './dispatch-cost';
const COST_AGENT = '<agent>'; // e.g. 'quiz'

// after generateXxx() / sidecar.res available:
logDispatchCost({
  agent: COST_AGENT,
  source: 'genkit' | 'sidecar' | 'genkit_fallback',
  inputChars: <length of topic + prompt context>,
  outputChars: JSON.stringify(output).length,
  uid: input.userId,
  latencyMs,
});
```

In `shadow` mode emit BOTH a `genkit` AND a `sidecar` row so the dashboard correctly accounts the doubled spend.

### Sink to BigQuery

```bash
bash infra/billing/dispatch-cost-log-sink.sh
```

Creates dataset `dispatch_cost`, the `dispatch-cost-sink` logging sink filtered to `jsonPayload.event="dispatch.cost"`, and prints the writer-identity SA which still needs **BigQuery Data Editor** on the dataset (one-time, via Console).

### Aggregation query

`infra/billing/per-agent-tokens-daily.sql`:
- **Block 1**: per (date, agent, source) tokens + dispatch count + avg latency.
- **Block 2**: weekly sidecar / Genkit ratio — backs the > 2× alert.

---

## 4. Looker Studio dashboard

Looker Studio doesn't have a useful gcloud surface — set up via UI:

1. <https://lookerstudio.google.com> → Blank report → BigQuery connector.
2. **Data source A** — billing dataset, custom query = `infra/billing/sidecar-vs-genkit-daily.sql` block 2.
   Chart: **Stacked area chart**, dimension = `usage_date`, breakdown = `service_tier`, metric = `net_usd`.
3. **Data source B** — `dispatch_cost` dataset, custom query = `infra/billing/per-agent-tokens-daily.sql` block 1.
   Chart: **Line chart**, dimension = `usage_date`, breakdown = `agent`, metric = `estimated_tokens`. Filter `source = sidecar`; clone with `source IN ('genkit','genkit_fallback')` for the second line chart.
4. Add date-range control top-right (default last 30 days).
5. Add filter chip for `cost-bucket` (so ops can isolate `adk-prod` from `adk-staging`).
6. Share → Schedule email delivery → ops@<list> → Weekly Monday 09:00 IST.
7. Paste the report URL into `infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml` (the WARN doc references it) and below:

```
Looker Studio URL: <PASTE HERE AFTER FIRST PUBLISH>
```

---

## 5. Alert: weekly sidecar tokens > 2× Genkit

`infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml` declares the log-based alert. Setup:

1. **Create the scheduled BQ query** that fills `dispatch_cost.weekly_ratio_alerts`. BigQuery Console → Scheduled queries → New:
   - Schedule: every Monday 00:30 UTC (06:00 IST).
   - Destination table: `dispatch_cost.weekly_ratio_alerts` (write-append).
   - Query:
     ```sql
     WITH weekly AS (
       SELECT
         DATE_TRUNC(DATE(timestamp), WEEK(MONDAY)) AS week_start,
         jsonPayload.agent  AS agent,
         jsonPayload.source AS source,
         SUM(CAST(jsonPayload.estimated_tokens AS INT64)) AS tokens
       FROM `sahayakai-b4248.dispatch_cost.run_googleapis_com_stdout`
       WHERE jsonPayload.event = 'dispatch.cost'
         AND DATE(timestamp) BETWEEN
             DATE_TRUNC(CURRENT_DATE() - 7, WEEK(MONDAY))
         AND DATE_TRUNC(CURRENT_DATE(), WEEK(MONDAY)) - 1
       GROUP BY week_start, agent, source
     ),
     agg AS (
       SELECT week_start, agent,
              SUM(IF(source='sidecar', tokens, 0)) AS sidecar_tokens,
              SUM(IF(source IN ('genkit','genkit_fallback'), tokens, 0)) AS genkit_tokens
       FROM weekly
       GROUP BY week_start, agent
     )
     SELECT *, SAFE_DIVIDE(sidecar_tokens, NULLIF(genkit_tokens, 0)) AS ratio
     FROM agg
     WHERE SAFE_DIVIDE(sidecar_tokens, NULLIF(genkit_tokens, 0)) > 2.0;
     ```
2. **Create the log-based alert**:
   ```bash
   gcloud alpha monitoring policies create \
     --project=sahayakai-b4248 \
     --policy-from-file=infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml
   ```
3. Attach the existing ops email notification channel via the Console.

Severity is WARN, not PAGE — sidecar > 2× Genkit during shadow rollout is expected (every shadow request doubles spend). Intended for steady-state after canary promotion. Runbook in the policy doc explains how to triage.

---

## 6. Interpreting the dashboard

| Chart                    | Healthy                                                                      | Investigate                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Stacked area cost        | dispatcher tier roughly flat; sidecar tier scales with canary rollout         | Sudden sidecar spike with flat dispatch count → cold-start storm or a runaway min-instances=2 raised without sign-off |
| Per-agent sidecar tokens | sum across agents tracks user-load curve                                     | One agent > 50 % of total tokens → prompt bloat regression; pull a 10-row `agent_shadow_diffs` sample                 |
| Sidecar / Genkit ratio   | < 1.3× steady-state                                                          | > 2× steady state → fires the WARN; > 3× → manual rollback consideration                                             |

---

## 7. Files in this PR

| Path                                                    | Purpose                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| `infra/labels/apply-dispatcher-labels.sh`               | stamp labels on all 4 Cloud Run services (idempotent)|
| `infra/billing/sidecar-vs-genkit-daily.sql`             | billing rollup query                                 |
| `infra/billing/per-agent-tokens-daily.sql`              | dispatch.cost rollup query                           |
| `infra/billing/dispatch-cost-log-sink.sh`               | Cloud Logging → BigQuery sink setup                  |
| `infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml`      | WARN alert policy                                    |
| `src/lib/sidecar/dispatch-cost.ts`                      | shared helper emitting `dispatch.cost` events        |
| `qa/docs/COST_TELEMETRY.md`                             | this doc                                             |
| `qa/results/lane-F/Q3E_COST_DASHBOARD.md`               | execution report                                     |
