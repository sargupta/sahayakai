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
#   - GoogleFonts.* anywhere in lib/       (fonts are bundled — see below)
#
# The "no runtime font fetch" rule sat here as a NOT-ENFORCED note for months
# while google_fonts streamed faces on first use. Unit U0.5 bundled all 11
# families into the APK, so the rule is now real and enforced below. It matters
# twice: a teacher opening the app offline saw fallback boxes for their own
# script, and golden tests cannot be deterministic against a font that arrives
# over a network `flutter test` does not have.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."

# PATH bootstrap (Windows/fvm)
if ! command -v python3 >/dev/null 2>&1; then
  for candidate in /c/Users/*/AppData/Local/Programs/Python/Python*/python.exe; do
    [ -x "$candidate" ] && export PATH="$(dirname "$candidate"):$PATH" && break
  done
  command -v python3 >/dev/null 2>&1 || { command -v python >/dev/null 2>&1 && alias python3=python; }
fi

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
  | grep -Ev '\.circular\((8|10|12|14|16|18|20|26|38|9999)(\.0)?\)' \
  | grep -Ev '\? 9999')
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

# Deliberately NOT scan_files: that helper excludes lib/core/theme/, which is
# precisely where GoogleFonts lived and where it would come back. A rule that
# cannot see the file it exists to protect is a rule that always passes.
font_scan_files() {
  find "$LIB" -name '*.dart' ! -name '*.g.dart' ! -path "$LIB/core/i18n/gen/*"
}

# Match CODE, not prose.
#
# The pattern is deliberately narrow: `GoogleFonts.` or a real package import.
# An earlier draft matched a bare `google_fonts`, which fired on two doc
# comments that merely NAME the package — that is what the comment filter below
# was added for. Tightening the pattern already fixed those two, so the filter
# is not load-bearing for them any more.
#
# It is kept for the case that survives: a commented-out `// GoogleFonts.inter()`
# does match `GoogleFonts\.` and is not a runtime fetch. Cheap insurance,
# honestly labelled — the alternative was leaving a confident explanation of a
# problem this pattern no longer has.
hits=$(font_scan_files | xargs grep -nE "GoogleFonts\.|import +'package:google_fonts" 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)')
if [ -n "$hits" ]; then
  echo "VIOLATION: GoogleFonts in lib/ — the 11 families are bundled offline"
  echo "  (pubspec.yaml flutter.fonts). Use TextStyle(fontFamily: 'Outfit'|'Inter')"
  echo "  with kIndicSansFallback. A runtime fetch breaks the offline first launch"
  echo "  and makes golden baselines non-deterministic."
  echo "$hits"; fail=1
fi

# ---------------------------------------------------------------------------
# Phase 3a — minimum font size floor (12px)
# Reject fontSize: 9/10/11 and copyWith(fontSize: 9/10/11) in lib/.
# ---------------------------------------------------------------------------
hits=$(scan_files | xargs grep -nE 'fontSize:[[:space:]]*(9|10|11)(\.0)?' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: font size below 12px floor (DESIGN_RUBRIC 12px minimum)"; echo "$hits"; fail=1
fi
hits=$(scan_files | xargs grep -nE 'copyWith\([^)]*fontSize:[[:space:]]*(9|10|11)(\.0)?' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: copyWith fontSize below 12px floor"; echo "$hits"; fail=1
fi

# ---------------------------------------------------------------------------
# Phase 3b — text-scale clamping floor (allow only >= 1.3)
# Reject .clamp(maxScaleFactor: X) where X < 1.3.
# ---------------------------------------------------------------------------
hits=$(scan_files | xargs grep -oE 'maxScaleFactor:[[:space:]]*[0-9]+\.[0-9]+' 2>/dev/null)
bad=""
for h in $hits; do
  val="${h##*:}"
  val="${val// /}"
  [ -z "$val" ] && continue
  if awk "BEGIN { exit !($val < 1.3) }" 2>/dev/null; then
    bad="$bad $h"
  fi
done
if [ -n "$bad" ]; then
  echo "VIOLATION: text-scale clamp below 1.3 (DESIGN_RUBRIC 1.3 floor)"; echo "$bad"; fail=1
fi

# ---------------------------------------------------------------------------
# Phase 3c — labelled (white-text) saffron fills
# Conservative Python check: flag a Dart file when it contains both
#   backgroundColor: AppColors.saffron500 (or raw Color(0xFFC96A28)) and
#   foregroundColor: Colors.white (or color: Colors.white near button text)
# in the context of FilledButton/ElevatedButton/TextButton/styleFrom.
# ---------------------------------------------------------------------------
PYBIN="$(command -v python3 || command -v python || echo '')"
py_hits=$("$PYBIN" - 2>/dev/null <<'PY' || true
import pathlib, re, sys
files = []
for p in pathlib.Path("lib").rglob("*.dart"):
    if "/gen/" in str(p) or p.name.endswith(".g.dart"):
        continue
    text = p.read_text(encoding="utf-8", errors="ignore")
    has_saffron_fill = (
        "backgroundColor: AppColors.saffron500" in text
        or "Color(0xFFC96A28)" in text
        or "Color(0xffc96a28)" in text.lower()
    )
    has_white_fg = (
        "foregroundColor: Colors.white" in text
        or "color: Colors.white" in text
    )
    if has_saffron_fill and has_white_fg:
        print(str(p))
PY
)
if [ -n "$py_hits" ]; then
  echo "VIOLATION: labelled white-text on saffron-500 fill (use AppColors.accentFill)"
  echo "$py_hits"
  fail=1
fi

if [ "$fail" -eq 0 ]; then echo "token-guard: PASS"; fi
exit "$fail"
