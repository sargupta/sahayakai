#!/usr/bin/env bash
# Shared environment preamble for every loop script. Source it, never execute it.
#
# The `unset GIT_*` line is load-bearing, not hygiene: when a script is invoked
# from a git hook or from a shell that inherited a hook's environment, GIT_DIR
# and friends point at the *worktree toplevel*, and every `git` call from the
# app root then silently operates on the wrong index. The pre-commit hook in
# this repo documents the same hazard.
#
# GITPFX is equally load-bearing, and it applies ASYMMETRICALLY. The app root
# is one directory BELOW the worktree toplevel, and git treats the two
# directions differently:
#
#   OUTPUT is repo-root-relative  ->  `git status --porcelain` and
#                                     `git diff --name-only` print
#                                     `sahayakai-flutter/lib/main.dart`
#   PATHSPEC is CWD-relative      ->  `-- lib` from the app root is correct;
#                                     `-- sahayakai-flutter/lib` resolves to
#                                     sahayakai-flutter/sahayakai-flutter/lib
#                                     and silently matches NOTHING
#
# Getting this backwards does not error — it returns an empty set, so every
# check built on it reports "clean" forever. That is exactly how this repo's
# shared pre-commit hook once printed "✓ Pre-commit checks passed" without
# having run a single check, and it is how the first draft of this harness
# shipped a scope gate, a secret scanner and an auto-decay rule that were all
# no-ops. Rule: PATHSPECS UNPREFIXED, OUTPUT PARSED AS PREFIXED.
# `git add` takes a pathspec, so it is also unprefixed from the app root.

unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_PREFIX GIT_COMMON_DIR GIT_OBJECT_DIRECTORY

# Derive the roots from THIS file's location, never a hardcoded path: the loop
# scripts must run identically on a laptop, in CI (ubuntu-latest), and in a
# remote container. This file lives at <APP_ROOT>/scripts/loop/_env.sh, so the
# app root is two directories up. WT_TOPLEVEL is the git worktree root, and
# GITPFX is the app root's path relative to it (with a trailing slash) — the
# asymmetric prefix the comment above depends on, computed rather than pinned so
# it stays correct wherever the repo is checked out.
_ENV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export APP_ROOT="$(cd "$_ENV_DIR/../.." && pwd)"
export WT_TOPLEVEL="$(git -C "$APP_ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$APP_ROOT")"
_APP_REL="${APP_ROOT#"$WT_TOPLEVEL"}"
_APP_REL="${_APP_REL#/}"
export GITPFX="${_APP_REL:+$_APP_REL/}"
unset _ENV_DIR _APP_REL
export LOOP_BRANCH="feature/flutter-rebuild"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
if [ -d "/opt/homebrew/opt/openjdk@17" ]; then
  export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
  export PATH="$JAVA_HOME/bin:$PATH"
fi

export LOOP_DIR="$APP_ROOT/docs/flutter/loop"
export LOOP_STATE="$LOOP_DIR/LOOP_STATE.json"
export WAKE_LOG="$LOOP_DIR/WAKE_LOG.jsonl"
export CLAIMS_TSV="${CLAIMS_TSV:-$LOOP_DIR/CLAIMS.tsv}"

export UPLOAD_KEYSTORE="/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-android/mobile/android/app/upload.keystore"
export UPLOAD_KEYSTORE_PROPS="/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-android/mobile/android/keystore.properties"
