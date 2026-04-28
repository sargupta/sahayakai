#!/usr/bin/env python3
"""Offline shadow-diff aggregator (Phase M.5).

Reads `agent_shadow_diffs/{date}/{agent}/{uid}__{ts}` from Firestore
and rolls up per-agent parity signals so the canary flip is no
longer blind. The 13 dispatchers under
`sahayakai-main/src/lib/sidecar/*-dispatch.ts` (every dispatcher
EXCEPT parent-call) write paired (genkit, sidecar) outputs through
`writeAgentShadowDiff` from `shadow-diff-writer.ts`. This script
batches those rows daily and emits a per-agent rollup doc to
`agent_shadow_rollups/{date}` with:

  - `samples`: total rows seen for the agent
  - `sidecarOk`: rows where the sidecar succeeded
  - `sidecarErrorRate`: 1.0 - sidecarOk/samples
  - `latency`: {p50, p95, p99} for both genkit + sidecar paths (ms)
  - `parity.cosine`: term-frequency cosine over text fields, mean
    + p10. Cheap, stdlib-only — no LaBSE dependency required for
    the aggregator to run on a stock CI worker.
  - `parity.languageMatch`: rate at which both replies share the
    same dominant Unicode block (Devanagari, Tamil, Latin, ...).
  - `parity.shapeMatch`: rate at which the JSON-shape of both
    replies matches (key set + nesting), where applicable.

Tier 2 (LaBSE / IndicSBERT): if `sentence-transformers` is
importable, the script computes semantic cosine in addition to
term-frequency cosine. Falls back gracefully when the dep is
absent.

Wire compatibility: parent-call writes its own pairs to the
`shadow_calls` subcollection (handled by `compare_parity.py`). We
DO NOT touch that subcollection — the aggregator iterates all
known per-agent subcollections under `{date}` and skips
`shadow_calls`. Parent-call retains its dedicated pipeline.

Usage:

  uv run python scripts/aggregate_shadow_diffs.py \
      --date 2026-04-27 \
      --project sahayakai-b4248

  # Or for the previous UTC day (the typical cron use-case):
  uv run python scripts/aggregate_shadow_diffs.py --yesterday

Round-2 audit reference: M.5 first-canary-flip-no-longer-blind.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import statistics
import sys
import unicodedata
from collections import Counter
from datetime import UTC, datetime, timedelta
from typing import Any

try:
    from google.cloud import firestore  # type: ignore[import-not-found]
except ImportError as exc:  # pragma: no cover — script fails fast.
    print(
        "[aggregator] google-cloud-firestore is required; install via "
        "`uv pip install google-cloud-firestore`.",
        file=sys.stderr,
    )
    raise SystemExit(1) from exc


# 13 agents covered by writeAgentShadowDiff (parent-call uses the
# legacy `shadow_calls` subcollection and is handled separately).
_KNOWN_AGENTS = (
    "vidya",
    "quiz",
    "lesson-plan",
    "exam-paper",
    "instant-answer",
    "rubric",
    "teacher-training",
    "video-storyteller",
    "virtual-field-trip",
    "visual-aid",
    "voice-to-text",
    "worksheet",
    "parent-message",
    "avatar-generator",
)

_PARENT_CALL_SUBCOLLECTION = "shadow_calls"


# ---- Tier 1 parity: TF cosine over flattened text -------------------------

_WORD = re.compile(r"\w+", re.UNICODE)


def _tokenise(text: str) -> list[str]:
    """Unicode-aware tokeniser; lowercases Latin, leaves Indic as-is."""
    return [t.lower() for t in _WORD.findall(text)]


def _flatten_text(payload: Any) -> str:
    """Walk a nested dict/list and join all string leaf values.

    Keeps the comparator agent-agnostic — different dispatchers'
    outputs have different shapes (lesson plan = nested sections,
    quiz = list of variants) but ALL eventually produce string leaves
    that we can score together.
    """
    if payload is None:
        return ""
    if isinstance(payload, str):
        return payload
    if isinstance(payload, (int, float, bool)):
        return str(payload)
    if isinstance(payload, list):
        return " ".join(_flatten_text(x) for x in payload)
    if isinstance(payload, dict):
        return " ".join(_flatten_text(v) for v in payload.values())
    return ""


def _cosine_tf(a: str, b: str) -> float:
    va = Counter(_tokenise(a))
    vb = Counter(_tokenise(b))
    if not va or not vb:
        return 0.0
    common = set(va) & set(vb)
    dot = sum(va[t] * vb[t] for t in common)
    na = math.sqrt(sum(v * v for v in va.values()))
    nb = math.sqrt(sum(v * v for v in vb.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


# ---- Language detection (cheap, no deps) ----------------------------------


def _dominant_block(text: str) -> str:
    """Return the dominant Unicode block among letter chars.

    Mirrors `parent_call/_lang_match.py` philosophy — the aggregator
    only needs to bucket replies into broad scripts (Devanagari,
    Tamil, Bengali, Latin, ...) so a hi response paired with an en
    response trips a `languageMatch=False` flag. We do NOT need full
    language ID here.
    """
    counts: Counter[str] = Counter()
    for ch in text:
        if not ch.isalpha():
            continue
        try:
            name = unicodedata.name(ch, "")
        except ValueError:
            continue
        # `unicodedata.name` uses script names like "DEVANAGARI LETTER KA".
        # Take the first token as the script bucket.
        first = name.split(" ", 1)[0]
        counts[first] += 1
    if not counts:
        return ""
    return counts.most_common(1)[0][0]


def _language_match(genkit: Any, sidecar: Any) -> bool:
    a = _dominant_block(_flatten_text(genkit))
    b = _dominant_block(_flatten_text(sidecar))
    if not a or not b:
        return False
    return a == b


# ---- JSON-shape diff -------------------------------------------------------


def _shape(payload: Any) -> Any:
    """Return a structural fingerprint of `payload` (no string content).

    Used to flag schema drift — e.g. sidecar returning `discussionSpark`
    but Genkit returning `discussionSparks` (plural).
    """
    if isinstance(payload, dict):
        return {k: _shape(v) for k, v in payload.items()}
    if isinstance(payload, list):
        if not payload:
            return []
        return [_shape(payload[0])]  # only sample first element
    return type(payload).__name__


def _shape_match(genkit: Any, sidecar: Any) -> bool:
    if genkit is None or sidecar is None:
        return False
    return _shape(genkit) == _shape(sidecar)


# ---- Optional Tier 2: LaBSE / IndicSBERT cosine ---------------------------


def _try_load_embedder() -> Any | None:
    """Return a sentence-transformers model if installed, else None."""
    try:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
    except ImportError:
        return None
    try:
        return SentenceTransformer("l3cube-pune/indic-sentence-bert-nli")
    except Exception as exc:  # pragma: no cover — model download issues
        print(
            f"[aggregator] could not load IndicSBERT ({exc}); "
            "skipping semantic cosine.",
            file=sys.stderr,
        )
        return None


def _semantic_cosine(model: Any, a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    emb = model.encode([a, b], convert_to_numpy=True, normalize_embeddings=True)
    return float(emb[0] @ emb[1])


# ---- Aggregation core ------------------------------------------------------


def _percentile(values: list[float], pct: int) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return values[0]
    s = sorted(values)
    k = (len(s) - 1) * (pct / 100)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def _agent_rollup(
    samples: list[dict[str, Any]],
    *,
    embedder: Any | None,
) -> dict[str, Any]:
    """Compute per-agent rollup from raw sample docs."""
    n = len(samples)
    if n == 0:
        return {"samples": 0}

    sidecar_ok = sum(1 for s in samples if s.get("sidecarOk"))
    genkit_lat = [
        float(s.get("genkitLatencyMs", 0))
        for s in samples
        if s.get("genkitLatencyMs") is not None
    ]
    sidecar_lat = [
        float(s.get("sidecarLatencyMs", 0))
        for s in samples
        if s.get("sidecarLatencyMs") is not None
    ]

    # Parity is only meaningful when BOTH sides returned something.
    paired = [
        s for s in samples
        if s.get("genkit") is not None and s.get("sidecar") is not None
    ]
    cosines = [
        _cosine_tf(_flatten_text(s["genkit"]), _flatten_text(s["sidecar"]))
        for s in paired
    ]
    lang_matches = [_language_match(s["genkit"], s["sidecar"]) for s in paired]
    shape_matches = [_shape_match(s["genkit"], s["sidecar"]) for s in paired]

    semantic: dict[str, Any] = {}
    if embedder is not None and paired:
        scores = [
            _semantic_cosine(
                embedder,
                _flatten_text(s["genkit"]),
                _flatten_text(s["sidecar"]),
            )
            for s in paired
        ]
        semantic = {
            "mean": statistics.fmean(scores) if scores else 0.0,
            "p10": _percentile(scores, 10),
        }

    return {
        "samples": n,
        "sidecarOk": sidecar_ok,
        "sidecarErrorRate": round(1.0 - sidecar_ok / n, 4) if n else 0.0,
        "pairedSamples": len(paired),
        "latency": {
            "genkit": {
                "p50": round(_percentile(genkit_lat, 50)),
                "p95": round(_percentile(genkit_lat, 95)),
                "p99": round(_percentile(genkit_lat, 99)),
            },
            "sidecar": {
                "p50": round(_percentile(sidecar_lat, 50)),
                "p95": round(_percentile(sidecar_lat, 95)),
                "p99": round(_percentile(sidecar_lat, 99)),
            },
        },
        "parity": {
            "cosine": {
                "mean": round(statistics.fmean(cosines), 4) if cosines else 0.0,
                "p10": round(_percentile(cosines, 10), 4),
            },
            "languageMatchRate": round(
                sum(lang_matches) / len(lang_matches), 4,
            ) if lang_matches else 0.0,
            "shapeMatchRate": round(
                sum(shape_matches) / len(shape_matches), 4,
            ) if shape_matches else 0.0,
            "semantic": semantic,
        },
    }


def _read_agent_samples(
    db: Any, date: str, agent: str,
) -> list[dict[str, Any]]:
    """Pull all docs in `agent_shadow_diffs/{date}/{agent}` as dicts."""
    coll_ref = db.collection("agent_shadow_diffs").document(date) \
                 .collection(agent)
    return [doc.to_dict() for doc in coll_ref.stream()]


def aggregate(
    *,
    date: str,
    project: str | None,
    enable_semantic: bool,
    dry_run: bool,
) -> dict[str, Any]:
    """Run the rollup for one date. Returns the summary doc."""
    client_kwargs = {"project": project} if project else {}
    db = firestore.Client(**client_kwargs)
    embedder = _try_load_embedder() if enable_semantic else None

    rollup: dict[str, Any] = {
        "date": date,
        "computedAt": datetime.now(UTC).isoformat(),
        "agents": {},
    }
    total_samples = 0
    for agent in _KNOWN_AGENTS:
        samples = _read_agent_samples(db, date, agent)
        if not samples:
            continue
        agent_summary = _agent_rollup(samples, embedder=embedder)
        rollup["agents"][agent] = agent_summary
        total_samples += agent_summary.get("samples", 0)

    rollup["totalSamples"] = total_samples

    if not dry_run:
        db.collection("agent_shadow_rollups").document(date).set(rollup)
    return rollup


def _yesterday_utc() -> str:
    return (datetime.now(UTC) - timedelta(days=1)).strftime("%Y-%m-%d")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--date",
        help="UTC date in YYYY-MM-DD; default = yesterday.",
    )
    parser.add_argument(
        "--yesterday",
        action="store_true",
        help="Shorthand for --date <yesterday-UTC>.",
    )
    parser.add_argument(
        "--project",
        help="GCP project ID. Falls back to ADC default.",
    )
    parser.add_argument(
        "--no-semantic",
        action="store_true",
        help=(
            "Skip Tier 2 semantic cosine even if sentence-transformers "
            "is installed."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute the rollup and print it; do not write to Firestore.",
    )
    args = parser.parse_args(argv)

    if args.yesterday and args.date:
        parser.error("Use one of --date / --yesterday, not both.")
    date = args.date or _yesterday_utc()

    rollup = aggregate(
        date=date,
        project=args.project,
        enable_semantic=not args.no_semantic,
        dry_run=args.dry_run,
    )
    print(json.dumps(rollup, indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
