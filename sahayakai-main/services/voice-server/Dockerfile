FROM python:3.12-slim

WORKDIR /app

# Install system deps for audio processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps ONLY from the pinned, hashed lock (scripts/lock.sh), so
# a candidate differs from the last image in code, not in whatever pipecat or
# google-genai happened to be newest at build time. The build fails closed if
# requirements.lock is missing or any package is unpinned. The project itself
# is installed without resolving anything (--no-deps).
COPY pyproject.toml requirements.lock ./
RUN pip install --no-cache-dir --require-hashes -r requirements.lock \
    && pip install --no-cache-dir --no-deps -e .

# Copy source
COPY src/ src/

EXPOSE 8000

CMD ["python", "-m", "src.main"]
