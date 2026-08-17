#!/usr/bin/env python3
"""Emit a per-locale translation work packet, and seed the glossary from the
translations that already exist.

    python3 scripts/loop/i18n_extract_missing.py --locale hi --out <dir>
    python3 scripts/loop/i18n_extract_missing.py --glossary > GLOSSARY.md

WHY A PACKET INSTEAD OF THE ARB ITSELF
A translation agent handed an .arb file has to parse JSON, preserve 476 keys it
must not touch, and write valid JSON back. Every one of those is a chance to
corrupt a file that ten agents are working on in parallel. The packet is a flat
list of {key, en, description} — the agent returns translations and nothing
else, and this repo's own merge step writes the ARB.

WHY THE GLOSSARY IS EXTRACTED, NOT WRITTEN
Ten agents translating in parallel will invent ten words for "worksheet" unless
they are told which one this product already uses. The existing 495 translated
keys per locale are the answer: they were done in one pass by one translator
and are internally consistent. So the glossary is derived from them rather than
composed — it records what the product ALREADY says, which is the only
definition of "consistent" that means anything to a teacher reading the app.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
ARB = APP_ROOT / "lib/core/i18n/arb"

# The product's load-bearing nouns. If two locales disagree on any of these the
# app reads as though two different products were translated.
GLOSSARY_TERMS = [
    "SahayakAI", "VIDYA", "Staffroom", "Prep desk", "Parent Hotline",
    "lesson plan", "worksheet", "quiz", "rubric", "exam paper",
    "teacher training", "visual aid", "assessment", "attendance",
    "teacher", "student", "parent", "class", "subject", "grade",
    "library", "Create", "Home", "settings", "profile", "sign in",
]

LOCALE_NAMES = {
    "hi": "Hindi", "bn": "Bengali", "ta": "Tamil", "te": "Telugu",
    "kn": "Kannada", "ml": "Malayalam", "mr": "Marathi", "gu": "Gujarati",
    "pa": "Punjabi", "or": "Odia",
}


def load(loc: str) -> dict:
    return json.loads((ARB / f"app_{loc}.arb").read_text(encoding="utf-8"))


def keys_of(d: dict) -> dict:
    return {k: v for k, v in d.items() if not k.startswith("@")}


def packet(loc: str) -> list[dict]:
    raw_en = load("en")
    en = keys_of(raw_en)
    cur = keys_of(load(loc))
    out = []
    for k in en:
        if k in cur:
            continue
        meta = raw_en.get(f"@{k}", {}) or {}
        item = {"key": k, "en": en[k]}
        if meta.get("description"):
            item["description"] = meta["description"]
        ph = sorted(set(re.findall(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", str(en[k]))))
        if ph:
            item["placeholders"] = ph
        if re.search(r"\{\s*\w+\s*,\s*plural\s*,", str(en[k])):
            item["icuPlural"] = True
        out.append(item)
    return out


def glossary() -> str:
    en = keys_of(load("en"))
    locales = [l for l in LOCALE_NAMES if (ARB / f"app_{l}.arb").exists()]
    tr = {l: keys_of(load(l)) for l in locales}

    lines = [
        "# Translation glossary — locked",
        "",
        "**Generated** by `scripts/loop/i18n_extract_missing.py --glossary`.",
        "Do not hand-edit: regenerate it.",
        "",
        "Extracted from the translations this product ALREADY ships, not composed",
        "from a dictionary. The existing per-locale keys were produced in a single",
        "consistent pass, so they are the closest thing to a house style that exists.",
        "",
        "The point is narrow and important: ten agents translating in parallel will",
        "otherwise invent ten different words for *worksheet*, and a teacher moving",
        "between two screens will meet two different products. Where a row below is",
        "blank, no shipped string contained that term yet — the first translator to",
        "need it sets the precedent, and it should be added here afterwards.",
        "",
    ]

    for term in GLOSSARY_TERMS:
        # Find the shortest English string containing the term — short strings
        # are the ones where the term dominates, so the translation is the
        # clearest evidence of how it is rendered.
        cands = [k for k, v in en.items()
                 if isinstance(v, str) and term.lower() in v.lower() and len(v) < 60]
        cands.sort(key=lambda k: len(en[k]))
        row = None
        for k in cands:
            if all(k in tr[l] for l in locales):
                row = k
                break
        if row is None:
            continue
        lines.append(f"### {term}")
        lines.append("")
        lines.append(f"Evidence: `{row}` = {en[row]!r}")
        lines.append("")
        lines.append("| locale | shipped string |")
        lines.append("|---|---|")
        for l in locales:
            lines.append(f"| {LOCALE_NAMES[l]} ({l}) | {tr[l][row]} |")
        lines.append("")

    missing = [t for t in GLOSSARY_TERMS
               if not any(isinstance(v, str) and t.lower() in v.lower() and len(v) < 60
                          and all(k in tr[l] for l in locales)
                          for k, v in en.items())]
    if missing:
        lines += [
            "## No precedent yet",
            "",
            "No already-translated string contains these terms, so there is nothing",
            "to be consistent with. The first translator to need one decides, and",
            "should add it here so the other nine follow.",
            "",
            *(f"- {t}" for t in missing), "",
        ]
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--locale")
    ap.add_argument("--out")
    ap.add_argument("--glossary", action="store_true")
    a = ap.parse_args()

    if a.glossary:
        print(glossary())
        return 0
    if not a.locale:
        print("need --locale or --glossary", file=sys.stderr)
        return 2

    items = packet(a.locale)
    blob = json.dumps({"locale": a.locale,
                       "language": LOCALE_NAMES.get(a.locale, a.locale),
                       "count": len(items), "items": items},
                      ensure_ascii=False, indent=2)
    if a.out:
        p = Path(a.out) / f"packet_{a.locale}.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(blob, encoding="utf-8")
        print(f"{p} ({len(items)} keys)")
    else:
        print(blob)
    return 0


if __name__ == "__main__":
    sys.exit(main())
