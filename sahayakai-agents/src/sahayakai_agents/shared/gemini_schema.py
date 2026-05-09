"""Pydantic → Gemini-safe response_schema helper.

The Gemini structured-output API (`generation_config.response_schema`) supports a
strict subset of OpenAPI 3 — notably it REJECTS any payload that contains the
`additionalProperties` field, even with the value `False`. Pydantic's default
`model_json_schema()` emits `additionalProperties: false` whenever the model
sets `model_config = ConfigDict(extra="forbid")` and `additionalProperties: true`
otherwise.

This helper takes a Pydantic class (or an already-built JSON schema dict),
recursively strips `additionalProperties` (and a few other unsupported keys
such as `$defs` resolution markers, `title`, `examples`, format hints Gemini
silently ignores), and returns a dict the google-genai SDK accepts.

Usage:

    from sahayakai_agents.shared.gemini_schema import gemini_response_schema

    config = GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=gemini_response_schema(InstantAnswerCore),
    )

NEVER pass the raw Pydantic class — that triggers the SDK's automatic
`model_json_schema()` path which produces the broken payload.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel

# Keys Gemini's structured-output endpoint rejects (HTTP 400 INVALID_ARGUMENT).
_BANNED_KEYS = frozenset(
    {
        "additionalProperties",
        "additional_properties",  # snake-case form the SDK sometimes emits
        # The following are silently ignored or cause inconsistent behaviour
        # depending on Gemini version. Strip for safety.
        "$defs",
        "definitions",
        "$schema",
        "$id",
        "discriminator",
        "examples",
        "default",
    }
)


def _strip(node: Any) -> Any:
    """Recursively drop `additionalProperties` and friends from a JSON schema."""
    if isinstance(node, dict):
        cleaned: dict[str, Any] = {}
        for key, value in node.items():
            if key in _BANNED_KEYS:
                continue
            cleaned[key] = _strip(value)
        return cleaned
    if isinstance(node, list):
        return [_strip(item) for item in node]
    return node


def _resolve_refs(schema: dict[str, Any]) -> dict[str, Any]:
    """Inline `$ref` so the cleaned schema works after `$defs` removal.

    Pydantic emits `$defs` for nested models; Gemini doesn't follow `$ref`
    reliably across the structured-output boundary. We resolve every
    `{"$ref": "#/$defs/Foo"}` into the inlined schema BEFORE stripping `$defs`.
    """
    defs = schema.get("$defs") or schema.get("definitions") or {}
    if not defs:
        return schema

    def resolve(node: Any) -> Any:
        if isinstance(node, dict):
            if "$ref" in node and isinstance(node["$ref"], str):
                ref = node["$ref"]
                # Only resolve internal $defs/definitions refs.
                prefix_defs = "#/$defs/"
                prefix_definitions = "#/definitions/"
                if ref.startswith(prefix_defs):
                    name = ref[len(prefix_defs) :]
                    target = defs.get(name)
                    if target is not None:
                        return resolve(target)
                if ref.startswith(prefix_definitions):
                    name = ref[len(prefix_definitions) :]
                    target = defs.get(name)
                    if target is not None:
                        return resolve(target)
            return {k: resolve(v) for k, v in node.items()}
        if isinstance(node, list):
            return [resolve(item) for item in node]
        return node

    return resolve(schema)


def gemini_response_schema(source: type[BaseModel] | dict[str, Any]) -> dict[str, Any]:
    """Return a Gemini-compatible JSON schema dict.

    Accepts either a Pydantic model class or an already-constructed JSON schema
    dict (handy for tests and one-off schemas). Always returns a fresh dict —
    callers can mutate the result without touching the source.
    """
    if isinstance(source, dict):
        raw: dict[str, Any] = source
    elif isinstance(source, type) and issubclass(source, BaseModel):
        raw = source.model_json_schema()
    else:  # pragma: no cover — defensive
        raise TypeError(
            f"gemini_response_schema expects a Pydantic model class or dict; got {type(source)!r}"
        )

    inlined = _resolve_refs(raw)
    cleaned = _strip(inlined)
    if not isinstance(cleaned, dict):  # pragma: no cover — _strip preserves shape
        raise ValueError("schema root must be a JSON object")
    return cleaned


__all__ = ["gemini_response_schema"]
