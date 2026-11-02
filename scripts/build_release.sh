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
# release.env.json holds public build config only (API_BASE_URL). Model keys
# live on the backend: anything passed as a --dart-define ships inside the AAB
# and can be read back out of it (P0.6).
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('release.env.json','utf8'));if(!j.API_BASE_URL||!String(j.API_BASE_URL).trim()){console.error('Missing or empty required release key: API_BASE_URL');process.exit(1);}const bad=Object.keys(j).filter(k=>/KEY|SECRET|TOKEN|PASSWORD|OPENROUTER/i.test(k)&&String(j[k]).trim());if(bad.length){console.error('release.env.json must not carry secrets (they ship in the AAB): '+bad.join(', '));process.exit(1);}" || exit 1
flutter build appbundle --release --dart-define-from-file=release.env.json
bash scripts/check_aab_secrets.sh build/app/outputs/bundle/release/app-release.aab
