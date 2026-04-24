"""Runtime configuration.

Source of truth: environment variables. Production values come from Cloud Run
service config + Secret Manager; local dev reads from `.env.local`.

Every setting is validated at import time so a misconfigured deploy fails fast
instead of throwing in the middle of a parent call.

Review trace:
- P0 #2 shadow key separation — `genai_shadow_api_key` is a SEPARATE Secret Manager
  entry. Never the same key as `genai_api_key`.
- P1 #11 telephony backoff — `max_total_backoff_seconds` defaults to 7 so
  failover + jitter + final attempt all land inside Twilio's 15s webhook budget.
- P1 #12 IAM invoker — `allowed_invokers` gates who can call the sidecar at all,
  independent of the ID-token audience check.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Typed, validated runtime settings."""

    model_config = SettingsConfigDict(
        env_file=".env.local",
        env_file_encoding="utf-8",
        env_prefix="",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Runtime ---
    env: Environment = Field(default="development", alias="SAHAYAKAI_AGENTS_ENV")
    port: int = Field(default=8080, alias="SAHAYAKAI_AGENTS_PORT")
    log_level: str = Field(default="INFO", alias="SAHAYAKAI_AGENTS_LOG_LEVEL")

    # --- GCP ---
    gcp_project: str = Field(default="sahayakai-b4248", alias="GOOGLE_CLOUD_PROJECT")
    gcp_region: str = Field(default="asia-southeast1", alias="GOOGLE_CLOUD_REGION")

    # --- Auth (P1 #12, #15) ---
    # Space-or-comma-separated list of service account emails permitted to
    # invoke this sidecar. The Next.js runtime SA must be here.
    allowed_invokers_raw: str = Field(default="", alias="SAHAYAKAI_AGENTS_ALLOWED_INVOKERS")

    # OAuth2 audience claim Next.js signs into its ID token. Must match the
    # Cloud Run URL exactly.
    audience: str = Field(default="", alias="SAHAYAKAI_AGENTS_AUDIENCE")

    # HMAC key for body integrity. Rotates per environment, lives in Secret
    # Manager in prod. Never shared with the model or logged.
    request_signing_key: SecretStr = Field(
        default=SecretStr("dev-only-change-me"),
        alias="SAHAYAKAI_REQUEST_SIGNING_KEY",
    )

    # --- AI keys (P0 #2 — two SEPARATE pools) ---
    genai_api_key: SecretStr = Field(default=SecretStr(""), alias="GOOGLE_GENAI_API_KEY")
    genai_shadow_api_key: SecretStr = Field(
        default=SecretStr(""), alias="GOOGLE_GENAI_SHADOW_API_KEY"
    )

    # --- Session store (P0 #10) ---
    firestore_database: str = Field(default="(default)", alias="SAHAYAKAI_FIRESTORE_DATABASE")
    session_collection: str = Field(default="agent_sessions", alias="SAHAYAKAI_SESSION_COLLECTION")
    session_ttl_hours: int = Field(default=24, alias="SAHAYAKAI_SESSION_TTL_HOURS")

    # --- Resilience (P1 #11) ---
    max_total_backoff_seconds: float = Field(
        default=7.0, alias="SAHAYAKAI_MAX_TOTAL_BACKOFF_SECONDS"
    )

    # --- Telemetry ---
    otel_service_name: str = Field(default="sahayakai-agents", alias="OTEL_SERVICE_NAME")

    @property
    def is_production(self) -> bool:
        return self.env == "production"

    @property
    def allowed_invokers(self) -> tuple[str, ...]:
        """Parsed list of SA emails that may invoke this service."""
        raw = self.allowed_invokers_raw.replace(",", " ")
        return tuple(sorted({item.strip() for item in raw.split() if item.strip()}))

    @property
    def genai_keys(self) -> tuple[str, ...]:
        """Live Gemini API key pool. Comma-separated for failover."""
        raw = self.genai_api_key.get_secret_value()
        return tuple(k.strip() for k in raw.split(",") if k.strip())

    @property
    def genai_shadow_keys(self) -> tuple[str, ...]:
        """Shadow-mode Gemini key pool. Must be disjoint from live pool in prod."""
        raw = self.genai_shadow_api_key.get_secret_value()
        return tuple(k.strip() for k in raw.split(",") if k.strip())

    def assert_prod_invariants(self) -> None:
        """Fail boot in production if anything is misconfigured.

        Combines several Round-2 findings:
        - P0 #2 shadow-key isolation: live vs shadow pools must not overlap.
        - R2 P0-3: `request_signing_key` must not be the hardcoded dev
          default and must be at least 32 chars.
        - R2 P0-2: `audience` must be non-empty (otherwise every ID-token
          verification will 401).
        - R2 extra: `allowed_invokers` must contain at least one entry,
          `genai_keys` must have at least one key.
        """
        if not self.is_production:
            return

        errors: list[str] = []

        overlap = set(self.genai_keys) & set(self.genai_shadow_keys)
        if overlap:
            errors.append(
                "Shadow Gemini key pool overlaps with live pool (P0 #2). "
                "Rotate keys and redeploy."
            )

        signing = self.request_signing_key.get_secret_value()
        if signing == "dev-only-change-me":
            errors.append(
                "SAHAYAKAI_REQUEST_SIGNING_KEY is the dev default in production "
                "(Round-2 P0-3). Provision a real rotating secret."
            )
        if len(signing) < 32:
            errors.append(
                "SAHAYAKAI_REQUEST_SIGNING_KEY is shorter than 32 characters; "
                "use a 256-bit random value."
            )

        if not self.audience:
            errors.append(
                "SAHAYAKAI_AGENTS_AUDIENCE is empty (Round-2 P0-2). "
                "Every ID-token verification will 401. "
                "Set it to the Cloud Run service URL after first deploy."
            )
        elif "${" in self.audience:
            errors.append(
                f"SAHAYAKAI_AGENTS_AUDIENCE contains an unresolved placeholder: "
                f"{self.audience!r}. Substitution failed at deploy time."
            )

        if not self.allowed_invokers:
            errors.append(
                "SAHAYAKAI_AGENTS_ALLOWED_INVOKERS is empty; no caller can "
                "invoke this service."
            )

        if not self.genai_keys:
            errors.append(
                "GOOGLE_GENAI_API_KEY pool is empty; model calls will fail."
            )

        if errors:
            joined = "\n  - ".join(errors)
            raise RuntimeError(
                f"sahayakai-agents refuses to boot in production due to config errors:\n  - {joined}"
            )

    # Deprecated alias for the old name; keep for one release so older
    # callers in tests don't snap.
    assert_shadow_keys_isolated = assert_prod_invariants


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings accessor.

    Exception: tests that need to override should set env vars BEFORE the first
    call, or call `get_settings.cache_clear()` between cases.
    """
    settings = Settings()
    settings.assert_prod_invariants()
    return settings
