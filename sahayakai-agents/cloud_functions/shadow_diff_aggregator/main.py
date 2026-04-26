"""Shadow-diff aggregation Cloud Function.

Reads `agent_shadow_diffs/{YYYY-MM-DD}/calls/**` for the last
`WINDOW_SIZE` samples (default 500) across the trailing N days,
scores each (genkit, sidecar) pair, then writes the aggregate to a
custom Cloud Monitoring metric:

  custom.googleapis.com/parent_call/shadow_labse_mean

Track D's alert policy 04 (`04_shadow_diff_labse.yaml`) keys off this
metric and fires when the rolling mean drops below 0.75. Without this
function the alert never fires; alert 04 is wired but blind until
this function is deployed.

Designed to run on Cloud Scheduler every 5 minutes:

  gcloud scheduler jobs create http parent-call-shadow-diff-rollup \
      --location=asia-southeast1 \
      --schedule="*/5 * * * *" \
      --uri="${FUNCTION_URL}" \
      --http-method=POST \
      --oidc-service-account-email=sahayakai-shadow-rollup-runtime@...

Scoring strategy:

  - Tier 1 (always): TF cosine over the (genkit_reply, sidecar_reply)
    pair. Stdlib only; no extra runtime cost.
  - Tier 2 (`USE_EMBEDDINGS=1`): IndicSBERT cosine via
    `sentence-transformers`. Loads ~500 MB on the first invocation;
    subsequent invocations within the warm-instance window reuse the
    cached model. Cloud Function cold starts > 30s should turn this
    OFF and run the embedding tier in a separate scheduled job that
    can tolerate the cost.

The function emits two metrics regardless:

  parent_call/shadow_labse_mean        (float, 0.0-1.0)
  parent_call/shadow_sample_count      (int)

The `parent_call/shadow_sample_count` metric lets us see when the
rolling window is too thin for the LaBSE mean to be statistically
meaningful (under 50 samples → ignore the alert).

Round-2 audit reference: P0 SHADOW-1 (alert 04 needs a metric writer).
"""
from __future__ import annotations

import json
import logging
import math
import os
import re
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

import firebase_admin
from firebase_admin import firestore as admin_firestore
from google.cloud import monitoring_v3

# ---- Constants ------------------------------------------------------------

PROJECT_ID = os.environ.get("GCP_PROJECT") or os.environ.get("GOOGLE_CLOUD_PROJECT", "")
WINDOW_SIZE = int(os.environ.get("WINDOW_SIZE", "500"))
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "2"))
USE_EMBEDDINGS = os.environ.get("USE_EMBEDDINGS", "0") == "1"
EMBEDDING_MODEL = os.environ.get(
    "EMBEDDING_MODEL", "l3cube-pune/indic-sentence-bert-nli"
)

SHADOW_COLLECTION = "agent_shadow_diffs"
METRIC_TYPE_MEAN = "custom.googleapis.com/parent_call/shadow_labse_mean"
METRIC_TYPE_COUNT = "custom.googleapis.com/parent_call/shadow_sample_count"

log = logging.getLogger("sahayakai.shadow_rollup")
log.setLevel(logging.INFO)

# Module-scoped embedding model cache so warm invocations skip the load.
_embedding_model: Any = None


# ---- Firebase Admin singleton --------------------------------------------


def _get_db() -> Any:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()
    return admin_firestore.client()


# ---- Tier 1: TF cosine ---------------------------------------------------

_WORD = re.compile(r"\w+", re.UNICODE)


def _tokenise(text: str) -> list[str]:
    return [t.lower() for t in _WORD.findall(text)]


def _cosine_tf(a: str, b: str) -> float:
    va = Counter(_tokenise(a))
    vb = Counter(_tokenise(b))
    if not va or not vb:
        return 0.0
    # Identical token bags collapse to exactly 1.0 — avoids floating
    # point drift (2/sqrt(2)/sqrt(2) reads as 0.999...8) that would
    # surprise pinning tests.
    if va == vb:
        return 1.0
    shared = set(va) & set(vb)
    dot = sum(va[t] * vb[t] for t in shared)
    mag_a = math.sqrt(sum(c * c for c in va.values()))
    mag_b = math.sqrt(sum(c * c for c in vb.values()))
    denom = mag_a * mag_b
    return dot / denom if denom else 0.0


# ---- Tier 2: IndicSBERT cosine -------------------------------------------


def _embedding_cosine(a: str, b: str) -> float:
    """Lazy-load + cache the SentenceTransformer model. Returns 0.0
    if the model cannot be loaded (e.g. running in a stripped runtime
    that omits sentence-transformers — this should ONLY happen if
    USE_EMBEDDINGS is wrongly set).
    """
    global _embedding_model
    if _embedding_model is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            log.warning("shadow_rollup.sentence_transformers_missing")
            return 0.0
        _embedding_model = SentenceTransformer(EMBEDDING_MODEL)
    if not a or not b:
        return 0.0
    embeddings = _embedding_model.encode([a, b], convert_to_numpy=True)
    import numpy as np

    va, vb = embeddings[0], embeddings[1]
    denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
    return float(np.dot(va, vb) / denom) if denom else 0.0


