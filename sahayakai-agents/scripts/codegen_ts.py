#!/usr/bin/env python3
"""Generate TypeScript types from the Pydantic source-of-truth schemas.

Writes `dist/types.generated.ts` for consumption by the Next.js side
(`sahayakai-main/src/lib/sidecar/types.ts` currently holds a
hand-written placeholder; it will import from here once both repos
settle).

CI runs this script then `git diff --exit-code dist/types.generated.ts`.
Drift between source and generated output fails the build.

Hand-rolled emitter rather than `datamodel-codegen` because:
- Our schema surface is small (~10 types) and stable.
- Avoids pulling in a heavy dev dep with its own upstream churn.
- Output shape is under our control, so we can match Next.js conventions.

Output is deterministic: key order follows the source-file declaration
order via `__dataclass_fields__` / `model_fields`.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Any, get_args

# Add src/ to path so running from repo root works.
_HERE = Path(__file__).resolve().parent
_SRC = _HERE.parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from pydantic import BaseModel  # noqa: E402

from sahayakai_agents.agents.parent_call.schemas import (  # noqa: E402
    AgentReplyRequest,
    AgentReplyResponse,
    CallQuality,
    CallSummaryRequest,
    CallSummaryResponse,
    ParentLanguage,
    ParentSentiment,
    TranscriptTurn,
    WireError,
    WireErrorEnvelope,
)

_BANNER = (
    "// GENERATED FROM sahayakai-agents/src/sahayakai_agents/agents/parent_call/schemas.py\n"
    "// DO NOT EDIT. Regenerate via `python scripts/codegen_ts.py`.\n"
    "//\n"
    "// Source of truth: the Pydantic models in schemas.py. TypeScript types\n"
    "// are generated from those models for consumption by the Next.js\n"
    "// sidecar client.\n"
)


def _ts_literal_union(py_literal: Any, name: str) -> str:
    """Emit `export type Name = 'a' | 'b' | 'c';` from a Literal[...]."""
    values = get_args(py_literal)
    rendered = " | ".join(f"'{v}'" for v in values)
    return f"export type {name} = {rendered};"


def _ts_type_from_annotation(ann: Any) -> str:
    """Map a Python annotation to a TypeScript type expression.

    Supports: str → string, int/float → number, bool → boolean,
    Optional[T] → T | null, list[T] → T[], Literal unions → inline union,
    nested BaseModel → reference by class name.
    """
    origin = getattr(ann, "__origin__", None)
    args = get_args(ann)

    # list[T]
    if origin in (list, tuple):
        inner = _ts_type_from_annotation(args[0]) if args else "unknown"
        return f"{inner}[]"

    # Optional[T] is Union[T, None] → expressed as `T | null` in TS.
    if origin is type(None):
        return "null"

    # Union / T | None
    if origin is not None and str(origin).endswith("Union") or origin is type(None):
        non_none = [a for a in args if a is not type(None)]
        if len(non_none) == 1:
            return _ts_type_from_annotation(non_none[0]) + " | null"

    # Literal[...]
    if getattr(ann, "__class__", None).__name__ == "_LiteralGenericAlias":
        return " | ".join(f"'{v}'" for v in args)

    # Pydantic models
    if isinstance(ann, type) and issubclass(ann, BaseModel):
        return ann.__name__

    # Primitives
    if ann is str:
        return "string"
    if ann in (int, float):
        return "number"
    if ann is bool:
        return "boolean"

    # Fallback for PEP 604 `A | B` unions (types.UnionType at runtime).
    from types import UnionType

    if isinstance(ann, UnionType):
        union_args = ann.__args__
        non_none = [a for a in union_args if a is not type(None)]
        if len(non_none) == 1 and len(union_args) > len(non_none):
            return _ts_type_from_annotation(non_none[0]) + " | null"
        return " | ".join(_ts_type_from_annotation(a) for a in union_args)

    return "unknown"


def _ts_interface(model: type[BaseModel]) -> str:
    """Emit a TypeScript interface for a Pydantic model."""
    lines = [f"export interface {model.__name__} {{"]
    for field_name, field_info in model.model_fields.items():
        ts_type = _ts_type_from_annotation(field_info.annotation)
        optional = "?" if not field_info.is_required() else ""
        lines.append(f"  {field_name}{optional}: {ts_type};")
    lines.append("}")
    return "\n".join(lines)


def _emit() -> str:
    sections: list[str] = [_BANNER]

    # Literal unions first — interfaces reference them.
    sections.append("// ---- Enums and literal unions --------------------------------------")
    sections.append(_ts_literal_union(ParentLanguage, "ParentLanguage"))
    sections.append(_ts_literal_union(ParentSentiment, "ParentSentiment"))
    sections.append(_ts_literal_union(CallQuality, "CallQuality"))

    sections.append("")
    sections.append("// ---- Transcript turn -----------------------------------------------")
    sections.append(_ts_interface(TranscriptTurn))

    sections.append("")
    sections.append("// ---- Reply (per-turn) ----------------------------------------------")
    sections.append(_ts_interface(AgentReplyRequest))
    sections.append("")
    sections.append(_ts_interface(AgentReplyResponse))

    sections.append("")
    sections.append("// ---- Summary (post-call) -------------------------------------------")
    sections.append(_ts_interface(CallSummaryRequest))
    sections.append("")
    sections.append(_ts_interface(CallSummaryResponse))

    sections.append("")
    sections.append("// ---- Error envelope ------------------------------------------------")
    sections.append(_ts_interface(WireError))
    sections.append("")
    sections.append(_ts_interface(WireErrorEnvelope))
    sections.append("")  # trailing newline

    return "\n".join(sections)


def main() -> int:
    output = _emit()
    out_path = _HERE.parent / "dist" / "types.generated.ts"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(output, encoding="utf-8")
    print(f"[codegen_ts] wrote {out_path.relative_to(_HERE.parent)} ({len(output)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
