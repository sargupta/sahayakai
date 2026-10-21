#!/usr/bin/env python3
"""Merge a translation result file into a locale ARB.

    python3 scripts/loop/i18n_merge.py --locale hi --input <path/to/hi.json>

The translating agent never touches the ARB. It writes a flat {key: string}
JSON and this merges it, because ten agents editing shared JSON files in
parallel is a corruption risk with no upside — and because the merge can then
REFUSE anything that would damage the file:

  - a key not present in app_en.arb (invented)
  - a key already translated (this only fills gaps; it cannot overwrite
    existing work, so a bad run can never destroy a good one)
  - a non-string value
  - a placeholder set that differs from English

Key order follows app_en.arb so the diff is readable and stable across runs.
"""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[2]
ARB = APP_ROOT / "lib/core/i18n/arb"
PH = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--locale", required=True)
    ap.add_argument("--input", required=True)
    a = ap.parse_args()

    en_raw = json.loads((ARB / "app_en.arb").read_text(encoding="utf-8"))
    en = {k: v for k, v in en_raw.items() if not k.startswith("@")}
    path = ARB / f"app_{a.locale}.arb"
    cur = json.loads(path.read_text(encoding="utf-8"))

    incoming = json.loads(Path(a.input).read_text(encoding="utf-8"))
    if isinstance(incoming, dict) and "translations" in incoming:
        incoming = incoming["translations"]

    added, rejected = 0, []
    for k, v in incoming.items():
        if k not in en:
            rejected.append(f"{k}: not in app_en.arb"); continue
        if k in cur:
            rejected.append(f"{k}: already translated (merge never overwrites)"); continue
        if not isinstance(v, str) or not v.strip():
            rejected.append(f"{k}: empty or non-string"); continue
        if set(PH.findall(v)) != set(PH.findall(str(en[k]))):
            rejected.append(f"{k}: placeholder mismatch"); continue
        cur[k] = v; added += 1

    # Rebuild in app_en.arb order; keep @@locale and any @-metadata first.
    ordered = {k: v for k, v in cur.items() if k.startswith("@@")}
    for k in en:
        if k in cur:
            ordered[k] = cur[k]
    for k, v in cur.items():
        if k not in ordered:
            ordered[k] = v

    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
    print(f"merged {added} into app_{a.locale}.arb (now {len([k for k in ordered if not k.startswith('@')])} keys)")
    if rejected:
        print(f"REJECTED {len(rejected)}:")
        for r in rejected[:15]:
            print(f"  {r}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
