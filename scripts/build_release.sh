#!/usr/bin/env bash
# Release build for the INTERNAL TESTING track only.
# Requires android/app/upload.keystore + android/key.properties (never committed).
set -euo pipefail
cd "$(dirname "$0")/.."
# PATH bootstrap (Windows/fvm)
if ! command -v flutter >/dev/null 2>&1; then
  for candidate in "$HOME"/fvm/versions/*/bin; do
    [ -x "$candidate/flutter.bat" ] && export PATH="$candidate:$PATH" && break
  done
fi
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('release.env.json','utf8'));for(const k of ['OPENROUTER_API_KEY','API_BASE_URL']){if(!j[k]||!String(j[k]).trim()){console.error('Missing or empty required release key: '+k);process.exit(1);}}" || exit 1
flutter build appbundle --release --dart-define-from-file=release.env.json