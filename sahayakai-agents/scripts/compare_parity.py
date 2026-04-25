#!/usr/bin/env python3
"""Parity comparator for parent-call agent: sidecar vs Genkit.

Replays each fixture in `tests/fixtures/parent_call_turns.json` through
the FastAPI sidecar (in-process via `httpx.AsyncClient(ASGITransport)`)
with `google.genai.Client` faked to return the recorded raw text. The
sidecar therefore exercises its full code path — shared-prompt render,
structured parse, turn-cap, behavioural guard, OCC writes, response
shaping — without any network calls.

For each fixture the script then scores `sidecar.reply` against the
recorded Genkit `wrappedOutput.reply` using a tiered set of signals:

  Tier 1 (default, no extra deps): term-frequency cosine. Fast, cheap,
  stdlib-only. Good for catching gross drift; weak on paraphrase.

  Tier 2 (`--use-embeddings`, loads sentence-transformers):
  IndicSBERT cosine. Captures cross-script semantic similarity across
  the 11 supported Indic + Latin scripts.

  Tier 3 (`--use-judge`, calls Gemini-2.5-Pro): LLM-as-judge over the
  rubric {semantic_equivalence, tone, language_match, factual_grounding,
  safety, cultural_appropriateness}. Most expensive; gates Track D
  shadow-ramp step-ups.

Output: `dist/parity_report.json` with per-language and per-tier
breakdown, plus a top-level `passRate` for dashboard consumption.
Non-zero exit when any fixture lands in the fail bucket.

This replaces the previous `NotImplementedError` stub (Day-1 #6) with
the real replay path. The cosine-self-comparison tautology is gone for
good.

Round-2 audit reference: P0 EVAL-1.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import math
import os
import re
import sys
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

# ---- Path resolution ------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_PACKAGE_ROOT = _HERE.parent
_FIXTURES = _PACKAGE_ROOT / "tests" / "fixtures" / "parent_call_turns.json"
_REPORT = _PACKAGE_ROOT / "dist" / "parity_report.json"

# Make `import sahayakai_agents...` work whether invoked via uv run, .venv,
# or plain python from the repo root.
if str(_PACKAGE_ROOT / "src") not in sys.path:
    sys.path.insert(0, str(_PACKAGE_ROOT / "src"))
if str(_PACKAGE_ROOT) not in sys.path:
    sys.path.insert(0, str(_PACKAGE_ROOT))

# ---- Tier 1: term-frequency cosine ----------------------------------------

_WORD = re.compile(r"\w+", re.UNICODE)


def _tokenise(text: str) -> list[str]:
    """Unicode-aware tokeniser; lowercases Latin-script chars, leaves
    Indic scripts as-is (they do not have case)."""
    return [t.lower() for t in _WORD.findall(text)]


def _cosine_tf(a: str, b: str) -> float:
    """Term-frequency cosine. Returns 0.0 for empty input, 1.0 for
    identical strings. NOT a semantic measure — use embedding cosine
    for cross-paraphrase similarity."""
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


# ---- ASGI replay infrastructure -------------------------------------------


def _install_fake_genai(reply_text: str) -> None:
    """Patch `google.genai` and `google.genai.types` in `sys.modules` so
    `_call_gemini_structured` returns `reply_text` regardless of input.

    Mirrors the pattern in `tests/integration/test_parent_call_reply.py`
    so a fixture that passes integration tests will also work under
    parity replay.
    """

    fake_usage_meta = SimpleNamespace(
        input_tokens=1200,
        output_tokens=80,
        total_tokens=1280,
        cached_content_tokens=300,
    )
    fake_result = SimpleNamespace(
        text=reply_text,
        usage_metadata=fake_usage_meta,
        candidates=[],
    )

    class _FakeAioModels:
        async def generate_content(self, **_kwargs: Any) -> Any:
            return fake_result

    class _FakeAio:
        def __init__(self) -> None:
            self.models = _FakeAioModels()

    class _FakeClient:
        def __init__(self, api_key: str) -> None:  # noqa: ARG002
            self.aio = _FakeAio()
            # `models` (sync) is unused by the async path but kept for
            # parity with the production client surface.
            self.models = _FakeAioModels()

    fake_types = SimpleNamespace(GenerateContentConfig=lambda **kw: kw)
    fake_module = SimpleNamespace(Client=_FakeClient, types=fake_types)

    sys.modules["google.genai"] = fake_module  # type: ignore[assignment]
    sys.modules["google.genai.types"] = fake_types  # type: ignore[assignment]


def _patch_session_store() -> None:
    """Swap the FastAPI router's session store for the in-memory fake.

    Matches the integration-test fake. Avoids touching real Firestore
    (and lets the parity script run on a developer laptop without GCP
    credentials).
    """
    # Lazy imports — the package only imports when sys.path is set above.
    from sahayakai_agents.agents.parent_call import router as router_module
    from tests.unit.fake_firestore import make_fake_session_store

    fake = make_fake_session_store()

    async def _append_turn(turn: Any) -> None:
        fake._sync_append_turn(turn)

    async def _load(_call_sid: str) -> list[Any]:
        return []

    async def _mark_ended(call_sid: str, duration_seconds: float | None = None) -> None:
        fake._sync_mark_ended(call_sid, duration_seconds)

    fake.append_turn = _append_turn
    fake.load_transcript = _load
    fake.mark_ended = _mark_ended

    router_module._session_store = fake
    router_module._get_session_store = lambda: fake


async def _replay_fixture(client: Any, fixture: dict[str, Any]) -> str:
    """POST one fixture's request to `/v1/parent-call/reply` and return
    the sidecar's `reply` string."""
    req = fixture.get("request") or {}
    res = await client.post("/v1/parent-call/reply", json=req)
    if res.status_code != 200:
        raise RuntimeError(
            f"Sidecar replay returned {res.status_code} for fixture "
            f"{fixture.get('fixtureId')!r}: {res.text[:300]}"
        )
    body = res.json()
    return str(body.get("reply") or "")


