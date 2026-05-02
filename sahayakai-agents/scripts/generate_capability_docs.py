#!/usr/bin/env python3
"""Generate per-agent capability sheets from registry + schemas.

Phase Q.3 deliverable. External A2A consumers reading the agent card
get a JSON skill list from `/.well-known/agent.json`; this script
produces the human-readable companion — one markdown file per agent
sourced from:

- `agents/vidya/registry.py` (SUB_AGENTS, INLINE_AGENTS) — capability
  blurb + endpoint URL.
- `agents/{flow}/schemas.py` — Pydantic request + response models,
  rendered as JSON Schema for the I/O contract.
- `prompts/{flow}/*.handlebars` — prompt template, excerpted (first
  ~30 non-comment lines so the doc is browsable; full template stays
  source-of-truth in the file).
- `agents/{flow}/_guard.py` — behavioural rules (the module + each
  public assertion's docstring).
- `agents/{flow}/router.py` — structlog event names that fire on the
  request path.

Re-runnable in CI; the commit captures the current state as a snapshot
so `git diff` flags drift between code and docs.

Usage:
    cd sahayakai-agents
    uv run python scripts/generate_capability_docs.py

Output: 15 files at `docs/agents/{flow}.md` (one per agent in
SUB_AGENTS + INLINE_AGENTS + the 4 not-in-registry agents:
parent-call, parent-message, avatar-generator, vidya itself).
"""
from __future__ import annotations

import ast
import importlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# ---- Path setup ---------------------------------------------------------

_HERE = Path(__file__).resolve().parent
_REPO_ROOT = _HERE.parent
_SRC = _REPO_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

_PROMPTS_DIR = _REPO_ROOT / "prompts"
_AGENTS_DIR = _SRC / "sahayakai_agents" / "agents"
_DOCS_DIR = _REPO_ROOT / "docs" / "agents"


# ---- Agent inventory ----------------------------------------------------


@dataclass(frozen=True)
class AgentDoc:
    """Resolved metadata for one agent."""

    flow: str               # registry slug, e.g. "lesson-plan"
    package: str            # python package, e.g. "lesson_plan"
    prompts_dir: str        # prompts/<dir>, e.g. "lesson-plan"
    endpoint: str           # base path, e.g. "/v1/lesson-plan"
    capability: str         # one-line summary
    request_classes: list[str]
    response_classes: list[str]
    has_guard_module: bool  # True iff agents/<pkg>/_guard.py exists


# Agents in the VIDYA registry — inferred dynamically at runtime.
# Plus the 4 agents NOT in the registry (parent-call, parent-message,
# avatar-generator, vidya itself).
_NOT_IN_REGISTRY: tuple[tuple[str, str, str, str, str, list[str], list[str]], ...] = (
    # (flow, package, prompts_dir, endpoint, capability, requests, responses)
    (
        "parent-call",
        "parent_call",
        "parent-call",
        "/v1/parent-call",
        (
            "Multi-turn phone conversation with a parent in the parent's "
            "home language; structured English summary at end of call. "
            "Two endpoints: /reply (per-turn) and /summary (post-call)."
        ),
        ["AgentReplyRequest", "CallSummaryRequest"],
        ["AgentReplyResponse", "CallSummaryResponse"],
    ),
    (
        "parent-message",
        "parent_message",
        "parent-message",
        "/v1/parent-message",
        (
            "Multilingual parent-facing nudges. `reasonContext` and "
            "`languageCode` are server-rewritten as defence-in-depth "
            "against prompt injection."
        ),
        ["ParentMessageRequest"],
        ["ParentMessageResponse"],
    ),
    (
        "avatar-generator",
        "avatar_generator",
        "avatar-generator",
        "/v1/avatar-generator",
        (
            "Single image-generation call returning a base64 data URI for "
            "teacher avatars."
        ),
        ["AvatarGeneratorRequest"],
        ["AvatarGeneratorResponse"],
    ),
    (
        "vidya",
        "vidya",
        "vidya",
        "/v1/vidya",
        (
            "Supervisor / OmniOrb mic. Classifies natural-language teacher "
            "requests, extracts parameters, and either returns a "
            "VidyaAction for the OmniOrb client or delegates inline to "
            "instant-answer."
        ),
        ["VidyaRequest"],
        ["VidyaResponse"],
    ),
)


