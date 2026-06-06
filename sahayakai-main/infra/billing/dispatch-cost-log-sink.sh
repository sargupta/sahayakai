#!/usr/bin/env bash
# Q3E: Cloud Logging → BigQuery sink for the per-agent
# `dispatch.cost` structured events emitted by every dispatcher
# (src/lib/sidecar/dispatch-cost.ts).
#
# Run once. The sink update path is idempotent.
#
# After this runs, the `<DATASET>` dataset will receive a table per
# unique resource.type (typically `run_googleapis_com_stdout`). Use the
# queries in infra/billing/per-agent-tokens-daily.sql against that.
set -euo pipefail

PROJECT="${PROJECT:-sahayakai-b4248}"
LOCATION="${LOCATION:-asia-southeast1}"
DATASET="${DATASET:-dispatch_cost}"
SINK="${SINK:-dispatch-cost-sink}"

# 1. BigQuery dataset to receive the sink (idempotent).
if ! bq --project_id="${PROJECT}" show --dataset "${PROJECT}:${DATASET}" >/dev/null 2>&1; then
  bq --project_id="${PROJECT}" mk \
     --location="${LOCATION}" \
     --dataset \
     --description="Q3E per-agent dispatch.cost telemetry" \
     "${PROJECT}:${DATASET}"
fi

# 2. The filter restricts the sink to only the dispatcher's
#    `dispatch.cost` JSON lines — anything else stays in Cloud Logging.
FILTER='resource.type="cloud_run_revision"
AND jsonPayload.event="dispatch.cost"'

DESTINATION="bigquery.googleapis.com/projects/${PROJECT}/datasets/${DATASET}"

if gcloud logging sinks describe "${SINK}" --project="${PROJECT}" >/dev/null 2>&1; then
  gcloud logging sinks update "${SINK}" \
    --project="${PROJECT}" \
    "${DESTINATION}" \
    --log-filter="${FILTER}" \
    --use-partitioned-tables \
    --quiet
else
  gcloud logging sinks create "${SINK}" \
    --project="${PROJECT}" \
    "${DESTINATION}" \
    --log-filter="${FILTER}" \
    --use-partitioned-tables \
    --quiet
fi

# 3. The sink writes as a Logging-managed service account; grant it
#    BigQuery Data Editor on the target dataset.
SINK_SA=$(gcloud logging sinks describe "${SINK}" --project="${PROJECT}" \
  --format='value(writerIdentity)')

echo "Sink writer identity: ${SINK_SA}"
echo "Grant 'BigQuery Data Editor' on ${PROJECT}:${DATASET} (Console: BigQuery → ${DATASET} → Sharing → Add Principal)."
