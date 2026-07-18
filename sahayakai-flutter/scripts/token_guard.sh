#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Token guard (DESIGN_RUBRIC.md §14): rejects off-token values in Flutter
# source so screens can't reintroduce the predecessor's design drift.
#
# Rejects, outside lib/core/theme/ and generated code:
#   - raw Color(0x...) literals            (colors must be theme roles/tokens)
#   - off-scale .circular(N) radii         (allowed: 8, 10, 12, 14, 16, 20)
#   - banned animation curves              (bounce*/elastic*/linear on reveals)
#   - emoji codepoints                     (Lucide icons only, no emoji)
#
# foundation-v1 note: the "no runtime GoogleFonts fetch" rule is intentionally
# NOT enforced yet — google_fonts runtime fetch is in use; bundling the TTFs as
# offline assets is a deferred hardening task (see docs/flutter/BUILD_STATE.json).
# Add that rule to this guard when the fonts are bundled.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."
LIB=lib
fail=0

scan_files() {
  find "$LIB" -name '*.dart' \
    ! -path "$LIB/core/theme/*" \
    ! -name '*.g.dart' \
    ! -path "$LIB/core/i18n/gen/*"
}

hits=$(scan_files | xargs grep -nE 'Color\(0x' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: raw Color(0x...) outside lib/core/theme/"; echo "$hits"; fail=1
fi

hits=$(scan_files | xargs grep -nE '\.circular\(' 2>/dev/null \
  | grep -Ev '\.circular\((8|10|12|14|16|20)(\.0)?\)')
if [ -n "$hits" ]; then
  echo "VIOLATION: off-scale .circular() radius (allowed 8/10/12/14/16/20)"; echo "$hits"; fail=1
fi

hits=$(scan_files | xargs grep -nE 'Curves\.(bounceIn|bounceOut|elasticIn|elasticOut|linear)' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: banned Curves.* (use AppMotion.easeOutQuart)"; echo "$hits"; fail=1
fi

hits=$(scan_files | xargs perl -ne 'print "$ARGV:$.: $_" if /[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE00}-\x{FE0F}]/' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: emoji codepoint in source (Lucide icons only)"; echo "$hits"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "token-guard: PASS"; fi
exit "$fail"
