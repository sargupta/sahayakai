"""Per-axis scorer functions for the offline eval suite.

Every scorer returns a `float in [0.0, 1.0]` so axes compose into a
single aggregate without per-axis weighting maths sprinkled across the
runner. A score of `1.0` means "passes the check"; `0.0` means
"fails". Continuous scorers (`score_labse_similarity`) interpolate.

Scorers MUST NOT raise on bad input — the suite runs over 100+ cases
and we want every case scored even if one is malformed. Bad input
returns `0.0` and a sibling `note` so the runner can log the reason.

Phase R.3 deliverable. See `evals/__init__.py` for context.
"""
from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from sahayakai_agents._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


@dataclass(frozen=True)
class ScoreResult:
    """One scorer's verdict on one output. `note` carries the
    user-facing explanation when `score < 1.0` (or always for
    continuous scorers like LaBSE)."""

    axis: str
    score: float
    note: str = ""


# ---- Programmatic scorers (zero-LLM, deterministic) --------------------


def score_safety(output: str) -> ScoreResult:
    """1.0 if `assert_no_forbidden_phrases` passes; 0.0 otherwise.

    Uses the same hardened forbidden-phrase scan that the live router
    fail-closes on, so an eval failure here means the model produced
    output that would have been 502'd in production. That's the worst
    possible regression.
    """
    if not isinstance(output, str) or not output.strip():
        return ScoreResult(axis="safety", score=0.0, note="empty output")
    try:
        assert_no_forbidden_phrases(output)
    except AssertionError as exc:
        return ScoreResult(axis="safety", score=0.0, note=str(exc)[:300])
    return ScoreResult(axis="safety", score=1.0)


def score_language_match(output: str, expected_lang: str) -> ScoreResult:
    """1.0 if `assert_script_matches_language` passes for `expected_lang`.

    Skips (returns 1.0) for unknown language codes — same semantics as
    the production guard. Empty / non-string output → 0.0.
    """
    if not isinstance(output, str) or not output.strip():
        return ScoreResult(
            axis="language_match", score=0.0, note="empty output",
        )
    try:
        assert_script_matches_language(output, expected_lang)
    except AssertionError as exc:
        return ScoreResult(
            axis="language_match", score=0.0, note=str(exc)[:300],
        )
    return ScoreResult(
        axis="language_match", score=1.0,
        note=f"expected_lang={expected_lang!r}",
    )


def score_length(output: str, min_w: int, max_w: int) -> ScoreResult:
    """1.0 if word count is within `[min_w, max_w]`; 0.0 otherwise.

    Word count uses `str.split()` — same algorithm as the production
    `assert_lesson_plan_length` so eval and runtime agree.
    """
    if not isinstance(output, str):
        return ScoreResult(
            axis="length", score=0.0, note="non-string output",
        )
    n = len(output.split())
    if min_w <= n <= max_w:
        return ScoreResult(
            axis="length", score=1.0, note=f"{n} words",
        )
    return ScoreResult(
        axis="length", score=0.0,
        note=f"{n} words (expected {min_w}-{max_w})",
    )


# ---- Semantic similarity (LaBSE with Jaccard fallback) -----------------


def _jaccard(a: str, b: str) -> float:
    """Simple Jaccard index over word sets. Used as the fallback when
    `sentence-transformers` is not installed (e.g. CI runner without
    the `eval` extra)."""
    set_a = set(_tokens(a))
    set_b = set(_tokens(b))
    if not set_a and not set_b:
        return 1.0
    if not set_a or not set_b:
        return 0.0
    intersection = len(set_a & set_b)
    union = len(set_a | set_b)
    return intersection / union if union > 0 else 0.0


def _tokens(text: str) -> Iterable[str]:
    """Lower-case word tokens. Naïve but consistent across reference
    and output, which is what Jaccard cares about."""
    return (tok for tok in text.lower().split() if tok)


# Cached LaBSE model — loading the SentenceTransformer is ~3s + ~500MB
# of weights, so we share one instance across the whole eval run.
_LABSE_MODEL: Any = None
_LABSE_LOAD_FAILED = False


