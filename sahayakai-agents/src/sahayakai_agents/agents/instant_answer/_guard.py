"""Behavioural guard for the instant-answer agent — self-contained.

Phase B §B.1. We import the SHARED helpers (forbidden phrases, script
match, confusable folding) from `_behavioural.py` but keep the
instant-answer-specific composite + length + URL-shape rules INSIDE
this package so the existing module stays untouched. Pattern:

  - shared, broadly applicable rules: `_behavioural.py` (parent-call
    + lesson-plan + vidya all reuse)
  - specialist-specific composite + length + niche rules: per-package
    `_guard.py` (this file)

Why keep this separate from `_behavioural.py`:
  - Adding here doesn't risk merge conflicts with future shared-rule
    edits.
  - Each specialist's behavioural envelope is its own concern; the
    shared module shouldn't grow another section every time we add an
    agent.
  - Localised guards make per-agent overrides (e.g. video-storyteller
    needs a wider word cap) ergonomic.

Audit cross-reference: P0 #15 (role-confusion injection), P0 #75
(hand-rolled emitter coverage), P1 #21 (PII leak via ValidationError).
"""
from __future__ import annotations

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)

# Instant answers are paragraph-length pedagogical prose. Hard cap at 1500
# words to defend against runaway model output. The schema caps at 8000
# chars (roughly 1500 Hindi words / 1300 English words). Below that we
# enforce a floor so a 1-word "ok" never lands.
INSTANT_ANSWER_MIN_WORDS = 5
INSTANT_ANSWER_MAX_WORDS = 1500

# Allow only YouTube-search URLs in `videoSuggestionUrl`. The prompt
# instructs the model to use the search-results URL form; anything else
# (e.g. specific watch?v=... IDs) gets rejected because Gemini sometimes
# hallucinates IDs that don't exist. Search URLs are always valid.
_VIDEO_URL_PREFIX = "https://www.youtube.com/results?search_query="
_VIDEO_URL_MAX_LEN = 500


def assert_instant_answer_length(answer_text: str) -> None:
    """Cap instant-answer length at the prose budget."""
    word_count = len(answer_text.split())
    assert INSTANT_ANSWER_MIN_WORDS <= word_count <= INSTANT_ANSWER_MAX_WORDS, (
        f"Instant-answer length out of range: {word_count} words "
        f"(expected {INSTANT_ANSWER_MIN_WORDS}-{INSTANT_ANSWER_MAX_WORDS})"
    )


def assert_instant_answer_video_url_shape(url: str | None) -> None:
    """Validate the videoSuggestionUrl is either None or a YouTube
    search URL with a non-empty query.

    Hard-rejects:
      - URLs that don't start with the YouTube search prefix.
      - URLs with empty `search_query=` (no query terms).
      - URLs longer than 500 chars (defends against runaway URL
        generation).
    """
    if url is None:
        return
    assert len(url) <= _VIDEO_URL_MAX_LEN, (
        f"videoSuggestionUrl too long ({len(url)} > {_VIDEO_URL_MAX_LEN})"
    )
    assert url.startswith(_VIDEO_URL_PREFIX), (
        f"videoSuggestionUrl must use YouTube search-results URL form "
        f"({_VIDEO_URL_PREFIX}<query>). Got: {url[:100]}"
    )
    query_part = url[len(_VIDEO_URL_PREFIX):]
    assert query_part.strip(), (
        "videoSuggestionUrl has empty search query"
    )


def assert_instant_answer_response_rules(
    *,
    answer_text: str,
    language: str,
    video_suggestion_url: str | None,
) -> None:
    """Composite assertion called by the instant-answer router
    post-generation guard.

    Four checks:
    - **forbidden phrases** — same hardened set as parent-call /
      lesson-plan / vidya. Confusable / NFKC / ZWJ hardening applies.
    - **script match** — Unicode-range check at 85 % alpha-in-range.
    - **length** — 5-1500 words. Defends against runaway prose.
    - **video URL shape** — None OR YouTube search URL with non-empty
      query. Defends against hallucinated specific video IDs.

    Fail-closed in the router: any assertion failure → 502.
    """
    assert_no_forbidden_phrases(answer_text)
    assert_script_matches_language(answer_text, language)
    assert_instant_answer_length(answer_text)
    assert_instant_answer_video_url_shape(video_suggestion_url)


__all__ = [
    "INSTANT_ANSWER_MAX_WORDS",
    "INSTANT_ANSWER_MIN_WORDS",
    "assert_instant_answer_length",
    "assert_instant_answer_response_rules",
    "assert_instant_answer_video_url_shape",
]
