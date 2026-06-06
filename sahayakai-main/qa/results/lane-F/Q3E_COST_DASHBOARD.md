# Q3E — Cost attribution + sidecar-vs-Genkit dashboard

Branch: `feature/cost-attribution-dashboard` (off `develop`).

## Verdict

| Step                                                | Status                                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1. Cloud Run labels — apply-dispatcher-labels.sh    | DONE (idempotent — stamps all 4 services: sidecar prod/staging + dispatcher prod/preview) |
| 1. Declarative sidecar labels in deploy/service.yaml | DEFERRED — see Concurrency note                                                         |
| 2. Cloud Billing → BigQuery export verify           | DOCUMENTED — gcloud verify step + Console fallback for first-time setup                 |
| 2. Daily roll-up SQL                                | DONE (`infra/billing/sidecar-vs-genkit-daily.sql`)                                      |
| 3. `dispatch.cost` telemetry helper                 | DONE (`src/lib/sidecar/dispatch-cost.ts`)                                               |
| 3. Wire helper into 17 dispatchers                  | DEFERRED — see Concurrency note                                                         |
| 3. Logging → BigQuery sink                          | DONE (`infra/billing/dispatch-cost-log-sink.sh` idempotent)                             |
| 3. Per-agent aggregation SQL                        | DONE (`infra/billing/per-agent-tokens-daily.sql`)                                       |
| 4. Looker Studio dashboard                          | DOCUMENTED — manual UI setup steps in `qa/docs/COST_TELEMETRY.md` §4                    |
| 4. Scheduled weekly email to ops                    | DOCUMENTED — Looker Studio share → schedule (no gcloud surface)                         |
| 5. Alert weekly sidecar > 2× Genkit (WARN)          | DONE — `infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml` + setup notes                 |
| 6. End-to-end doc                                   | DONE (`qa/docs/COST_TELEMETRY.md`)                                                      |

## Concurrency note

This task ran in parallel with at least three other sessions touching `sahayakai-agents/deploy/service.yaml`, `sahayakai-agents/deploy/cloudbuild.yaml`, `src/lib/sidecar/dispatch.ts` and `src/lib/sidecar/quiz-dispatch.ts`. Three separate attempts to land:

- declarative `labels:` block on `deploy/service.yaml` + the cloudbuild staging-rewrite sed step
- `logDispatchCost(...)` calls inside `dispatch.ts` and `quiz-dispatch.ts`

were each reverted within seconds by the parallel sessions' branch-swap activity (a stash+checkout from another session even pulled this branch out from under the workspace mid-edit; restored via `git checkout feature/cost-attribution-dashboard`).

To avoid fighting a churn race that would force a follow-up PR rebase anyway, the in-app wire-up of the helper is deferred. Two paths from here:

1. **Recommended**: a single follow-up branch `feature/cost-attribution-dashboard-wire` lands once `dispatch.ts` + `quiz-dispatch.ts` settle. Wire-up pattern is documented exhaustively in `qa/docs/COST_TELEMETRY.md` §3.
2. **Today**: ops can already see the **sidecar-vs-Genkit GCP $$ split** the moment `infra/labels/apply-dispatcher-labels.sh` runs and Cloud Billing export catches up (~24 h). The per-agent token chart will be empty until at least one dispatcher is wired — that's strictly an enhancement, not a blocker.

Same logic applies to the declarative `deploy/service.yaml` labels — the imperative `apply-dispatcher-labels.sh` stamps the sidecar services too, idempotently, so the Cloud Billing rollup is fully functional today.

## What lands when

| Signal                                              | Available after                                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Service-tier / cost-bucket split in Cloud Billing   | `bash infra/labels/apply-dispatcher-labels.sh` + ~24 h export latency                    |
| `dispatch.cost` rows in `dispatch_cost` dataset     | `bash infra/billing/dispatch-cost-log-sink.sh` + at least one wired dispatcher in prod   |
| Looker Studio dashboard                             | human runs through `qa/docs/COST_TELEMETRY.md` §4                                        |
| Weekly > 2× alert firing                            | scheduled BQ query in §5 runs the first Monday post-setup                                |

## Files

```
infra/billing/sidecar-vs-genkit-daily.sql
infra/billing/per-agent-tokens-daily.sql
infra/billing/dispatch-cost-log-sink.sh             (chmod +x)
infra/labels/apply-dispatcher-labels.sh             (chmod +x)
infra/monitoring/q3e-sidecar-cost-2x-genkit.yaml
qa/docs/COST_TELEMETRY.md
src/lib/sidecar/dispatch-cost.ts
```

## Verification

`npx tsc --noEmit` against the new helper: clean. Only pre-existing error
`__tests__/clients-http-contract.test.ts(43,72)` — unrelated to this PR.

Manual smoke-test plan once a dispatcher is wired:

1. Trigger one dispatch in prod (e.g. a quiz request).
2. `gcloud logging read 'jsonPayload.event="dispatch.cost"' --limit=5 --project=sahayakai-b4248 --freshness=10m` — confirm a row appears.
3. `bq query --use_legacy_sql=false 'SELECT * FROM \`sahayakai-b4248.dispatch_cost.run_googleapis_com_stdout\` WHERE jsonPayload.event="dispatch.cost" ORDER BY timestamp DESC LIMIT 5'` — confirm the sink mirrored it.

## Not done / explicit deferrals

- **In-app wire-up of `logDispatchCost`** — concurrent file churn; see Concurrency note.
- **Declarative sidecar labels in deploy/service.yaml + cloudbuild staging rewrite** — same; `apply-dispatcher-labels.sh` covers it idempotently.
- **Looker Studio report URL not embedded** — requires human auth to lookerstudio.google.com. URL goes into the doc + alert YAML's `documentation.content` once published.
- **Scheduled query for `weekly_ratio_alerts`** — BigQuery scheduled queries can't be expressed declaratively without `bq mk --transfer_config` + DTS IAM bootstrap; the exact SQL + cron is in `qa/docs/COST_TELEMETRY.md` §5 for one-time Console setup.
- **Notification channel attachment** — depends on the existing ops channel ID which lives in ops infra, not this repo.
- **Real cost calibration of the chars/4 heuristic** — fine for trend detection (the only thing the > 2× alert requires); recalibrate against a 50-call Gemini token-counter sample before quoting any absolute $/agent number externally.
