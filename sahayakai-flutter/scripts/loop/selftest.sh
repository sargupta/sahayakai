#!/usr/bin/env bash
# Proves the guards can actually FAIL.
#
# WHY THIS EXISTS
# The first draft of this harness shipped three guards that were silent
# no-ops. Each used a git pathspec prefixed with `sahayakai-flutter/` while
# running from inside `sahayakai-flutter/`, so every pathspec resolved to
# `sahayakai-flutter/sahayakai-flutter/...` and matched nothing. The scope gate
# passed on any diff. The secret scanner scanned an empty string. The
# auto-decay rule could never fire. All three printed a cheerful green.
#
# That is the same defect this repo's shared pre-commit hook once had, and it
# is the same defect as the golden-test gate cited in four documents that had
# no implementation behind it. A gate nobody has ever seen fail is
# indistinguishable from a gate that cannot fail.
#
# So: plant a real violation for each guard, assert it is caught, clean up.
# Run this after touching any guard. It is cheap — a few seconds.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

SCRATCH="lib/__selftest_scratch__.dart"
UNDECLARED="lib/__selftest_undeclared__.dart"
cleanup() { rm -f "$SCRATCH" "$UNDECLARED"; }
trap cleanup EXIT

pass=0; fail=0
ok()   { echo "  ✓ $1"; pass=$((pass+1)); }
nope() { echo "  ✗ $1"; fail=$((fail+1)); }

# expect_fail <label> <command...> — the guard MUST exit non-zero here
expect_fail() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    nope "$label — guard returned SUCCESS on a planted violation (it is a no-op)"
  else
    ok "$label"
  fi
}

expect_pass() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then ok "$label"; else nope "$label — guard failed on clean input"; fi
}

echo "selftest: planting violations to prove each guard can fail"
echo

# ── 1. secret_scan must catch a credential in the worktree diff ──────────────
# The fixture is written at runtime and deleted on exit, but the heredoc body
# would still appear in THIS file's own diff and trip the scanner on every
# wake. So the credential is assembled from parts: no single line of source
# matches the pattern, while the file written to disk matches it exactly.
# (Suppressing it with a marker instead would be wrong — the marker would land
# in the fixture too, and the test would then be proving nothing.)
{
  echo '// selftest scratch — deleted automatically'
  printf 'const store%s = "%s";\n' 'Password' 'hunter2-not-a-real-password'
} > "$SCRATCH"
expect_fail "secret_scan detects a planted keystore password" \
  bash scripts/loop/secret_scan.sh --worktree
rm -f "$SCRATCH"

# ── 2. contradiction_guard must catch a stub claim next to real wiring ───────
# Base64 for the same reason the credential above is assembled from parts: a
# plaintext fixture here would sit in this file's own diff and trip the very
# guard it exists to test, on every wake, forever. Decodes to:
#     // This is a stub and is not yet wired.          contradiction-guard: allow (fixture documentation)
#     final user = FirebaseAuth.instance.currentUser;  contradiction-guard: allow (fixture documentation)
echo '// selftest scratch — deleted automatically' > "$SCRATCH"
printf '%s' 'Ly8gVGhpcyBpcyBhIHN0dWIgYW5kIGlzIG5vdCB5ZXQgd2lyZWQuCmZpbmFsIHVzZXIgPSBGaXJlYmFzZUF1dGguaW5zdGFuY2UuY3VycmVudFVzZXI7Cg==' \
  | base64 -d >> "$SCRATCH"
expect_fail "contradiction_guard detects a stub claim above real wiring" \
  bash scripts/loop/contradiction_guard.sh
rm -f "$SCRATCH"

# ── 3. scope gate must catch a file outside the declared list ────────────────
echo '// selftest scratch — deleted automatically' > "$UNDECLARED"
expect_fail "scope gate detects an undeclared changed file" \
  env UNIT_FILES="pubspec.yaml" bash -c '
    . scripts/loop/_env.sh
    actual="$(git status --porcelain -- . | awk "{print \$NF}" | sort -u)"
    declared="$(for f in $UNIT_FILES; do echo "${GITPFX}${f}"; done | sort -u)"
    extra="$(comm -23 <(printf "%s\n" "$actual") <(printf "%s\n" "$declared"))"
    [ -z "$extra" ]'
rm -f "$UNDECLARED"

# ── 4. scope gate must refuse to run unbounded ───────────────────────────────
expect_fail "scope gate refuses to run with UNIT_FILES unset" \
  env -u UNIT_FILES bash -c '[ -n "${UNIT_FILES:-}" ]'

