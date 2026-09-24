"""Verification for the purpose-scoped tokens on Vobiz-facing URLs.

This is the Python half of a contract whose other half is
`sahayakai-main/src/lib/vobiz/tokens.ts`. The web runtime mints; this verifies.
Both sign with `SAHAYAKAI_REQUEST_SIGNING_KEY`, which both already mount.

WHY THE DOMAIN TAG IS NOT OPTIONAL

The media socket is the only endpoint in this service that opens a **billable**
Gemini Live session on behalf of an unauthenticated caller — the far end is a
parent's phone, so there is no user credential anywhere in the flow. The natural
shortcut is one "call token" honoured everywhere, which is fine until any single
endpoint leaks one and it then opens all of them, including this one.

So every token commits to its purpose inside the signature:

    hmac(key, "<domain>.<outreach_id>.<exp>")

and the wire shape stays `<outreach_id>.<exp>.<sig>`. A token minted for the
answer webhook does not verify here, and — the property worth stating plainly —
neither does a token minted for the app's own web voice stream, because
`verify_stream_token` in `vidya_voice.router` signs `"<uid>.<exp>"` with no
domain at all. The isolation is a property of the signature, not of a check
someone has to remember to write on the next endpoint.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from enum import StrEnum

from ..config import get_settings

__all__ = ["VobizDomain", "verify_vobiz_token", "vobiz_token_message"]


class VobizDomain(StrEnum):
    """One tag per internet-reachable endpoint on the Vobiz call path."""

    ANSWER = "vobiz-answer"
    STREAM = "vobiz-call"
    STATUS = "vobiz-status"


def vobiz_token_message(domain: VobizDomain, outreach_id: str, exp: int) -> str:
    """The exact bytes signed. Must match `vobizTokenMessage` in the web runtime."""
    return f"{domain.value}.{outreach_id}.{exp}"


def verify_vobiz_token(  # noqa: PLR0911 — one return per way a token can be bad; collapsing them hides the enumeration, which IS the check
    domain: VobizDomain, token: str | None
) -> str | None:
    """Return the outreach id a token authorises for `domain`, else None.

    `domain` is required and has no default, so a caller cannot accidentally
    accept "any Vobiz token" by leaving it off.
    """
    if not token:
        return None
    parts = token.split(".")
    # Exactly three segments. A dotted outreach id would produce more, and must
    # not be silently re-joined into something that verifies.
    if len(parts) != 3:
        return None
    outreach_id, exp_raw, sig = parts
    if not outreach_id or not sig:
        return None
    try:
        exp = int(exp_raw)
    except ValueError:
        return None
    if exp < int(time.time()):
        return None

    key = get_settings().request_signing_key.get_secret_value().strip().encode()
    message = vobiz_token_message(domain, outreach_id, exp).encode()
    expected = (
        base64.urlsafe_b64encode(hmac.new(key, message, hashlib.sha256).digest())
        .rstrip(b"=")
        .decode()
    )
    if not hmac.compare_digest(expected, sig):
        return None
    return outreach_id