def _load_labse() -> Any:
    """Lazy-load LaBSE. Returns `None` if `sentence-transformers` is
    not installed OR the load fails (e.g. no internet to fetch
    weights). Guarded by a module-level flag so we only attempt the
    import once per process."""
    global _LABSE_MODEL, _LABSE_LOAD_FAILED  # noqa: PLW0603
    if _LABSE_MODEL is not None:
        return _LABSE_MODEL
    if _LABSE_LOAD_FAILED:
        return None
    try:
        from sentence_transformers import SentenceTransformer  # noqa: PLC0415
    except ImportError:
        _LABSE_LOAD_FAILED = True
        return None
    try:
        _LABSE_MODEL = SentenceTransformer("sentence-transformers/LaBSE")
    except (OSError, RuntimeError, ValueError):
        # OSError: weights download failed (no internet on CI runner).
        # RuntimeError: torch device mismatch.
        # ValueError: malformed model card.
        _LABSE_LOAD_FAILED = True
        return None
    return _LABSE_MODEL


def score_labse_similarity(output: str, reference: str) -> ScoreResult:
    """Semantic similarity in [0, 1].

    Uses LaBSE (Language-agnostic BERT Sentence Embedding) via
    `sentence-transformers` when available — LaBSE is the right tool
    for cross-lingual similarity because it trained on 109 languages
    including the 11 Indic ones we care about.

    Falls back to Jaccard token overlap when `sentence-transformers`
    isn't installed. Jaccard is a degraded signal (it conflates
    "same words different meaning" with "same meaning different
    words"), but on English / Devanagari / shared-script reference
    pairs it correlates well enough to flag obvious regressions.

    Empty inputs → 0.0. Both empty → 1.0 (trivially identical).
    """
    if not isinstance(output, str) or not isinstance(reference, str):
        return ScoreResult(
            axis="labse_similarity", score=0.0,
            note="non-string input",
        )
    if not output.strip() and not reference.strip():
        return ScoreResult(
            axis="labse_similarity", score=1.0,
            note="both empty",
        )
    if not output.strip() or not reference.strip():
        return ScoreResult(
            axis="labse_similarity", score=0.0,
            note="one side empty",
        )

    model = _load_labse()
    if model is None:
        score = _jaccard(output, reference)
        return ScoreResult(
            axis="labse_similarity", score=score,
            note=f"jaccard fallback ({score:.3f})",
        )

    # Cosine similarity on LaBSE embeddings → values in [-1, 1].
    # We rescale to [0, 1] linearly so it composes with binary scorers.
    try:
        embeds = model.encode([output, reference], convert_to_numpy=True)
        # NumPy import is implicit via sentence-transformers; guard the
        # math anyway in case the embed call returns a Python list.
        import numpy as np  # noqa: PLC0415
        a, b = embeds[0], embeds[1]
        denom = (np.linalg.norm(a) * np.linalg.norm(b)) or 1.0
        cos = float(np.dot(a, b) / denom)
    except (RuntimeError, ValueError, ImportError) as exc:
        score = _jaccard(output, reference)
        return ScoreResult(
            axis="labse_similarity", score=score,
            note=f"labse failed ({exc!r}); jaccard={score:.3f}",
        )

    rescaled = max(0.0, min(1.0, (cos + 1.0) / 2.0))
    return ScoreResult(
        axis="labse_similarity", score=rescaled,
        note=f"cos={cos:.3f}",
    )


# ---- Trait dispatcher --------------------------------------------------

# `expected_output_traits` entries from the golden set are strings.
# Some are bare axis names (`"passes_safety"`, `"matches_language"`);
# some carry an inline parameter (`"min_word_count: 200"`,
# `"max_word_count: 5000"`). The runner parses these into scorer
# invocations via `parse_trait` below.


def parse_trait(trait: str) -> tuple[str, dict[str, Any]]:
    """Parse a trait string like `"min_word_count: 200"` into
    `("min_word_count", {"value": 200})`.

    Bare traits (`"passes_safety"`) parse to `(trait, {})`. Unknown
    formats fall through as bare. Invalid integers degrade gracefully
    rather than raising.
    """
    if ":" not in trait:
        return trait.strip(), {}
    name, _, raw = trait.partition(":")
    name = name.strip()
    raw = raw.strip()
    try:
        return name, {"value": int(raw)}
    except ValueError:
        return name, {"value": raw}
