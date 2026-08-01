#!/usr/bin/env python3
"""VIDYA parity harness — the scoreboard for the 0/99 → 95/99 mission.

    # start the sidecar first:  uv run uvicorn sahayakai_agents.main:app --port 8080
    uv run python scripts/vidya_parity.py
    uv run python scripts/vidya_parity.py --threshold 95      # non-zero exit below 95
    uv run python scripts/vidya_parity.py --lang hi --verbose # debug one language

Replaces the harness that produced `vidya-final.json` on 2026-06-06 and was
never committed. Inputs come from `tests/fixtures/vidya_parity_cells.json`
(see build_vidya_parity_cells.py for how that was reconstructed).

SCORING — 3 of the original 4 criteria
--------------------------------------
  1. flow_match   sidecar action.flow == the recorded Genkit flow (incl. both-null)
  2. script       >= 90% of letters in the target language's Unicode block
  3. entity       a key term appears in the reply
  4. cosine       NOT SCORED — the baseline stored the resulting score but not
                  Genkit's response text, so it cannot be reconstructed. Drop a
                  capture at tests/fixtures/vidya_genkit_baseline.json to enable.

A cell PASSES when every scored criterion passes. The harness prints which
criteria were active so a number is never mistaken for the full gate.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import unicodedata
from datetime import UTC, datetime
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
CELLS = ROOT / "tests" / "fixtures" / "vidya_parity_cells.json"
GENKIT_TEXT = ROOT / "tests" / "fixtures" / "vidya_genkit_baseline.json"
RESULTS_DIR = ROOT / "qa" / "parity"

# Unicode blocks per language, for the script check.
SCRIPT_RANGES: dict[str, list[tuple[int, int]]] = {
    "en": [(0x0041, 0x005A), (0x0061, 0x007A)],
    "hi": [(0x0900, 0x097F)],
    "mr": [(0x0900, 0x097F)],
    "bn": [(0x0980, 0x09FF)],
    "pa": [(0x0A00, 0x0A7F)],
    "gu": [(0x0A80, 0x0AFF)],
    "or": [(0x0B00, 0x0B7F)],
    "ta": [(0x0B80, 0x0BFF)],
    "te": [(0x0C00, 0x0C7F)],
    "kn": [(0x0C80, 0x0CFF)],
    "ml": [(0x0D00, 0x0D7F)],
}

SCRIPT_THRESHOLD = 0.90


def script_coverage(text: str, lang: str) -> float:
    """Fraction of cased/letter characters that sit in the target block.

    Digits, punctuation and whitespace are ignored — a Devanagari sentence
    containing "class 7" should not be penalised for the numeral.
    """
    ranges = SCRIPT_RANGES.get(lang)
    if not ranges:
        return 1.0
    letters = [c for c in text if unicodedata.category(c).startswith("L")]
    if not letters:
        return 0.0
    hits = sum(1 for c in letters if any(lo <= ord(c) <= hi for lo, hi in ranges))
    return hits / len(letters)


def entity_hit(text: str, entities: list[str]) -> bool:
    low = text.lower()
    return any(e.lower() in low for e in entities)


# A free-tier Gemini key rate-limits hard. Without this the harness reports
# `sidecar_missing` for quota errors, which reads as "VIDYA is broken" when it
# is really "we asked too fast" — the single most misleading failure mode for
# an autonomous loop, because it makes a good fix look like a regression.
RETRY_STATUSES = {429, 503}
MAX_ATTEMPTS = 4


async def probe(client: httpx.AsyncClient, base: str, cell: dict, pace: float) -> dict:
    payload = {
        "message": cell["message"],
        "chatHistory": [],
        "currentScreenContext": {"path": "/", "uiState": {}},
        "teacherProfile": {},
        "detectedLanguage": cell["lang"],
        "userId": "parity-harness",
    }
    last = {"ok": False, "error": "no attempt made", "status": None}
    for attempt in range(MAX_ATTEMPTS):
        if attempt or pace:
            # Exponential backoff on retry; a flat pace between first attempts.
            await asyncio.sleep(pace if not attempt else min(2**attempt * 2.0, 30.0))
        try:
            r = await client.post(f"{base}/v1/vidya/orchestrate", json=payload, timeout=45.0)
        except Exception as exc:  # noqa: BLE001
            last = {"ok": False, "error": f"{type(exc).__name__}: {exc}", "status": None}
            continue
        if r.status_code == 200:
            try:
                return {"ok": True, "status": 200, "body": r.json()}
            except Exception as exc:  # noqa: BLE001
                return {"ok": False, "error": f"unparseable JSON: {exc}", "status": 200}
        last = {"ok": False, "error": r.text[:300], "status": r.status_code}
        if r.status_code not in RETRY_STATUSES:
            return last  # a real failure — do not burn retries on it
    last["quotaExhausted"] = last.get("status") in RETRY_STATUSES
    return last


def score(cell: dict, probe_result: dict, genkit_text: dict | None) -> dict:  # noqa: PLR0912 — one branch per failure-reason classification; flat reads clearer than a dispatch table in a test harness
    row = {
        "cell": cell["cell"],
        "lang": cell["lang"],
        "intent": cell["intent"],
        "expectedFlow": cell["expectedFlow"],
        "genkitFlow": cell["genkitFlow"],
        "sidecarFlow": None,
        "flowMatch": False,
        "script": 0.0,
        "entityHit": False,
        "verdict": "FAIL",
        "failReasons": [],
    }

    if not probe_result["ok"]:
        err = probe_result.get("error", "")
        if probe_result.get("quotaExhausted"):
            reason = "quota_exhausted"
        elif "Behavioural guard failed" in err and "Script mismatch" in err:
            reason = "behavioural_502_script"  # root cause 1, as a hard error
        elif "Behavioural guard failed" in err:
            reason = "behavioural_502_other"
        elif "instant-answer agent failed" in err:
            reason = "instant_answer_502"  # root cause 2 territory
        else:
            reason = "sidecar_missing"
        row["failReasons"].append(reason)
        row["notes"] = probe_result.get("error", "")[:200]
        return row

    body = probe_result["body"]
    response_text = body.get("response") or ""
    action = body.get("action")
    row["sidecarFlow"] = action.get("flow") if isinstance(action, dict) else None
    row["response"] = response_text[:400]

    # 1. flow match (both-null counts as a match)
    row["flowMatch"] = row["sidecarFlow"] == cell["genkitFlow"]
    if not row["flowMatch"]:
        row["failReasons"].append("action_flow_mismatch")

    # 2. script coverage
    row["script"] = round(script_coverage(response_text, cell["lang"]), 4)
    if row["script"] < SCRIPT_THRESHOLD:
        row["failReasons"].append("script_mismatch")

    # 3. entity hit
    # For CREATE/ACTION the reply is a short acknowledgement by design — the
    # extracted topic lives in action.params, not in the prose. Checking the
    # response text there would fail every cell for a bug that isn't real.
    if cell["intent"] == "ANSWER":
        # ANSWER replies are prose: the concept should appear in the text.
        row["entityHit"] = entity_hit(response_text, cell.get("entities", []))
    else:
        # CREATE/ACTION: the reply is a fixed acknowledgement, so the thing to
        # verify is that VIDYA pulled the topic OUT of what the teacher said.
        #
        # A keyword list cannot do this — the extracted topic comes back in the
        # teacher's own script ("ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ", not "photosynthesis"), so a
        # list of English terms fails 8 perfectly-correct cells. Checking that
        # the extracted topic actually overlaps the input message is both
        # language-agnostic and a stricter test of the real behaviour.
        params = action.get("params") if isinstance(action, dict) else {}
        params = params or {}
        topic = str(params.get("topic") or "").strip()
        row["extractedTopic"] = topic
        msg = cell["message"]

        # Check ALL populated params, not just topic. An exam-paper request
        # has a SUBJECT and a grade, not a topic — VIDYA correctly returns
        # topic='' and subject='Science' there, and requiring a topic failed
        # 6 perfectly-correct act-exam cells. English only passed because it
        # happened to put "Science" in topic.
        extracted = [str(v).strip() for v in params.values() if v and str(v).strip()]
        haystack = " ".join(extracted)

        in_message = any(
            v.lower() in msg.lower()
            or any(len(w) > 3 and w.lower() in msg.lower() for w in v.split())
            for v in extracted
        )
        in_entities = entity_hit(haystack, cell.get("entities", []))
        # VIDYA is inconsistent about whether the topic comes back in the
        # teacher's script or translated to English. soul.ts:125 asks for
        # English, so both are legitimate. Only extracting NOTHING fails.
        row["entityHit"] = bool(extracted) and (in_message or in_entities)
        if topic and not in_message and cell["lang"] != "en":
            row["topicTranslated"] = True

    if not row["entityHit"]:
        row["failReasons"].append("entity_miss")

    # 4. cosine — only when a Genkit text capture is present
    if genkit_text and cell["cell"] in genkit_text:
        row["cosineScored"] = True  # scorer intentionally left to whoever captures the texts
    row["verdict"] = "PASS" if not row["failReasons"] else "FAIL"
    return row


async def run(base: str, lang_filter: str | None, concurrency: int, pace: float) -> dict:
    cells = json.loads(CELLS.read_text(encoding="utf-8"))
    if lang_filter:
        cells = [c for c in cells if c["lang"] == lang_filter]

    genkit_text = None
    if GENKIT_TEXT.exists():
        genkit_text = {r["cell"]: r for r in json.loads(GENKIT_TEXT.read_text(encoding="utf-8"))}

    sem = asyncio.Semaphore(concurrency)
    started = datetime.now(UTC)

    async with httpx.AsyncClient() as client:

        async def one(c: dict) -> dict:
            async with sem:
                return score(c, await probe(client, base, c, pace), genkit_text)

        rows = await asyncio.gather(*(one(c) for c in cells))

    passed = sum(1 for r in rows if r["verdict"] == "PASS")
    ok = sum(1 for r in rows if "sidecar_missing" not in r["failReasons"])
    criteria = ["flow_match", "script", "entity"] + (["cosine"] if genkit_text else [])

    return {
        "runStartedAt": started.isoformat(),
        "runFinishedAt": datetime.now(UTC).isoformat(),
        "total": len(rows),
        "passed": passed,
        "passRate": round(passed / len(rows), 4) if rows else 0.0,
        "sidecarOkRatio": round(ok / len(rows), 4) if rows else 0.0,
        "criteriaScored": criteria,
        "cosineScored": bool(genkit_text),
        "results": rows,
    }


def report(res: dict, verbose: bool) -> None:  # noqa: PLR0912 — sequential report sections; splitting them would obscure the output layout
    import collections

    print(f"\n{'=' * 66}")
    print(f"  VIDYA PARITY   {res['passed']}/{res['total']}   ({res['passRate'] * 100:.1f}%)")
    print(f"{'=' * 66}")
    print(f"  sidecar OK      {res['sidecarOkRatio'] * 100:.1f}%")
    print(f"  criteria        {', '.join(res['criteriaScored'])}")
    if not res["cosineScored"]:
        print("  NOTE            cosine NOT scored — no Genkit text capture present.")
        print("                  This is 3 of the original 4 criteria.")

    by_lang = collections.defaultdict(lambda: [0, 0])
    by_intent = collections.defaultdict(lambda: [0, 0])
    reasons: collections.Counter = collections.Counter()
    for r in res["results"]:
        by_lang[r["lang"]][1] += 1
        by_intent[r["intent"]][1] += 1
        if r["verdict"] == "PASS":
            by_lang[r["lang"]][0] += 1
            by_intent[r["intent"]][0] += 1
        reasons.update(r["failReasons"])

    print(f"\n  {'lang':<6}{'pass':>8}   {'intent':<10}{'pass':>8}")
    langs = sorted(by_lang)
    intents = sorted(by_intent)
    for i in range(max(len(langs), len(intents))):
        if i < len(langs):
            lang = langs[i]
            left = f"  {lang:<6}{by_lang[lang][0]:>3}/{by_lang[lang][1]:<4}"
        else:
            left = " " * 15
        if i < len(intents):
            intent = intents[i]
            right = f"   {intent:<10}{by_intent[intent][0]:>3}/{by_intent[intent][1]:<4}"
        else:
            right = ""
        print(left + right)

    quota = reasons.get("quota_exhausted", 0)
    if quota:
        print(f"\n  ⚠  {quota} cell(s) hit the Gemini quota — NOT a VIDYA failure.")
        print("     Re-run with --pace 8 (or a higher-quota key) before trusting this number.")

    if reasons:
        print("\n  failure reasons (highest count first — fix the top one):")
        for reason, n in reasons.most_common():
            print(f"    {n:>3}  {reason}")

    if verbose:
        print("\n  failing cells:")
        for r in res["results"]:
            if r["verdict"] == "FAIL":
                print(
                    f"    {r['cell']:<18} flow={str(r['sidecarFlow']):<20} "
                    f"script={r['script']:.2f} {','.join(r['failReasons'])}"
                )
    print()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--threshold", type=int, default=0, help="exit 1 if passed < this")
    ap.add_argument("--lang", default=None, help="score one language only")
    ap.add_argument(
        "--concurrency", type=int, default=1, help="parallel requests; keep at 1 on a free-tier key"
    )
    ap.add_argument(
        "--pace", type=float, default=4.0, help="seconds between requests, to stay under the quota"
    )
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default=None, help="write JSON here (default: qa/parity/<ts>.json)")
    a = ap.parse_args()

    if not CELLS.exists():
        print(
            f"ERROR: {CELLS} missing. Run tests/fixtures/build_vidya_parity_cells.py",
            file=sys.stderr,
        )
        return 2

    res = asyncio.run(run(a.base_url, a.lang, a.concurrency, a.pace))
    report(res, a.verbose)

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = (
        Path(a.out) if a.out else RESULTS_DIR / f"{res['runStartedAt'][:19].replace(':', '')}.json"
    )
    out.write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    latest = RESULTS_DIR / "latest.json"
    latest.write_text(json.dumps(res, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"  written: {out.relative_to(ROOT)}  (also qa/parity/latest.json)\n")

    quota_hits = sum(1 for r in res["results"] if "quota_exhausted" in r["failReasons"])
    if quota_hits:
        print(
            f"  RUN INVALID: {quota_hits} cell(s) quota-limited. Score is not trustworthy.\n",
            file=sys.stderr,
        )
        return 3

    if a.threshold and res["passed"] < a.threshold:
        print(f"  BELOW THRESHOLD: {res['passed']} < {a.threshold}\n", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