def _load_registry() -> tuple[Any, Any]:
    """Import the VIDYA registry; returns (SUB_AGENTS, INLINE_AGENTS)."""
    mod = importlib.import_module("sahayakai_agents.agents.vidya.registry")
    return mod.SUB_AGENTS, mod.INLINE_AGENTS


# Special-case mapping for registry flow slugs whose Python package
# (and prompts dir) name is NOT a straight `s/-/_/` substitution. The
# registry uses user-facing names (`quiz-generator`, `visual-aid-designer`)
# but the packages and prompt dirs are pithier (`quiz`, `visual_aid`).
_FLOW_PACKAGE_OVERRIDES: dict[str, str] = {
    "quiz-generator": "quiz",
    "visual-aid-designer": "visual_aid",
    "worksheet-wizard": "worksheet",
    "rubric-generator": "rubric",
    "instantAnswer": "instant_answer",
}

# Prompt dir mapping. Mostly mirrors the package mapping but keeps
# hyphens (filesystem convention).
_FLOW_PROMPTS_DIR_OVERRIDES: dict[str, str] = {
    "quiz-generator": "quiz",
    "visual-aid-designer": "visual-aid",
    "worksheet-wizard": "worksheet",
    "rubric-generator": "rubric",
    "instantAnswer": "instant-answer",
}


def _flow_to_package(flow: str) -> str:
    """`lesson-plan` → `lesson_plan`. Special-cased for the 5 flows
    whose package name diverges from the slug (see overrides above)."""
    if flow in _FLOW_PACKAGE_OVERRIDES:
        return _FLOW_PACKAGE_OVERRIDES[flow]
    return flow.replace("-", "_")


def _flow_to_prompts_dir(flow: str) -> str:
    """Map registry flow slug to its `prompts/<dir>/`."""
    if flow in _FLOW_PROMPTS_DIR_OVERRIDES:
        return _FLOW_PROMPTS_DIR_OVERRIDES[flow]
    return flow


def _classes_for_package(package: str) -> tuple[list[str], list[str]]:
    """Pull request / response class names from `agents/<pkg>/schemas.py`.

    A "Request" class ends with "Request"; a "Response" class ends with
    "Response". Vidya / instant-answer / lesson-plan also expose
    Core / Verdict / Variants names — we expose those as response-side
    auxiliaries when they're meaningful.
    """
    schema_file = _AGENTS_DIR / package / "schemas.py"
    if not schema_file.exists():
        return [], []
    src = schema_file.read_text(encoding="utf-8")
    tree = ast.parse(src)
    requests, responses = [], []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ClassDef):
            continue
        n = node.name
        if n.endswith("Request"):
            requests.append(n)
        elif n.endswith(("Response", "VariantsResponse")):
            responses.append(n)
    return requests, responses


def _build_inventory() -> list[AgentDoc]:
    """Compose the 15-agent inventory from registry + the 4 not-in-registry."""
    sub_agents, inline_agents = _load_registry()
    out: list[AgentDoc] = []

    for entry in tuple(sub_agents) + tuple(inline_agents):
        package = _flow_to_package(entry.flow)
        prompts_dir = _flow_to_prompts_dir(entry.flow)
        # Endpoint base = registry endpoint without trailing /<verb>.
        endpoint_base = "/".join(entry.endpoint.split("/")[:-1])
        requests, responses = _classes_for_package(package)
        has_guard = (_AGENTS_DIR / package / "_guard.py").exists()
        out.append(
            AgentDoc(
                flow=entry.flow,
                package=package,
                prompts_dir=prompts_dir,
                endpoint=endpoint_base,
                capability=entry.capability,
                request_classes=requests,
                response_classes=responses,
                has_guard_module=has_guard,
            )
        )

    for flow, package, prompts_dir, endpoint, cap, reqs, resps in _NOT_IN_REGISTRY:
        # Only include the explicit reqs/resps that actually exist in the
        # schemas.py — the hand-curated lists are a safety net, not a
        # promise. We trust the AST result.
        ast_reqs, ast_resps = _classes_for_package(package)
        actual_reqs = [c for c in reqs if c in ast_reqs]
        actual_resps = [c for c in resps if c in ast_resps]
        has_guard = (_AGENTS_DIR / package / "_guard.py").exists()
        out.append(
            AgentDoc(
                flow=flow,
                package=package,
                prompts_dir=prompts_dir,
                endpoint=endpoint,
                capability=cap,
                request_classes=actual_reqs,
                response_classes=actual_resps,
                has_guard_module=has_guard,
            )
        )
    return out


