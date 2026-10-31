"""Run the sidecar locally for hands-free VIDYA voice (ADK engine, Vertex Live).

LOCAL DEVELOPMENT ONLY. Credentials are the developer's own gcloud ADC
(`gcloud auth application-default login`); nothing here is a production value.

The web app and this sidecar must share the stream-token HMAC key. It lives in
exactly one gitignored file — `sahayakai-main/.env.development.local`
(`SAHAYAKAI_REQUEST_SIGNING_KEY=...`) — and is read from there so it is never
duplicated into another file or printed.

    .venv/Scripts/python.exe scripts/run_local_voice.py [--port 8080]
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB_ENV = ROOT.parent / "sahayakai-main" / ".env.development.local"


def _load_signing_key() -> str:
    if not WEB_ENV.exists():
        sys.exit(f"missing {WEB_ENV} — create it with SAHAYAKAI_REQUEST_SIGNING_KEY=<random>")
    for line in WEB_ENV.read_text(encoding="utf-8").splitlines():
        if line.startswith("SAHAYAKAI_REQUEST_SIGNING_KEY="):
            value = line.split("=", 1)[1].strip()
            if len(value) >= 32:
                return value
    sys.exit(f"SAHAYAKAI_REQUEST_SIGNING_KEY (>=32 chars) not found in {WEB_ENV}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8080)
    args = parser.parse_args()

    os.environ["SAHAYAKAI_REQUEST_SIGNING_KEY"] = _load_signing_key()
    os.environ.setdefault("SAHAYAKAI_AGENTS_ENV", "development")
    os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
    os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "sahayakai-b4248")
    os.environ.setdefault("SAHAYAKAI_VIDYA_VOICE_ENGINE", "adk")
    os.environ.setdefault("PYTHONUNBUFFERED", "1")
    sys.path.insert(0, str(ROOT / "src"))

    import uvicorn

    print(
        f"[run_local_voice] sidecar on http://localhost:{args.port} "
        f"engine={os.environ['SAHAYAKAI_VIDYA_VOICE_ENGINE']} project={os.environ['GOOGLE_CLOUD_PROJECT']}",
        flush=True,
    )
    uvicorn.run("sahayakai_agents.main:app", host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    main()
