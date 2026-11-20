"""Make `import src.…` resolve to this service, however pytest is invoked.

The suite needs nothing but pytest: the pure modules are stdlib-only, and the
wiring tests swap pipecat, loguru and friends for the stand-ins in
bot_harness.py.
"""

import sys
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]
TESTS_DIR = Path(__file__).resolve().parent

for path in (str(SERVICE_ROOT), str(TESTS_DIR)):
    if path not in sys.path:
        sys.path.insert(0, path)
