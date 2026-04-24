"""OpenTelemetry initialization.

Production: exports traces to Cloud Trace in the same GCP project as the main
service. Local dev: no-op unless OTEL_EXPORTER_OTLP_ENDPOINT is set.

Wired into FastAPI via `FastAPIInstrumentor.instrument_app(app)` from
`main.py`.
"""
from __future__ import annotations

import structlog

from .config import get_settings

log = structlog.get_logger(__name__)

_initialised = False


def init_telemetry() -> None:
    """Idempotent. Called once from the FastAPI startup event."""
    global _initialised
    if _initialised:
        return
    _initialised = True

    settings = get_settings()
    if not settings.is_production:
        log.info("telemetry.dev_mode_skip")
        return

    # Cloud Trace exporter + OpenTelemetry SDK wiring. The imports are local to
    # avoid paying the cost in tests and in dev.
    try:
        from opentelemetry import trace
        from opentelemetry.exporter.cloud_trace import CloudTraceSpanExporter
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError as exc:
        log.warning("telemetry.import_failed", error=str(exc))
        return

    resource = Resource.create(
        {
            "service.name": settings.otel_service_name,
            "service.namespace": "sahayakai",
            "deployment.environment": settings.env,
            "cloud.provider": "gcp",
            "cloud.region": settings.gcp_region,
        }
    )
    provider = TracerProvider(resource=resource)
    exporter = CloudTraceSpanExporter(project_id=settings.gcp_project)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)

    log.info("telemetry.cloud_trace_enabled", project=settings.gcp_project)
