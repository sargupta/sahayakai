# Auto-abort Cloud Function

Demotes `parentCallSidecarMode` / `parentCallSidecarPercent` in the
Firestore feature-flags doc one step whenever any of the six
Cloud Monitoring alert policies fires. The TwiML route's dispatcher
sees the new value within ~5 minutes (its cache TTL).

## Architecture

```
Cloud Run sidecar metrics ─┐
log-based metrics          ├─► Cloud Monitoring alert policies
custom rollup metrics      ┘                │
                                            │ notify
                                            ▼
                              Pub/Sub topic `parent-call-auto-abort`
                                            │
                                            ▼
                              Auto-abort Cloud Function (this dir)
                                            │
                                            ▼
                              Firestore `system_config/feature_flags`
                                            │
                                            ▼
                              Next.js dispatcher (~5 min cache TTL)
```

## Demotion ladder

One step down per fire — never more — so the function is safe to wire
to multiple high-tolerance alerts simultaneously.

| Current state           | Demotes to              |
|-------------------------|-------------------------|
| `full / 100%`           | `canary / 100%`         |
| `canary / 100%`         | `canary / 50%`          |
| `canary / 50%`          | `canary / 25%`          |
| `canary / 25%`          | `canary / 5%`           |
| `canary / 5%`           | `shadow / 25%`          |
| `shadow / 25%`          | `shadow / 5%`           |
| `shadow / 5%`           | `shadow / 1%`           |
| `shadow / 1%`           | `off / 0%`              |
| `off / 0%`              | `off / 0%` (no-op)      |

States not exactly on the ladder (e.g. operator manually set `25%`)
collapse to the closest LOWER rung within the same mode.

## Deploy

```bash
# 1. Create the Pub/Sub topic the alerts notify into.
gcloud pubsub topics create parent-call-auto-abort \
    --project=sahayakai-b4248

# 2. Deploy the Cloud Function (Pub/Sub trigger).
gcloud functions deploy parent-call-auto-abort \
    --gen2 \
    --runtime=python312 \
    --region=asia-southeast1 \
    --source=. \
    --entry-point=auto_abort_pubsub \
    --trigger-topic=parent-call-auto-abort \
    --service-account=sahayakai-auto-abort-runtime@sahayakai-b4248.iam.gserviceaccount.com \
    --memory=256Mi \
    --timeout=60s \
    --max-instances=3 \
    --project=sahayakai-b4248

# 3. Optionally also expose the HTTP entry point for manual dry-runs.
gcloud functions deploy parent-call-auto-abort-http \
    --gen2 \
    --runtime=python312 \
    --region=asia-southeast1 \
    --source=. \
    --entry-point=auto_abort_http \
    --trigger-http \
    --no-allow-unauthenticated \
    --service-account=sahayakai-auto-abort-runtime@sahayakai-b4248.iam.gserviceaccount.com \
    --memory=256Mi \
    --timeout=60s \
    --max-instances=1 \
    --project=sahayakai-b4248
```

## Required IAM bindings (runtime SA)

`sahayakai-auto-abort-runtime@sahayakai-b4248.iam.gserviceaccount.com`
needs:

- `roles/datastore.user` — read + write the feature-flags doc
- `roles/logging.logWriter` — emit structured action logs
- `roles/monitoring.metricWriter` — optional, if the function ever
  emits its own custom metric

## Apply the alert policies

Each YAML in `policy_templates/` is a Cloud Monitoring alerting
policy. `${AUTO_ABORT_PUBSUB_CHANNEL}` is a placeholder for the
notification channel name — replace before applying:

```bash
CHANNEL=$(gcloud alpha monitoring channels list \
    --project=sahayakai-b4248 \
    --filter='displayName="parent-call auto-abort"' \
    --format='value(name)')

for p in policy_templates/*.yaml; do
    sed "s|\${AUTO_ABORT_PUBSUB_CHANNEL}|${CHANNEL}|g" "$p" \
        > "/tmp/$(basename "$p")"
    gcloud alpha monitoring policies create \
        --project=sahayakai-b4248 \
        --policy-from-file="/tmp/$(basename "$p")"
done
```

## Manual abort (escape hatch)

If the function is broken or off, an operator can demote the rollout
manually:

```bash
gcloud firestore documents patch system_config/feature_flags \
    --project=sahayakai-b4248 \
    --data='{"parentCallSidecarMode":"off","parentCallSidecarPercent":0,"updatedBy":"manual-abort"}'
```

The dispatcher picks up the change within ~5 minutes (Next.js cache
TTL on the read side).

## Test the function locally

```bash
pip install -r requirements.txt functions-framework

# Sample Pub/Sub envelope shaped like a Cloud Monitoring alert.
cat > /tmp/sample.json <<'PUBSUB'
{
  "data": "eyJpbmNpZGVudCI6eyJwb2xpY3lfbmFtZSI6InBvbGljeS90ZXN0LWJlaGF2aW91cmFsLWd1YXJkIn19"
}
PUBSUB

functions-framework-python --target=auto_abort_http --port=8888 &
sleep 1
curl -s -X POST -H 'Content-Type: application/json' \
    -d @/tmp/sample.json \
    'http://localhost:8888'
```

## Round-2 audit references

- P0 ABORT-1: auto-abort wired before the first shadow-mode flag flip.
- P1 ABORT-2: demotion ladder is monotonic — the function never
  promotes; manual re-promotion is gated on parity verification.
