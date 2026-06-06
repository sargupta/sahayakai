"""Cross-stack parity guard for `AllowedFlow` / `LiveAllowedFlow`.

The Pydantic Literal types in `vidya/schemas.py:AllowedFlow` and
`vidya_voice/schemas.py:LiveAllowedFlow` are the wire source of truth.
`scripts/codegen_ts.py` regenerates a TS literal union from them into
`sahayakai-main/src/lib/sidecar/types.generated.ts` (two positions:
`LiveToolDefinition.flow` and `VidyaAction.flow`).

The bug this test prevents: a flow value (`instant-answer`, committed
in e119fc10e) was hand-added to the TS file only. The next regeneration
of `types.generated.ts` would silently strip it because the Pydantic
source didn't carry it. This test ensures every value in the Python
Literal appears in BOTH `flow:` positions of the generated TS, and that
`instant-answer` specifically lives in both stacks.

Runs as a unit test in CI alongside the other vidya schema tests.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import get_args

import pytest

from sahayakai_agents.agents.vidya.schemas import AllowedFlow
from sahayakai_agents.agents.vidya_voice.schemas import LiveAllowedFlow

pytestmark = pytest.mark.unit


# Two parents up from sahayakai-agents/tests/unit → repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]
_TS_FILE = (
    _REPO_ROOT / "sahayakai-main" / "src" / "lib" / "sidecar" / "types.generated.ts"
)

# Match `flow: 'a' | 'b' | ...;` in either VidyaAction or LiveToolDefinition.
# We extract every `flow:` line and parse the single-quoted literals.
_FLOW_LINE_RE = re.compile(r"^\s*flow:\s*(.+?);\s*$", re.MULTILINE)
_LITERAL_RE = re.compile(r"'([^']+)'")


def _parse_ts_flow_unions(ts_source: str) -> list[set[str]]:
    """Return one set of literal values per `flow:` line in the TS file.

    The generated file has TWO such lines today (LiveToolDefinition and
    VidyaAction). Both must contain the full Python `AllowedFlow` set.
    """
    flow_lines = _FLOW_LINE_RE.findall(ts_source)
    return [set(_LITERAL_RE.findall(line)) for line in flow_lines]


class TestAllowedFlowParity:
    def test_ts_file_exists(self) -> None:
        assert _TS_FILE.exists(), (
            f"Expected generated TS at {_TS_FILE} — run "
            "`python scripts/codegen_ts.py` from sahayakai-agents/."
        )

    def test_instant_answer_in_python_allowed_flow(self) -> None:
        assert "instant-answer" in get_args(AllowedFlow)

    def test_instant_answer_in_python_live_allowed_flow(self) -> None:
        assert "instant-answer" in get_args(LiveAllowedFlow)

    def test_instant_answer_in_every_ts_flow_union(self) -> None:
        """Hard guard for the bug we just fixed (commit e119fc10e
        hand-edited TS only; codegen would have stripped it)."""
        unions = _parse_ts_flow_unions(_TS_FILE.read_text(encoding="utf-8"))
        assert len(unions) >= 2, (
            "Expected at least two `flow:` literal unions in the generated "
            f"TS file ({_TS_FILE}). Found {len(unions)}."
        )
        for idx, values in enumerate(unions):
            assert "instant-answer" in values, (
                f"`instant-answer` missing from TS flow union #{idx} "
                f"({sorted(values)}). The next codegen run will strip it "
                "unless the Pydantic AllowedFlow Literal carries the value. "
                "See qa/results/lane-F/PYDANTIC_ENUM_SYNC.md."
            )

    def test_python_allowed_flow_is_subset_of_every_ts_flow_union(self) -> None:
        """Every Python `AllowedFlow` value must appear in every TS
        `flow:` literal position. Catches the more general case where any
        Python value drifts ahead of the TS regen, not just instant-answer."""
        py_values = set(get_args(AllowedFlow))
        unions = _parse_ts_flow_unions(_TS_FILE.read_text(encoding="utf-8"))
        for idx, ts_values in enumerate(unions):
            missing = py_values - ts_values
            assert not missing, (
                f"TS flow union #{idx} is missing Python values: "
                f"{sorted(missing)}. Regenerate with "
                "`python scripts/codegen_ts.py` from sahayakai-agents/."
            )
