"""Monkey-patch google-genai's schema transformer to strip
`additionalProperties` recursively before the request hits Gemini.

Background
----------
Pydantic models with `model_config = ConfigDict(extra="forbid")` (most of our
`*Core` output schemas) emit `additionalProperties: false` in
`model_json_schema()`. The google-genai SDK forwards that field to Gemini's
`generation_config.response_schema`, where it is rejected with:

    INVALID_ARGUMENT. Unknown name "additional_properties" at
    'generation_config.response_schema': Cannot find field.

This affects every sidecar AI flow that uses `output_schema=...` on an ADK
`LlmAgent` OR `response_schema=...` on a direct google-genai call. The bug
surfaced after the Phase E + Phase U promotions (which moved 13 flows onto
Pydantic-derived schemas).

Fix
---
We wrap `google.genai._transformers.process_schema` with a thin shim that
calls the original function, then strips every nested `additionalProperties`
key from the in-place schema. This works for both the direct google-genai
SDK and the ADK runtime, since ADK ultimately funnels through the same
transformer.

We avoid touching the Pydantic schemas themselves so other consumers (TS
codegen via `scripts/codegen_ts.py`, OpenAPI export, eval framework) keep
seeing the strict `extra="forbid"` semantics. Only the on-the-wire payload
to Gemini gets the field stripped.

Usage:

    # In main.py, before the FastAPI app starts:
    from sahayakai_agents.shared.genai_patch import apply_genai_schema_patch
    apply_genai_schema_patch()

Idempotent — safe to call multiple times.
"""
from __future__ import annotations

from typing import Any

_PATCHED = False


def _strip_additional_properties(node: Any) -> None:
    """Recursively drop `additionalProperties` (any case) from a JSON schema dict."""
    if isinstance(node, dict):
        # Drop both casings — the SDK normalises to camelCase before sending,
        # but during processing both forms can appear.
        for key in ("additionalProperties", "additional_properties"):
            node.pop(key, None)
        for value in node.values():
            _strip_additional_properties(value)
    elif isinstance(node, list):
        for item in node:
            _strip_additional_properties(item)


# ── Phase 1b: collapse `anyOf: [{T}, {null}]` to {T} ────────────────────────
#
# Pydantic emits `T | None` as `{"anyOf": [{"type": "T"}, {"type": "null"}]}`.
# Gemini's structured-output constraint compiler counts every `anyOf` branch
# as a fork in its state machine. With one nullable field at root that's
# tolerable; with three nullable fields nested inside an unbounded array of
# objects (quiz: `QuizGeneratorCore.questions[].options` + per-item enums +
# multiple nullable top-level fields), the cartesian product explodes past
# Gemini's `too many states for serving` ceiling.
#
# Genkit's Zod schemas express optionality as field-absence (the field is
# simply not in `required[]`); Zod's `nullable()` is rare. Mirroring that
# means flattening `anyOf [{T}, {null}]` to just `{T}` for the wire payload.
# Optional semantics are preserved by NOT adding the field to `required[]`
# (Pydantic already omits it correctly because `T | None = None` doesn't
# imply required-ness).
#
# This is a Gemini-wire-only transform. The Pydantic model still accepts
# null on the response (`T | None`), so a model that explicitly returns
# `null` instead of omitting the field still validates downstream. The
# only thing we lose is Gemini's permission to emit `null`; in practice
# Gemini's structured output omits the field when it has nothing to say
# rather than emitting `null`, so this matches real model behaviour.


def _collapse_nullable_anyof(node: Any) -> None:
    """Recursively flatten `anyOf: [{T}, {null}]` → {T}.

    Mutates ``node`` in place. Handles the four shapes Pydantic emits:

      1. ``{"anyOf": [{"type": "string"}, {"type": "null"}]}``
      2. ``{"anyOf": [{"type": "null"}, {"type": "string"}]}``
      3. ``{"anyOf": [{...inline object...}, {"type": "null"}]}``
      4. Nested under ``items`` / ``properties[*]`` / array elements.

    Pydantic also wraps anyOf with sibling ``title`` / ``description`` keys —
    we preserve them on the flattened result by copying them onto the
    non-null branch.
    """
    if isinstance(node, dict):
        any_of = node.get("anyOf")
        if isinstance(any_of, list) and len(any_of) == 2:
            null_branches = [
                b for b in any_of
                if isinstance(b, dict) and b.get("type") == "null"
            ]
            non_null = [
                b for b in any_of
                if not (isinstance(b, dict) and b.get("type") == "null")
            ]
            if len(null_branches) == 1 and len(non_null) == 1 and isinstance(non_null[0], dict):
                # Replace the anyOf with the non-null branch in place.
                surviving = dict(non_null[0])
                # Preserve top-level annotation siblings (title/description).
                for k, v in list(node.items()):
                    if k == "anyOf":
                        continue
                    surviving.setdefault(k, v)
                node.clear()
                node.update(surviving)
        # Recurse — the surviving / unchanged structure may contain nested
        # anyOf at deeper levels.
        for value in node.values():
            _collapse_nullable_anyof(value)
    elif isinstance(node, list):
        for item in node:
            _collapse_nullable_anyof(item)


# Bounds Gemini's constraint compiler treats as state-multipliers on
# unbounded arrays. Genkit's Zod baseline omits these on output schemas;
# we mirror that on the wire payload (Pydantic still enforces them on
# response validation).
_BOUNDS_KEYS_TO_DROP = (
    "minItems",
    "maxItems",
    "min_items",
    "max_items",
    "minLength",
    "maxLength",
    "min_length",
    "max_length",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "pattern",
)


def _drop_bounds(node: Any) -> None:
    """Recursively drop length / numeric / pattern constraints.

    Gemini's structured-output compiler multiplies constraint states per
    bounded field. Genkit's Zod output schemas have no bounds (the bounds
    live on the Zod *input* schema, server-side validated post-call). To
    mirror that envelope, strip bounds from the wire schema only — Pydantic
    still enforces them on the parsed response.
    """
    if isinstance(node, dict):
        for key in _BOUNDS_KEYS_TO_DROP:
            node.pop(key, None)
        for value in node.values():
            _drop_bounds(value)
    elif isinstance(node, list):
        for item in node:
            _drop_bounds(item)


def _simplify_schema_for_gemini(node: Any) -> None:
    """Apply every wire-only simplification in one pass (idempotent)."""
    _strip_additional_properties(node)
    _collapse_nullable_anyof(node)
    _drop_bounds(node)


def apply_genai_schema_patch() -> None:
    """Install the monkey-patch on `google.genai._transformers.process_schema`."""
    global _PATCHED
    if _PATCHED:
        return

    try:
        from google.genai import _transformers  # type: ignore[attr-defined]
    except ImportError:  # pragma: no cover — google-genai always present in prod
        return

    original = _transformers.process_schema

    def patched(schema: Any, *args: Any, **kwargs: Any) -> Any:
        result = original(schema, *args, **kwargs)
        _simplify_schema_for_gemini(schema)
        return result

    _transformers.process_schema = patched  # type: ignore[assignment]
    _PATCHED = True


__all__ = [
    "_collapse_nullable_anyof",
    "_drop_bounds",
    "_simplify_schema_for_gemini",
    "_strip_additional_properties",
    "apply_genai_schema_patch",
]
