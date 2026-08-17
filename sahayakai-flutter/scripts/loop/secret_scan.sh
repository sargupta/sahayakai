#!/usr/bin/env bash
# Greps the staged diff (or, with --worktree, the unstaged diff) for credentials.
# Deliberately narrow and high-signal: a noisy secret scanner gets ignored, and
# an ignored gate is worse than no gate.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

# Via worktree_diff.sh, which also renders UNTRACKED files as additions.
# `git diff HEAD` alone cannot see a new file, and a new file is most of what a
# build agent produces — that blind spot made this scanner a no-op until the
# self-test planted a password in a new file and watched it pass.
MODE="${1:---staged}"
DIFF="$(bash "$(dirname "${BASH_SOURCE[0]}")/worktree_diff.sh" "$MODE" 2>/dev/null)"

[ -z "$DIFF" ] && { echo "secret_scan: nothing to scan"; exit 0; }

# Added lines only — an existing secret is a separate (already-lost) battle, and
# flagging it every wake would train the loop to ignore this gate.
#
# Lines carrying the marker `secret-scan: allow <reason>` are dropped. Two
# things legitimately need it: this scanner's own patterns, and the self-test's
# planted fixture. Blanket-excluding those FILES would be the easy fix and the
# wrong one — a per-line marker with a stated reason stays greppable and
# auditable, and it cannot silently widen to cover a real credential added to
# the same file later.
ADDED="$(printf '%s\n' "$DIFF" | grep '^+' | grep -v '^+++' | grep -v 'secret-scan: allow')"

hits=0
flag() { echo "SECRET SCAN HIT [$1]:"; printf '%s\n' "$2" | sed 's/^/    /'; hits=1; }

# check <label> <pattern> [--case-sensitive]
# Credential names vary in case (storePassword, STORE_PASSWORD, storepass), so
# these match case-insensitively by default. Only key formats with a fixed
# prefix stay case-sensitive.
check() {
  local label="$1" pattern="$2" flagcs="${3:-}"
  local m
  if [ "$flagcs" = "--case-sensitive" ]; then
    m="$(printf '%s\n' "$ADDED" | grep -nE "$pattern" | head -5)"
  else
    m="$(printf '%s\n' "$ADDED" | grep -niE "$pattern" | head -5)"
  fi
  [ -n "$m" ] && flag "$label" "$m"
}

# The value may be bare or quoted. An earlier version of this pattern excluded
# a leading quote in an attempt to ignore env indirection like
# `storePassword=$STORE_PASS` — but that also excluded every quoted literal,
# which is the actual dangerous case, and made this scanner a no-op. Allow an
# optional quote, then require a character that is not `$` (env var), not `{`
# (gradle/property interpolation), and not `-` or `}` (which would match the
# `${VAR:-}` shell-default idiom on the `:` separator).
check "keystore password" '(store|key)_?pass(word)?[[:space:]]*[=:][[:space:]]*["'"'"']?[^-${}"'"'"'[:space:]]'
check "private key block" 'BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY'
check "google api key"    'AIza[0-9A-Za-z_-]{35}' --case-sensitive
check "service account"   '"private_key"[[:space:]]*:'
check "generic bearer"    '(secret|token|passwd|password|api_?key)[[:space:]]*[=:][[:space:]]*["'"'"'][A-Za-z0-9+/_-]{16,}'

if [ "$hits" -ne 0 ]; then
  echo "secret_scan: FAIL — a credential appears in the diff."
  echo "  If this is a false positive, it still must not be committed as-is:"
  echo "  move the value behind an env var or a gitignored properties file."
  exit 1
fi
echo "secret_scan: OK"
exit 0
