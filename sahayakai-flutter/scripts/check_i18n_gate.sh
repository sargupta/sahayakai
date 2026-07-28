#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# i18n regression gate (T2-U8): protects Login + Onboarding from silently
# regressing back to English.
#
# WHY THIS EXISTS
#   `flutter gen-l10n` does NOT fail the build on a missing key in a
#   non-English .arb file — it silently bakes the English string into the
#   generated locale class (e.g. AppLocalizationsHi.onboardingTitle would
#   read "Set up SahayakAI" in Hindi). That gap is invisible to
#   `flutter analyze` and to every widget/unit test, which is exactly how
#   every non-English .arb file in this repo ended up frozen at 436 keys
#   while app_en.arb quietly grew to ~938.
#
#   The remaining ~480-key backlog (Exam Paper, Parent Message, Dashboard
#   greeting, Profile, Settings, Library, Assess Assignment, ...) is real but
#   OUT OF SCOPE for this gate — it predates this unit and is tracked
#   separately (see the T2 audit report). A hard "zero untranslated keys,
#   period" gate would fail on that pre-existing backlog and block unrelated
#   commits. This gate is deliberately narrow: it protects only Login +
#   Onboarding, the screens this unit just brought to 100% coverage across
#   all 10 non-English locales, so a future edit can never silently
#   re-introduce an English string there without failing the commit/CI.
#
# WHAT IT CHECKS
#   Runs `flutter gen-l10n --untranslated-messages-file=<tmp>` (via a
#   temporary, always-reverted l10n.yaml override — gen-l10n ignores CLI
#   flags once l10n.yaml exists) and fails if ANY of the 10 non-English
#   locales still has an untranslated key whose name starts with "login" or
#   "onboarding".
#
# USAGE
#   bash scripts/check_i18n_gate.sh
#   Exit 0 = no Login/Onboarding key is untranslated (baked-English) in any
#            locale.
#   Exit 1 = at least one is — block the commit/CI run.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."

L10N_YAML="l10n.yaml"
if [ ! -f "$L10N_YAML" ]; then
  echo "✗  i18n-gate: $L10N_YAML not found (expected at repo root)."
  exit 1
fi

BACKUP_YAML="$(mktemp)"
REPORT_DIR="$(mktemp -d)"
REPORT="$REPORT_DIR/untranslated.json"
GEN_LOG="$REPORT_DIR/gen_l10n.log"

cleanup() {
  # Always restore l10n.yaml exactly and leave lib/core/i18n/gen/ in the
  # normal (no debug report) state, even on failure or interrupt.
  if [ -f "$BACKUP_YAML" ]; then
    cp "$BACKUP_YAML" "$L10N_YAML"
    rm -f "$BACKUP_YAML"
    flutter gen-l10n >/dev/null 2>&1 || true
  fi
  rm -rf "$REPORT_DIR"
}
trap cleanup EXIT

cp "$L10N_YAML" "$BACKUP_YAML"
printf 'untranslated-messages-file: %s\n' "$REPORT" >> "$L10N_YAML"

if ! flutter gen-l10n >"$GEN_LOG" 2>&1; then
  echo "✗  i18n-gate: flutter gen-l10n itself failed:"
  cat "$GEN_LOG"
  exit 1
fi

if [ ! -f "$REPORT" ]; then
  echo "✗  i18n-gate: flutter gen-l10n did not produce an untranslated-messages report."
  cat "$GEN_LOG"
  exit 1
fi

hits="$(python3 - "$REPORT" <<'PY'
import json, sys

with open(sys.argv[1], encoding="utf-8") as f:
    data = json.load(f)

bad = []
for locale, keys in sorted(data.items()):
    for key in keys:
        if key.startswith("login") or key.startswith("onboarding"):
            bad.append(f"  {locale}: {key}")

print("\n".join(bad))
PY
)"

if [ -n "$hits" ]; then
  echo "✗  i18n-gate FAILED — Login/Onboarding key(s) are untranslated (baked as"
  echo "   English) in at least one locale:"
  echo "$hits"
  echo ""
  echo "   Add a real, natural translation for each key above to the matching"
  echo "   lib/core/i18n/arb/app_<locale>.arb file, then re-run:"
  echo "     flutter gen-l10n"
  exit 1
fi

echo "i18n-gate: PASS — no Login/Onboarding key is untranslated in any locale."
exit 0
