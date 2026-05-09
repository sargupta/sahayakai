"""Tests for `shared/gemini_schema.py` and `shared/genai_patch.py`.

These cover the production-blocking bug surfaced by the comparator: Pydantic
models with `extra="forbid"` emit `additionalProperties: false` which Gemini's
structured-output API rejects. Both the explicit helper (`gemini_response_schema`)
and the global SDK monkey-patch (`apply_genai_schema_patch`) MUST recursively
strip every casing of the offending key without losing other schema fields.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from sahayakai_agents.shared.gemini_schema import gemini_response_schema
from sahayakai_agents.shared.genai_patch import (
    _strip_additional_properties,
    apply_genai_schema_patch,
)


class _Inner(BaseModel):
    model_config = ConfigDict(extra="forbid")
    value: str


class _Outer(BaseModel):
    """Outer model with a nested object + list of objects.

    Covers all four places a banned key can appear: root, nested object,
    array element, and the snake-case spelling that the SDK sometimes
    serialises before sending.
    """

    model_config = ConfigDict(extra="forbid")
    name: str = Field(..., min_length=1)
    inner: _Inner
    items: list[_Inner]


def _walk_for_banned(node: object, path: str = "$") -> list[str]:
    found: list[str] = []
    if isinstance(node, dict):
        for k, v in node.items():
            if k in {"additionalProperties", "additional_properties"}:
                found.append(f"{path}.{k}")
            found.extend(_walk_for_banned(v, f"{path}.{k}"))
    elif isinstance(node, list):
        for i, item in enumerate(node):
            found.extend(_walk_for_banned(item, f"{path}[{i}]"))
    return found


# ─── gemini_response_schema (explicit helper) ───────────────────────────────


def test_gemini_response_schema_strips_root_additional_properties() -> None:
    schema = gemini_response_schema(_Outer)
    assert _walk_for_banned(schema) == [], (
        f"helper left additionalProperties in: {_walk_for_banned(schema)}"
    )


def test_gemini_response_schema_keeps_required_fields() -> None:
    schema = gemini_response_schema(_Outer)
    assert "properties" in schema
    assert set(schema["required"]) >= {"name", "inner", "items"}
    assert schema["properties"]["name"]["type"] == "string"


def test_gemini_response_schema_inlines_refs() -> None:
    """`$defs` / `$ref` are stripped; nested objects must be inlined."""
    schema = gemini_response_schema(_Outer)
    assert "$defs" not in schema
    inner_via_field = schema["properties"]["inner"]
    assert inner_via_field.get("type") == "object"
    assert "properties" in inner_via_field
    assert "value" in inner_via_field["properties"]


def test_gemini_response_schema_handles_arrays_of_objects() -> None:
    schema = gemini_response_schema(_Outer)
    items_schema = schema["properties"]["items"]
    assert items_schema["type"] == "array"
    assert items_schema["items"]["type"] == "object"
    assert "value" in items_schema["items"]["properties"]


def test_gemini_response_schema_accepts_dict_input() -> None:
    raw = {
        "type": "object",
        "additionalProperties": False,
        "properties": {"x": {"type": "string", "additionalProperties": False}},
    }
    cleaned = gemini_response_schema(raw)
    assert _walk_for_banned(cleaned) == []


def test_gemini_response_schema_returns_independent_copy() -> None:
    raw: dict[str, object] = {"type": "object", "additionalProperties": False}
    cleaned = gemini_response_schema(raw)
    assert "additionalProperties" in raw  # caller's dict untouched
    assert "additionalProperties" not in cleaned


# ─── _strip_additional_properties + apply_genai_schema_patch ─────────────────


def test_strip_additional_properties_handles_both_casings() -> None:
    node = {
        "additionalProperties": False,
        "additional_properties": True,
        "properties": {
            "a": {"additionalProperties": False, "additional_properties": True, "type": "object"},
        },
    }
    _strip_additional_properties(node)
    assert "additionalProperties" not in node
    assert "additional_properties" not in node
    assert "additionalProperties" not in node["properties"]["a"]
    assert "additional_properties" not in node["properties"]["a"]
    assert node["properties"]["a"]["type"] == "object"  # unrelated keys kept


def test_strip_additional_properties_recurses_into_lists() -> None:
    node = {
        "type": "array",
        "items": {
            "type": "object",
            "additionalProperties": False,
            "properties": {"x": {"type": "string"}},
        },
    }
    _strip_additional_properties(node)
    assert "additionalProperties" not in node["items"]
    assert node["items"]["properties"]["x"]["type"] == "string"


def test_apply_genai_schema_patch_is_idempotent() -> None:
    apply_genai_schema_patch()
    apply_genai_schema_patch()  # second call must not double-wrap


def test_genai_patch_strips_after_process_schema_runs() -> None:
    """End-to-end: install the patch, run the SDK transformer, expect a
    stripped output. We construct a schema as the SDK would receive it
    from `model_json_schema()`, then call the patched transformer and
    assert no banned key survives.

    Order-resilient: integration tests in the same suite swap
    `sys.modules["google.genai"]` for a fake to avoid hitting Gemini.
    Pytest may run those first; if so the import of `_transformers`
    here would fail. We restore the real package before importing.
    """
    import importlib
    import sys

    if not hasattr(sys.modules.get("google.genai"), "__file__"):
        # A fake is present (no `__file__` attr). Drop it + the real
        # submodule cache entries so importlib re-loads the real SDK
        # from disk.
        for key in list(sys.modules):
            if key == "google.genai" or key.startswith("google.genai."):
                del sys.modules[key]
        # Force-reimport the real `google.genai` package.
        importlib.import_module("google.genai")
        # The patch's `_PATCHED` flag remembered True from an earlier
        # apply, but the freshly-reimported `_transformers` has no
        # wrapper attached. Reset the flag so the next apply rewrites
        # the new module's `process_schema`.
        from sahayakai_agents.shared import genai_patch as _gp
        _gp._PATCHED = False

    from google.genai import _transformers  # type: ignore[attr-defined]

    apply_genai_schema_patch()

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "x": {
                "type": "object",
                "additionalProperties": False,
                "properties": {"y": {"type": "string"}},
            },
            "ys": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {"z": {"type": "integer"}},
                },
            },
        },
    }
    _transformers.process_schema(schema, client=None)
    assert _walk_for_banned(schema) == [], _walk_for_banned(schema)
    # Ensure the patch didn't damage the rest of the schema.
    assert schema["type"] == "object"
    assert schema["properties"]["x"]["properties"]["y"]["type"] == "string"
    assert schema["properties"]["ys"]["items"]["properties"]["z"]["type"] == "integer"
