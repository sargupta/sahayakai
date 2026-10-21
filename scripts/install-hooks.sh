#!/usr/bin/env bash
# install-hooks.sh
#
# Points git's hook lookup at scripts/hooks/ for THIS WORKTREE ONLY, via a
# worktree-scoped `core.hooksPath` (requires extensions.worktreeConfig=true,
# already set on this repo). This is deliberately worktree-scoped rather than
# a repo-wide `git config core.hooksPath`: the git dir here is shared across
# every worktree of the sahayakai monorepo (`git worktree list` shows dozens),
# and this worktree's Flutter app lives at a different path
# (`sahayakai-flutter/`) than the convention the shared hook at
# `.git/hooks/pre-commit` expects (`sahayakai_mobile/`). A worktree-scoped
# override fixes that for this branch without touching any other worktree's
# hooks or the read-only sahayakai-main reference repo.
#
# Unlike sahayakai-main's install-hooks.sh (which COPIES scripts/hooks/* into
# .git/hooks/), this points hooksPath directly at the tracked scripts/hooks/
# directory — no copy step, so editing a hook here takes effect on the next
# commit with no re-install needed. Re-run this script only if hooksPath ever
# gets reset (e.g. `git worktree remove` + re-add).
#
# Hooks installed:
#   pre-commit  — flutter analyze + token_guard.sh (dart changes),
#                 check_i18n_gate.sh (T2-U8: Login/Onboarding i18n regression
#                 gate, arb changes)
#   commit-msg  — Conventional Commits format (mirrors sahayakai-main's)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"        # .../sahayakai-flutter/scripts
FLUTTER_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"        # .../sahayakai-flutter
WORKTREE_ROOT="$(cd "$FLUTTER_ROOT/.." && pwd)"     # .../wt-flutter-rebuild

cd "$FLUTTER_ROOT"

REL_HOOKS_DIR="$(basename "$FLUTTER_ROOT")/scripts/hooks"

if [[ ! -d "$FLUTTER_ROOT/scripts/hooks" ]]; then
  echo "✗ scripts/hooks/ not found under $FLUTTER_ROOT" >&2
  exit 1
fi

chmod +x "$FLUTTER_ROOT"/scripts/hooks/* "$FLUTTER_ROOT"/scripts/*.sh

git config --worktree core.hooksPath "$REL_HOOKS_DIR"

echo "✓ Installed worktree-scoped core.hooksPath = $REL_HOOKS_DIR"
echo "  (scoped to this worktree only: $WORKTREE_ROOT)"
echo ""
echo "Verify with:"
echo "  git config --get core.hooksPath   # should print: $REL_HOOKS_DIR"
echo ""
echo "Test:"
echo "  - Remove a translated key from an app_<locale>.arb file, stage it,"
echo "    and commit → check_i18n_gate.sh should reject it."
echo "  - Commit with a non-conventional message (e.g. 'fix stuff') →"
echo "    commit-msg should reject it."
echo "  - Override either: SKIP_COMMITLINT=1 git commit ..."
