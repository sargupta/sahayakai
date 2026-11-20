"""Extract the Riya school-calling workflow from an ElevenLabs agent export.

    python scripts/extract_riya_workflow.py <agent-export.json> [out.json]

Writes `src/sahayakai_agents/telephony/riya_workflow.json` by default: ONLY the
parts the Vobiz bridge runs (prompts, opening, routing, turn timings, the
end_call rules, data-collection fields). Everything that belongs to the
ElevenLabs runtime is dropped on purpose: voice ids, TTS/ASR settings, agent
ids, phone numbers, widget and access settings. Nothing here calls ElevenLabs.

The repository is public, so no provider resource id reaches the output: the
export's version id (provenance only, nothing reads it) is replaced by a fixed
made-up one, and the file is refused, not written, if any other ElevenLabs-shaped
id would land in it (the same shapes as the app's class gate,
sahayakai-main/src/__tests__/scripts/no-provider-identifiers.test.ts).

The export's workflow also carries a hotel guest-feedback branch ("Athithi").
That is a different agent sharing the same graph, not Riya; it is excluded and
its route is recorded as excluded so the bridge sends that context to the safe
exit rather than to an unrelated persona.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Stands in for the export's version id: visibly made up, so the tracked file
# never carries a real one.
REDACTED_VERSION_ID = "agtvrsn_" + "fakeversion".ljust(28, "0")

# ElevenLabs-shaped ids: a known prefix with any 20+ character body, or any short lowercase
# prefix with the time-prefixed base-36 body. Made-up bodies start with one digit four times,
# fake, localtest, other, source or simulated.
_NAMED_ID = re.compile(
    r"(?<![0-9a-z])(agent|phnum|agtbrch|agtvrsn)_([0-9a-z]{20,})(?![0-9a-z])"
)
_SHAPED_ID = re.compile(
    r"(?<![0-9a-z])([a-z]{2,10})_([0-9]{4}(?=[0-9a-z]*[a-z])[0-9a-z]{16,})(?![0-9a-z])"
)
_MADE_UP = re.compile(r"^(([0-9])\2{3}|fake|localtest|other|source|simulated)")

EXCLUDED_NODES = {"node_athithi_guest_feedback": "hotel guest-feedback agent, not Riya"}
DEFAULT_OUT = (
    Path(__file__).resolve().parents[1]
    / "src"
    / "sahayakai_agents"
    / "telephony"
    / "riya_workflow.json"
)


def provider_ids(text: str) -> list[str]:
    """Every real-looking provider id in `text`, masked to its kind and last 2 characters."""
    found: dict[int, str] = {}
    for pattern in (_NAMED_ID, _SHAPED_ID):
        for m in pattern.finditer(text):
            if m.start() not in found and not _MADE_UP.match(m.group(2)):
                found[m.start()] = f"{m.group(1)}_…{m.group(2)[-2:]}"
    return [found[k] for k in sorted(found)]


def render(data: dict) -> str:
    """The output file's text, or ValueError if a real provider id would be written."""
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    leaked = provider_ids(text)
    if leaked:
        raise ValueError(
            "refusing to write the workflow: it would carry provider id(s) "
            f"{', '.join(leaked)}. The repository is public; drop or replace them in extract()."
        )
    return text


def _load(path: str) -> dict:
    raw = Path(path).read_text(encoding="utf-8")
    return json.loads(raw[raw.find("{") : raw.rfind("}") + 1])


def _condition(cond: dict) -> dict:
    """Edge condition -> {"product_context": x, "call_purpose": y} (or {} = unconditional)."""
    if cond.get("type") == "unconditional":
        return {}
    expr = cond["expression"]
    leaves = expr["children"] if expr["type"] == "and_operator" else [expr]
    out: dict[str, str] = {}
    for leaf in leaves:
        if leaf["type"] != "eq_operator" or leaf["left"]["type"] != "dynamic_variable":
            raise ValueError(f"unsupported condition: {leaf}")
        out[leaf["left"]["name"]] = leaf["right"]["value"]
    return out


def extract(agent: dict) -> dict:
    cc = agent["conversation_config"]
    ag = cc["agent"]
    prompt = ag["prompt"]
    wf = agent["workflow"]
    tools = {t["name"]: t for t in prompt.get("tools") or []}

    nodes: dict[str, dict] = {}
    for nid, node in wf["nodes"].items():
        if node.get("type") != "override_agent" or nid in EXCLUDED_NODES:
            continue
        override = ((node.get("conversation_config") or {}).get("agent") or {}).get("prompt") or {}
        nodes[nid] = {
            "label": node.get("label"),
            "entry_behavior": node.get("entry_behavior"),
            # Appended to the base prompt (ElevenLabs "additional_prompt").
            "additional_prompt": node.get("additional_prompt") or "",
            # Replaces the base prompt entirely (safe exit only).
            "prompt_override": override.get("prompt"),
        }

    start = wf["nodes"]["start_node"]
    routes = []
    for eid in start["edge_order"]:
        edge = wf["edges"][eid]
        cond = edge["forward_condition"]
        routes.append(
            {
                "edge": eid,
                "label": cond.get("label"),
                "when": _condition(cond),
                "node": edge["target"],
                "excluded": EXCLUDED_NODES.get(edge["target"]),
            }
        )

    dc = agent["platform_settings"]["data_collection"]
    return {
        # Provenance only: the export's real version id is never written (the repository is public).
        "source": {"agent_name": agent.get("name"), "version_id": REDACTED_VERSION_ID},
        "language": ag.get("language"),
        "first_message": ag["first_message"],
        "disable_first_message_interruptions": ag.get("disable_first_message_interruptions"),
        "max_duration_seconds": cc["conversation"]["max_duration_seconds"],
        "max_duration_message": ag.get("max_conversation_duration_message"),
        "turn": {
            "turn_timeout": cc["turn"]["turn_timeout"],
            "silence_end_call_timeout": cc["turn"]["silence_end_call_timeout"],
            "soft_timeout_seconds": cc["turn"]["soft_timeout_config"]["timeout_seconds"],
        },
        "llm": {
            "model": prompt.get("llm"),
            "temperature": prompt.get("temperature"),
            "timezone": prompt.get("timezone"),
        },
        "base_prompt": prompt["prompt"],
        "tools": {
            "end_call": {"description": tools["end_call"]["description"]},
            "skip_turn": {"description": tools.get("skip_turn", {}).get("description", "")},
        },
        "data_collection": {
            k: {"type": v.get("type"), "description": v.get("description"), "enum": v.get("enum")}
            for k, v in dc.items()
        },
        "routes": routes,
        "nodes": nodes,
        "excluded_nodes": EXCLUDED_NODES,
    }


def main() -> None:
    src = sys.argv[1]
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_OUT
    data = extract(_load(src))
    text = render(data)  # refuses before anything is written
    out.write_text(text, encoding="utf-8")
    print(f"wrote {out} ({len(data['nodes'])} nodes, {len(data['routes'])} routes)")


if __name__ == "__main__":
    main()
