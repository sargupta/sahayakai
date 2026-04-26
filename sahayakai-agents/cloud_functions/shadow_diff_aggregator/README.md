# Shadow-diff aggregation Cloud Function

Reads `agent_shadow_diffs/{date}/calls/**` from Firestore, scores each
(genkit, sidecar) pair captured during shadow-mode traffic, writes the
rolling mean to a Cloud Monitoring custom metric.

Output metrics:

- `custom.googleapis.com/parent_call/shadow_labse_mean` — float [0, 1]
- `custom.googleapis.com/parent_call/shadow_sample_count` — int

Track D's alert policy 04 (`auto_abort/policy_templates/04_shadow_diff_labse.yaml`)
keys off `shadow_labse_mean` and fires when the mean drops below 0.75.
**Without this function the alert never fires.** Deploy this BEFORE
applying alert 04, and BEFORE flipping `parentCallSidecarMode` to
`shadow` in production.

## Configuration (via env)

| Var               | Default                                   | Notes |
|-------------------|-------------------------------------------|-------|
| `WINDOW_SIZE`     | `500`                                     | Rolling window samples |
| `LOOKBACK_DAYS`   | `2`                                       | Trailing days to scan |
| `USE_EMBEDDINGS`  | `0`                                       | `1` enables IndicSBERT (warm cold-starts ~30s) |
| `EMBEDDING_MODEL` | `l3cube-pune/indic-sentence-bert-nli`     | sentence-transformers model id |

## Deploy

```bash
gcloud functions deploy parent-call-shadow-rollup \
    --gen2 \
    --runtime=python312 \
    --region=asia-southeast1 \
    --source=. \
    --entry-point=shadow_rollup_http \
    --trigger-http \
    --no-allow-unauthenticated \
    --service-account=sahayakai-shadow-rollup-runtime@sahayakai-b4248.iam.gserviceaccount.com \
    --memory=1Gi \
    --timeout=300s \
    --max-instances=2 \
    --set-env-vars=USE_EMBEDDINGS=0,WINDOW_SIZE=500 \
    --project=sahayakai-b4248
```

For Tier 2 (IndicSBERT) scoring, redeploy with `USE_EMBEDDINGS=1` and
`--memory=2Gi` (the model needs ~1.2 GB at runtime).

## Schedule

```bash
FUNCTION_URL=$(gcloud functions describe parent-call-shadow-rollup \
    --region=asia-southeast1 --gen2 \
    --format='value(serviceConfig.uri)')

gcloud scheduler jobs create http parent-call-shadow-rollup-cron \
    --location=asia-southeast1 \
    --schedule="*/5 * * * *" \
    --uri="${FUNCTION_URL}" \
    --http-method=POST \
    --oidc-service-account-email=sahayakai-shadow-rollup-runtime@sahayakai-b4248.iam.gserviceaccount.com \
    --oidc-token-audience="${FUNCTION_URL}"
```

5-minute cadence matches the alert window; running more often costs
extra without giving the alert more signal.

## Required IAM bindings

`sahayakai-shadow-rollup-runtime@...` needs:

- `roles/datastore.user` — read `agent_shadow_diffs/**`
- `roles/monitoring.metricWriter` — write the two custom metrics
- `roles/logging.logWriter` — emit the structured log line

## Sample-count gate

The auto-abort alert 04 should be configured to ignore values when
`shadow_sample_count < 50`. A rolling window with too few samples
produces noisy means; firing on those wastes operator attention. The
alert YAML in `auto_abort/policy_templates/04_shadow_diff_labse.yaml`
documents the threshold; this function exposes the count so the alert
can read it.

## Round-2 audit reference

P0 SHADOW-1: alert 04 needs a metric writer.