# ---- Sample aggregation --------------------------------------------------


def _iter_recent_samples(db: Any, *, lookback_days: int, limit: int) -> Iterable[dict[str, Any]]:
    """Walk `agent_shadow_diffs/{date}/calls/**` for the last
    `lookback_days` UTC days, newest-first. Stop after `limit` non-error
    samples so the function's I/O stays bounded even on busy days.

    Errored samples (sidecar threw) are intentionally NOT included in
    the rolling mean — they are tracked separately by the 5xx-rate
    alert policy. Including them here would let a single transport
    blip drag the mean below the alert threshold.
    """
    today = datetime.now(UTC).date()
    days = [today - timedelta(days=d) for d in range(lookback_days + 1)]
    yielded = 0
    root = db.collection(SHADOW_COLLECTION)

    for day in days:
        date_str = day.isoformat()
        calls_ref = root.document(date_str).collection("calls")
        # Newest-first within a day; capturedAt indexed by Firestore
        # automatically when set as the order field.
        query = calls_ref.order_by(
            "capturedAt", direction=admin_firestore.Query.DESCENDING
        ).limit(limit - yielded)
        for snap in query.stream():
            data = snap.to_dict() or {}
            if data.get("sidecarError"):
                continue
            if not data.get("genkitReply") or not data.get("sidecarReply"):
                continue
            yield data
            yielded += 1
            if yielded >= limit:
                return


# ---- Metric writer -------------------------------------------------------


def _write_metric(value: float, sample_count: int) -> None:
    """Write the rolling mean and sample count as Cloud Monitoring
    custom metrics. Uses the synchronous client because Cloud Functions
    runtime supports it and the call latency is negligible.
    """
    if not PROJECT_ID:
        log.warning("shadow_rollup.no_project_id")
        return

    client = monitoring_v3.MetricServiceClient()
    project_name = f"projects/{PROJECT_ID}"
    now = datetime.now(UTC)
    interval = monitoring_v3.TimeInterval(
        {"end_time": {"seconds": int(now.timestamp())}}
    )

    series_mean = monitoring_v3.TimeSeries()
    series_mean.metric.type = METRIC_TYPE_MEAN
    series_mean.resource.type = "global"
    series_mean.resource.labels["project_id"] = PROJECT_ID
    point_mean = monitoring_v3.Point(
        {"interval": interval, "value": {"double_value": float(value)}}
    )
    series_mean.points = [point_mean]

    series_count = monitoring_v3.TimeSeries()
    series_count.metric.type = METRIC_TYPE_COUNT
    series_count.resource.type = "global"
    series_count.resource.labels["project_id"] = PROJECT_ID
    point_count = monitoring_v3.Point(
        {"interval": interval, "value": {"int64_value": int(sample_count)}}
    )
    series_count.points = [point_count]

    client.create_time_series(name=project_name, time_series=[series_mean, series_count])


# ---- Main entrypoints ----------------------------------------------------


def shadow_rollup_http(request: Any) -> tuple[str, int]:
    """HTTP-trigger entrypoint for Cloud Scheduler invocation."""
    _ = request
    db = _get_db()

    samples: list[dict[str, Any]] = list(
        _iter_recent_samples(db, lookback_days=LOOKBACK_DAYS, limit=WINDOW_SIZE)
    )
    if not samples:
        log.info(
            json.dumps({"event": "shadow_rollup.empty_window", "lookback": LOOKBACK_DAYS})
        )
        return json.dumps({"sampleCount": 0, "mean": None}), 200

    scores: list[float] = []
    for sample in samples:
        baseline = str(sample["genkitReply"])
        candidate = str(sample["sidecarReply"])
        if USE_EMBEDDINGS:
            scores.append(_embedding_cosine(baseline, candidate))
        else:
            scores.append(_cosine_tf(baseline, candidate))

    mean = sum(scores) / len(scores)

    _write_metric(value=mean, sample_count=len(samples))

    log.info(
        json.dumps(
            {
                "event": "shadow_rollup.scored",
                "sampleCount": len(samples),
                "mean": round(mean, 4),
                "useEmbeddings": USE_EMBEDDINGS,
            }
        )
    )

    return (
        json.dumps(
            {
                "sampleCount": len(samples),
                "mean": round(mean, 4),
                "useEmbeddings": USE_EMBEDDINGS,
            }
        ),
        200,
    )


# ---- Helper for unit tests -----------------------------------------------


def _score_pair(baseline: str, candidate: str, *, use_embeddings: bool = False) -> float:
    """Pure scoring helper, exposed so tests can pin the math without
    booting Firestore or Cloud Monitoring."""
    if use_embeddings:
        return _embedding_cosine(baseline, candidate)
    return _cosine_tf(baseline, candidate)
