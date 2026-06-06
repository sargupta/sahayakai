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
    _collapse_nullable_anyof,
    _drop_bounds,
    _simplify_schema_for_gemini,
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


# ─── Phase 1b: `anyOf [T, null]` collapse + bounds stripping ────────────────


def test_collapse_nullable_anyof_flattens_string_or_null() -> None:
    node = {
        "title": "TeacherInstructions",
        "anyOf": [{"type": "string"}, {"type": "null"}],
    }
    _collapse_nullable_anyof(node)
    assert node["type"] == "string"
    # Title preserved as an annotation sibling.
    assert node["title"] == "TeacherInstructions"
    assert "anyOf" not in node


def test_collapse_nullable_anyof_handles_either_order() -> None:
    node = {"anyOf": [{"type": "null"}, {"type": "integer"}]}
    _collapse_nullable_anyof(node)
    assert node["type"] == "integer"
    assert "anyOf" not in node


def test_collapse_nullable_anyof_flattens_nested_object_branch() -> None:
    node = {
        "anyOf": [
            {"type": "object", "properties": {"x": {"type": "string"}}},
            {"type": "null"},
        ],
    }
    _collapse_nullable_anyof(node)
    assert node["type"] == "object"
    assert node["properties"]["x"]["type"] == "string"
    assert "anyOf" not in node


def test_collapse_nullable_anyof_leaves_multi_branch_union_alone() -> None:
    """`anyOf` with 3+ branches or non-null branches is a real union — keep it."""
    node = {
        "anyOf": [
            {"type": "string"},
            {"type": "integer"},
            {"type": "null"},
        ],
    }
    _collapse_nullable_anyof(node)
    # Untouched — collapsing this would change semantics.
    assert "anyOf" in node
    assert len(node["anyOf"]) == 3


def test_collapse_nullable_anyof_recurses_into_properties_and_items() -> None:
    node = {
        "type": "object",
        "properties": {
            "nullable_str": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "list_of_objects": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "nullable_int": {
                            "anyOf": [{"type": "integer"}, {"type": "null"}],
                        },
                    },
                },
            },
        },
    }
    _collapse_nullable_anyof(node)
    assert node["properties"]["nullable_str"]["type"] == "string"
    assert "anyOf" not in node["properties"]["nullable_str"]
    items = node["properties"]["list_of_objects"]["items"]
    assert items["properties"]["nullable_int"]["type"] == "integer"
    assert "anyOf" not in items["properties"]["nullable_int"]


def test_drop_bounds_strips_array_and_string_limits() -> None:
    node = {
        "type": "array",
        "minItems": 1,
        "maxItems": 10,
        "items": {"type": "string", "minLength": 1, "maxLength": 500},
    }
    _drop_bounds(node)
    assert "minItems" not in node
    assert "maxItems" not in node
    assert "minLength" not in node["items"]
    assert "maxLength" not in node["items"]
    # Core shape preserved.
    assert node["type"] == "array"
    assert node["items"]["type"] == "string"


def test_drop_bounds_strips_numeric_and_pattern_constraints() -> None:
    node = {
        "type": "object",
        "properties": {
            "score": {"type": "integer", "minimum": 0, "maximum": 100},
            "code": {"type": "string", "pattern": "^[A-Z]+$"},
        },
    }
    _drop_bounds(node)
    assert "minimum" not in node["properties"]["score"]
    assert "maximum" not in node["properties"]["score"]
    assert "pattern" not in node["properties"]["code"]
    assert node["properties"]["score"]["type"] == "integer"
    assert node["properties"]["code"]["type"] == "string"


def test_simplify_schema_for_gemini_is_idempotent() -> None:
    node = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "x": {"anyOf": [{"type": "string"}, {"type": "null"}]},
            "ys": {
                "type": "array",
                "minItems": 1,
                "items": {"type": "string", "maxLength": 100},
            },
        },
    }
    _simplify_schema_for_gemini(node)
    snapshot = {
        "additional": "additionalProperties" in node,
        "anyof_x": "anyOf" in node["properties"]["x"],
        "x_type": node["properties"]["x"].get("type"),
        "minItems": "minItems" in node["properties"]["ys"],
        "maxLength": "maxLength" in node["properties"]["ys"]["items"],
    }
    _simplify_schema_for_gemini(node)
    assert snapshot == {
        "additional": False,
        "anyof_x": False,
        "x_type": "string",
        "minItems": False,
        "maxLength": False,
    }


def test_gemini_response_schema_collapses_pydantic_optional_fields() -> None:
    """End-to-end: a Pydantic model with `T | None = None` fields emits
    `anyOf [T, null]`. After `gemini_response_schema`, those must be
    flattened so Gemini's state compiler doesn't see them as forks.
    """
    from pydantic import BaseModel, ConfigDict

    class _OptionalShape(BaseModel):
        model_config = ConfigDict(extra="forbid")
        required: str
        maybe: str | None = None

    schema = gemini_response_schema(_OptionalShape)
    assert schema["properties"]["maybe"]["type"] == "string"
    assert "anyOf" not in schema["properties"]["maybe"]


def test_gemini_response_schema_drops_min_items_on_arrays() -> None:
    from pydantic import BaseModel, ConfigDict, Field

    class _ArrayShape(BaseModel):
        model_config = ConfigDict(extra="forbid")
        items: list[str] = Field(min_length=1)

    schema = gemini_response_schema(_ArrayShape)
    items_field = schema["properties"]["items"]
    assert items_field["type"] == "array"
    assert "minItems" not in items_field
    assert "min_items" not in items_field


def test_quiz_generator_core_schema_has_no_anyof_null_branches() -> None:
    """Live-bug guard for the Phase 1b root cause.

    `QuizGeneratorCore` has three nullable top-level fields
    (`teacherInstructions`, `gradeLevel`, `subject`) plus one nullable
    field inside `QuizQuestion.options`. Together with the two enum
    fields per question and the unbounded `questions[]` array, those
    `anyOf [T, null]` forks were what tipped Gemini's constraint
    compiler past `too many states for serving`. This test pins the
    Phase 1b fix: every wire schema fed to Gemini for the quiz output
    must be free of `anyOf [..., null]` branches.
    """
    from sahayakai_agents.agents.quiz.schemas import QuizGeneratorCore

    schema = gemini_response_schema(QuizGeneratorCore)

    def _walk_for_null_anyof(node: object, path: str = "$") -> list[str]:
        found: list[str] = []
        if isinstance(node, dict):
            any_of = node.get("anyOf")
            if isinstance(any_of, list):
                has_null = any(
                    isinstance(b, dict) and b.get("type") == "null"
                    for b in any_of
                )
                if has_null:
                    found.append(path)
            for k, v in node.items():
                found.extend(_walk_for_null_anyof(v, f"{path}.{k}"))
        elif isinstance(node, list):
            for i, item in enumerate(node):
                found.extend(_walk_for_null_anyof(item, f"{path}[{i}]"))
        return found

    leftovers = _walk_for_null_anyof(schema)
    assert leftovers == [], (
        f"QuizGeneratorCore wire schema still has anyOf[null] branches: {leftovers}"
    )
