#!/usr/bin/env bash
# Prints a single integer for CLAIMS.tsv and the gate ladder.
#
#   untranslated  keys in app_en.arb absent from a locale ARB, summed over all 10
#   identical     keys present but carrying the English string
#
# THIS IS NOW A THIN SHIM OVER i18n_audit.py, NOT A SECOND IMPLEMENTATION.
# It used to carry its own copy of the script-coverage logic, and the two
# drifted the moment the audit learned to auto-detect format-only strings: the
# audit reported 0 English-identical while this reported 32, for the same tree,
# on the same day. Two tools answering the same question differently is how a
# gate ends up certifying whichever number is more convenient.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

MODE="${1:-untranslated}"
case "$MODE" in
  untranslated) FIELD=missing ;;
  identical)    FIELD=identical ;;
  *) echo "usage: i18n_count.sh [untranslated|identical]" >&2; exit 2 ;;
esac

python3 - "$FIELD" <<'PY'
import json, subprocess, sys, pathlib
field = sys.argv[1]
root = pathlib.Path.cwd()
try:
    out = subprocess.run(
        [sys.executable, "scripts/loop/i18n_audit.py", "--json"],
        cwd=root, capture_output=True, text=True, timeout=120).stdout
    print(json.loads(out)["totals"][field])
except Exception:
    print(-1)  # fail loud, never silently zero
PY
