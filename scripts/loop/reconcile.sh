#!/usr/bin/env bash
# Thin wrapper so every caller uses the same interpreter and environment.
# All logic lives in reconcile.py — see its docstring for why.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1
exec python3 scripts/loop/reconcile.py "$@"
