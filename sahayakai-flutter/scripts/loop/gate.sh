#!/usr/bin/env bash
# The gate ladder. Cheapest rung first, fail fast.
#
#   UNIT_FILES="lib/a.dart android/app/build.gradle.kts" \
#     bash scripts/loop/gate.sh standard
#
# Profiles (each is a superset of the one above it):
#   fast      docs / tracker-only units
#   standard  any Dart source unit
#   i18n      any unit touching lib/core/i18n/arb/**
#   native    any unit touching pubspec.* or android/**
#   release   band exits, and unit U0.4
#
# WHY `native` EXISTS AS ITS OWN PROFILE
# `flutter analyze` and `flutter test` run the analysis server and the test VM.
# Neither compiles the release kernel snapshot and neither invokes Gradle. This
# repo has already lost a build to exactly that blind spot: `record 5.2.1`
# capped `record_linux` below 1.0.0, resolving a stale sibling whose
# hasPermission signature no longer matched the platform interface. Analyze was
# clean, all tests were green, and `flutter build apk` was broken. So any unit
# touching pubspec or android/ must build an APK before it may be called done.
#
# WHY `release` RUNS AT UNIT U0.4 AND NOT ONLY AT THE END
# The hard deliverable is a genuinely signed AAB. Proving that capability at
# hour 8 is how you discover at 07:40 that the keystore alias is wrong and
# finish the run with nothing. It is proved at hour 1 and re-proved at each
# band exit.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

PROFILE="${1:-standard}"
RUN_LOG="${LOOP_DIR}/last_gate_run.json"
mkdir -p "$LOOP_DIR"

declare -a RESULTS=()
FAILED_RUNG=""
FAILED_TAIL=""

json_escape() { python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))'; }

# run <name> <command...>   — records duration + last 20 lines, halts on failure
run() {
  local name="$1"; shift
  local out rc start dur tail20
  start=$(date +%s)
  echo "── $name"
  out="$("$@" 2>&1)"; rc=$?
  dur=$(( $(date +%s) - start ))
  tail20="$(printf '%s\n' "$out" | tail -20)"
  printf '%s\n' "$out" | tail -6 | sed 's/^/   /'
  RESULTS+=("{\"gate\":\"$name\",\"exit\":$rc,\"durationSec\":$dur,\"tail\":$(printf '%s' "$tail20" | json_escape)}")
  if [ "$rc" -ne 0 ]; then
    FAILED_RUNG="$name"; FAILED_TAIL="$tail20"
    echo "   ✗ $name FAILED (exit $rc, ${dur}s)"
    finish 1
  fi
  echo "   ✓ $name (${dur}s)"
  return 0
}

# skip <name> <reason> — an honest non-result. Never recorded as a pass.
skip() {
  echo "── $1"
  echo "   ⊘ SKIP: $2"
  RESULTS+=("{\"gate\":\"$1\",\"exit\":null,\"skipped\":true,\"reason\":$(printf '%s' "$2" | json_escape)}")
}

finish() {
  local rc="$1"
  {
    # UNIT_ID is written into the evidence so record.py can refuse to accept
    # one unit's passing gate as proof for a different unit. Without this
    # binding, any unit could claim the most recent green run — which is how a
    # not-yet-started unit gets marked done.
    printf '{"unit":%s,"profile":"%s","atSha":"%s","atEpoch":%s,"exit":%s,' \
      "$( [ -n "${UNIT_ID:-}" ] && printf '%s' "$UNIT_ID" | json_escape || echo null )" \
      "$PROFILE" "$(git rev-parse HEAD)" "$(date +%s)" "$rc"
    printf '"failedRung":%s,"gates":[' \
      "$( [ -n "$FAILED_RUNG" ] && printf '%s' "$FAILED_RUNG" | json_escape || echo null )"
    local i
    for i in "${!RESULTS[@]}"; do [ "$i" -gt 0 ] && printf ','; printf '%s' "${RESULTS[$i]}"; done
    printf ']}\n'
  } > "$RUN_LOG"
  echo
  if [ "$rc" -eq 0 ]; then
    echo "gate[$PROFILE]: PASS — evidence in $RUN_LOG"
  else
    echo "gate[$PROFILE]: FAIL at '$FAILED_RUNG' — evidence in $RUN_LOG"
    echo "   the failing output is recorded verbatim; do not paraphrase it into the tracker"
  fi
  exit "$rc"
}

