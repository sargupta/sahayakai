#!/usr/bin/env python3
"""Parity comparator for parent-call agent: sidecar vs Genkit.

Two-phase pipeline:

  Phase 1: REPLAY
    For each fixture in `tests/fixtures/parent_call_turns.json`,
    install a fake `google.genai.Client` in `sys.modules` that returns
    the recorded `wrappedOutput` JSON-serialised, then POST the
    fixture's request to `/v1/parent-call/reply` via
    `httpx.AsyncClient(ASGITransport(app))`. The FastAPI sidecar
    therefore exercises its full code path — shared-prompt render,
    structured parse, turn-cap, behavioural guard, OCC, response
    shaping — without any network calls. Capture
    (genkit_reply, sidecar_reply) pairs in memory.

  Phase 2: SCORE
    Pop the fake from `sys.modules` (so any further google-genai use
    in this process talks to the real SDK) and score each pair across
    the active tiers:

      Tier 1 (default, no extra deps): term-frequency cosine. Fast,
      cheap, stdlib-only. Catches gross drift; weak on paraphrase.

      Tier 2 (`--use-embeddings`, requires the `[eval]` extra):
      sentence-transformers cosine over a multilingual-Indic SBERT
      model (default `l3cube-pune/indic-sentence-bert-nli`,
      configurable via `--embedding-model`). Captures semantic
      similarity across the 11 supported Indic + Latin scripts.

      Tier 3 (`--use-judge`, requires `--judge-api-key`): Gemini
      LLM-as-judge over the rubric:
        {semantic_equivalence, tone, language_match,
         factual_grounding, safety, cultural_appropriateness}
      Each axis [0, 1]; pass requires the AVERAGE >= the configured
      threshold. Most expensive; gates Track D shadow-ramp step-ups
      beyond 5%.

A fixture is `pass` only if it passes EVERY active tier; `fail` if
any active tier returns < the near threshold; otherwise `near_miss`.
This is intentionally strict — a fixture that scores high TF cosine
but low LLM-judge (e.g. matches keywords but misses tone) should not
silently slip through.

Output: `dist/parity_report.json` per-fixture × per-tier breakdown,
plus per-language and overall pass rates. Non-zero exit when any
fixture is in the fail bucket.

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

DEFAULT_EMBEDDING_MODEL = "l3cube-pune/indic-sentence-bert-nli"
DEFAULT_JUDGE_MODEL = "gemini-2.5-pro"

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


# ---- Tier 2: IndicSBERT cosine --------------------------------------------


class _EmbeddingScorer:
    """Lazy loader for sentence-transformers. The model weights are
    ~500 MB and the import alone pulls torch into memory, so we only
    materialise the model when the caller actually opts in via
    `--use-embeddings`.
    """

    def __init__(self, model_name: str) -> None:
        self.model_name = model_name
        self._model: Any = None

    def _load(self) -> None:
        if self._model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise RuntimeError(
                "sentence-transformers is not installed. Install with "
                "`uv sync --extra eval` (or `pip install -e '.[eval]'`)."
            ) from exc
        self._model = SentenceTransformer(self.model_name)

    def cosine(self, a: str, b: str) -> float:
        if not a or not b:
            return 0.0
        self._load()
        # encode both at once; batched is faster than two single calls.
        embeddings = self._model.encode([a, b], convert_to_numpy=True)
        va, vb = embeddings[0], embeddings[1]
        # Compute cosine in numpy without importing it explicitly —
        # SentenceTransformer guarantees numpy is available.
        import numpy as np

        denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
        if denom == 0.0:
            return 0.0
        return float(np.dot(va, vb) / denom)


# ---- Tier 3: Gemini LLM-as-judge ------------------------------------------

_JUDGE_PROMPT_TEMPLATE = """You are a strict QA reviewer scoring two candidate \
replies for a parent-call AI agent.

The agent is on a phone call with a parent in {parentLanguage}. Both replies \
were produced for the SAME input. Reply A is the BASELINE (Genkit-served \
production). Reply B is the CANDIDATE (sidecar-served replacement). The \
candidate is acceptable only if it preserves the baseline's pedagogical \
intent, tone, and cultural register.

Score each axis on a [0, 1] scale where 0 means "completely fails" and 1 \
means "as good as the baseline":

- semantic_equivalence: do A and B convey the same advice / commitment / \
  follow-up?
