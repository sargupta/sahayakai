"""The policy modules import with the standard library alone.

CI installs pytest and nothing else, and the wiring tests replace pipecat with
stand-ins. If a policy module ever started importing pipecat, loguru or a
Google SDK, the decisions it makes could no longer be tested directly, so this
imports each one in a fresh interpreter that refuses those packages.
"""

import subprocess
import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]

PURE_MODULES = [
    "src.call_policy",
    "src.prompts.agent_reply",
    "src.prompts.phase_guidance",
    "src.opt_out",
    "src.stt_noise",
    "src.stream_tokens",
    "src.log_redaction",
    "src.gemini_backend",
    "src.log_setup",
]

_PROBE = r"""
import importlib, importlib.abc, sys
FORBIDDEN = ("pipecat", "loguru", "google", "httpx", "fastapi", "uvicorn", "dotenv", "numpy")
class Refuse(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path=None, target=None):
        if name.split(".")[0] in FORBIDDEN:
            raise ModuleNotFoundError("forbidden in a pure module: " + name)
        return None
# Some site-packages pre-load the `google` namespace from a .pth file; only
# modules our imports bring in count.
already = set(sys.modules)
sys.meta_path.insert(0, Refuse())
sys.path.insert(0, sys.argv[1])
for name in sys.argv[2:]:
    importlib.import_module(name)
loaded = sorted(m for m in set(sys.modules) - already if m.split(".")[0] in FORBIDDEN)
assert not loaded, loaded
print("ok")
"""


def test_policy_modules_need_nothing_but_the_standard_library():
    result = subprocess.run(
        [sys.executable, "-I", "-c", _PROBE, str(SERVICE_ROOT), *PURE_MODULES],
        cwd=SERVICE_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ok"
