"""Class gate: re-extracting the Riya workflow can never write a real provider id.

The bug this catches: `scripts/extract_riya_workflow.py` copied the export's
`version_id` into the tracked `riya_workflow.json`, so every re-extraction put
the live agent's real ElevenLabs version id back into the public repository
(and the app's id gate, which then knew only three prefixes, stayed green).

The extractor now writes a fixed made-up version id and refuses to write a file
that would carry any ElevenLabs-shaped id. Real-shaped ids below are built by
concatenation so this file itself never holds one.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

# CI selects tests by marker (ci-agents.yml: -m "unit or integration or behavioral"); unmarked = never run.
pytestmark = pytest.mark.unit

AGENTS_ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = AGENTS_ROOT / "src" / "sahayakai_agents" / "telephony" / "riya_workflow.json"
REAL_BODY = "0601" + "m6hcabcdefghijklmnopqrstu"  # time-prefixed base 36, like a live id


def _extractor():
    path = AGENTS_ROOT / "scripts" / "extract_riya_workflow.py"
    spec = importlib.util.spec_from_file_location("extract_riya_workflow", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _export(version_id: str, base_prompt: str = "You are Riya.") -> dict:
    """The smallest ElevenLabs agent export extract() reads."""
    unconditional = {"type": "unconditional"}
    return {
        "name": "Riya (test export)",
        "version_id": version_id,
        "conversation_config": {
            "agent": {
                "language": "en",
                "first_message": "Hello, I'm Riya.",
                "prompt": {
                    "prompt": base_prompt,
                    "llm": "test-llm",
                    "tools": [{"name": "end_call", "description": "End the call."}],
                },
            },
            "conversation": {"max_duration_seconds": 300},
            "turn": {
                "turn_timeout": 7,
                "silence_end_call_timeout": 20,
                "soft_timeout_config": {"timeout_seconds": 3},
            },
        },
        "workflow": {
            "nodes": {
                "start_node": {"type": "start", "edge_order": ["edge_to_school"]},
                "node_school": {
                    "type": "override_agent",
                    "label": "School",
                    "additional_prompt": "School call.",
                },
            },
            "edges": {
                "edge_to_school": {"forward_condition": unconditional, "target": "node_school"},
            },
        },
        "platform_settings": {
            "data_collection": {"outcome": {"type": "string", "description": "How it ended."}},
        },
    }


def test_the_export_version_id_is_never_copied() -> None:
    ex = _extractor()
    data = ex.extract(_export("agtvrsn_" + REAL_BODY))
    assert data["source"]["version_id"] == ex.REDACTED_VERSION_ID
    text = ex.render(data)
    assert REAL_BODY not in text
    assert ex.provider_ids(text) == []


def test_any_provider_id_in_the_output_refuses_the_write(tmp_path: Path) -> None:
    ex = _extractor()
    prompt = "Transfer to agent_" + REAL_BODY + " or conv_" + REAL_BODY
    data = ex.extract(_export("agtvrsn_" + REAL_BODY, base_prompt=prompt))
    with pytest.raises(ValueError, match="refusing to write") as refused:
        ex.render(data)
    # The refusal names the kind and the last 2 characters only: logs are public too.
    assert REAL_BODY not in str(refused.value)
    assert "agent_…tu" in str(refused.value) and "conv_…tu" in str(refused.value)


def test_the_detector_knows_every_kind_and_spares_made_up_ids() -> None:
    ex = _extractor()
    for kind in ("agent", "phnum", "agtbrch", "agtvrsn", "conv", "btcal", "tool"):
        assert ex.provider_ids(f'"{kind}_{REAL_BODY}"') == [f"{kind}_…tu"]
    assert ex.provider_ids(ex.REDACTED_VERSION_ID) == []
    made_up = "agent_" + "fakeagent1".ljust(28, "0") + " phnum_" + "0" * 28
    assert ex.provider_ids(made_up) == []
    assert ex.provider_ids("node_athithi_guest_feedback edge_route_to_safe_exit") == []


def test_the_tracked_workflow_carries_no_provider_id() -> None:
    ex = _extractor()
    text = WORKFLOW.read_text(encoding="utf-8")
    assert ex.provider_ids(text) == []
    assert json.loads(text)["source"]["version_id"] == ex.REDACTED_VERSION_ID