# ---- Section renderers ---------------------------------------------------


def _pydantic_json_schema(package: str, class_name: str) -> dict[str, Any] | None:
    """Import the Pydantic class and return `model_json_schema()`."""
    try:
        mod = importlib.import_module(f"sahayakai_agents.agents.{package}.schemas")
        cls = getattr(mod, class_name, None)
        if cls is None:
            return None
        if not hasattr(cls, "model_json_schema"):
            return None
        schema: dict[str, Any] = cls.model_json_schema()
        return schema
    except Exception as exc:  # pragma: no cover — defensive
        return {"_error": f"could not import {class_name}: {exc}"}


def _render_io_contract(doc: AgentDoc) -> str:
    """Render request + response Pydantic schemas as JSON Schema blocks."""
    sections: list[str] = []
    for class_name in doc.request_classes:
        schema = _pydantic_json_schema(doc.package, class_name)
        if schema is None:
            continue
        sections.append(f"#### Request: `{class_name}`\n")
        sections.append("```json")
        sections.append(json.dumps(schema, indent=2, ensure_ascii=False))
        sections.append("```\n")
    for class_name in doc.response_classes:
        schema = _pydantic_json_schema(doc.package, class_name)
        if schema is None:
            continue
        sections.append(f"#### Response: `{class_name}`\n")
        sections.append("```json")
        sections.append(json.dumps(schema, indent=2, ensure_ascii=False))
        sections.append("```\n")
    if not sections:
        return "_No Pydantic schemas detected in `schemas.py`._\n"
    return "\n".join(sections)


_HBS_COMMENT_RE = re.compile(r"\{\{!.*?\}\}", flags=re.DOTALL)


def _excerpt_handlebars(content: str, max_lines: int = 30) -> str:
    """Strip Handlebars `{{! ... }}` comments and return the first
    `max_lines` non-empty content lines."""
    stripped = _HBS_COMMENT_RE.sub("", content)
    lines: list[str] = []
    for raw in stripped.splitlines():
        line = raw.rstrip()
        if not line.strip():
            continue
        lines.append(line)
        if len(lines) >= max_lines:
            break
    return "\n".join(lines)


def _render_prompt_section(doc: AgentDoc) -> str:
    """List every Handlebars template in `prompts/<dir>/`, with an excerpt
    of the first one (the canonical / primary template)."""
    pdir = _PROMPTS_DIR / doc.prompts_dir
    if not pdir.exists():
        return f"_No prompt directory at `prompts/{doc.prompts_dir}/`._\n"
    files = sorted(pdir.glob("*.handlebars"))
    if not files:
        return f"_No `.handlebars` templates under `prompts/{doc.prompts_dir}/`._\n"
    parts: list[str] = []
    parts.append(f"Templates under `prompts/{doc.prompts_dir}/`:\n")
    for f in files:
        parts.append(f"- `{f.name}`")
    parts.append("")
    primary = files[0]
    parts.append(f"#### Excerpt: `{primary.name}` (first 30 non-comment lines)\n")
    parts.append("```handlebars")
    parts.append(_excerpt_handlebars(primary.read_text(encoding="utf-8")))
    parts.append("```\n")
    return "\n".join(parts)


def _render_behavioural_rules(doc: AgentDoc) -> str:
    """Pull docstrings from `_guard.py` (module + every public def).

    For agents without a `_guard.py` (parent-call, lesson-plan, vidya),
    document that they use `_behavioural.py` directly with no
    specialist-specific overrides.
    """
    if not doc.has_guard_module:
        return (
            "Uses the shared `_behavioural.py` envelope directly:\n"
            "- `assert_no_forbidden_phrases` — confusable-folded forbidden-phrase scan.\n"
            "- `assert_script_matches_language` — Unicode-range script check.\n\n"
            "No specialist-specific overrides. Length / element bounds are "
            "enforced at the Pydantic schema layer (see I/O Contract above).\n"
        )
    guard_file = _AGENTS_DIR / doc.package / "_guard.py"
    src = guard_file.read_text(encoding="utf-8")
    tree = ast.parse(src)
    out: list[str] = []
    mod_doc = ast.get_docstring(tree)
    if mod_doc:
        out.append("**Module docstring**\n")
        out.append("> " + mod_doc.strip().replace("\n", "\n> "))
        out.append("")
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef):
            continue
        if node.name.startswith("_"):
            continue
        fn_doc = ast.get_docstring(node)
        out.append(f"**`{node.name}()`**")
        if fn_doc:
            out.append("> " + fn_doc.strip().replace("\n", "\n> "))
        else:
            out.append("> _No docstring._")
        out.append("")
    return "\n".join(out)


