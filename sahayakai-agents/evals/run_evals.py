"""Run the eval suite against the live sidecar.

Invocation:

    uv run python -m evals.run_evals --agent vidya \\
        --golden-set evals/golden_set/vidya.json

Add `--dry-run` to load the golden set + dispatch table without
hitting the sidecar — useful for smoke-testing the runner itself, and
the only mode that runs in CI today.

Output: per-axis scores + aggregate, written to
`evals/results/{agent}_{ts}.json`. The file is git-ignored locally
but operators commit promotion-gate baselines via PR.

Phase R.3 deliverable. See `evals/__init__.py` for context.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from collections.abc import Mapping
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx

from evals.scorer import (
    ScoreResult,
    parse_trait,
    score_labse_similarity,
    score_language_match,
    score_length,
    score_safety,
)

# ---- Agent dispatch table ---------------------------------------------

# Every agent's request body shape lives in
# `src/sahayakai_agents/agents/<name>/schemas.py`. We do NOT import
# those Pydantic models here because the runner is meant to work even
# against a sidecar built on a *different* schema revision. Instead,
# each entry below tells us:
#
# - `endpoint`: the wire path to POST to.
# - `extract_output`: how to pull the prose blob to score out of the
#   JSON response (different agents put it under different keys).
# - `expected_lang_field`: which input field carries the language
#   code, so the scorer can use the right Unicode range.

@dataclass(frozen=True)
class AgentDispatch:
    name: str
    endpoint: str
    extract_output: str  # dotted path into the response JSON
    expected_lang_field: str  # dotted path into the input JSON


_DISPATCH: dict[str, AgentDispatch] = {
    "lesson_plan": AgentDispatch(
        name="lesson_plan",
        endpoint="/v1/lesson-plan/generate",
        # Lesson-plan response wraps activity prose; we concatenate
        # title + objectives + activity descriptions for scoring.
        extract_output="__lesson_plan_prose__",
        expected_lang_field="language",
    ),
    "instant_answer": AgentDispatch(
        name="instant_answer",
        endpoint="/v1/instant-answer/answer",
        extract_output="answer",
        expected_lang_field="language",
    ),
    "parent_call": AgentDispatch(
        name="parent_call",
        endpoint="/v1/parent-call/reply",
        extract_output="reply",
        expected_lang_field="parentLanguage",
    ),
    "parent_message": AgentDispatch(
        name="parent_message",
        endpoint="/v1/parent-message/generate",
        extract_output="message",
        # parent-message uses LANGUAGE NAME ("Hindi", not "hi").
        # We map it before invoking the language-match scorer.
        expected_lang_field="parentLanguage",
    ),
    "vidya": AgentDispatch(
        name="vidya",
        endpoint="/v1/vidya/orchestrate",
        # VIDYA's wire response always sets `response`; we score that
        # blob. `intent` parity is checked via the trait
        # `expected_intent: <flow>` in vidya.json.
        extract_output="response",
        expected_lang_field="detectedLanguage",
    ),
    "virtual_field_trip": AgentDispatch(
        name="virtual_field_trip",
        endpoint="/v1/virtual-field-trip/plan",
        # Virtual field trip wraps prose across `stops[].description +
        # educationalFact + reflectionPrompt`. The runner concatenates.
        extract_output="__field_trip_prose__",
        expected_lang_field="language",
    ),
}


# ---- Language name → BCP47 alias ---------------------------------------

# parent-message uses language NAMES on the wire (`"Hindi"`); the
# behavioural script-match check wants the BCP47-ish code (`"hi"`).
# Same map as `LANGUAGE_TO_BCP47` in
# `sahayakai-main/src/ai/flows/parent-message-generator.ts`.
_LANG_NAME_TO_CODE: dict[str, str] = {
    "English": "en",
    "Hindi": "hi",
    "Tamil": "ta",
    "Telugu": "te",
    "Kannada": "kn",
    "Malayalam": "ml",
    "Bengali": "bn",
    "Marathi": "mr",
    "Gujarati": "gu",
    "Punjabi": "pa",
    "Odia": "or",
}


def _resolve_lang(raw: str | None) -> str:
    """Normalise the various `language` inputs across agents to a
    BCP47-ish code that `assert_script_matches_language` recognises."""
    if not raw:
        return "en"
    if raw in _LANG_NAME_TO_CODE:
        return _LANG_NAME_TO_CODE[raw]
    # BCP47 prefix collapse: "en-IN" → "en". Same approach as the
    # production guard which only consults the language part.
    return raw.split("-", 1)[0].lower()


# ---- Output extraction --------------------------------------------------


def _extract_output(dispatch: AgentDispatch, response: dict[str, Any]) -> str:
    """Pull the prose blob to score out of the response. Agents with
    structured output (lesson-plan stops + activities) get a flattened
    concatenation."""
    if dispatch.extract_output == "__lesson_plan_prose__":
        return _flatten_lesson_plan(response)
    if dispatch.extract_output == "__field_trip_prose__":
        return _flatten_field_trip(response)
    # Simple dotted path resolver. None of our agents have nested
    # output keys today so this is single-level, but keep the shape
    # general for future fields like `output.text`.
    cur: Any = response
    for part in dispatch.extract_output.split("."):
        if not isinstance(cur, Mapping):
            return ""
        cur = cur.get(part, "")
    return cur if isinstance(cur, str) else json.dumps(cur, ensure_ascii=False)


def _flatten_lesson_plan(response: Mapping[str, Any]) -> str:
    """Concatenate title + objectives + activity descriptions into one
    prose blob suitable for length / language / safety scoring."""
    parts: list[str] = []
    title = response.get("title", "")
    if title:
        parts.append(str(title))
    objectives = response.get("objectives") or []
    if isinstance(objectives, list):
        parts.extend(str(o) for o in objectives if isinstance(o, str))
    activities = response.get("activities") or []
    if isinstance(activities, list):
        for act in activities:
            if isinstance(act, Mapping):
                desc = act.get("description", "")
                if desc:
                    parts.append(str(desc))
    return "\n\n".join(parts)


def _flatten_field_trip(response: Mapping[str, Any]) -> str:
    """Concatenate title + each stop's description + educationalFact
    + reflectionPrompt for scoring."""
    parts: list[str] = []
    title = response.get("title", "")
    if title:
        parts.append(str(title))
    stops = response.get("stops") or []
    if isinstance(stops, list):
        for stop in stops:
            if isinstance(stop, Mapping):
                for key in ("description", "educationalFact", "reflectionPrompt"):
                    val = stop.get(key, "")
                    if val:
                        parts.append(str(val))
    return "\n\n".join(parts)


# ---- Trait → scorer dispatch ------------------------------------------


def _apply_traits(
    *,
    output_text: str,
    expected_lang: str,
    reference: str,
    traits: list[str],
) -> list[ScoreResult]:
    """Resolve each trait string in `traits` to a scorer call.

    Unknown traits return a 1.0 score with a `unrecognised` note rather
    than 0.0 — they're operator typos, not regressions. The runner
    surfaces them in the per-case log so they get fixed.
    """
    results: list[ScoreResult] = []
    for trait in traits:
        name, params = parse_trait(trait)
        if name == "passes_safety":
            results.append(score_safety(output_text))
        elif name == "matches_language":
            results.append(score_language_match(output_text, expected_lang))
        elif name == "min_word_count":
            min_w = int(params.get("value", 0))
            # Default upper bound is the production lesson-plan ceiling.
            results.append(score_length(output_text, min_w, 5000))
        elif name == "max_word_count":
            max_w = int(params.get("value", 5000))
            results.append(score_length(output_text, 1, max_w))
        elif name == "labse_similarity":
            results.append(score_labse_similarity(output_text, reference))
        else:
            results.append(ScoreResult(
                axis=name, score=1.0,
                note="unrecognised trait — skipped",
            ))
    return results


# ---- Runner orchestration ----------------------------------------------


@dataclass
class CaseResult:
    """One row in the final report."""

    case_id: str
    input: dict[str, Any]
    output: dict[str, Any] | None
    output_text: str
    scores: list[ScoreResult] = field(default_factory=list)
    error: str | None = None


def _aggregate(scores: list[ScoreResult]) -> float:
    """Mean across all axes. Empty list → 0.0 (the case yielded no
    measurements, so it's worse than a 0/N case which produced data)."""
    if not scores:
        return 0.0
    return sum(s.score for s in scores) / len(scores)


async def _post_to_sidecar(
    client: httpx.AsyncClient,
    base_url: str,
    dispatch: AgentDispatch,
    body: dict[str, Any],
) -> dict[str, Any]:
    """POST one case to the sidecar; raise httpx.HTTPStatusError on
    non-2xx so the runner records a per-case error rather than silently
    scoring an error blob."""
    url = base_url.rstrip("/") + dispatch.endpoint
    resp = await client.post(url, json=body, timeout=30.0)
    resp.raise_for_status()
    return resp.json()


async def _run_case(
    *,
    client: httpx.AsyncClient,
    base_url: str,
    dispatch: AgentDispatch,
    case: dict[str, Any],
    case_id: str,
    dry_run: bool,
) -> CaseResult:
    """Run one golden-set case end-to-end."""
    inp = case.get("input", {})
    traits = case.get("expected_output_traits", []) or []
    reference = case.get("reference", "") or ""
    expected_lang = _resolve_lang(_get_dotted(inp, dispatch.expected_lang_field))

    if dry_run:
        # `--dry-run` skips the live POST. We still exercise trait
        # parsing + scorer dispatch using the reference text as the
        # output stand-in, so a malformed trait surfaces.
        return CaseResult(
            case_id=case_id,
            input=inp,
            output=None,
            output_text=reference,
            scores=_apply_traits(
                output_text=reference,
                expected_lang=expected_lang,
                reference=reference,
                traits=traits,
            ),
        )

    try:
        response = await _post_to_sidecar(client, base_url, dispatch, inp)
    except httpx.HTTPStatusError as exc:
        return CaseResult(
            case_id=case_id, input=inp, output=None, output_text="",
            error=f"HTTP {exc.response.status_code}: {exc.response.text[:300]}",
        )
    except (httpx.RequestError, json.JSONDecodeError) as exc:
        return CaseResult(
            case_id=case_id, input=inp, output=None, output_text="",
            error=f"{type(exc).__name__}: {exc}",
        )

    output_text = _extract_output(dispatch, response)
    scores = _apply_traits(
        output_text=output_text,
        expected_lang=expected_lang,
        reference=reference,
        traits=traits,
    )
    return CaseResult(
        case_id=case_id,
        input=inp,
        output=response,
        output_text=output_text,
        scores=scores,
    )


def _get_dotted(obj: Mapping[str, Any], path: str) -> str | None:
    """Resolve a dotted path against `obj`. Returns None if any step
    misses; returns the string at the leaf otherwise."""
    cur: Any = obj
    for part in path.split("."):
        if not isinstance(cur, Mapping):
            return None
        cur = cur.get(part)
        if cur is None:
            return None
    return cur if isinstance(cur, str) else None


async def _run_suite(
    *,
    agent: str,
    golden_set_path: Path,
    base_url: str,
    dry_run: bool,
) -> dict[str, Any]:
    dispatch = _DISPATCH.get(agent)
    if dispatch is None:
        raise ValueError(
            f"Unknown agent: {agent!r}. "
            f"Choose one of: {sorted(_DISPATCH)}",
        )
    if not golden_set_path.exists():
        raise FileNotFoundError(f"Golden set not found: {golden_set_path}")

    cases = json.loads(golden_set_path.read_text(encoding="utf-8"))
    if not isinstance(cases, list):
        raise ValueError(
            f"Golden set must be a JSON array, got {type(cases).__name__}",
        )

    started = time.perf_counter()
    results: list[CaseResult] = []
    async with httpx.AsyncClient() as client:
        for idx, case in enumerate(cases):
            case_id = case.get("id") or f"{agent}-{idx:03d}"
            result = await _run_case(
                client=client,
                base_url=base_url,
                dispatch=dispatch,
                case=case,
                case_id=case_id,
                dry_run=dry_run,
            )
            results.append(result)

    duration = time.perf_counter() - started

    # Per-axis aggregate across all cases.
    axis_buckets: dict[str, list[float]] = {}
    for r in results:
        for s in r.scores:
            axis_buckets.setdefault(s.axis, []).append(s.score)
    per_axis = {
        axis: sum(v) / len(v) if v else 0.0
        for axis, v in axis_buckets.items()
    }
    overall = (
        sum(_aggregate(r.scores) for r in results) / len(results)
        if results else 0.0
    )

    return {
        "agent": agent,
        "endpoint": dispatch.endpoint,
        "case_count": len(cases),
        "dry_run": dry_run,
        "started_unix": int(time.time() - duration),
        "duration_s": round(duration, 3),
        "overall_score": round(overall, 4),
        "per_axis": {k: round(v, 4) for k, v in sorted(per_axis.items())},
        "cases": [_case_to_dict(r) for r in results],
    }


def _case_to_dict(r: CaseResult) -> dict[str, Any]:
    return {
        "case_id": r.case_id,
        "input": r.input,
        "output_text": r.output_text[:2000],  # truncate for log readability
        "scores": [asdict(s) for s in r.scores],
        "aggregate": round(_aggregate(r.scores), 4),
        "error": r.error,
    }


# ---- CLI entry point ---------------------------------------------------


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="evals.run_evals",
        description="Run the offline eval suite for one ADK sidecar agent.",
    )
    parser.add_argument(
        "--agent", required=True,
        choices=sorted(_DISPATCH),
        help="Which agent's golden set to run.",
    )
    parser.add_argument(
        "--golden-set",
        type=Path,
        default=None,
        help=(
            "Path to the JSON golden-set file. Defaults to "
            "evals/golden_set/{agent}.json relative to the repo root."
        ),
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8080",
        help="Sidecar base URL. Set to the staging URL for shadow runs.",
    )
    parser.add_argument(
        "--results-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "results",
        help="Where to write the JSON report. Defaults to evals/results/.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help=(
            "Skip live sidecar POSTs; exercise trait parsing + scorer "
            "dispatch using the reference text as a stand-in."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    repo_root = Path(__file__).resolve().parent.parent
    golden_set_path = (
        args.golden_set
        if args.golden_set is not None
        else repo_root / "evals" / "golden_set" / f"{args.agent}.json"
    )
    args.results_dir.mkdir(parents=True, exist_ok=True)

    report = asyncio.run(_run_suite(
        agent=args.agent,
        golden_set_path=golden_set_path,
        base_url=args.base_url,
        dry_run=args.dry_run,
    ))

    ts = int(time.time())
    out_path = args.results_dir / f"{args.agent}_{ts}.json"
    out_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(  # noqa: T201 — CLI surface
        f"agent={args.agent} cases={report['case_count']} "
        f"overall={report['overall_score']:.3f} "
        f"per_axis={report['per_axis']} -> {out_path}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
