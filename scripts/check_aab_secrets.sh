#!/usr/bin/env bash
# Release gate: fail if a built AAB/APK carries a known secret format.
# Everything compiled into the app (dart-defines, assets, native resources) can
# be read back out of the bundle, so the bundle itself is what gets checked.
# Usage: bash scripts/check_aab_secrets.sh <path/to/app.aab|app.apk>
set -euo pipefail
bundle="${1:?usage: check_aab_secrets.sh <aab|apk>}"
[ -f "$bundle" ] || { echo "check_aab_secrets: no such file: $bundle"; exit 1; }

# Fixed-prefix key formats only, so a hit is a real key, not noise.
patterns='sk-or-v1-[0-9a-f]{32,}|sk-ant-[A-Za-z0-9_-]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
unzip -q -o "$bundle" -d "$tmp"

hits="$(grep -rlaE "$patterns" "$tmp" || true)"
if [ -n "$hits" ]; then
  echo "check_aab_secrets: FAIL - secret-shaped strings in $bundle:"
  printf '%s\n' "$hits" | sed "s|$tmp/|    |"
  echo "  Do not upload this build. Move the secret to the backend and rotate it."
  exit 1
fi
echo "check_aab_secrets: OK ($bundle)"