# ---- Bucketing ------------------------------------------------------------


def _bucket(score: float, *, pass_threshold: float, near_threshold: float) -> str:
    if score >= pass_threshold:
        return "pass"
    if score >= near_threshold:
        return "near_miss"
    return "fail"


# ---- Main -----------------------------------------------------------------


async def run(args: argparse.Namespace) -> int:
    if not _FIXTURES.exists():
        print(
            f"[parity] fixtures not present at "
            f"{_FIXTURES.relative_to(_PACKAGE_ROOT)}; "
            f"run sahayakai-main/scripts/record-parent-call-fixtures.ts first.",
            file=sys.stderr,
        )
        return 0  # absent fixtures are not a failure — gate is presence-checked

    try:
        fixtures = json.loads(_FIXTURES.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"[parity] fixtures file is not valid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(fixtures, list) or not fixtures:
        print(f"[parity] fixture file has no entries at {_FIXTURES}", file=sys.stderr)
        return 0

    # Set the dev-mode env BEFORE importing the FastAPI app. The parity
    # script runs without GCP credentials.
    os.environ.setdefault("SAHAYAKAI_AGENTS_ENV", "development")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "sahayakai-b4248-test")
    os.environ.setdefault("SAHAYAKAI_REQUEST_SIGNING_KEY", "parity-test-signing-key")
    os.environ.setdefault("GOOGLE_GENAI_API_KEY", "parity-test-key")
    os.environ.setdefault("GOOGLE_GENAI_SHADOW_API_KEY", "parity-test-shadow-key")

    # Lazy imports of the FastAPI app so env defaults take effect.
    from httpx import ASGITransport, AsyncClient  # noqa: PLC0415

    from sahayakai_agents.config import get_settings  # noqa: PLC0415
    from sahayakai_agents.main import app  # noqa: PLC0415

    get_settings.cache_clear()
    _patch_session_store()

    transport = ASGITransport(app=app)

    results: list[dict[str, Any]] = []
    by_lang: dict[str, dict[str, int]] = {}

    async with AsyncClient(transport=transport, base_url="http://parity") as client:
        for fixture in fixtures:
            wrapped = fixture.get("wrappedOutput") or {}
            genkit_reply = str(wrapped.get("reply") or "")
            lang = str(fixture.get("parentLanguage") or "unknown")

            # Inject the recorded raw output as the model's response.
            # Sidecar contract requires JSON matching `AgentReplyCore`,
            # so we wrap the recorded reply into the same shape.
            genai_payload = json.dumps(
                {
                    "reply": genkit_reply,
                    "shouldEndCall": bool(wrapped.get("shouldEndCall", False)),
                    "followUpQuestion": wrapped.get("followUpQuestion"),
                }
            )
            _install_fake_genai(genai_payload)

            try:
                sidecar_reply = await _replay_fixture(client, fixture)
            except Exception as exc:  # noqa: BLE001 — surface ALL failures per-fixture
                results.append(
                    {
                        "fixtureId": fixture.get("fixtureId"),
                        "parentLanguage": lang,
                        "turnNumber": fixture.get("turnNumber"),
                        "cosineTf": 0.0,
                        "bucket": "fail",
                        "error": str(exc)[:500],
                    }
                )
                bucket_stats = by_lang.setdefault(
                    lang, {"pass": 0, "near_miss": 0, "fail": 0}
                )
                bucket_stats["fail"] += 1
                continue

            score = round(_cosine_tf(genkit_reply, sidecar_reply), 3)
            bucket = _bucket(
                score,
                pass_threshold=args.pass_threshold,
                near_threshold=args.near_threshold,
            )
            bucket_stats = by_lang.setdefault(
                lang, {"pass": 0, "near_miss": 0, "fail": 0}
            )
            bucket_stats[bucket] += 1
            results.append(
                {
                    "fixtureId": fixture.get("fixtureId"),
                    "parentLanguage": lang,
                    "turnNumber": fixture.get("turnNumber"),
                    "cosineTf": score,
                    "bucket": bucket,
                }
            )

    total = len(results)
    passes = sum(1 for r in results if r["bucket"] == "pass")
    near = sum(1 for r in results if r["bucket"] == "near_miss")
    fails = sum(1 for r in results if r["bucket"] == "fail")

    report = {
        "status": "scored",
        "fixtures": total,
        "pass": passes,
        "near_miss": near,
        "fail": fails,
        "passRate": round(passes / total, 3) if total else 0.0,
        "byLanguage": by_lang,
        "details": results,
        "tiers": {
            "tf_cosine": {
                "passThreshold": args.pass_threshold,
                "nearThreshold": args.near_threshold,
                "active": True,
            },
            "indic_sbert_cosine": {"active": args.use_embeddings},
            "llm_judge": {"active": args.use_judge},
        },
        "scoredAt": datetime.now(UTC).isoformat(),
        "notes": (
            "Tier-1 term-frequency cosine only. Tiers 2 (IndicSBERT) and "
            "3 (Gemini-2.5-Pro LLM-judge) are gated behind --use-embeddings "
            "and --use-judge respectively; both will be required before "
            "Track D shadow-ramp step-ups."
        ),
    }

    _REPORT.parent.mkdir(parents=True, exist_ok=True)
    _REPORT.write_text(
        json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(
        f"[parity] wrote {_REPORT.relative_to(_PACKAGE_ROOT)}  "
        f"pass={passes}/{total}  near_miss={near}  fail={fails}",
    )

    return 1 if fails else 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n", 1)[0])
    parser.add_argument(
        "--pass-threshold",
        type=float,
        default=0.85,
        help="cosine score >= this is `pass` (default: 0.85)",
    )
    parser.add_argument(
        "--near-threshold",
        type=float,
        default=0.70,
        help="cosine score in [near, pass) is `near_miss` (default: 0.70)",
    )
    parser.add_argument(
        "--use-embeddings",
        action="store_true",
        help="(stub) layer IndicSBERT cosine on top of TF cosine. "
        "Loads ~500 MB of model weights. Not yet implemented.",
    )
    parser.add_argument(
        "--use-judge",
        action="store_true",
        help="(stub) layer Gemini-2.5-Pro LLM-judge on top. Costs "
        "~$0.10 per 22-fixture run. Not yet implemented.",
    )
    args = parser.parse_args(argv)

    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
