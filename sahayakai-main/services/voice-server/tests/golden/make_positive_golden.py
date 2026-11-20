"""Regenerate golden/positive_feedback.json from a voice-server source tree.

The golden pins what a positive_feedback call said BEFORE the request-to-talk
change. It was produced from commit 71b365d18 (the deployed engine) with:

    git archive 71b365d18 sahayakai-main/services/voice-server | tar -x -C /tmp/base
    python tests/golden/make_positive_golden.py \
        /tmp/base/sahayakai-main/services/voice-server > tests/golden/positive_feedback.json

Regenerated once on purpose (2026-11-16) from this tree, to add the one
deliberate change to the positive_feedback prompt: the FUTURE CALLS rule
(tests/test_future_calls_rule.py checks that it is the only difference).

Only regenerate it on purpose, from the tree whose behaviour you mean to pin.
Needs nothing but the standard library: pipecat and the SDKs are stubbed.
"""

import json
import sys
from pathlib import Path

if len(sys.argv) != 2:
    sys.exit("usage: make_positive_golden.py <voice-server source root>")

source_root = Path(sys.argv[1]).resolve()
tests_dir = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(source_root), str(tests_dir)]

from positive_scenarios import capture_all  # noqa: E402

json.dump(capture_all(), sys.stdout, ensure_ascii=False, indent=2, sort_keys=True)
sys.stdout.write("\n")
