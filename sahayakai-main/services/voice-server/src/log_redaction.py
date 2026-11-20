"""
Keep signed tokens out of the engine's own logs.

Vobiz opens the media socket at /telephony/vobiz/stream?t=<token>&…, and
uvicorn logs every accepted WebSocket with its full path and query string
("WebSocket /telephony/vobiz/stream?t=…" [accepted]) to stderr, which Cloud
Logging keeps. Its HTTP access log does the same for any `?t=` request. This
filter rewrites those records before any handler writes them.

It cannot reach the Cloud Run request log, which Google writes from outside
the container with the full URL; only moving the token out of the URL fixes
that (a web-side change). Single-use tokens (src/stream_tokens.py) are what
make a token that does reach a log worthless.

Pure: stdlib only.
"""

from __future__ import annotations

import copy
import logging
import re
from typing import Any

REDACTED = "<redacted>"

# Query parameters that carry a credential on this service.
_SECRET_PARAM = re.compile(r"([?&](?:t|token|sig|signature)=)[^&\s\"'#]+", re.IGNORECASE)


def redact(text: str) -> str:
    return _SECRET_PARAM.sub(lambda m: m.group(1) + REDACTED, text)


def _clean(value: Any) -> Any:
    return redact(value) if isinstance(value, str) else value


class QuerySecretFilter(logging.Filter):
    """Redacts credential query parameters in a record's message and arguments.

    Arguments are rewritten one by one rather than folded into the message,
    because uvicorn's AccessFormatter reads them by position.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact(record.msg)
        if isinstance(record.args, tuple):
            record.args = tuple(_clean(a) for a in record.args)
        elif isinstance(record.args, dict):
            record.args = {k: _clean(v) for k, v in record.args.items()}
        return True


FILTER_NAME = "redact_query_secrets"


def with_redaction(log_config: dict) -> dict:
    """A copy of a logging dictConfig with the filter on every handler."""
    config = copy.deepcopy(log_config)
    config.setdefault("filters", {})[FILTER_NAME] = {"()": QuerySecretFilter}
    for handler in config.get("handlers", {}).values():
        filters = handler.setdefault("filters", [])
        if FILTER_NAME not in filters:
            filters.append(FILTER_NAME)
    return config
