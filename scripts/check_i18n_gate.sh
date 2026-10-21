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
#   "Login + Onboarding" is NOT determined by key-name prefix. It used to be
#   (`key.startswith("login") or key.startswith("onboarding")`), and that was
#   a real bug: the onboarding profile step (lib/features/onboarding/
#   presentation/onboarding_screen.dart) calls plenty of keys named
#   `profile*` and `settings*` (field hints, validation errors, the admin-role
#   dropdown) that don't match either prefix. Those keys shipped untranslated
#   in all 10 non-English locales while this gate reported PASS, because the
#   prefix guess never looked at what the screen actually calls.
#
#   Instead, this gate builds the reachable-key-set by grepping the real
#   `l10n.<key>` call sites out of lib/features/onboarding/presentation/*.dart
#   (this already covers login_screen.dart, which lives in that directory —
#   the glob also reaches any nested subdirectory, and a repo-wide fallback
#   search catches login_screen.dart if it's ever moved elsewhere). That is
#   the actual set of keys Login + Onboarding can render. It then runs
#   `flutter gen-l10n --untranslated-messages-file=<tmp>` (via a temporary,
#   always-reverted l10n.yaml override — gen-l10n ignores CLI flags once
#   l10n.yaml exists) and fails if ANY of the 10 non-English locales has an
#   untranslated key that is IN that reachable-key-set.
#
# USAGE
#   bash scripts/check_i18n_gate.sh
#   Exit 0 = no key reachable from Login + Onboarding is untranslated
#            (baked-English) in any locale.
#   Exit 1 = at least one is — block the commit/CI run.
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."

L10N_YAML="l10n.yaml"
if [ ! -f "$L10N_YAML" ]; then
  echo "✗  i18n-gate: $L10N_YAML not found (expected at repo root)."
  exit 1
fi

ONBOARDING_DIR="lib/features/onboarding/presentation"
if [ ! -d "$ONBOARDING_DIR" ]; then
  echo "✗  i18n-gate: $ONBOARDING_DIR not found — cannot build the reachable-key-set."
  exit 1
fi

REPORT_DIR="$(mktemp -d)"
BACKUP_YAML="$REPORT_DIR/l10n.yaml.bak"
REPORT="$REPORT_DIR/untranslated.json"
GEN_LOG="$REPORT_DIR/gen_l10n.log"
SOURCE_FILES="$REPORT_DIR/source_files.txt"
REACHABLE_KEYS="$REPORT_DIR/reachable_keys.txt"

# Build the real reachable-key-set: every `l10n.<key>` call site inside the
# onboarding feature's presentation layer, plus a repo-wide fallback for
# login_screen.dart in case it's ever relocated out of that directory.
{
  find "$ONBOARDING_DIR" -type f -name '*.dart'
  find lib -type f -name 'login_screen.dart'
} | sort -u >"$SOURCE_FILES"

if [ ! -s "$SOURCE_FILES" ]; then
  echo "✗  i18n-gate: found no Dart source files to scan under $ONBOARDING_DIR."
  exit 1
fi

grep -hoE '\bl10n\.[A-Za-z0-9_]+' $(cat "$SOURCE_FILES") \
  | sed -E 's/^l10n\.//' \
  | sort -u >"$REACHABLE_KEYS"

reachable_count="$(wc -l <"$REACHABLE_KEYS" | tr -d ' ')"
if [ "$reachable_count" -eq 0 ]; then
  echo "✗  i18n-gate: scanned $(wc -l <"$SOURCE_FILES" | tr -d ' ') source file(s) but found zero"
  echo "   l10n.<key> call sites — that almost certainly means the scan is broken, not"
  echo "   that Login/Onboarding stopped using translations."
  exit 1
fi

echo "i18n-gate: reachable-key-set built from $(wc -l <"$SOURCE_FILES" | tr -d ' ') source file(s):"
sed 's/^/  - /' "$SOURCE_FILES"
echo "i18n-gate: $reachable_count distinct l10n key(s) reachable from Login + Onboarding:"
paste -sd, "$REACHABLE_KEYS" | fold -s -w 100 | sed 's/^/  /'

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

hits="$(python3 - "$REPORT" "$REACHABLE_KEYS" <<'PY'
import json, sys

report_path, reachable_path = sys.argv[1], sys.argv[2]

with open(report_path, encoding="utf-8") as f:
    data = json.load(f)

with open(reachable_path, encoding="utf-8") as f:
    reachable = {line.strip() for line in f if line.strip()}

bad = []
for locale, keys in sorted(data.items()):
    for key in keys:
        if key in reachable:
            bad.append(f"  {locale}: {key}")

print("\n".join(bad))
PY
)"

if [ -n "$hits" ]; then
  echo "✗  i18n-gate FAILED — key(s) reachable from Login + Onboarding are"
  echo "   untranslated (baked as English) in at least one locale:"
  echo "$hits"
  echo ""
  echo "   Add a real, natural translation for each key above to the matching"
  echo "   lib/core/i18n/arb/app_<locale>.arb file, then re-run:"
  echo "     flutter gen-l10n"
  exit 1
fi

echo "i18n-gate: PASS — no key reachable from Login + Onboarding is untranslated in any locale."
exit 0
