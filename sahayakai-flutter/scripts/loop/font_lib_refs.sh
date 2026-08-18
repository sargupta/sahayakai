#!/usr/bin/env bash
# Prints the number of CODE references to google_fonts in lib/ (comments and
# generated files excluded). Zero means no app code path can trigger a runtime
# font fetch, regardless of whether the package is still a dependency.
#
# Deliberately scans ALL of lib/ — token_guard's scan_files helper excludes
# lib/core/theme/, which is exactly where GoogleFonts lived.
set -uo pipefail
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1
n="$(find lib -name '*.dart' ! -name '*.g.dart' ! -path 'lib/core/i18n/gen/*' -print0 \
     | xargs -0 grep -nE "GoogleFonts\.|import +'package:google_fonts" 2>/dev/null \
     | grep -vcE '^[^:]+:[0-9]+: *(///?|\*)' || true)"
printf '%s\n' "${n:-0}"
