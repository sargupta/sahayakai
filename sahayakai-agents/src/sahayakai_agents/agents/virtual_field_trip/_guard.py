"""Behavioural guard for virtual field-trip agent (Phase D.3)."""
from __future__ import annotations

from typing import Any

from ..._behavioural import (
    assert_no_forbidden_phrases,
    assert_script_matches_language,
)


def _flatten_text(title: str, stops: list[dict[str, Any]]) -> str:
    parts: list[str] = [title]
    for stop in stops:
        for key in (
            "name", "description", "educationalFact", "reflectionPrompt",
            "culturalAnalogy", "explanation",
        ):
            parts.append(stop.get(key, ""))
    return " ".join(p for p in parts if p)


def assert_google_earth_url_shape(stops: list[dict[str, Any]]) -> None:
    """Ensure each stop's googleEarthUrl is well-shaped.

    Accepts both `https://earth.google.com/...` and Google search URLs
    that point at the location (some Genkit responses use search URLs
    so we follow that convention).
    """
    for i, stop in enumerate(stops):
        url = stop.get("googleEarthUrl", "")
        assert isinstance(url, str), f"Stop {i} googleEarthUrl is not a string"
        assert (
            url.startswith("https://earth.google.com/")
            or url.startswith("https://www.google.com/")
            or url.startswith("https://google.com/")
        ), (
            f"Stop {i} googleEarthUrl must be a Google Earth or "
            f"Google search URL; got: {url[:100]}"
        )


def assert_virtual_field_trip_response_rules(
    *,
    title: str,
    stops: list[dict[str, Any]],
    language: str,
) -> None:
    flattened = _flatten_text(title, stops)
    assert_no_forbidden_phrases(flattened)
    assert_script_matches_language(flattened, language)
    assert_google_earth_url_shape(stops)


__all__ = [
    "assert_google_earth_url_shape",
    "assert_virtual_field_trip_response_rules",
]
