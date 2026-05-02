#!/usr/bin/env python3
"""Generate TypeScript types from the FastAPI OpenAPI spec.

Phase N.2 — forensic audit P1 #22 wiring fix. The original migration
plan called for codegen but only the parent_call slice was emitted.
That left 14 hand-typed sidecar clients drifting from the Pydantic
source of truth (e.g. `VidyaActionParams.topic` was required nullable
in TS but optional + nullable in Python — silent contract drift).

This script:
  1. Boots the FastAPI app and asks for `app.openapi()`.
  2. Walks `components.schemas` deterministically (alpha-sorted).
  3. Emits a single `types.generated.ts` covering every wire schema.
  4. Writes to two locations:
       - `dist/types.generated.ts` (preserves the existing CI guard)
       - `sahayakai-main/src/lib/sidecar/types.generated.ts`
         (so TS clients can `import { ... } from './types.generated'`).

CI runs this script then `git diff --exit-code dist/types.generated.ts`.
Drift between source and generated output fails the build.

Why hand-rolled and not `datamodel-codegen`:
  - `datamodel-codegen` does not ship a TypeScript output backend.
  - `openapi-typescript` (npm) is a fine alternative but adds a Node
    dep to a Python repo; we avoid the cross-stack tooling.
  - The hand-rolled path is ~150 lines, deterministic, dep-free.

Output format choices:
  - `Optional[T]` (anyOf [T, null]) without `required` → `T?: T | null`.
  - `Optional[T]` with `required` → `T: T | null`.
  - Required scalar → `T: T`.
  - `Literal[...]` → inline union of string literals.
  - Internal FastAPI schemas (`HTTPValidationError`, `ValidationError`)
    are skipped — they describe FastAPI's 422 envelope, not our wire
    contracts.

Determinism: schemas walked in `sorted()` order; field order follows
OpenAPI declaration order (which Pydantic guarantees from `model_fields`).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

# Add src/ to path so running from repo root works.
_HERE = Path(__file__).resolve().parent
_SRC = _HERE.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from sahayakai_agents.main import app  # noqa: E402

# Output paths.
_AGENTS_DIST = _HERE.parent / "dist" / "types.generated.ts"
# Two parents up from sahayakai-agents/scripts/ → repo root.
_REPO_ROOT = _HERE.parent.parent
_NEXTJS_OUT = (
    _REPO_ROOT / "sahayakai-main" / "src" / "lib" / "sidecar" / "types.generated.ts"
)

_BANNER = (
    "// GENERATED FROM sahayakai-agents FastAPI OpenAPI spec.\n"
    "// DO NOT EDIT. Regenerate via `python scripts/codegen_ts.py`.\n"
    "//\n"
    "// Source of truth: Pydantic models in sahayakai-agents/src/sahayakai_agents/\n"
    "// agents/*/schemas.py. TypeScript interfaces are emitted from those\n"
    "// models for consumption by the Next.js sidecar clients.\n"
    "//\n"
    "// Phase N.2 — Forensic audit P1 #22. The hand-typed `Sidecar*Request`\n"
    "// and `Sidecar*Response` shapes drifted from Python (most visibly\n"
    "// `VidyaActionParams.topic` was required nullable in TS, optional in\n"
    "// Python). Use these generated types in new code.\n"
)

# Skip FastAPI-internal schemas — they describe FastAPI's own 422
# validation envelope, not our wire contracts. Clients never reference
# them.
_SKIP_SCHEMAS: set[str] = {
    "HTTPValidationError",
    "ValidationError",
}


def _ts_type(prop: dict[str, Any]) -> str:  # noqa: PLR0911 — OpenAPI dispatcher reads cleanest with one return per branch
    """Map an OpenAPI property fragment to a TypeScript type expression.

    Only reads JSON Schema fields we actually use (`type`, `enum`,
    `const`, `items`, `anyOf`, `$ref`, `additionalProperties`). Anything
    else is `unknown`.
    """
    # $ref → strip the prefix, return the schema name.
    if "$ref" in prop:
        ref: str = prop["$ref"]
        return ref.rsplit("/", 1)[-1]

    # anyOf with null → Optional / nullable union.
    if "anyOf" in prop:
        variants = prop["anyOf"]
        non_null = [v for v in variants if v.get("type") != "null"]
        has_null = any(v.get("type") == "null" for v in variants)
        if len(non_null) == 1:
            inner = _ts_type(non_null[0])
            return f"{inner} | null" if has_null else inner
        # General union (rare in our schemas).
        return " | ".join(_ts_type(v) for v in variants)

    # const string — emit literal.
    if "const" in prop:
        return f"'{prop['const']}'"

    # Enum → inline union of string literals. Numeric enums fall through
    # to the type dispatch below.
    if "enum" in prop and prop.get("type") == "string":
        return " | ".join(f"'{v}'" for v in prop["enum"])

    t = prop.get("type")
    if t == "string":
        return "string"
    if t in {"integer", "number"}:
        return "number"
    if t == "boolean":
        return "boolean"
    if t == "array":
        items = prop.get("items", {})
        inner = _ts_type(items)
        # Wrap unions / nullables in parens before the `[]` so TS parses
        # them as `(A | B)[]` instead of `A | (B[])`. Conservative test:
        # any whitespace + `|` in the rendered type means we need parens.
        if " | " in inner:
            return f"({inner})[]"
        return f"{inner}[]"
    if t == "object":
        # Pydantic emits `additionalProperties` for `dict[str, str]`.
        ap = prop.get("additionalProperties")
        if isinstance(ap, dict):
            return f"Record<string, {_ts_type(ap)}>"
        return "Record<string, unknown>"

    return "unknown"


def _ts_interface(name: str, schema: dict[str, Any]) -> str:
    """Emit `export interface Name { ... }` for an OpenAPI object schema.

    A property is `?:` (optional) when the schema's `required` list does
    not contain it. The TS type itself preserves the OpenAPI nullability
    via `| null`.
    """
    properties: dict[str, Any] = schema.get("properties", {})
    required: set[str] = set(schema.get("required", []))

    description = schema.get("description")
    lines: list[str] = []
    if description:
        # JSDoc-format the docstring.
        lines.append("/**")
        for doc_line in description.splitlines():
            lines.append(f" * {doc_line}".rstrip())
        lines.append(" */")
    lines.append(f"export interface {name} {{")
    for field_name, prop in properties.items():
        ts_t = _ts_type(prop)
        optional = "" if field_name in required else "?"
        lines.append(f"  {field_name}{optional}: {ts_t};")
    lines.append("}")
    return "\n".join(lines)


def _ts_enum_alias(name: str, schema: dict[str, Any]) -> str:
    """Emit `export type Name = 'a' | 'b';` for a top-level string enum."""
    enum_values = schema["enum"]
    rendered = " | ".join(f"'{v}'" for v in enum_values)
    return f"export type {name} = {rendered};"


def _emit(spec: dict[str, Any]) -> str:
    schemas: dict[str, Any] = spec.get("components", {}).get("schemas", {})

    sections: list[str] = [_BANNER]

    # Walk schemas alphabetically for determinism.
    for name in sorted(schemas.keys()):
        if name in _SKIP_SCHEMAS:
            continue
        schema = schemas[name]
        # Top-level string enum surfaces as a named type alias.
        if "enum" in schema and schema.get("type") == "string":
            sections.append(_ts_enum_alias(name, schema))
            sections.append("")
            continue
        # Object schema.
        if schema.get("type") == "object" or "properties" in schema:
            sections.append(_ts_interface(name, schema))
            sections.append("")
            continue
        # Fallback: type alias from a primitive.
        sections.append(f"export type {name} = {_ts_type(schema)};")
        sections.append("")

    return "\n".join(sections).rstrip() + "\n"


def main() -> int:
    spec = app.openapi()
    output = _emit(spec)

    for out_path in (_AGENTS_DIST, _NEXTJS_OUT):
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(output, encoding="utf-8")
        try:
            rel = out_path.relative_to(_REPO_ROOT)
        except ValueError:
            rel = out_path
        print(f"[codegen_ts] wrote {rel} ({len(output)} bytes)")

    # Also keep the OpenAPI spec on disk for ad-hoc inspection. CI does
    # NOT diff this — it's a debug artefact.
    spec_path = _HERE.parent / "dist" / "openapi.json"
    spec_path.parent.mkdir(parents=True, exist_ok=True)
    spec_path.write_text(
        json.dumps(spec, indent=2, sort_keys=True), encoding="utf-8",
    )
    print(f"[codegen_ts] wrote {spec_path.relative_to(_REPO_ROOT)} (debug)")

    return 0


if __name__ == "__main__":
    sys.exit(main())
