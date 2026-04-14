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
    )
