"""Voice server configuration — reads from environment."""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    sarvam_api_key: str
    google_api_key: str
    sahayakai_api_url: str
    sahayakai_internal_key: str
    host: str
    port: int
    twilio_account_sid: str
    twilio_auth_token: str
    # Vobiz media path
    google_cloud_project: str
    request_signing_key: str
    vobiz_auth_id: str
    vobiz_auth_token: str
    # Gemini endpoint (src/gemini_backend.py). Defaults keep the AI Studio key.
    gemini_backend: str = "ai_studio"
    vertex_location: str = "asia-south1"
    # The built-in __test__ call scenarios start a full, billed pipeline.
    # Off unless explicitly enabled; never enable in production.
    allow_test_scenarios: bool = False


def load_config() -> Config:
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass

    return Config(
        sarvam_api_key=os.environ.get("SARVAM_AI_API_KEY", ""),
        google_api_key=os.environ.get("GOOGLE_GENAI_API_KEY", ""),
        sahayakai_api_url=os.environ.get("SAHAYAKAI_API_URL", "http://localhost:3000"),
        sahayakai_internal_key=os.environ.get("SAHAYAKAI_INTERNAL_KEY", ""),
        host=os.environ.get("HOST", "0.0.0.0"),
        port=int(os.environ.get("PORT", "8000")),
        twilio_account_sid=os.environ.get("TWILIO_ACCOUNT_SID", ""),
        twilio_auth_token=os.environ.get("TWILIO_AUTH_TOKEN", ""),
        # Vobiz media path: context is read straight from Firestore
        # (GOOGLE_CLOUD_PROJECT), the stream URL is verified with the same
        # signing key the web app mints with, and the leg is ended over Vobiz REST.
        google_cloud_project=os.environ.get("GOOGLE_CLOUD_PROJECT", ""),
        request_signing_key=os.environ.get("SAHAYAKAI_REQUEST_SIGNING_KEY", ""),
        vobiz_auth_id=os.environ.get("VOBIZ_AUTH_ID", ""),
        vobiz_auth_token=os.environ.get("VOBIZ_AUTH_TOKEN", ""),
        gemini_backend=os.environ.get("SAHAYAKAI_GEMINI_BACKEND", "ai_studio"),
        vertex_location=os.environ.get("SAHAYAKAI_VERTEX_LOCATION", "asia-south1"),
        allow_test_scenarios=os.environ.get("SAHAYAKAI_ALLOW_TEST_SCENARIOS", "").strip().lower()
        in ("1", "true", "yes"),
    )