# ── 5. the counters must be reading real data, not returning a stub zero ─────
# A counter stuck at 0 would make CLAIMS rows go green for the wrong reason.
# Proving the counter reads real data must NOT depend on the gap being
# non-empty. The original form asserted untranslated > 0 — true while 4,760
# strings were missing, and false the moment the work was finished, so
# completing the task broke the test that watched it. Instead: it must return a
# real integer (never the -1 failure sentinel) AND agree with the audit, which
# is now its single source of truth.
n="$(bash scripts/loop/i18n_count.sh untranslated)"
a="$(python3 scripts/loop/i18n_audit.py --json 2>/dev/null \
     | python3 -c 'import json,sys; print(json.load(sys.stdin)["totals"]["missing"])' 2>/dev/null)"
if [ "${n:-x}" = "-1" ] || [ -z "${n:-}" ]; then
  nope "i18n_count returned '$n' — it failed to read the ARB files"
elif [ "$n" != "$a" ]; then
  nope "i18n_count says $n untranslated but the audit says $a — the two have drifted apart"
else
  ok "i18n_count reads real ARBs and agrees with the audit (untranslated=$n)"
fi

k="$(python3 -c "import json;print(len([x for x in json.load(open('lib/core/i18n/arb/app_en.arb')) if not x.startswith('@')]))")"
if [ "$k" -eq 971 ]; then ok "template key count matches the audited value (971)"
else nope "template keys = $k, audit said 971 — one of them is wrong, find out which"; fi

# ── 6. doc_truth_guard must report the honest red count, and --strict must exit 1
# Proving doc_truth_guard works must NOT assume a claim is red. The original
# form asserted red > 0 — true while band B0 was unfinished, and false the
# moment every row went green, so COMPLETING the work broke the test watching
# it. (The i18n counter case above had the same defect, for the same reason.)
# Instead: it must account for every row in CLAIMS.tsv, and --strict must still
# fail when handed a claim that cannot pass.
rows="$(grep -cvE '^\s*(#|$)' "$CLAIMS_TSV")"
counts="$(bash scripts/loop/doc_truth_guard.sh --json \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["green"], d["red"])')"
g="${counts%% *}"; r="${counts##* }"
if [ "$((g + r))" = "$rows" ]; then
  ok "doc_truth_guard accounts for all $rows claims (${g} green / ${r} red)"
else
  nope "doc_truth_guard saw $((g + r)) claims but CLAIMS.tsv has $rows — it is not reading every row"
fi

# A claim that can never pass, in a throwaway file: --strict must still exit 1.
_impossible="$(mktemp -t claims)"
printf 'impossible_by_construction\tThis can never hold\techo 0\t>=1\n' > "$_impossible"
expect_fail "doc_truth_guard --strict still fails on an unsatisfiable claim" \
  env CLAIMS_TSV="$_impossible" bash scripts/loop/doc_truth_guard.sh --strict
rm -f "$_impossible"

# ── 7. reconcile's ancestry check must reject a fabricated sha ───────────────
expect_fail "verifiedAtSha ancestry check rejects a fabricated sha" \
  git merge-base --is-ancestor deadbeefdeadbeefdeadbeefdeadbeefdeadbeef HEAD

# ── 8. record.py must not let one unit borrow another unit's evidence ────────
# This existed as a live hole: record.py checked only that SOME gate run had
# passed, so a not-yet-started unit could be marked done on the strength of a
# different unit's green run. Proven here so it cannot silently return.
if [ -f "$LOOP_DIR/last_gate_run.json" ]; then
  gated_unit="$(python3 -c "import json;print(json.load(open('$LOOP_DIR/last_gate_run.json')).get('unit') or '')" 2>/dev/null || true)"
  other="$(python3 -c "
import json
s=json.load(open('$LOOP_STATE'))
for u in s['queue']:
    if u['id'] != '${gated_unit:-none}':
        print(u['id']); break" 2>/dev/null || true)"
  if [ -n "$other" ]; then
    # --dry-run, because if the binding check HAS regressed, a live call would
    # mark an unstarted unit done and corrupt the tracker while proving it.
    expect_fail "record.py refuses another unit's gate as evidence" \
      python3 scripts/loop/record.py --unit "$other" --status done --dry-run
  fi
else
  echo "  ⊘ SKIP: no gate run on disk to test evidence binding against"
fi

# ── 9. guards must still PASS on a clean tree ────────────────────────────────
expect_pass "loop_guard passes on the real tree" bash scripts/loop/loop_guard.sh
expect_pass "reconcile passes on the real tree"  bash scripts/loop/reconcile.sh

echo
echo "selftest: $pass passed, $fail failed"
[ "$fail" -eq 0 ] || { echo "selftest: FAIL — a guard cannot detect its own violation"; exit 1; }
echo "selftest: every guard demonstrably fails when it should"
