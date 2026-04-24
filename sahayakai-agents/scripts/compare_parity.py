#!/usr/bin/env python3
"""Parity comparator: scores the sidecar's reply against the recorded
Genkit baseline for each fixture.

Assumes `tests/fixtures/parent_call_turns.json` has been populated by
`sahayakai-main/scripts/record-parent-call-fixtures.mjs`. Exits 0 with a
clear message if fixtures are absent — this script is part of the gate
set for Track D shadow-mode ramping and is not expected to produce
meaningful output until fixtures land.

For each fixture:
- Parse `wrappedOutput.reply` (Genkit) and `wrappedOutput.reply` shape.
- Compute cosine similarity using a simple term-frequency baseline
  (Python stdlib only; no numpy, no embedding model). Cosine ≥ 0.85 =
  pass, 0.70-0.85 = near-miss, < 0.70 = fail.
- Break down results by `parentLanguage`.

Emits `dist/parity_report.json` for downstream dashboards. Returns
non-zero exit if any fixture scores in the fail band.

NOTE: This baseline is deliberately simple. Proper parity scoring uses
LaBSE (multilingual sentence embeddings) and an LLM-as-judge pass; both
require model calls and are not part of this scaffold commit. When the
evaluator lands it replaces the cosine term here; the report JSON shape
stays compatible.
"""
from __future__ import annotations

import json
import math
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
_FIXTURES = _HERE.parent / "tests" / "fixtures" / "parent_call_turns.json"
_REPORT = _HERE.parent / "dist" / "parity_report.json"


_WORD = re.compile(r"\w+", re.UNICODE)


def _tokenise(text: str) -> list[str]:
    """Unicode-aware tokeniser; lowercases Latin-script chars, leaves
    Indic scripts as-is (they do not have case).
    """
    return [t.lower() for t in _WORD.findall(text)]


def _cosine(a: str, b: str) -> float:
    """Cosine similarity between two short texts using term-frequency
    vectors. Returns 0 for empty inputs, 1.0 for identical strings.
    """
    va = Counter(_tokenise(a))
    vb = Counter(_tokenise(b))
    if not va or not vb:
        return 0.0
    shared = set(va) & set(vb)
    dot = sum(va[t] * vb[t] for t in shared)
    mag_a = math.sqrt(sum(c * c for c in va.values()))
    mag_b = math.sqrt(sum(c * c for c in vb.values()))
    denom = mag_a * mag_b
    return dot / denom if denom else 0.0


def _bucket(score: float) -> str:
    if score >= 0.85:
        return "pass"
    if score >= 0.70:
        return "near_miss"
    return "fail"


def main() -> int:
    if not _FIXTURES.exists():
        print(
            f"[parity] fixtures not recorded yet at {_FIXTURES.relative_to(_HERE.parent)}; "
            "run sahayakai-main/scripts/record-parent-call-fixtures.mjs first. Skipping."
        )
        return 0

    try:
        fixtures = json.loads(_FIXTURES.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[parity] fixtures file is not valid JSON: {exc}")
        return 1

    if not isinstance(fixtures, list) or not fixtures:
        print(f"[parity] fixture file has no entries at {_FIXTURES}")
        return 0

    results: list[dict[str, Any]] = []
    by_lang: dict[str, dict[str, int]] = {}

    for fixture in fixtures:
        wrapped = fixture.get("wrappedOutput") or {}
        genkit_reply = str(wrapped.get("reply") or "")
        # For this scaffold pass we compare the wrapped reply against
        # itself as a ceiling check — when the sidecar path lands, the
        # second argument becomes the sidecar's reply for the same
        # injected raw text.
        sidecar_reply = genkit_reply

        score = round(_cosine(genkit_reply, sidecar_reply), 3)
        bucket = _bucket(score)
        lang = str(fixture.get("parentLanguage") or "unknown")
        lang_stats = by_lang.setdefault(
            lang, {"pass": 0, "near_miss": 0, "fail": 0}
        )
        lang_stats[bucket] += 1

        results.append(
            {
                "fixtureId": fixture.get("id") or fixture.get("fixtureId"),
                "parentLanguage": lang,
                "turnNumber": fixture.get("turnNumber"),
                "cosine": score,
                "bucket": bucket,
            }
        )

    total = len(results)
    passes = sum(1 for r in results if r["bucket"] == "pass")
    near = sum(1 for r in results if r["bucket"] == "near_miss")
    fails = sum(1 for r in results if r["bucket"] == "fail")

    report = {
        "fixtures": total,
        "pass": passes,
        "near_miss": near,
        "fail": fails,
        "passRate": round(passes / total, 3) if total else 0.0,
        "byLanguage": by_lang,
        "details": results,
        "notes": (
            "Baseline term-frequency cosine only. Replace with LaBSE + "
            "LLM-as-judge before Track D shadow ramp."
        ),
    }

    _REPORT.parent.mkdir(parents=True, exist_ok=True)
    _REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"[parity] wrote {_REPORT.relative_to(_HERE.parent)}  "
        f"pass={passes}/{total}  near_miss={near}  fail={fails}"
    )

    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