# --- scope: the diff may not stray outside the unit's declared files ---------
# Without this, a unit quietly grows ("while I was in there"), attribution for
# the next red gate is lost, and the two review agents lose the bounded diff
# that makes their job tractable.
gate_scope() {
  if [ -z "${UNIT_FILES:-}" ]; then
    echo "UNIT_FILES not set — scope gate cannot bound this unit"
    return 1
  fi
  # `-- .` is the app root (pathspecs are CWD-relative); the paths it PRINTS
  # are repo-root-relative and so carry GITPFX, which is why `declared` is
  # built with the prefix while the pathspec has none. See _env.sh.
  local actual declared preexisting extra
  actual="$(git status --porcelain -- . | awk '{print $NF}' | sort -u)"
  declared="$(for f in $UNIT_FILES; do echo "${GITPFX}${f}"; done | sort -u)"

  # Dirt that predates the loop is not this unit's doing. It is declared once,
  # in baselines.preexistingDirtyPaths, and owned by a specific unit (U0.2).
  # Subtracting it here keeps the gate honest about attribution WITHOUT the
  # softer alternative of widening UNIT_FILES, which would hide it.
  preexisting="$(python3 -c "
import json
try:
    s = json.load(open('$LOOP_STATE'))
    for p in s.get('baselines', {}).get('preexistingDirtyPaths', []):
        print(p)
except Exception:
    pass" 2>/dev/null | sort -u)"

  # The harness's own bookkeeping is rewritten by the `reconcile` rung, which
  # runs BEFORE this one — so the gate would otherwise flag the file it just
  # dirtied itself. Same narrow set reconcile.py excludes from auto-decay, and
  # for the same reason: these hold no logic, only state the harness recomputes.
  local bookkeeping="${GITPFX}docs/flutter/loop/LOOP_STATE.json
${GITPFX}docs/flutter/loop/WAKE_LOG.jsonl
${GITPFX}docs/flutter/loop/last_gate_run.json"

  extra="$(comm -23 <(printf '%s\n' "$actual") \
                    <(printf '%s\n%s\n%s\n' "$declared" "$preexisting" "$bookkeeping" | sort -u))"

  # A declared path may be a directory; treat any change beneath it as in scope.
  if [ -n "$extra" ] && [ -n "$UNIT_FILES" ]; then
    local remaining=""
    while IFS= read -r p; do
      [ -z "$p" ] && continue
      local matched=0
      for f in $UNIT_FILES; do
        case "$p" in "${GITPFX}${f}"/*|"${GITPFX}${f}") matched=1; break ;; esac
      done
      [ "$matched" -eq 0 ] && remaining="${remaining}${p}"$'\n'
    done <<< "$extra"
    extra="$(printf '%s' "$remaining" | sed '/^$/d')"
  fi

  if [ -n "$extra" ]; then
    echo "changed outside the declared file list:"
    printf '%s\n' "$extra" | sed 's/^/    /'
    echo "  declare them in the unit's files[], or split them into their own unit."
    return 1
  fi
  echo "all changes within the declared file list"
  [ -n "$preexisting" ] && echo "  (excluding $(printf '%s\n' "$preexisting" | wc -l | tr -d ' ') declared pre-existing dirty path(s))"
  return 0
}

gate_format() {
  local files
  files="$(git status --porcelain -- . | awk '{print $NF}' \
           | sed "s|^${GITPFX}||" | grep '\.dart$' | grep -v '\.g\.dart$' || true)"
  [ -z "$files" ] && { echo "no hand-written dart files changed"; return 0; }
  # shellcheck disable=SC2086
  dart format --output=none --set-exit-if-changed $files
}

gate_analyze() {
  local out
  out="$(flutter analyze 2>&1)"
  printf '%s\n' "$out" | tail -3
  printf '%s\n' "$out" | grep -qE '^(No issues found|No issues found!)' \
    || { printf '%s\n' "$out" | grep -E '^\s+(error|warning|info)' | head -20; return 1; }
}

# Asserts the generator is IDEMPOTENT against the current working tree: running
# it again changes nothing.
#
# The obvious check — compare .g.dart against HEAD — is wrong here, because the
# gate runs BEFORE the commit. A unit whose entire purpose is to commit
# regenerated output would fail a HEAD comparison by definition, and the only
# way to "pass" would be to commit first and gate afterwards, which defeats the
# gate. Idempotency is the property actually worth having: it catches source
# changed without a regen, and a .g.dart edited by hand, at any point in the
# cycle.
gate_codegen_drift() {
  local before after
  before="$(find lib -name '*.g.dart' -exec shasum {} + 2>/dev/null | shasum | awk '{print $1}')"
  dart run build_runner build --delete-conflicting-outputs >/dev/null 2>&1 || {
    echo "build_runner failed"; return 1; }
  after="$(find lib -name '*.g.dart' -exec shasum {} + 2>/dev/null | shasum | awk '{print $1}')"
  if [ "$before" != "$after" ]; then
    echo "re-running the generator CHANGED the tree — source and generated output disagree:"
    git status --porcelain -- ':(glob)lib/**/*.g.dart' | sed 's/^/    /'
    return 1
  fi
  echo "codegen is idempotent against the working tree"
}

