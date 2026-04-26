#!/usr/bin/env bash
# install-hooks.sh
#
# Installs the SahayakAI pre-commit git hook by copying
# `scripts/hooks/pre-commit` into the repo's `.git/hooks/`.
#
# Run once after cloning, after a hook update, or after switching
# worktrees if the hook seems stale.
#
# The hook itself runs:
#   1. Flutter analyze (only if sahayakai_mobile/* files are staged)
#   2. tsc --noEmit  (only if sahayakai-main/* files are staged)
#   3. scripts/audit-i18n-source.sh (only if web changed; blocks new
#      hard-coded user-visible JSX strings — see AGENTS.md gate 1)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
SRC="$(cd "$(dirname "$0")"/hooks && pwd)/pre-commit"
DST="${REPO_ROOT}/.git/hooks/pre-commit"

if [[ ! -f "$SRC" ]]; then
    echo "✗ source hook not found at $SRC"
    exit 1
fi

cp "$SRC" "$DST"
chmod +x "$DST"

echo "✓ Installed pre-commit hook → $DST"
echo "  Source: $SRC"
echo
echo "Verify with:"
echo "  ls -l $DST"
echo "Test by committing a file with a hard-coded JSX string in"
echo "  src/components/landing or src/components/community — the"
echo "  commit should be rejected."
