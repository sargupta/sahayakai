"""Sampark ⇄ bridge, for Riya calls placed by Sampark with the Vobiz provider.

A Sampark call is named `sampark~{orgId}~{callId}` in every token. Its data lives in
Sampark's own database, never in `parent_outreach`, so the bridge:

  - fetches the call's Riya variables from Sampark (GET /api/webhooks/vobiz-riya/context,
    token domain `sampark-riya-context`, signed with the shared request-signing key);
  - writes nothing to Firestore for it;
  - reports the result ONCE as a signed post-call event (POST /api/webhooks/vobiz-riya/event,
    header `x-riya-bridge-signature: t=<unix>,v1=<base64url HMAC-SHA256(key, "<t>.<body>")>`),
    which Sampark applies through the same reducer as the ElevenLabs webhook.

Env: SAMPARK_WEB_BASE_URL (the Sampark web app as the bridge reaches it, e.g. its internal URL).
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import time
from typing import Any

import structlog

from ..config import get_settings

log = structlog.get_logger(__name__)

PREFIX = "sampark~"
_REF = re.compile(r"^sampark~[A-Za-z0-9_-]{1,128}~[a-f0-9]{32}$")
CONTEXT_DOMAIN = "sampark-riya-context"


def is_sampark(outreach_id: str | None) -> bool:
    return bool(outreach_id and _REF.match(outreach_id))


def _key() -> bytes:
    return get_settings().request_signing_key.get_secret_value().strip().encode()


def _base() -> str | None:
    raw = os.environ.get("SAMPARK_WEB_BASE_URL", "").strip().rstrip("/")
    return raw or None


def mint_context_token(ref: str, ttl: int = 120) -> str:
    """Same wire format as the web's `mintVobizToken` (`<id>.<exp>.<sig>`)."""
    exp = int(time.time()) + ttl
    sig = base64.urlsafe_b64encode(
        hmac.new(_key(), f"{CONTEXT_DOMAIN}.{ref}.{exp}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"{ref}.{exp}.{sig}"


def sign_body(body: str, now: int | None = None) -> str:
    t = int(now if now is not None else time.time())
    mac = base64.urlsafe_b64encode(
        hmac.new(_key(), f"{t}.{body}".encode(), hashlib.sha256).digest()
    ).rstrip(b"=").decode()
    return f"t={t},v1={mac}"


async def fetch_context(ref: str) -> dict[str, Any] | None:
    """The call's Riya context, or None (unknown / settled call, Sampark unreachable)."""
    base = _base()
    if not base or not is_sampark(ref):
        log.warning("telephony.sampark_context_unavailable", reason="no_base_url" if not base else "bad_ref")
        return None
    import httpx

    url = f"{base}/api/webhooks/vobiz-riya/context"
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(url, params={"t": mint_context_token(ref)})
        if r.status_code != 200:
            log.warning("telephony.sampark_context_refused", status=r.status_code)
            return None
        data = r.json()
        return data if isinstance(data, dict) and data.get("agentWorkflow") == "riya" else None
    except Exception as exc:  # noqa: BLE001 — never fatal: the call then closes safely
        log.warning("telephony.sampark_context_failed", error=type(exc).__name__)
        return None


async def post_event(payload: dict[str, Any]) -> bool:
    """POST the post-call event; retried (Sampark's reducer makes a retry harmless)."""
    base = _base()
    if not base:
        log.error("telephony.sampark_event_unsent", reason="no_base_url")
        return False
    import httpx

    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    url = f"{base}/api/webhooks/vobiz-riya/event"
    for attempt in range(4):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                r = await client.post(
                    url,
                    content=body.encode(),
                    headers={"content-type": "application/json", "x-riya-bridge-signature": sign_body(body)},
                )
            if r.status_code == 200:
                log.info("telephony.sampark_event_sent", attempt=attempt)
                return True
            if r.status_code in (400, 401, 404, 413):
                log.error("telephony.sampark_event_refused", status=r.status_code)
                return False
        except Exception as exc:  # noqa: BLE001
            log.warning("telephony.sampark_event_retry", attempt=attempt, error=type(exc).__name__)
        await asyncio.sleep(1.5 * (attempt + 1))
    log.error("telephony.sampark_event_failed")
    return False
