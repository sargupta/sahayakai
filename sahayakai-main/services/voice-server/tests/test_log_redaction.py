"""CLASS GATE — a signed token in a request URL never reaches the engine's logs.

Found in production logs (2026-11-16): uvicorn's line
`"WebSocket /telephony/vobiz/stream?t=<token>&cuid=…" [accepted]` carried the
live stream token to stderr, i.e. Cloud Logging. The class is "a credential
in a query string is logged by the server", so the gate runs uvicorn-shaped
records (the accepted line and a positional access-log line) through the real
logging machinery with the config main() hands uvicorn, and requires that no
token survives while the rest of the line does.

The Cloud Run request log is written by Google outside the container and is
out of this service's reach; see src/log_redaction.py.
"""

from __future__ import annotations

import io
import logging
import logging.config
import sys

import pytest

from bot_harness import UVICORN_LOGGING_CONFIG, import_main, mint_stream_token, stubbed_runtime
from src.log_redaction import FILTER_NAME, QuerySecretFilter, redact, with_redaction

TOKEN = mint_stream_token("OutreachSt0000000001")
PATH = f"/telephony/vobiz/stream?t={TOKEN}&cuid=123e4567-e89b-42d3-a456-426614174000&lang=Kannada"


def test_redact_keeps_everything_but_the_credential():
    out = redact(PATH)
    assert TOKEN not in out and TOKEN.split(".")[2] not in out
    assert out == "/telephony/vobiz/stream?t=<redacted>&cuid=123e4567-e89b-42d3-a456-426614174000&lang=Kannada"
    assert redact("/x?a=1&token=abc&sig=def") == "/x?a=1&token=<redacted>&sig=<redacted>"
    assert redact("/health") == "/health"


@pytest.fixture
def captured_uvicorn_logging(monkeypatch):
    err, out = io.StringIO(), io.StringIO()
    monkeypatch.setattr(sys, "stderr", err)
    monkeypatch.setattr(sys, "stdout", out)
    logging.config.dictConfig(with_redaction(UVICORN_LOGGING_CONFIG))
    yield err, out
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        for h in list(lg.handlers):
            lg.removeHandler(h)
        lg.propagate = True


def test_uvicorn_shaped_lines_reach_the_log_without_the_token(captured_uvicorn_logging):
    err, out = captured_uvicorn_logging
    # Exactly how uvicorn's websocket protocols log an accepted socket.
    logging.getLogger("uvicorn.error").info('%s - "WebSocket %s" [accepted]', "169.254.0.1:29564", PATH)
    # The access log reads its arguments by position.
    logging.getLogger("uvicorn.access").info('%s - "%s %s HTTP/%s" %d', "169.254.0.1:1", "GET", PATH, "1.1", 200)
    logged = err.getvalue() + out.getvalue()
    assert "[accepted]" in logged and "GET" in logged and "cuid=123e4567-e89b-42d3-a456-426614174000" in logged
    assert TOKEN not in logged and TOKEN.split(".")[2] not in logged


def test_with_redaction_puts_the_filter_on_every_handler_and_leaves_the_input_alone():
    cfg = with_redaction(UVICORN_LOGGING_CONFIG)
    assert cfg["filters"][FILTER_NAME]["()"] is QuerySecretFilter
    assert all(FILTER_NAME in h["filters"] for h in cfg["handlers"].values())
    assert "filters" not in UVICORN_LOGGING_CONFIG["handlers"]["default"]


def test_main_starts_uvicorn_with_the_redacting_log_config(tmp_path, monkeypatch):
    with stubbed_runtime():
        main = import_main(tmp_path, monkeypatch)
        seen = {}
        main.uvicorn.run = lambda *args, **kwargs: seen.update(kwargs)
        main.main()
    cfg = seen.get("log_config")
    assert isinstance(cfg, dict), "uvicorn.run must be given an explicit log_config"
    assert set(cfg["handlers"]) == set(UVICORN_LOGGING_CONFIG["handlers"])
    assert all(FILTER_NAME in h.get("filters", []) for h in cfg["handlers"].values())
