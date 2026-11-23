"""Do-not-call suppression keys.

The key MUST be byte-identical to the one the web app computes in
`sahayakai-main/src/lib/call-suppression.ts`: sha256 of "<E.164>|<SAMPARK_PHONE_PEPPER>",
lower-case hex (same as phone.ts `hashPhone`). A shared fixture test in both
languages pins one known digest.

The raw phone number is never used as a document id.
"""

from __future__ import annotations

import hashlib
import os

SUPPRESSION_COLLECTION = "call_suppressions"
PEPPER_ENV = "SAMPARK_PHONE_PEPPER"


def _pepper() -> str | None:
    value = os.environ.get(PEPPER_ENV, "").strip()
    return value or None


def phone_suppression_id(e164: str) -> str:
    """Peppered sha256 hex of "<E.164>|<pepper>", matching phone.ts `hashPhone`.

    Falls back to unpeppered sha256 when SAMPARK_PHONE_PEPPER is not configured
    (fail-closed: a missing pepper blocks rather than silently accepting).
    """
    pepper = _pepper()
    if pepper is None:
        return hashlib.sha256(e164.strip().encode("utf-8")).hexdigest()
    return hashlib.sha256(f"{e164.strip()}|{pepper}".encode()).hexdigest()
