"""Do-not-call suppression keys.

The key MUST be byte-identical to the one the web app computes in
`sahayakai-main/src/lib/call-suppression.ts`: sha256 of the E.164 string,
lower-case hex. A shared fixture test in both languages pins one known digest.

The raw phone number is never used as a document id.
"""

from __future__ import annotations

import hashlib

SUPPRESSION_COLLECTION = "call_suppressions"


def phone_suppression_id(e164: str) -> str:
    """sha256 hex of the E.164 number (trimmed)."""
    return hashlib.sha256(e164.strip().encode("utf-8")).hexdigest()
