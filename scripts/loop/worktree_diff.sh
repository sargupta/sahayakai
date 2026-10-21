#!/usr/bin/env bash
# Emits a unified-diff stream covering EVERYTHING a unit changed, including
# files git does not yet track.
#
# WHY THIS EXISTS
# `git diff HEAD` shows modifications to tracked files and nothing else. A
# brand-new file — which is most of what a build agent produces — is invisible
# to it. Both the secret scanner and the contradiction guard were built on
# `git diff HEAD` and therefore could not see a credential or a false comment
# in any newly created file. The self-test caught this by planting a violation
# in a new file and watching both guards report success.
#
# `git add -N` would also solve it, but it mutates the index, and loop_guard
# inspects the index for staged paths outside the app. This stays read-only:
# tracked changes come from git, untracked files are rendered as pure additions
# in the same `+++ b/<path>` / `+<line>` shape both parsers already expect.
#
#   $1  --worktree (default) = everything since HEAD
#       --staged             = only what is staged (untracked files excluded,
#                              since by definition they are not staged)
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

MODE="${1:---worktree}"

if [ "$MODE" = "--staged" ]; then
  git diff --cached -U6 -- .
  exit 0
fi

# Tracked modifications. Pathspec `.` is CWD-relative; output carries GITPFX.
git diff HEAD -U6 -- .

# Untracked files, rendered as additions so downstream parsers see them.
git ls-files --others --exclude-standard -- . | while IFS= read -r f; do
  [ -f "$f" ] || continue
  # Skip anything binary or oversized — a scanner is not a hex viewer, and a
  # multi-megabyte asset would swamp the signal.
  if [ "$(wc -c < "$f" | tr -d ' ')" -gt 262144 ]; then continue; fi
  if LC_ALL=C grep -qI . "$f" 2>/dev/null; then
    printf '+++ b/%s%s\n' "$GITPFX" "$f"
    sed 's/^/+/' "$f"
  fi
done