# Match `log.<level>(`, capturing the first quoted event name argument.
# Used to pull every distinct structlog event from the router file.
_LOG_EVENT_RE = re.compile(
    r"""log\.(info|warning|error|debug)\s*\(\s*["']([a-zA-Z0-9_.]+)["']""",
)


def _render_observability(doc: AgentDoc) -> str:
    """Scan `router.py` for structlog event names + log levels."""
    router_file = _AGENTS_DIR / doc.package / "router.py"
    if not router_file.exists():
        return "_No `router.py` for this agent._\n"
    src = router_file.read_text(encoding="utf-8")
    events: dict[str, str] = {}  # event → level
    for match in _LOG_EVENT_RE.finditer(src):
        level, event = match.group(1), match.group(2)
        events.setdefault(event, level.upper())
    if not events:
        return "_No structlog events detected in router.py._\n"
    lines = ["| Event | Level |", "|---|---|"]
    for event in sorted(events):
        lines.append(f"| `{event}` | {events[event]} |")
    return "\n".join(lines) + "\n"


def _render_endpoint(doc: AgentDoc) -> str:
    """Pull every `@router.post("/<path>")` decorator out of router.py."""
    router_file = _AGENTS_DIR / doc.package / "router.py"
    if not router_file.exists():
        return f"_No `router.py` for this agent. Base prefix: `{doc.endpoint}`._\n"
    src = router_file.read_text(encoding="utf-8")
    paths: list[tuple[str, str]] = []  # (verb, full path)
    # Match `@<name>router.post(...)` or bare `@router.post(...)`. Some
    # agents use a per-package router name (e.g. `quiz_router`); others
    # use a bare `router` (e.g. `parent-call`, `lesson-plan`).
    for match in re.finditer(
        r"""@(?:[a-zA-Z_]\w*_)?router\.(post|get)\(\s*["']([^"']+)["']""", src,
    ):
        verb_word, sub_path = match.group(1), match.group(2)
        paths.append((verb_word.upper(), f"{doc.endpoint}{sub_path}"))
    if not paths:
        return f"Base prefix: `{doc.endpoint}`. No endpoints detected.\n"
    lines = [f"Base prefix: `{doc.endpoint}`\n", "| Verb | Path |", "|---|---|"]
    for verb_word, path in paths:
        lines.append(f"| `{verb_word}` | `{path}` |")
    return "\n".join(lines) + "\n"


# ---- Top-level renderer --------------------------------------------------


_DOC_TEMPLATE = """\
# {flow}

> {capability}

_Generated by `scripts/generate_capability_docs.py`. Re-run after every
schema, prompt, guard, or router change. Source of truth is the code._

## Overview

- **Registry slug:** `{flow}`
- **Python package:** `sahayakai_agents.agents.{package}`
- **Prompts directory:** `prompts/{prompts_dir}/`
- **Endpoint base:** `{endpoint}`
- **Has specialist `_guard.py`:** {has_guard}

## I/O contract

{io_contract}

## Prompt template

{prompt_section}

## Behavioural rules

{behavioural}

## Observability

Structured log events emitted on the request path (key off `event=...`
in Cloud Logging):

{observability}

## Endpoint URL

{endpoint_table}
"""


def render_agent_doc(doc: AgentDoc) -> str:
    return _DOC_TEMPLATE.format(
        flow=doc.flow,
        package=doc.package,
        prompts_dir=doc.prompts_dir,
        endpoint=doc.endpoint,
        capability=doc.capability,
        has_guard="yes" if doc.has_guard_module else "no (uses shared `_behavioural.py`)",
        io_contract=_render_io_contract(doc),
        prompt_section=_render_prompt_section(doc),
        behavioural=_render_behavioural_rules(doc),
        observability=_render_observability(doc),
        endpoint_table=_render_endpoint(doc),
    )


def main() -> int:
    _DOCS_DIR.mkdir(parents=True, exist_ok=True)
    inventory = _build_inventory()
    written = 0
    for doc in inventory:
        out_path = _DOCS_DIR / f"{doc.flow}.md"
        out_path.write_text(render_agent_doc(doc), encoding="utf-8")
        written += 1
    print(f"Wrote {written} per-agent capability sheets to {_DOCS_DIR}/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
