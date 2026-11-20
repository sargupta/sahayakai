"""
Production logging for the engine (loguru, which pipecat logs through too).

loguru's default sink logs at DEBUG, and pipecat logs the whole model context
at DEBUG ("Generating chat from context [...]"): the system prompt, the
greeting and every word the parent said. On 2026-11-16 that put a child's
concern and a parent's speech into Cloud Logging. Production runs at INFO.
`diagnose=False` keeps loguru from printing local variables (which hold
transcripts) into exception tracebacks.

    SAHAYAKAI_LOG_LEVEL   INFO by default; DEBUG only for local work.

The app's own INFO-and-above lines log ids and lengths, never conversation
text or phone numbers (tests/test_log_privacy.py).

Pure: takes the logger object; no loguru import here.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Mapping

LEVEL_ENV = "SAHAYAKAI_LOG_LEVEL"
DEFAULT_LEVEL = "INFO"
LEVELS = ("TRACE", "DEBUG", "INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL")


def log_level(env: Mapping[str, str] = os.environ) -> str:
    level = (env.get(LEVEL_ENV) or DEFAULT_LEVEL).strip().upper()
    return level if level in LEVELS else DEFAULT_LEVEL


def configure_logging(logger: Any, env: Mapping[str, str] = os.environ, sink: Any = None) -> str:
    """Replace loguru's DEBUG default sink with one at the production level."""
    level = log_level(env)
    logger.remove()
    logger.add(sink if sink is not None else sys.stderr, level=level, backtrace=False, diagnose=False)
    return level
