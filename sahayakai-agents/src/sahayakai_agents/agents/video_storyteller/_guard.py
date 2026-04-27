"""Behavioural guard for video storyteller agent (Phase F.1).

Two surfaces to scan:

- The five category query lists (`pedagogy`, `storytelling`, `govtUpdates`,
  `courses`, `topRecommended`). Each must be 1-10 short search-string
  queries; each query is forbidden-phrase scanned. We do NOT script-check
  the queries themselves — they are YouTube search strings that may
  legitimately mix English transliteration with Indic script (e.g.
  "NISHTHA training हिंदी"). We DO bound their length to defend against
  a model dumping prose into the array.

- The `personalizedMessage` — narrative addressed to the teacher.
  Forbidden-phrase scanned AND script-matched against the user's
  preferred language (same convention as parent-call / lesson-plan).

A model that returns 0 queries in a category, or > 10, fails closed
(502). Genkit had no enforcement here; the structured output schema
caps to 10 but does not bound the lower side beyond `min_length=1`.
"""
from __future__ import annotations

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)

_CATEGORY_NAMES = (
    "pedagogy",
    "storytelling",
    "govtUpdates",
    "courses",
    "topRecommended",
)

# Search-query length bounds. Genkit prompt asks for "concise (3-6 words)";
# we accept up to 200 chars to allow the model some headroom for
# transliterated phrases without letting a 2000-char prose dump slip
# through.
_QUERY_MIN_CHARS = 2
_QUERY_MAX_CHARS = 200


def assert_query_count_per_category(
    *,
    pedagogy: list[str],
    storytelling: list[str],
    govtUpdates: list[str],
    courses: list[str],
    topRecommended: list[str],
) -> None:
    """Each category must have 1-10 entries (matches schema bounds).

    Pydantic already enforces this at parse time; we re-check at the
    guard layer because the router treats schema-pass + guard-pass as
    independent checks (defence in depth).
    """
    counts = {
        "pedagogy": len(pedagogy),
        "storytelling": len(storytelling),
        "govtUpdates": len(govtUpdates),
        "courses": len(courses),
        "topRecommended": len(topRecommended),
    }
    for name, n in counts.items():
        assert 1 <= n <= 10, (
            f"Category {name!r} has {n} queries; expected 1-10"
        )


def assert_query_shape(name: str, queries: list[str]) -> None:
    """Each search query must be a non-empty string within length bounds."""
    for i, q in enumerate(queries):
        assert isinstance(q, str), (
            f"Category {name!r} query[{i}] is not a string"
        )
        length = len(q.strip())
        assert _QUERY_MIN_CHARS <= length <= _QUERY_MAX_CHARS, (
            f"Category {name!r} query[{i}] length {length} out of "
            f"range ({_QUERY_MIN_CHARS}-{_QUERY_MAX_CHARS})"
        )


def assert_video_storyteller_response_rules(
    *,
    pedagogy: list[str],
    storytelling: list[str],
    govtUpdates: list[str],
    courses: list[str],
    topRecommended: list[str],
    personalized_message: str,
    language: str,
) -> None:
    """Composite assertion. Three groups of checks:

    1. Per-category bounds: 1-10 queries each.
    2. Per-query shape + forbidden-phrase scan across all queries.
    3. `personalizedMessage` forbidden-phrase + script-match.
    """
    assert_query_count_per_category(
        pedagogy=pedagogy,
        storytelling=storytelling,
        govtUpdates=govtUpdates,
        courses=courses,
        topRecommended=topRecommended,
    )
    by_name: dict[str, list[str]] = {
        "pedagogy": pedagogy,
        "storytelling": storytelling,
        "govtUpdates": govtUpdates,
        "courses": courses,
        "topRecommended": topRecommended,
    }
    for name in _CATEGORY_NAMES:
        assert_query_shape(name, by_name[name])
    # Run forbidden-phrase scan over the concatenated query corpus —
    # cheaper than per-query loop and equivalent for the regex set.
    flattened_queries = " ".join(
        q for queries in by_name.values() for q in queries
    )
    assert_no_forbidden_phrases(flattened_queries)

    # personalizedMessage gets both forbidden-phrase + script-match.
    assert_no_forbidden_phrases(personalized_message)
    assert_script_matches_language(personalized_message, language)


__all__ = [
    "assert_query_count_per_category",
    "assert_query_shape",
    "assert_video_storyteller_response_rules",
]
