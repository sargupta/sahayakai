#!/usr/bin/env python3
"""Latency benchmark for the Gemini Live spike (Phase 2 §2.0).

Three modes:

  audio-only      Just measure μ-law decode + 8k→16k resample.
                  No Gemini calls; no network. Per-frame target < 5 ms.

  end-to-end      Open a Gemini Live session, send audio, measure
                  first-byte latency. Requires GOOGLE_GENAI_API_KEY
                  and a sample mulaw clip. Costs ~$0.05 per run.

  with-guard      Same as end-to-end but adds the partial-transcript
                  behavioural guard. Measures the cut-fire latency
                  (target < 250 ms) when a forbidden phrase appears
                  in the synthesised partial stream.

Outputs JSON to stdout — same shape across modes so a follow-up
script can aggregate runs.

Usage:
  python spikes/gemini_live/latency_benchmark.py audio-only
  python spikes/gemini_live/latency_benchmark.py end-to-end \\
      --audio-clip ./samples/parent_speech_en.mulaw
  python spikes/gemini_live/latency_benchmark.py with-guard
"""
from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any

# Ensure spikes module is importable when run from repo root.
_HERE = Path(__file__).resolve().parent
_PACKAGE_ROOT = _HERE.parent.parent
if str(_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_PACKAGE_ROOT))

from spikes.gemini_live import audio  # noqa: E402


def _run_audio_only(args: argparse.Namespace) -> dict[str, Any]:
    """Per-frame μ-law decode + resample latency."""
    n_iters = args.iterations
    frame = b"\xff" * audio.TWILIO_FRAME_BYTES  # 20 ms silence frame
    state: Any = None
    samples_ms: list[float] = []
    for _ in range(n_iters):
        start = time.perf_counter()
        pcm, state = audio.upsample_8k_to_16k(frame, state=state)
        elapsed_ms = (time.perf_counter() - start) * 1000
        samples_ms.append(elapsed_ms)
        # Use pcm to prevent dead-store optimisation (mypy doesn't see this).
        if not pcm:
            raise RuntimeError("upsample produced empty output")

    p95 = (
        statistics.quantiles(samples_ms, n=20)[18]
        if len(samples_ms) >= 20
        else max(samples_ms)
    )
    p99 = (
        statistics.quantiles(samples_ms, n=100)[98]
        if len(samples_ms) >= 100
        else max(samples_ms)
    )
    return {
        "mode": "audio-only",
        "iterations": n_iters,
        "p50_ms": statistics.median(samples_ms),
        "p95_ms": p95,
        "p99_ms": p99,
        "max_ms": max(samples_ms),
        "target_p95_ms": 5.0,
        "passes_target": p95 < 5.0,
    }


def _run_end_to_end(args: argparse.Namespace) -> dict[str, Any]:
    """Stub for end-to-end Gemini Live measurement.

    Real implementation requires:
    - `google.genai.live.connect(model=...)` (API may not be GA yet
      — verify in the spike notebook before fleshing out)
    - μ-law sample clip on disk (committed under `./samples/` once
      DPDP review clears voice fixtures)
    - Real GOOGLE_GENAI_API_KEY in env

    For now this returns a stub with `status: not_implemented` so the
    benchmark script is callable end-to-end during scaffolding.
    """
    api_key = os.environ.get("GOOGLE_GENAI_API_KEY")
    audio_path = Path(args.audio_clip) if args.audio_clip else None

    if not api_key:
        return {
            "mode": "end-to-end",
            "status": "skipped",
            "reason": "GOOGLE_GENAI_API_KEY not set; run audio-only mode first",
        }
    if audio_path is None or not audio_path.exists():
        return {
            "mode": "end-to-end",
            "status": "skipped",
            "reason": (
                "no --audio-clip path; commit a mulaw sample under "
                "./samples/ first (see DPDP-T1 in the compliance plan)"
            ),
        }

    return {
        "mode": "end-to-end",
        "status": "not_implemented",
        "reason": (
            "Gemini Live API integration deferred to Phase 2 §2.2 "
            "(`live_client.py`). The notebook shows how to wire it; "
            "the benchmark will pick it up there."
        ),
    }


def _run_with_guard(args: argparse.Namespace) -> dict[str, Any]:
    """Stub for partial-transcript guard cut-fire latency."""
    e2e = _run_end_to_end(args)
    return {
        **e2e,
        "mode": "with-guard",
        "guard_target_ms": 250,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0] if __doc__ else "")
    parser.add_argument("mode", choices=["audio-only", "end-to-end", "with-guard"])
    parser.add_argument(
        "--iterations",
        type=int,
        default=1000,
        help="iterations for audio-only mode (default 1000)",
    )
    parser.add_argument(
        "--audio-clip",
        type=str,
        default=None,
        help="path to a μ-law sample clip for end-to-end mode",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.5-live-preview",
        help="Gemini Live model id (default: gemini-2.5-live-preview)",
    )
    args = parser.parse_args(argv)

    if args.mode == "audio-only":
        result = _run_audio_only(args)
    elif args.mode == "end-to-end":
        result = _run_end_to_end(args)
    else:
        result = _run_with_guard(args)

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
