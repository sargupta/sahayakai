"""
Vobiz media-stream support for the parent-call sidecar.

The web app (VOICE_PROVIDER=vobiz) dials via Vobiz and, on answer, hands Vobiz a
`<Stream>` verb pointing at THIS service's `/telephony/vobiz/stream` WebSocket
(see src/app/api/attendance/vobiz/answer/route.ts). Vobiz is a Plivo-compatible
platform, so its media socket speaks the Plivo AudioStream protocol and we
terminate it with Pipecat's PlivoFrameSerializer.

Everything Vobiz-specific lives here so bot.py / main.py stay provider-agnostic:
  - verify_stream_token(): validates the signed `t` query param (mirrors
    src/lib/vobiz/tokens.ts — HMAC-SHA256 over "vobiz-call.<outreachId>.<exp>").
  - fetch_context_firestore(): reads the parent_outreach record directly, so the
    sidecar needs no web-app internal key.
  - write_call_result_firestore(): writes transcript + callSummary back onto the
    same record, which is what the Contact-Parent modal renders.
  - record_opt_out_request_firestore(): records on parent_outreach/{id} that
    the parent may prefer not to be called (optOutRequested). The engine never
    writes call_suppressions.
  - consume_stream_token_firestore(): makes each stream token single-use.
  - hangup_vobiz_call(): ends the leg over Vobiz REST (the answer XML sets
    keepCallAlive=true, so closing the socket alone does not drop the call).
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Any

from loguru import logger

# The stream domain tag ("vobiz-call", VOBIZ_DOMAINS.STREAM in the web app's
# src/lib/vobiz/tokens.ts) lives with the token parser in src/stream_tokens.py.
_VOBIZ_API_BASE = "https://api.vobiz.ai/api/v1"


# ── Token verification (mirror of src/lib/vobiz/tokens.ts) ──────────────────

def verify_stream_token(token: str | None, signing_key: str | None) -> str | None:
    """Return the outreachId a stream token authorises, or None.

    Wire shape is `<outreachId>.<exp>.<sig>` where
    sig = base64url(HMAC_SHA256(key, "vobiz-call.<outreachId>.<exp>")) with no
    padding (Node's `digest('base64url')`). Only that exact spelling is
    accepted (stream_tokens.parse_stream_token): no leading zeros or signs on
    exp, no padding or alternate alphabet on sig, nothing around the token.
    The single-use record is keyed on the parsed claims, so an equivalent
    spelling could not slip past it even if one were accepted.
    """
    from src.stream_tokens import parse_stream_token

    if not token or not signing_key:
        return None
    parts = parse_stream_token(token)
    if parts is None:
        logger.warning("Vobiz stream token malformed")
        return None
    if parts.exp < int(time.time()):
        logger.warning("Vobiz stream token expired")
        return None

    digest = hmac.new(signing_key.strip().encode("utf-8"), parts.message().encode("utf-8"), hashlib.sha256).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    if not hmac.compare_digest(expected, parts.signature):
        logger.warning("Vobiz stream token signature mismatch")
        return None
    return parts.outreach_id


# ── Firestore context (self-contained; no web internal key needed) ──────────

def _db(project: str):
    # Imported lazily so unit tests / the Twilio path do not require the dep.
    from google.cloud import firestore  # type: ignore

    return firestore.AsyncClient(project=project)


async def fetch_context_firestore(outreach_id: str, project: str) -> dict[str, Any] | None:
    """Load the call context the bot needs from parent_outreach/{outreachId}.

    Shape mirrors GET /api/attendance/call-context so bot.py is unchanged.
    """
    try:
        snap = await _db(project).collection("parent_outreach").document(outreach_id).get()
        if not snap.exists:
            logger.error(f"parent_outreach/{outreach_id} not found")
            return None
        d = snap.to_dict() or {}
        return {
            "studentName": d.get("studentName", ""),
            "className": d.get("className", ""),
            "subject": d.get("subject", ""),
            "reason": d.get("reason", ""),
            "generatedMessage": d.get("generatedMessage", ""),
            "parentLanguage": d.get("parentLanguage", "Hindi"),
            "teacherName": d.get("teacherName", ""),
            "schoolName": d.get("schoolName", ""),
            "parentPhone": d.get("parentPhone", ""),
        }
    except Exception as e:  # noqa: BLE001 — a call must never crash on bookkeeping
        logger.error(f"Firestore context fetch failed for {outreach_id}: {e}")
        return None


async def write_call_result_firestore(
    outreach_id: str,
    project: str,
    transcript: list[dict],
    summary: dict | None,
) -> None:
    """Write transcript + callSummary onto the outreach record for the modal.

    callStatus itself is stamped by the web status webhook when Vobiz reports the
    hangup; we only add the conversation artefacts here.
    """
    try:
        update: dict[str, Any] = {
            "transcript": transcript,
            "turnCount": len(transcript),
            "updatedAt": _iso_now(),
        }
        if summary:
            update["callSummary"] = summary
        await _db(project).collection("parent_outreach").document(outreach_id).set(
            update, merge=True
        )
        logger.info(f"Wrote transcript+summary to parent_outreach/{outreach_id}")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Firestore result write failed for {outreach_id}: {e}")


async def record_opt_out_request_firestore(outreach_id: str, project: str, quote: str, source: str) -> bool:
    """Record (never enforce) a parent's "please don't call me" on parent_outreach/{id}.

    Writes only `optOutRequested: {quote, at, source}` (src/opt_out.py has the
    shape and why). True when it was written. Never logs the quote or a phone
    number.
    """
    from src.opt_out import record_opt_out_request

    try:
        result = await record_opt_out_request(_db(project), outreach_id, quote, source)
    except Exception as e:  # noqa: BLE001 — e.g. the client itself could not be built
        logger.error(f"Opt-out request record failed for {outreach_id}: {type(e).__name__}")
        return False
    (logger.info if result.ok else logger.error)(f"parent_outreach/{outreach_id}: {result.detail}")
    return result.ok


async def read_dial_attempt_firestore(outreach_id: str, project: str) -> str | None:
    """The dial attempt the web call route stamped on the outreach, or None.

    `callSid` is Vobiz's request_uuid from the make-call response, written by
    /api/attendance/call after the dial, server-side. Nothing on the answer
    path writes it, so a replayed answer request cannot change it.
    """
    try:
        snap = await _db(project).collection("parent_outreach").document(outreach_id).get()
    except Exception as e:  # noqa: BLE001
        logger.error(f"Could not read the dial attempt for {outreach_id}: {e}")
        return None
    data = (snap.to_dict() if snap.exists else None) or {}
    value = data.get("callSid")
    return value.strip() if isinstance(value, str) and value.strip() else None


async def consume_stream_token_firestore(token: str, outreach_id: str, project: str, dial_attempt: str | None = None):
    """Mark a verified stream as used; returns a StreamUse (see src/stream_tokens.py).

    Fails closed: if Firestore cannot record the use, the stream is refused.
    """
    from src.stream_tokens import StreamUse, consume_stream_token

    try:
        return await consume_stream_token(_db(project), token, outreach_id, dial_attempt=dial_attempt)
    except Exception as e:  # noqa: BLE001 — e.g. the client itself could not be built
        logger.error(f"Could not record stream use for {outreach_id}: {e}")
        return StreamUse.ERROR


def _iso_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


# ── Vobiz REST hangup (keepCallAlive=true means we must end the leg) ─────────

def hangup_url(call_uuid: str, auth_id: str) -> str | None:
    """The DELETE URL for one call leg, or None if the uuid is not a call UUID.

    The uuid comes from an unsigned query parameter. Checked against the
    call-UUID shape and percent-encoded as a single segment, so no value can
    walk the path ("..", "/", "%2F") to another account resource.
    """
    from urllib.parse import quote

    from src.stream_tokens import is_call_uuid

    if not is_call_uuid(call_uuid) or not auth_id:
        return None
    return f"{_VOBIZ_API_BASE}/Account/{quote(auth_id, safe='')}/Call/{quote(call_uuid, safe='')}/"


async def hangup_vobiz_call(call_uuid: str, auth_id: str, auth_token: str) -> None:
    """End the Vobiz leg via REST. No-op if we lack a valid uuid or creds."""
    url = hangup_url(call_uuid, auth_id)
    if url is None or not auth_token:
        if call_uuid:
            logger.warning("Vobiz hangup skipped: call uuid is not a call UUID")
        return
    import httpx  # lazy — keeps the module importable without the dep installed

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.delete(url, auth=(auth_id, auth_token))
        if resp.status_code >= 300:
            logger.warning(f"Vobiz hangup returned {resp.status_code} for {call_uuid}")
        else:
            logger.info(f"Vobiz call {call_uuid} hung up")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Vobiz hangup error for {call_uuid}: {e}")
