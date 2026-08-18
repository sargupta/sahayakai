#!/usr/bin/env bash
# Prints the number of ACTIVE lint rules in analysis_options.yaml.
#
# Commented-out rules do not count. Today every entry under `linter.rules` in
# this repo is commented out, and custom_lint + riverpod_lint sit in
# dev_dependencies with no `custom_lint` config block, so neither has ever run.
# The file therefore looks configured and enforces nothing beyond the default
# flutter_lints set.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

[ -f analysis_options.yaml ] || { echo 0; exit 0; }

awk '
  /^[[:space:]]*linter:[[:space:]]*$/        { in_linter = 1; next }
  in_linter && /^[[:space:]]*rules:[[:space:]]*$/ { in_rules = 1; next }
  # Any top-level key ends both blocks.
  /^[^[:space:]#]/                           { in_linter = 0; in_rules = 0 }
  in_rules && /^[[:space:]]*-[[:space:]]*[a-z_]+[[:space:]]*$/ { n++ }
  END { print n + 0 }
' analysis_options.yaml
