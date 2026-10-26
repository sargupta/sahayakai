#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Token guard (DESIGN_RUBRIC.md §14): rejects off-token values in Flutter
# source so screens can't reintroduce the predecessor's design drift.
#
# Rejects, outside lib/core/theme/ and generated code:
#   - raw Color(0x...) literals            (colors must be theme roles/tokens)
#   - off-scale .circular(N) radii         (the v2 radius scale only)
#   - banned animation curves              (bounce*/elastic*/linear on reveals)
#   - emoji codepoints                     (Lucide icons only, no emoji)
#
#   - GoogleFonts.* anywhere in lib/       (fonts are bundled — see below)
#
# Rejects ANYWHERE in lib/ (theme included — that is where they lived):
#   - the retired pre-v2 saffron #E0924D   (design system v2: saffron-500 #C96A28)
#   - the retired Outfit / Inter families   (v2: Bricolage Grotesque / Instrument Sans)
#   - text under 12px and clamped text scaling (the 12px floor, 26 Oct 2026)
#   - a saffron-500 component fill          (labels sit on accent-fill)
#
# The second block exists because the founder rejected design system v1 for
# not matching the v3 mobile design: the app had kept a retired saffron
# (2.50:1) and the old faces. test/core/theme/design_tokens_parity_test.dart
# pins every token to the design system's tokens.json; this pins the retired
# values out of every other file, so they cannot come back as a literal.
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

# The design system v2 radius scale (tokens.json `radius-*`): xs 6, sm 8,
# option 10, row 12, field 14, tile 16, card 18, panel 20, scan 22, sheet 26,
# screen 38. Prefer the AppRadius names; a literal must still be on-scale.
hits=$(scan_files | xargs grep -nE '\.circular\(' 2>/dev/null \
  | grep -Ev '\.circular\((6|8|10|12|14|16|18|20|22|26|38)(\.0)?\)')
if [ -n "$hits" ]; then
  echo "VIOLATION: off-scale .circular() radius (v2 scale: 6/8/10/12/14/16/18/20/22/26/38)"; echo "$hits"; fail=1
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
  echo "  (pubspec.yaml flutter.fonts). Use kDisplayFamily / kUiFamily with"
  echo "  kIndicSansFallback. A runtime fetch breaks the offline first launch"
  echo "  and makes golden baselines non-deterministic."
  echo "$hits"; fail=1
fi

# Retired pre-v2 values, anywhere in lib/ (font_scan_files includes theme/).
hits=$(font_scan_files | xargs grep -niE 'E0924D' 2>/dev/null)
if [ -n "$hits" ]; then
  echo "VIOLATION: retired saffron #E0924D (2.50:1). Design system v2 saffron is"
  echo "  AppColors.saffron500 #C96A28 (fills) / saffron600 (text)."
  echo "$hits"; fail=1
fi

hits=$(font_scan_files | xargs grep -nE "fontFamily: *'(Outfit|Inter)'|'(Outfit|Inter)'" 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)')
if [ -n "$hits" ]; then
  echo "VIOLATION: retired font family Outfit/Inter. Design system v2 faces are"
  echo "  kDisplayFamily (Bricolage Grotesque) and kUiFamily (Instrument Sans)."
  echo "$hits"; fail=1
fi

# Pre-v2 decoration the design system does not have: the saffron gradient
# ribbon on cards and the hairline rule after an eyebrow. v2 GlassCard: "no
# coloured left-border accents"; v2 Eyebrow carries no rule.
hits=$(font_scan_files | xargs grep -nE 'accentBar|EditorialSectionHeader\([^)]*rule:' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)')
if [ -n "$hits" ]; then
  echo "VIOLATION: pre-v2 card ribbon / eyebrow rule. Design system v2 cards and"
  echo "  eyebrows carry no ribbons or rules (components/GlassCard, Eyebrow)."
  echo "$hits"; fail=1
fi

# 12px floor (design system, decided 26 Oct 2026): no text style smaller
# than 12px in any script, anywhere in lib/ (theme included, where the type
# scale lives), and the phone's own text size is respected: no clamped
# TextScaler.
hits=$(font_scan_files | xargs grep -nE 'fontSize:\s*([0-9]|1[01])(\.[0-9]+)?\b|_(ui|display)\(\s*([0-9]|1[01])(\.[0-9]+)?\s*,' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)')
if [ -n "$hits" ]; then
  echo "VIOLATION: text under the 12px floor (design system: 12px in every"
  echo "  script). Use an AppTypeTokens style; the smallest is 12px."
  echo "$hits"; fail=1
fi

hits=$(font_scan_files | xargs grep -nE 'maxScaleFactor|minScaleFactor|withClampedTextScaling|TextScaler\.noScaling' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)')
if [ -n "$hits" ]; then
  echo "VIOLATION: clamped text scaling. The app follows the phone's own text"
  echo "  size (no clamp); let the label wrap and its container grow instead."
  echo "$hits"; fail=1
fi

# White never sits on saffron-500 (3.77:1): a saffron fill under a label is
# AppColors.accentFill (saffron-600, 5.28:1). Statically, no component fill
# (backgroundColor / selectedColor) may be saffron-500 or the primary role;
# test/core/theme/saffron_fill_gate_test.dart catches the rest at render time.
hits=$(font_scan_files | xargs grep -nE '(backgroundColor|selectedColor)\s*:\s*[^,]*\b(saffron500|brandSaffron|lPrimary|AppColors\.accent|scheme\.primary|colorScheme\.primary)\b' 2>/dev/null \
  | grep -vE '^[^:]+:[0-9]+: *(///?|\*)' \
  | grep -vE 'accentFill|accentTint|withValues\(alpha|withAlpha|withOpacity')
if [ -n "$hits" ]; then
  echo "VIOLATION: a saffron-500 component fill. A fill that carries a label is"
  echo "  AppColors.accentFill (saffron-600, white on it 5.28:1)."
  echo "$hits"; fail=1
fi

if [ "$fail" -eq 0 ]; then echo "token-guard: PASS"; fi
exit "$fail"