- tone: same warmth, respect, unhurried pacing?
- language_match: is B written in {parentLanguage} script (or English when \
  the language is en)? Code-switching ≤ 15% Latin alpha is fine.
- factual_grounding: does B avoid inventing facts about the student / \
  teacher / school that A did not state?
- safety: is B free of forbidden phrases ("I am an AI", "Sahayak", \
  "as a language model")? Free of harmful / discriminatory framing?
- cultural_appropriateness: does B respect Indian parent-teacher \
  conventions (warm address, no condescension, practical home-learning \
  tip)?

Return ONLY this JSON object — no prose, no markdown:
{{
  "semantic_equivalence": <float [0,1]>,
  "tone": <float [0,1]>,
  "language_match": <float [0,1]>,
  "factual_grounding": <float [0,1]>,
  "safety": <float [0,1]>,
  "cultural_appropriateness": <float [0,1]>,
  "rationale": "<one short sentence>"
}}

REPLY A (baseline):
{baseline}

REPLY B (candidate):
{candidate}
"""


class _JudgeScorer:
    """Lazy loader for the Gemini judge client. Imports `google.genai`
    only inside `_load`, AFTER any sidecar-replay sys.modules patches
    have been popped. Uses the official async surface.
    """

    JUDGE_AXES = (
        "semantic_equivalence",
        "tone",
        "language_match",
        "factual_grounding",
        "safety",
        "cultural_appropriateness",
    )

    def __init__(self, model: str, api_key: str) -> None:
        self.model = model
        self.api_key = api_key
        self._client: Any = None

    def _load(self) -> None:
        if self._client is not None:
            return
        # Make sure no sidecar-replay patches linger before we import.
        sys.modules.pop("google.genai", None)
        sys.modules.pop("google.genai.types", None)
        from google import genai

        self._client = genai.Client(api_key=self.api_key)

    async def score(
        self, *, parent_language: str, baseline: str, candidate: str
    ) -> dict[str, Any]:
        self._load()
        from google.genai import types as genai_types

        prompt = _JUDGE_PROMPT_TEMPLATE.format(
            parentLanguage=parent_language,
            baseline=baseline,
            candidate=candidate,
        )
        result = await self._client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0,  # judge should be deterministic
            ),
        )
        text = getattr(result, "text", None) or ""
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {
                "average": 0.0,
                "axes": dict.fromkeys(self.JUDGE_AXES, 0.0),
                "rationale": "judge_returned_unparseable_json",
                "raw": text[:500],
            }
        axes = {ax: float(parsed.get(ax, 0.0)) for ax in self.JUDGE_AXES}
        avg = sum(axes.values()) / len(self.JUDGE_AXES) if self.JUDGE_AXES else 0.0
        return {
            "average": round(avg, 3),
            "axes": axes,
            "rationale": str(parsed.get("rationale") or "")[:300],
        }


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


def _restore_real_genai() -> None:
    """Pop sidecar-replay fakes so phase 2 (judge tier) gets the real
    google.genai package on next import."""
    sys.modules.pop("google.genai", None)
    sys.modules.pop("google.genai.types", None)


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


def _aggregate_bucket(
    tier_buckets: list[str],
) -> str:
    """Combine per-tier buckets. Strictest of any tier wins:
    `fail` > `near_miss` > `pass`. Empty list defaults to `fail` (no
    tier scored = no signal).
    """
    if not tier_buckets:
        return "fail"
    if "fail" in tier_buckets:
        return "fail"
    if "near_miss" in tier_buckets:
        return "near_miss"
    return "pass"


# ---- Phase 1: replay ------------------------------------------------------


async def _phase1_replay(
    fixtures: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Run each fixture through the sidecar; return (genkit, sidecar) pairs."""
    from httpx import ASGITransport, AsyncClient

    from sahayakai_agents.config import get_settings
    from sahayakai_agents.main import app

    get_settings.cache_clear()
    _patch_session_store()

    pairs: list[dict[str, Any]] = []
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://parity") as client:
        for fixture in fixtures:
            wrapped = fixture.get("wrappedOutput") or {}
            genkit_reply = str(wrapped.get("reply") or "")
            lang = str(fixture.get("parentLanguage") or "unknown")

            # Inject the recorded raw output as the model's response.
            genai_payload = json.dumps(
                {
                    "reply": genkit_reply,
                    "shouldEndCall": bool(wrapped.get("shouldEndCall", False)),
                    "followUpQuestion": wrapped.get("followUpQuestion"),
                }
            )
            _install_fake_genai(genai_payload)

            entry: dict[str, Any] = {
                "fixtureId": fixture.get("fixtureId"),
                "parentLanguage": lang,
                "turnNumber": fixture.get("turnNumber"),
                "genkitReply": genkit_reply,
                "sidecarReply": None,
                "replayError": None,
            }
            try:
                entry["sidecarReply"] = await _replay_fixture(client, fixture)
            except Exception as exc:  # noqa: BLE001
                entry["replayError"] = str(exc)[:500]
            pairs.append(entry)

    return pairs


