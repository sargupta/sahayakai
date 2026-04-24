"""Structured logging configuration for Cloud Logging compatibility.

Cloud Run forwards stdout to Cloud Logging; a JSON line with a `severity`
field is surfaced as a structured entry, so we render via structlog's
`JSONRenderer` and map level → Cloud Logging severity values.

Local dev gets a human-readable console renderer instead of JSON so logs
are readable in the terminal. Both paths include the same context
fields, so switching environments doesn't drop information.
"""
from __future__ import annotations

import logging
import sys
from typing import Any

import structlog

from .config import get_settings


def _add_severity(_logger: Any, method_name: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """Map structlog method_name to Cloud Logging severity.

    structlog passes `"info"`, `"warning"`, etc.; Cloud Logging expects
    uppercase names in the `severity` key.
    """
    level = method_name.upper()
    if level in {"INFO", "WARNING", "ERROR", "CRITICAL", "DEBUG"}:
        event_dict["severity"] = level
    return event_dict


def configure_logging() -> None:
    """Idempotent configuration entry point. Call once on process start."""
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)

    # Tame noisy third-party loggers in prod.
    logging.basicConfig(
        stream=sys.stdout,
        format="%(message)s",
        level=level,
    )
    for noisy in ("urllib3", "google.auth.transport", "google.cloud"):
        logging.getLogger(noisy).setLevel(max(level, logging.WARNING))

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        _add_severity,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]

    if settings.is_production:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stderr.isatty())

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )
