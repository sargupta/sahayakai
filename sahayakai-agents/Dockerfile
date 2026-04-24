# Multi-stage build: minimise final image size + avoid shipping dev deps.
# Review trace:
# - P0 #1 cold-start: keep image slim so Cloud Run pulls fast. Aim for <200MB.
# - P1 #20: first deploy MUST measure p99 cold start before setting min-instances=1.

# ---- Builder ---------------------------------------------------------------
FROM python:3.12-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY pyproject.toml ./
# hatch wheel-builder reads pyproject; we skip any lockfile for Phase 1 and
# let pip resolve the pinned versions. Swap to uv lockfile in G1.
COPY src ./src
RUN pip install --upgrade pip && \
    pip install --prefix=/install .

# ---- Runtime ---------------------------------------------------------------
FROM python:3.12-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/install/bin:${PATH}" \
    PYTHONPATH="/install/lib/python3.12/site-packages"

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r sidecar && useradd --no-log-init -r -g sidecar sidecar

COPY --from=builder /install /install
WORKDIR /srv
COPY src ./src
COPY prompts ./prompts

USER sidecar

EXPOSE 8080

# Uvicorn is invoked without --reload and with one worker; Cloud Run gives
# us a single container per request concurrency level and autoscales
# horizontally. Multiple workers in one container doubles memory for no
# throughput gain at our request profile.
CMD ["uvicorn", "sahayakai_agents.main:app", "--host", "0.0.0.0", "--port", "8080", "--log-config", "/dev/null"]