gate_custom_lint() {
  grep -q 'custom_lint' analysis_options.yaml 2>/dev/null || return 2
  dart run custom_lint
}

gate_goldens() {
  local n
  n="$(grep -rho matchesGoldenFile test 2>/dev/null | wc -l | tr -d ' ')"
  [ "${n:-0}" -eq 0 ] && return 2
  flutter test --tags golden
}

gate_i18n_full() {
  local un id
  un="$(bash scripts/loop/i18n_count.sh untranslated)"
  id="$(bash scripts/loop/i18n_count.sh identical)"
  echo "untranslated=$un identical-to-english=$id"
  # During B0 this is a ratchet, not a cliff: the gate fails only if a unit made
  # things WORSE than the recorded baseline. The absolute target (both zero) is
  # enforced at the B0 exit unit. A hard zero-gate from day one would block
  # every unrelated commit behind a pre-existing 4,760-string backlog.
  local base_un base_id
  base_un="$(python3 -c "import json;print(json.load(open('$LOOP_STATE'))['baselines']['i18nUntranslated'])" 2>/dev/null || echo 999999)"
  base_id="$(python3 -c "import json;print(json.load(open('$LOOP_STATE'))['baselines']['i18nIdentical'])" 2>/dev/null || echo 999999)"
  if [ "$un" -gt "$base_un" ] || [ "$id" -gt "$base_id" ]; then
    echo "REGRESSION: baseline was untranslated=$base_un identical=$base_id"
    echo "a unit that adds an untranslated string widens the very gap B0 is closing"
    return 1
  fi
}

