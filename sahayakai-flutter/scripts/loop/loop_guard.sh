#!/usr/bin/env bash
# Blast-radius guard. Runs FIRST every wake, and again immediately before every
# commit. Any non-zero exit halts the loop — it does not warn.
#
# Every check here maps to a specific way this loop could damage something it
# was not asked to touch. Nothing is aspirational; if a rule cannot be checked
# mechanically it does not belong in this file, it belongs in the runbook.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || { echo "GUARD FAIL: cannot cd to APP_ROOT"; exit 1; }

fail=0
bad() { echo "GUARD FAIL: $1"; fail=1; }

# 1. Right tree, right branch, right remote.
[ "$(pwd -P)" = "$APP_ROOT" ] || bad "wrong cwd: $(pwd -P)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo UNKNOWN)"
[ "$BRANCH" = "$LOOP_BRANCH" ] || bad "wrong branch: $BRANCH (expected $LOOP_BRANCH)"
git remote get-url origin 2>/dev/null | grep -q 'sahayakai' || bad "unexpected origin remote"

# 2. Never on a protected branch, never detached.
case "$BRANCH" in
  main|develop|HEAD|UNKNOWN) bad "forbidden branch: $BRANCH" ;;
esac

# 3. Forensics: a forbidden git operation in recent history means the loop (or
#    something sharing this tree) already did what it must never do.
if git reflog -30 --format='%gs' 2>/dev/null | grep -qiE '^(merge|rebase)|reset: moving to .*--hard'; then
  bad "a merge/rebase/hard-reset appears in the last 30 reflog entries"
fi

# 4. Secret hygiene. These files must be gitignored BEFORE they are ever
#    written, and must never be tracked. Checked in both directions because
#    "gitignored" and "not tracked" are different failures.
for secret in android/key.properties android/app/upload.keystore android/app/keystore.properties; do
  if [ -f "$secret" ] && ! git check-ignore -q "$secret"; then
    bad "$secret exists but is NOT gitignored"
  fi
done
if git ls-files | grep -qE '(key\.properties|\.keystore|\.jks)$'; then
  bad "a keystore or key.properties file is TRACKED by git"
fi

# 5. Nothing staged outside this app.
if git diff --cached --name-only | grep -v "^${GITPFX}" | grep -q .; then
  bad "staged paths outside ${GITPFX}: $(git diff --cached --name-only | grep -v "^${GITPFX}" | tr '\n' ' ')"
fi

# 6. Sibling trees are not ours to disturb. The monorepo working tree carries
#    unrelated uncommitted work; dirtying it further would entangle this loop's
#    output with someone else's.
SIB_DIRTY="$(git -C /Users/sargupta/SahayakAIV2/sahayakai status --porcelain -- sahayakai-main sahayakai-agents 2>/dev/null | head -5)"
if [ -n "$SIB_DIRTY" ]; then
  echo "GUARD NOTE: sibling tree has pre-existing changes (not caused by this wake):"
  echo "$SIB_DIRTY" | sed 's/^/    /'
  echo "GUARD NOTE: the loop must not add to these. Web/sidecar units use a separate worktree."
fi

if [ "$fail" -eq 0 ]; then
  echo "loop_guard: OK (branch=$BRANCH head=$(git rev-parse --short HEAD))"
fi
exit "$fail"
