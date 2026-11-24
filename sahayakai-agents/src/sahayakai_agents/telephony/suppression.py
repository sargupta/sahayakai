"""Do-not-call suppression keys.

A parent's "do not call me again" is stored as `call_suppressions/{id}`, where the id is a hash
of the E.164 number. The raw number is never a document id.

The id was a plain sha256 of the number. Indian mobile numbers are only about 10^10 values, so
anyone holding the list could recover every number by hashing them all. The id is now keyed
with the platform's secret phone pepper, the same hash Sampark's own list uses
(`sahayakai-main/src/lib/sampark/phone.ts`, `hashPhone`): sha256 of "<E.164>|<pepper>", hex.

The key MUST stay byte-identical to the web app's (`sahayakai-main/src/lib/call-suppression.ts`).
A shared fixture test in both languages pins one known digest for each form.

Transition: entries written before the change sit under the plain sha256 id, and their
numbers cannot be recomputed from it (that is the point). So a lookup checks both ids
(`phone_suppression_ids`) and no recorded "no" is lost; new entries are written under the
keyed id. If the pepper is not configured, writes fall back to the plain id and the caller
logs it: losing a parent's opt-out is worse than a weaker hash.
"""

from __future__ import annotations

import hashlib
import os

SUPPRESSION_COLLECTION = "call_suppressions"
PEPPER_ENV = "SAMPARK_PHONE_PEPPER"
KEYED = "peppered-sha256-v1"
LEGACY = "sha256"


def _pepper() -> str | None:
    value = os.environ.get(PEPPER_ENV, "").strip()  # trimmed, as the web app's requiredEnv does
    return value or None


def legacy_phone_suppression_id(e164: str) -> str:
    """The old, unkeyed id: sha256 hex of the E.164 number (trimmed). Read only."""
    return hashlib.sha256(e164.strip().encode("utf-8")).hexdigest()


def keyed_phone_suppression_id(e164: str, pepper: str) -> str:
    """sha256 hex of "<E.164>|<pepper>", identical to Sampark's `hashPhone`."""
    return hashlib.sha256(f"{e164.strip()}|{pepper}".encode()).hexdigest()


def phone_suppression_id(e164: str) -> tuple[str, str]:
    """The id a new opt-out is written under, and which form it is (KEYED or LEGACY)."""
    pepper = _pepper()
    if pepper is None:
        return legacy_phone_suppression_id(e164), LEGACY
    return keyed_phone_suppression_id(e164, pepper), KEYED


def phone_suppression_ids(e164: str) -> list[str]:
    """Every id an opt-out for this number may sit under: keyed first, then the old one."""
    pepper = _pepper()
    ids = [keyed_phone_suppression_id(e164, pepper)] if pepper else []
    return [*ids, legacy_phone_suppression_id(e164)]