# A ratchet against baselines.testsFailing, not a hard zero.
#
# The suite starts with 13 genuinely failing tests (the Create-palette suite,
# broken when that widget was refactored into a private class in
# app_shell.dart). A hard zero-gate would block every unrelated unit behind
# them, and a gate that blocks everything gets bypassed — which is how those
# 13 came to be written off as "pre-existing, out of scope" in the first place.
#
# So: failures may not EXCEED the baseline, and the baseline only ever moves
# down. Unit U0.17 drives it to zero. Passing count must not fall either — that
# would catch a test being deleted or skipped to make this rung green.
gate_tests() {
  local out rc fails passes base summary
  out="$(flutter test --reporter compact --exclude-tags golden 2>&1)"; rc=$?

  # The EXIT CODE is the authority on pass/fail. The counts are for the ratchet
  # message only.
  #
  # An earlier version of this rung parsed counts with
  #     grep -oE '\-[0-9]+' | tail -1
  # over the whole output. The compact reporter rewrites one line with carriage
  # returns, so there are no line anchors to match, and that grep happily
  # scanned 300KB of unrelated text — it returned "-700" from a stray token and
  # reported a REGRESSION on a suite that had just passed 1750/0. A gate that
  # invents a failure destroys trust exactly as fast as one that hides a real
  # one, and it is likelier to get itself disabled.
  summary="$(printf '%s' "$out" | tr '\r' '\n' \
             | grep -E '^[0-9]{2}:[0-9]{2} \+[0-9]+' | tail -1)"
  [ -n "$summary" ] && echo "  $summary"

  passes="$(printf '%s' "$summary" | sed -nE 's/.*\+([0-9]+).*/\1/p')"
  fails="$(printf '%s' "$summary" | sed -nE 's/.* -([0-9]+):.*/\1/p')"
  passes="${passes:-0}"

  if [ "$rc" -eq 0 ]; then
    # flutter test exits 0 only when nothing failed. Trust that over any parse.
    fails=0
  else
    # Non-zero with an unparseable summary must fail closed, never open.
    fails="${fails:-999}"
  fi

  base="$(python3 -c "import json;print(json.load(open('$LOOP_STATE'))['baselines'].get('testsFailing',0))" 2>/dev/null || echo 0)"

  echo "passing=$passes failing=$fails (baseline failing=$base)"
  if [ "$fails" -gt "$base" ]; then
    echo "REGRESSION: $((fails - base)) test(s) newly failing"
    printf '%s\n' "$out" | grep -E 'The test description was:' | tail -20 | sed 's/^/    /'
    return 1
  fi
  if [ "$fails" -lt "$base" ]; then
    echo "IMPROVED: $((base - fails)) fewer failures than baseline — lower baselines.testsFailing to $fails in the same commit"
  fi
  return 0
}

gate_release_aab() { flutter build appbundle --release; }
gate_signature()   { bash scripts/loop/verify_aab_signer.sh; }

echo "gate[$PROFILE] @ $(git rev-parse --short HEAD)"
echo

# ── rungs common to every profile ───────────────────────────────────────────
run "guard"          bash scripts/loop/loop_guard.sh
run "reconcile"      bash scripts/loop/reconcile.sh
run "scope"          gate_scope
run "format"         gate_format
run "analyze"        gate_analyze
run "token_guard"    bash scripts/token_guard.sh
run "secret_scan"    bash scripts/loop/secret_scan.sh --worktree
run "contradiction"  bash scripts/loop/contradiction_guard.sh
run "doc_truth"      bash scripts/loop/doc_truth_guard.sh

case "$PROFILE" in
  fast) finish 0 ;;
esac

# ── standard and above ──────────────────────────────────────────────────────
run "codegen_drift"  gate_codegen_drift
if gate_custom_lint >/dev/null 2>&1; then run "custom_lint" gate_custom_lint
else skip "custom_lint" "no custom_lint block in analysis_options.yaml yet (unit U0.21)"; fi
run "tests"          gate_tests
if [ "$(grep -rho matchesGoldenFile test 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ]
  then run "goldens" gate_goldens
  else skip "goldens" "no matchesGoldenFile call sites exist yet (units U0.18/U0.19)"; fi

case "$PROFILE" in
  standard) finish 0 ;;
esac

run "i18n_full"      gate_i18n_full
case "$PROFILE" in
  i18n) finish 0 ;;
esac

run "build_apk_debug" flutter build apk --debug
case "$PROFILE" in
  native) finish 0 ;;
esac

run "build_aab_release" gate_release_aab
run "signature"         gate_signature
run "build_apk_release" flutter build apk --release --split-per-abi
finish 0
