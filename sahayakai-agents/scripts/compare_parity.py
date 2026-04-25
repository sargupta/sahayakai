#!/usr/bin/env python3
"""Parity comparator: scores the sidecar's reply against the recorded
Genkit baseline for each fixture.

Status (Round-2 audit P0 EVAL-1): the previous implementation scored each
fixture against itself (`sidecar_reply = genkit_reply`), which is a
tautology and reports 100 % parity even when the sidecar hasn't been
invoked. That is exactly the kind of green-on-broken signal that lets a
shadow ramp succeed on paper while every real call regresses. The
comparator now fails loudly until the real replay path is wired up.

What "wired up" means:

1. `sahayakai-main/scripts/record-parent-call-fixtures.mjs` writes
   `tests/fixtures/parent_call_turns.json` with the recorded Genkit
   output AND the raw Gemini text the live key returned for each turn.
2. This script will (when implemented):
   a. Boot a fake `google.genai` whose `aio.models.generate_content`
      returns the recorded raw text per fixture.
   b. Drive the FastAPI sidecar via `httpx.AsyncClient(transport=ASGITransport)`
      so the full `/v1/parent-call/reply` path runs end-to-end:
      shared-prompt render, structured parse, turn-cap, behavioural
      guard, OCC, response shaping.
   c. Compare the sidecar's `reply` against the recorded Genkit `reply`
      using:
        - IndicSBERT cosine for cross-script semantic similarity
          (LaBSE works too, IndicSBERT is the lighter Indic-tuned model).
        - Gemini-2.5-Pro as LLM-judge over the rubric
          {semantic_equivalence, tone, language_match, factual_grounding,
           safety, cultural_appropriateness}, returning a float in [0,1]
          per axis plus a one-line rationale.
3. Both signals land in `dist/parity_report.json` per language and per
   fixture, with hard pass-rate gates that block the Track D ramp.

Until step 2 lands, this script raises `NotImplementedError` and exits
non-zero so CI cannot mistake silence for parity.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
_FIXTURES = _HERE.parent / "tests" / "fixtures" / "parent_call_turns.json"
_REPORT = _HERE.parent / "dist" / "parity_report.json"


_PARITY_NOT_WIRED_MESSAGE = (
    "compare_parity.py is intentionally not implemented yet.\n"
    "\n"
    "The previous version scored each fixture against itself "
    "(tautology) and always reported 100% parity. That bug is fixed "
    "by removing it; the real replay path lands with the sidecar "
    "shadow gate, not in this scaffold commit.\n"
    "\n"
    "To unblock CI in the meantime, the workflow gate is moved to a "
    "presence-check on the fixtures file and a NotImplementedError "
    "guard here. When the real comparator lands:\n"
    "  - replay each fixture's `rawText` through the FastAPI sidecar\n"
    "  - score with IndicSBERT cosine + Gemini-2.5-Pro LLM-judge\n"
    "  - emit dist/parity_report.json with per-language pass-rates\n"
    "  - exit non-zero on any fail-band fixture\n"
    "\n"
    "Tracked in Notion: Master Audit P0 EVAL-1."
)


def _emit_pending_report(reason: str, fixtures_count: int | None = None) -> None:
    """Write a pending-state report so dashboards see structured 'not run'
    rather than a missing file or a stale 100 % green from the tautology
    era."""
    _REPORT.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "status": "not_implemented",
        "reason": reason,
        "fixtures": fixtures_count,
        "pass": 0,
        "near_miss": 0,
        "fail": 0,
        "passRate": 0.0,
        "byLanguage": {},
        "details": [],
    }
    _REPORT.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8"
    )


def main() -> int:
    fixtures_count: int | None = None
    if _FIXTURES.exists():
        try:
            data = json.loads(_FIXTURES.read_text(encoding="utf-8"))
            if isinstance(data, list):
                fixtures_count = len(data)
        except json.JSONDecodeError:
            fixtures_count = None

    _emit_pending_report(
        reason="parity comparator not wired; see header comment",
        fixtures_count=fixtures_count,
    )
    print(_PARITY_NOT_WIRED_MESSAGE, file=sys.stderr)
    raise NotImplementedError(
        "compare_parity.py: real sidecar replay path not yet implemented "
        "(P0 EVAL-1). The tautology score has been removed."
    )


if __name__ == "__main__":
    sys.exit(main())
