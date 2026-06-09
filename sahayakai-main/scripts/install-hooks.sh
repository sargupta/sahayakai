#!/usr/bin/env bash
# install-hooks.sh
#
# Installs the SahayakAI git hooks by copying `scripts/hooks/*` into
# the repo's `.git/hooks/`.
#
# Run once after cloning, after a hook update, or after switching
# worktrees if the hooks seem stale.
#
# Hooks installed:
#   pre-commit  — runs:
#     1. Flutter analyze (only if sahayakai_mobile/* files are staged)
#     2. tsc --noEmit  (only if sahayakai-main/* files are staged)
#     3. scripts/audit-i18n-source.sh (only if web changed; blocks new
#        hard-coded user-visible JSX strings — see AGENTS.md gate 1)
#   commit-msg  — enforces Conventional Commits format on the subject
#     line. Allows merge/revert/fixup commits. Override per-commit with
#     SKIP_COMMITLINT=1 env. See docs/operations/BRANCHING.md.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$(cd "$(dirname "$0")"/hooks && pwd)"

install_hook() {
    local hook_name="$1"
    local src="${HOOKS_DIR}/${hook_name}"
    local dst="${REPO_ROOT}/.git/hooks/${hook_name}"

    if [[ ! -f "$src" ]]; then
        echo "✗ source hook not found at $src" >&2
        return 1
    fi

    cp "$src" "$dst"
    chmod +x "$dst"
    echo "✓ Installed ${hook_name} hook → $dst"
}

install_hook pre-commit
install_hook commit-msg

echo
echo "Verify with:"
echo "  ls -l ${REPO_ROOT}/.git/hooks/{pre-commit,commit-msg}"
echo
echo "Test:"
echo "  - Commit a file with a hard-coded JSX string in"
echo "    src/components/landing or src/components/community →"
echo "    pre-commit should reject it."
echo "  - Commit with a non-conventional message (e.g. 'fix stuff') →"
echo "    commit-msg should reject it."
echo "  - Override either: SKIP_COMMITLINT=1 git commit ..."
