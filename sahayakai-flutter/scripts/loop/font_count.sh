#!/usr/bin/env bash
# Prints a single integer for CLAIMS.tsv.
#
#   families           font families declared in pubspec.yaml's flutter.fonts block
#   google_fonts_dep   1 if the google_fonts package is still a dependency, else 0
#
# Two claims rather than one, because they fail differently. Bundling fonts
# while leaving google_fonts in pubspec means the app still CAN fetch at
# runtime; removing the dependency makes "no runtime fetch" enforceable by
# absence, which is stronger than any grep over lib/.
#
# This matters twice over: a teacher opening the app offline for the first time
# currently gets fallback boxes for every Indic script, and golden tests run
# with no network, so any baseline captured before fonts are bundled blesses
# those same boxes as the correct rendering.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

# NOTE: `grep -c` exits 1 when the count is zero, and this script runs under
# `set -o pipefail`, so a naive `grep -c ... || echo 0` emits BOTH the real "0"
# and the fallback "0" — the caller then reads "00". Capture first, default
# after; never pipe grep -c into a fallback.
count() {
  local n
  n="$(grep -cE "$1" pubspec.yaml 2>/dev/null || true)"
  n="$(printf '%s' "$n" | tr -dc '0-9')"
  printf '%s\n' "${n:-0}"
}

case "${1:-families}" in
  families)
    # Count `- family:` entries. Commented lines are excluded; a family behind
    # a `#` is a plan, not a bundled font.
    count '^[[:space:]]*-[[:space:]]*family:'
    ;;
  google_fonts_dep)
    count '^[[:space:]]{2}google_fonts:'
    ;;
  *)
    echo "usage: font_count.sh [families|google_fonts_dep]" >&2; exit 2 ;;
esac
