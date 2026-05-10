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
        _strip_additional_properties(schema)
        return result

    _transformers.process_schema = patched  # type: ignore[assignment]
    _PATCHED = True


__all__ = ["apply_genai_schema_patch"]
