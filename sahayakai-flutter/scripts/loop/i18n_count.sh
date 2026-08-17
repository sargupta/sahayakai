#!/usr/bin/env bash
# Prints a single integer for CLAIMS.tsv. Two modes, because presence and
# translation are different things and only checking the first is how 4,760
# missing strings hid behind a green test suite.
#
#   untranslated  keys present in app_en.arb but ABSENT from a locale ARB,
#                 summed across all 10 Indic locales. `flutter gen-l10n` does
#                 NOT fail on these — it silently bakes the English string into
#                 the generated locale class, so analyze and every widget test
#                 stay green while half the UI renders English.
#
#   identical     keys PRESENT in a locale ARB whose value is byte-identical to
#                 English and contains no character from that locale's script.
#                 This is the check gen-l10n structurally cannot do, and it is
#                 what makes a parallel translation fan-out trustworthy: without
#                 it, an agent under time pressure copies the English string in,
#                 the key counts reconcile, and the gate passes on a lie.
#
# U0.6 replaces this with the fuller i18n_audit.py (placeholder parity, ICU
# plural categories, overflow probes). This file stays as the CLAIMS shim.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

MODE="${1:-untranslated}"

python3 - "$MODE" <<'PY'
import json, glob, os, re, sys

mode = sys.argv[1]
ARB = 'lib/core/i18n/arb'
en_path = os.path.join(ARB, 'app_en.arb')
if not os.path.exists(en_path):
    print(-1); raise SystemExit(0)

def keys(d):
    return {k: v for k, v in d.items() if not k.startswith('@')}

en = keys(json.load(open(en_path, encoding='utf-8')))

# Unicode blocks per locale. A translated string must contain at least one
# character from its own script; anything else is English wearing a hat.
SCRIPT = {
    'hi': r'ऀ-ॿ', 'mr': r'ऀ-ॿ',        # Devanagari
    'bn': r'ঀ-৿',                                 # Bengali
    'pa': r'਀-੿',                                 # Gurmukhi
    'gu': r'઀-૿',                                 # Gujarati
    'or': r'଀-୿',                                 # Odia
    'ta': r'஀-௿',                                 # Tamil
    'te': r'ఀ-౿',                                 # Telugu
    'kn': r'ಀ-೿',                                 # Kannada
    'ml': r'ഀ-ൿ',                                 # Malayalam
}

# Strings that are legitimately identical across languages: proper nouns,
# initialisms, and anything too short to carry script. Kept deliberately tiny —
# a generous allowlist defeats the whole check.
allow_path = os.path.join(ARB, '.identical_allowlist')
allow = set()
if os.path.exists(allow_path):
    allow = {l.strip() for l in open(allow_path, encoding='utf-8')
             if l.strip() and not l.startswith('#')}

total = 0
for path in sorted(glob.glob(os.path.join(ARB, 'app_*.arb'))):
    loc = os.path.basename(path)[4:-4]
    if loc == 'en':
        continue
    loc_keys = keys(json.load(open(path, encoding='utf-8')))
    if mode == 'untranslated':
        total += len([k for k in en if k not in loc_keys])
    else:
        rx = re.compile(f'[{SCRIPT.get(loc, "")}]') if SCRIPT.get(loc) else None
        for k, v in loc_keys.items():
            if k in allow or not isinstance(v, str) or len(v) <= 3:
                continue
            if v == en.get(k) and (rx is None or not rx.search(v)):
                total += 1

print(total)
PY
