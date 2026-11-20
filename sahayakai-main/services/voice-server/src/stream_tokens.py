"""
Single use for Vobiz media-stream tokens.

The web app's answer webhook mints a signed token (vobiz-call.<outreachId>.<exp>)
and hands Vobiz a stream URL carrying it. verify_stream_token proves the token
is genuine and unexpired, but on its own it accepts the same token any number
of times until it expires. The URL is not secret in practice: it sits in the
answer XML Vobiz fetched, and in the Cloud Run request log. A replayed socket
would hear the call's greeting and write a transcript and summary onto that
parent's outreach record.

So the first connection CONSUMES the token: an atomic `create()` of
vobiz_stream_tokens/{id}, which Firestore refuses if the document already
exists. Every later connection with the same token is refused before any call
context is loaded.

The id is computed from the PARSED claims (outreach id and expiry), never from
the raw string: if two spellings of one token both verified, keying on the
string would let the second spelling through as a "new" token. On top of that,
parse_stream_token accepts exactly one spelling: the one the web app mints
(`${outreachId}.${exp}.${base64url(hmac)}` in src/lib/vobiz/tokens.ts). The
signature is deterministic for a given (outreach id, expiry), so keying on
those two loses nothing. The token itself is never stored.

Pure on purpose (stdlib only; Firestore is passed in) so the tests can drive it.
"""

from __future__ import annotations

import base64
import enum
import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

# Must match VOBIZ_DOMAINS.STREAM in the web app's src/lib/vobiz/tokens.ts.
STREAM_DOMAIN = "vobiz-call"

# Exactly what the web app mints, and nothing else:
#   outreach id  a Firestore auto-id (20 ASCII letters/digits), or one of this
#                engine's built-in test scenarios (__test__NNN);
#   expiry       unix seconds, ASCII digits, no sign, no leading zero;
#   signature    unpadded base64url of a 32-byte HMAC-SHA256 (43 chars).
_OUTREACH_ID = re.compile(r"[A-Za-z0-9]{20}|__test__[0-9]{3}")
_EXPIRY = re.compile(r"[1-9][0-9]{0,11}")
_SIGNATURE = re.compile(r"[A-Za-z0-9_-]{43}")

# The carrier's call UUID (Plivo-compatible, 8-4-4-4-12 hex). It arrives as an
# unsigned query parameter and becomes a path segment of an authenticated
# REST DELETE, so nothing else is ever accepted.
_CALL_UUID = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def is_call_uuid(value: object) -> bool:
    return isinstance(value, str) and value.isascii() and _CALL_UUID.fullmatch(value) is not None


CONSUMED_COLLECTION = "vobiz_stream_tokens"

# Keep the consumed record a little past the token's own expiry, for a
# Firestore TTL policy on `expiresAt` to sweep.
_KEEP_AFTER_EXPIRY = timedelta(hours=1)


class StreamUse(enum.Enum):
    FIRST = "first"    # this connection consumed the token
    REPLAY = "replay"  # the token was already used; refuse
    ERROR = "error"    # could not record the use; refuse (fail closed)


@dataclass(frozen=True)
class StreamTokenParts:
    outreach_id: str
    exp: int
    signature: str

    def message(self) -> str:
        """What the signature signs (vobizTokenMessage in the web app)."""
        return f"{STREAM_DOMAIN}.{self.outreach_id}.{self.exp}"


def parse_stream_token(token: object) -> StreamTokenParts | None:
    """Split a stream token, accepting only its one canonical spelling.

    Shape only: the signature is checked by vobiz.verify_stream_token.
    """
    if not isinstance(token, str) or not token.isascii():
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    outreach_id, exp_raw, signature = parts
    if not (_OUTREACH_ID.fullmatch(outreach_id) and _EXPIRY.fullmatch(exp_raw) and _SIGNATURE.fullmatch(signature)):
        return None
    # 43 base64url characters carry 258 bits for 256; a last character with
    # the two spare bits set decodes to the same bytes. Only the encoding that
    # re-encodes to itself is accepted.
    try:
        raw = base64.urlsafe_b64decode(signature + "=")
    except (ValueError, TypeError):
        return None
    if len(raw) != 32 or base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii") != signature:
        return None
    return StreamTokenParts(outreach_id, int(exp_raw), signature)


def stream_token_id(parts: StreamTokenParts) -> str:
    """Document id for a token: a digest of its claims, never the raw string."""
    return hashlib.sha256(parts.message().encode("utf-8")).hexdigest()


def stream_use_id(parts: StreamTokenParts, dial_attempt: str | None = None) -> str:
    """What one stream is allowed per: the DIAL ATTEMPT when it is known.

    The web app's answer webhook mints a fresh stream token on every request,
    and its own answer token is reusable for minutes, so replaying the answer
    URL yields new tokens with new expiries. Keyed on the token, each would be
    a "first use". Keyed on (outreach, dial attempt), there is at most one
    stream per dial however many tokens are minted. The dial attempt is the
    `callSid` the web call route stamps from Vobiz's own response at dial
    time (server-side, never from the answer request). Without one (a legacy
    record, or a stream that raced the stamp), fall back to the token's claims.
    """
    if dial_attempt:
        key = f"vobiz-stream.{parts.outreach_id}.{dial_attempt}"
        return hashlib.sha256(key.encode("utf-8")).hexdigest()
    return stream_token_id(parts)


def _already_exists(exc: BaseException) -> bool:
    """google.api_core.exceptions.AlreadyExists (a Conflict, HTTP 409), without importing it."""
    names = {cls.__name__ for cls in type(exc).__mro__}
    return "AlreadyExists" in names or "Conflict" in names or getattr(exc, "code", None) == 409


async def consume_stream_token(
    db: Any, token: str, outreach_id: str, *, dial_attempt: str | None = None, now: datetime | None = None,
) -> StreamUse:
    """Record the first use of a verified stream token. Never raises."""
    now = now or datetime.now(timezone.utc)
    parts = parse_stream_token(token)
    if parts is None or parts.outreach_id != outreach_id:
        return StreamUse.ERROR  # only a token the verifier accepted may be consumed
    try:
        expiry = datetime.fromtimestamp(parts.exp, tz=timezone.utc)
    except (OverflowError, OSError, ValueError):
        return StreamUse.ERROR
    try:
        await db.collection(CONSUMED_COLLECTION).document(stream_use_id(parts, dial_attempt)).create(
            {
                "outreachId": outreach_id,
                "boundTo": "dial_attempt" if dial_attempt else "token",
                "consumedAt": now,
                "expiresAt": expiry + _KEEP_AFTER_EXPIRY,
            }
        )
    except Exception as exc:  # noqa: BLE001
        return StreamUse.REPLAY if _already_exists(exc) else StreamUse.ERROR
    return StreamUse.FIRST
