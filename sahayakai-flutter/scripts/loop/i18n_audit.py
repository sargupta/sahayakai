#!/usr/bin/env python3
"""Audit the ARB translation set. Five checks, each catching a failure that
`flutter gen-l10n` structurally cannot.

    python3 scripts/loop/i18n_audit.py                 # all locales, all checks
    python3 scripts/loop/i18n_audit.py --locales hi    # one locale
    python3 scripts/loop/i18n_audit.py --json          # machine-readable

WHY THIS EXISTS
`gen-l10n` does not fail on a missing key. It silently bakes the ENGLISH string
into the generated locale class. Verified on this repo: before the fix,
`app_localizations_kn.dart` returned the literal 'Voice mode' from the Kannada
class. So 476 keys x 10 locales were missing, half the UI rendered English in
every Indic locale, and `flutter analyze` plus all 1,750 tests stayed green.
Nothing in the toolchain could see it.

The second-order failure matters just as much. Once a fan-out of ten agents is
translating in parallel, the cheap way to make a key "present" is to copy the
English string into the locale file. The key count then reconciles, gen-l10n
reports zero untranslated, and the gate passes on a lie. Check 2 is what makes
the fan-out trustworthy; without it the whole exercise is theatre.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
ARB = APP_ROOT / "lib/core/i18n/arb"
ALLOWLIST = ARB / ".identical_allowlist"

# One Unicode block per locale. A translated string must contain at least one
# character from its own script — this is the check that separates a real
# translation from English wearing the key's name.
SCRIPT_RANGE = {
    "hi": ("ऀ", "ॿ"),  # Devanagari
    "mr": ("ऀ", "ॿ"),  # Devanagari
    "bn": ("ঀ", "৿"),  # Bengali
    "pa": ("਀", "੿"),  # Gurmukhi
    "gu": ("઀", "૿"),  # Gujarati
    "or": ("଀", "୿"),  # Odia
    "ta": ("஀", "௿"),  # Tamil
    "te": ("ఀ", "౿"),  # Telugu
    "kn": ("ಀ", "೿"),  # Kannada
    "ml": ("ഀ", "ൿ"),  # Malayalam
}

# Every locale here is a "one / other" language in CLDR. `=N` exact forms are
# also legal. Anything else — few, many, two, zero — is invented, and gen-l10n
# will emit it without complaint while the plural silently never matches.
LEGAL_PLURAL_CATEGORIES = {"one", "other", "zero", "two", "few", "many"}
EXPECTED_CATEGORIES = {"one", "other"}

PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
PLURAL_OPEN = re.compile(r"\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*,\s*plural\s*,")
EMOJI = re.compile(
    "[\U0001F000-\U0001FAFF☀-➿⬀-⯿︀-️]")
EM_DASH = "—"


def is_format_only(en_value: str) -> bool:
    """True when the English string carries no translatable word.

    Remove the placeholders and the ICU plural scaffolding; if no Latin letter
    survives, everything left is punctuation, digits or symbols, and the
    correct translation in every language is the identical string.
    """
    if not isinstance(en_value, str):
        return False
    if PLURAL_OPEN.search(en_value):
        return False  # plurals always contain prose in their branches
    stripped = PLACEHOLDER.sub("", en_value)
    return not re.search(r"[A-Za-z]", stripped)


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def keys_of(d: dict) -> dict:
    return {k: v for k, v in d.items() if not k.startswith("@")}


def plural_categories(value: str) -> list[str]:
    """Category names used inside a plural block, e.g. ['one','other']."""
    m = PLURAL_OPEN.search(value)
    if not m:
        return []
    # Scan the balanced braces after the plural marker.
    i = m.end()
    depth, out, token = 1, [], ""
    while i < len(value) and depth > 0:
        c = value[i]
        if c == "{":
            if depth == 1 and token.strip():
                out.append(token.strip())
            token = ""
            depth += 1
        elif c == "}":
            depth -= 1
        elif depth == 1:
            token += c
        i += 1
    return [t.lstrip("=") if t.startswith("=") else t for t in out]


def audit(locales: list[str] | None = None) -> dict:
    en_path = ARB / "app_en.arb"
    en = keys_of(load(en_path))

    allow = set()
    if ALLOWLIST.exists():
        allow = {l.split("#")[0].strip()
                 for l in ALLOWLIST.read_text(encoding="utf-8").splitlines()
                 if l.strip() and not l.lstrip().startswith("#")}
        allow.discard("")

    report: dict = {"templateKeys": len(en), "locales": {}, "totals": {
        "missing": 0, "extra": 0, "identical": 0, "placeholder": 0,
        "plural": 0, "emoji": 0, "emdash": 0}}

    for path in sorted(ARB.glob("app_*.arb")):
        loc = path.stem[4:]
        if loc == "en" or (locales and loc not in locales):
            continue
        cur = keys_of(load(path))
        rng = SCRIPT_RANGE.get(loc)
        script_re = re.compile(f"[{rng[0]}-{rng[1]}]") if rng else None

        missing = sorted(set(en) - set(cur))
        extra = sorted(set(cur) - set(en))
        identical, ph_bad, plural_bad, emoji_bad, emdash_bad = [], [], [], [], []

        for k, v in cur.items():
            if not isinstance(v, str):
                continue
            env = en.get(k)  # noqa: F841 — read by several checks below

            # 2. script coverage — present but English.
            #
            #    Format-only strings are exempt AUTOMATICALLY, not by a
            #    hand-kept list. Strip the placeholders from the English; if
            #    nothing alphabetic remains, there is no word to translate —
            #    '{used} / {limit}', '{chapter} ({year})', '•••• {last4}'.
            #
            #    This is not a convenience. The Hindi pilot showed the rule
            #    doing active harm without it: told every value must contain
            #    Devanagari, the translator invented words to satisfy it,
            #    turning '{points} / {max}' into '{points}/{max} अंक' and
            #    '{chapter} ({year})' into '{chapter} (वर्ष {year})' — adding
            #    text English never had, and contradicting the sibling key
            #    assessmentScannerMarks which ships as bare '{awarded}/{max}'.
            #    A hand-kept allowlist would have had to anticipate every such
            #    key across ten locales; deriving it cannot miss one.
            if k not in allow and env is not None and len(v) > 3:
                if not is_format_only(env) and v == env and (
                        script_re is None or not script_re.search(v)):
                    identical.append(k)

            # 3. placeholder parity
            if env is not None:
                if set(PLACEHOLDER.findall(v)) != set(PLACEHOLDER.findall(env)):
                    ph_bad.append(k)

            # 4. ICU plural validity
            if env is not None and PLURAL_OPEN.search(env):
                cats = set(plural_categories(v))
                if not PLURAL_OPEN.search(v):
                    plural_bad.append(f"{k} (plural block lost)")
                elif "other" not in cats:
                    plural_bad.append(f"{k} (no 'other' branch)")
                else:
                    bogus = {c for c in cats if not c.isdigit()} - LEGAL_PLURAL_CATEGORIES
                    if bogus:
                        plural_bad.append(f"{k} (invented category: {sorted(bogus)})")

            # 5. house style. Emoji are banned outright (token_guard §14 —
            #    Lucide icons only). The em-dash check is RELATIVE, not
            #    absolute: the English source itself uses em dashes in three
            #    strings, and the translations rightly preserve them. Flagging a
            #    translator for respecting the source's punctuation would be
            #    backwards — the no-em-dash house rule governs email and
            #    professional prose, not UI microcopy. What IS worth catching is
            #    a translation inventing punctuation the source never had.
            if EMOJI.search(v):
                emoji_bad.append(k)
            if EM_DASH in v and (env is None or EM_DASH not in env):
                emdash_bad.append(k)

        report["locales"][loc] = {
            "keys": len(cur), "missing": missing, "extra": extra,
            "identical": identical, "placeholderMismatch": ph_bad,
            "pluralInvalid": plural_bad, "emoji": emoji_bad, "emDash": emdash_bad,
        }
        t = report["totals"]
        t["missing"] += len(missing); t["extra"] += len(extra)
        t["identical"] += len(identical); t["placeholder"] += len(ph_bad)
        t["plural"] += len(plural_bad); t["emoji"] += len(emoji_bad)
        t["emdash"] += len(emdash_bad)

    return report


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--locales", help="comma-separated, e.g. hi,bn")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    locs = [x.strip() for x in a.locales.split(",")] if a.locales else None
    r = audit(locs)

    if a.json:
        print(json.dumps(r, ensure_ascii=False, indent=2))
    else:
        print(f"template: {r['templateKeys']} keys\n")
        print(f"{'locale':8} {'keys':>6} {'missing':>8} {'english':>8} "
              f"{'placehldr':>10} {'plural':>7} {'emoji':>6} {'emdash':>7}")
        for loc, d in r["locales"].items():
            print(f"{loc:8} {d['keys']:>6} {len(d['missing']):>8} "
                  f"{len(d['identical']):>8} {len(d['placeholderMismatch']):>10} "
                  f"{len(d['pluralInvalid']):>7} {len(d['emoji']):>6} "
                  f"{len(d['emDash']):>7}")
        t = r["totals"]
        print(f"\ntotals: missing={t['missing']} english={t['identical']} "
              f"extra={t['extra']} placeholder={t['placeholder']} "
              f"plural={t['plural']} emoji={t['emoji']} emdash={t['emdash']}")
        for loc, d in r["locales"].items():
            for label, items in (("MISSING", d["missing"]),
                                 ("ENGLISH", d["identical"]),
                                 ("PLACEHOLDER", d["placeholderMismatch"]),
                                 ("PLURAL", d["pluralInvalid"]),
                                 ("EMOJI", d["emoji"]), ("EM-DASH", d["emDash"])):
                if items and label != "MISSING":
                    print(f"  {loc} {label}: {', '.join(map(str, items[:8]))}"
                          f"{' …' if len(items) > 8 else ''}")

    t = r["totals"]
    return 1 if any(t[k] for k in t) else 0


if __name__ == "__main__":
    sys.exit(main())