# ---- Phase 2: score -------------------------------------------------------


async def _phase2_score(
    pairs: list[dict[str, Any]],
    args: argparse.Namespace,
) -> None:
    """Score each pair across active tiers; mutates each pair in place."""
    embedding_scorer = (
        _EmbeddingScorer(args.embedding_model) if args.use_embeddings else None
    )
    judge_scorer = (
        _JudgeScorer(args.judge_model, args.judge_api_key)
        if args.use_judge
        else None
    )

    for pair in pairs:
        scores: dict[str, Any] = {}
        tier_buckets: list[str] = []

        if pair.get("replayError"):
            # No sidecar reply to score against. Fail outright.
            pair["scores"] = {}
            pair["tierBuckets"] = ["fail"]
            pair["bucket"] = "fail"
            continue

        baseline = str(pair["genkitReply"])
        candidate = str(pair["sidecarReply"] or "")

        # Tier 1: TF cosine (always active)
        tf = round(_cosine_tf(baseline, candidate), 3)
        scores["tf_cosine"] = tf
        tier_buckets.append(
            _bucket(
                tf,
                pass_threshold=args.pass_threshold,
                near_threshold=args.near_threshold,
            )
        )

        # Tier 2: IndicSBERT
        if embedding_scorer is not None:
            try:
                sbert = round(embedding_scorer.cosine(baseline, candidate), 3)
            except Exception as exc:  # noqa: BLE001
                pair["embeddingError"] = str(exc)[:500]
                sbert = 0.0
            scores["indic_sbert_cosine"] = sbert
            tier_buckets.append(
                _bucket(
                    sbert,
                    pass_threshold=args.embedding_pass_threshold,
                    near_threshold=args.embedding_near_threshold,
                )
            )

        # Tier 3: LLM judge
        if judge_scorer is not None:
            try:
                judge_result = await judge_scorer.score(
                    parent_language=pair["parentLanguage"],
                    baseline=baseline,
                    candidate=candidate,
                )
                scores["llm_judge"] = judge_result
                tier_buckets.append(
                    _bucket(
                        judge_result["average"],
                        pass_threshold=args.judge_pass_threshold,
                        near_threshold=args.judge_near_threshold,
                    )
                )
            except Exception as exc:  # noqa: BLE001
                pair["judgeError"] = str(exc)[:500]
                tier_buckets.append("fail")

        pair["scores"] = scores
        pair["tierBuckets"] = tier_buckets
        pair["bucket"] = _aggregate_bucket(tier_buckets)


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

    if args.use_judge and not args.judge_api_key:
        print(
            "[parity] --use-judge requires --judge-api-key (or "
            "GOOGLE_GENAI_API_KEY env var; the script reads from "
            "args.judge_api_key after env fallback).",
            file=sys.stderr,
        )
        return 1

    # Set the dev-mode env BEFORE importing the FastAPI app. The parity
    # script runs without GCP credentials.
    os.environ.setdefault("SAHAYAKAI_AGENTS_ENV", "development")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "sahayakai-b4248-test")
    os.environ.setdefault("SAHAYAKAI_REQUEST_SIGNING_KEY", "parity-test-signing-key")
    os.environ.setdefault("GOOGLE_GENAI_API_KEY", "parity-test-key")
    os.environ.setdefault("GOOGLE_GENAI_SHADOW_API_KEY", "parity-test-shadow-key")

    print(f"[parity] phase 1 — replaying {len(fixtures)} fixtures through sidecar")
    pairs = await _phase1_replay(fixtures)

    # Phase 2 needs the real google.genai for the judge tier.
    _restore_real_genai()

    active_tiers = ["tf_cosine"]
    if args.use_embeddings:
        active_tiers.append("indic_sbert_cosine")
    if args.use_judge:
        active_tiers.append("llm_judge")
    print(f"[parity] phase 2 — scoring with tiers: {', '.join(active_tiers)}")
    await _phase2_score(pairs, args)

    # ---- Aggregate ---------------------------------------------------------
    by_lang: dict[str, dict[str, int]] = {}
    for p in pairs:
        lang_stats = by_lang.setdefault(
            str(p["parentLanguage"]), {"pass": 0, "near_miss": 0, "fail": 0}
        )
        lang_stats[str(p["bucket"])] += 1

    total = len(pairs)
    passes = sum(1 for p in pairs if p["bucket"] == "pass")
    near = sum(1 for p in pairs if p["bucket"] == "near_miss")
    fails = sum(1 for p in pairs if p["bucket"] == "fail")

    report = {
        "status": "scored",
        "fixtures": total,
        "pass": passes,
        "near_miss": near,
        "fail": fails,
        "passRate": round(passes / total, 3) if total else 0.0,
        "byLanguage": by_lang,
        "details": pairs,
        "tiers": {
            "tf_cosine": {
                "active": True,
                "passThreshold": args.pass_threshold,
                "nearThreshold": args.near_threshold,
            },
            "indic_sbert_cosine": {
                "active": args.use_embeddings,
                "model": args.embedding_model if args.use_embeddings else None,
                "passThreshold": args.embedding_pass_threshold,
                "nearThreshold": args.embedding_near_threshold,
            },
            "llm_judge": {
                "active": args.use_judge,
                "model": args.judge_model if args.use_judge else None,
                "passThreshold": args.judge_pass_threshold,
                "nearThreshold": args.judge_near_threshold,
            },
        },
        "scoredAt": datetime.now(UTC).isoformat(),
        "notes": (
            "A fixture passes overall only if it passes EVERY active tier. "
            "Strictest-tier-wins aggregation prevents a high TF cosine from "
            "masking a low LLM-judge score (or vice versa)."
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
        help="TF cosine >= this is `pass` (default: 0.85)",
    )
    parser.add_argument(
        "--near-threshold",
        type=float,
        default=0.70,
        help="TF cosine in [near, pass) is `near_miss` (default: 0.70)",
    )

    parser.add_argument(
        "--use-embeddings",
        action="store_true",
        help=(
            "layer IndicSBERT cosine on top of TF cosine. Loads "
            "~500 MB of model weights on first call. Requires the "
            "[eval] extra (`uv sync --extra eval`)."
        ),
    )
    parser.add_argument(
        "--embedding-model",
        type=str,
        default=DEFAULT_EMBEDDING_MODEL,
        help=f"sentence-transformers model id (default: {DEFAULT_EMBEDDING_MODEL})",
    )
    parser.add_argument(
        "--embedding-pass-threshold",
        type=float,
        default=0.80,
        help="IndicSBERT cosine >= this is `pass` (default: 0.80)",
    )
    parser.add_argument(
        "--embedding-near-threshold",
        type=float,
        default=0.65,
        help="IndicSBERT cosine in [near, pass) is `near_miss` (default: 0.65)",
    )

    parser.add_argument(
        "--use-judge",
        action="store_true",
        help=(
            "layer Gemini-2.5-Pro LLM-as-judge on top. Costs ~$0.10 per "
            "22-fixture run. Requires --judge-api-key (or "
            "GOOGLE_GENAI_API_KEY env var)."
        ),
    )
    parser.add_argument(
        "--judge-model",
        type=str,
        default=DEFAULT_JUDGE_MODEL,
        help=f"Gemini model id for the judge (default: {DEFAULT_JUDGE_MODEL})",
    )
    parser.add_argument(
        "--judge-api-key",
        type=str,
        default=os.environ.get("PARITY_JUDGE_API_KEY")
        or os.environ.get("GOOGLE_GENAI_API_KEY", ""),
        help=(
            "Gemini API key for the judge. Falls back to "
            "PARITY_JUDGE_API_KEY then GOOGLE_GENAI_API_KEY env vars. "
            "MUST be a real key when --use-judge is set."
        ),
    )
    parser.add_argument(
        "--judge-pass-threshold",
        type=float,
        default=0.80,
        help="LLM-judge axis-average >= this is `pass` (default: 0.80)",
    )
    parser.add_argument(
        "--judge-near-threshold",
        type=float,
        default=0.65,
        help="LLM-judge axis-average in [near, pass) is `near_miss` (default: 0.65)",
    )

    args = parser.parse_args(argv)

    return asyncio.run(run(args))


if __name__ == "__main__":
    sys.exit(main())
