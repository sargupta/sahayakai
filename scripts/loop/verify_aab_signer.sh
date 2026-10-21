#!/usr/bin/env bash
# Proves the release AAB is signed by the upload keystore — by comparing
# certificate fingerprints, not by trusting that the build "succeeded".
#
# This is the difference between a build that ran and an artifact Play will
# accept. `buildTypes.release.signingConfig = signingConfigs.getByName("debug")`
# (the untouched Flutter template, which this repo still ships) produces a
# release AAB that builds cleanly, installs cleanly, and is rejected on upload.
#
#   --quiet   print 1 (match) or 0 (no match / no artifact / no keystore)
#             for CLAIMS.tsv. Always exits 0 in this mode.
#   default   human-readable, exits non-zero on mismatch.
#
# Passwords are read into shell variables and never echoed.
set -uo pipefail
# shellcheck source=./_env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_env.sh"
cd "$APP_ROOT" || exit 1

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

say()  { [ "$QUIET" -eq 0 ] && echo "$@"; return 0; }
result() {  # $1 = 1|0
  if [ "$QUIET" -eq 1 ]; then echo "$1"; exit 0; fi
  [ "$1" = "1" ] && exit 0 || exit 1
}

AAB="build/app/outputs/bundle/release/app-release.aab"
if [ ! -f "$AAB" ]; then
  say "verify_aab_signer: no release AAB at $AAB (run: flutter build appbundle --release)"
  result 0
fi

# Prefer the LOCAL keystore + key.properties, because that is what Gradle
# actually signed with. Falling back to the Capacitor original would still
# compare equal today (it is a byte copy), but it would compare the AAB against
# a key the build never touched — and the whole point of this script is to stop
# trusting things that merely ought to be true.
KEYSTORE="$UPLOAD_KEYSTORE"
PROPS="$UPLOAD_KEYSTORE_PROPS"
if [ -f "android/key.properties" ] && [ -f "android/app/upload.keystore" ]; then
  KEYSTORE="android/app/upload.keystore"
  PROPS="android/key.properties"
  say "  using the local signing config (android/key.properties)"
fi

if [ ! -f "$KEYSTORE" ]; then
  say "verify_aab_signer: keystore not found at $KEYSTORE"
  result 0
fi

# Read credentials without ever printing them.
STORE_PASS=""; KEY_ALIAS=""
if [ -f "$PROPS" ]; then
  STORE_PASS="$(grep -E '^storePassword=' "$PROPS" | head -1 | cut -d= -f2-)"
  KEY_ALIAS="$(grep -E '^keyAlias=' "$PROPS" | head -1 | cut -d= -f2-)"
fi
[ -n "${KEYSTORE_STORE_PASS:-}" ] && STORE_PASS="$KEYSTORE_STORE_PASS"
[ -n "${KEYSTORE_KEY_ALIAS:-}" ] && KEY_ALIAS="$KEYSTORE_KEY_ALIAS"

if [ -z "$STORE_PASS" ]; then
  say "verify_aab_signer: no store password available (checked $PROPS and \$KEYSTORE_STORE_PASS)"
  result 0
fi

KS_SHA="$(keytool -list -v -keystore "$KEYSTORE" -storepass "$STORE_PASS" \
            ${KEY_ALIAS:+-alias "$KEY_ALIAS"} 2>/dev/null \
          | grep -m1 'SHA256:' | awk '{print $2}')"

AAB_SHA="$(keytool -printcert -jarfile "$AAB" 2>/dev/null \
          | grep -m1 'SHA256:' | awk '{print $2}')"

if [ -z "$KS_SHA" ]; then say "verify_aab_signer: could not read keystore certificate"; result 0; fi
if [ -z "$AAB_SHA" ]; then say "verify_aab_signer: AAB carries no readable signature — it is UNSIGNED"; result 0; fi

say "  keystore cert SHA-256: $KS_SHA"
say "  AAB signer  SHA-256:   $AAB_SHA"

if [ "$KS_SHA" = "$AAB_SHA" ]; then
  say "verify_aab_signer: MATCH — the AAB is signed with the upload key"
  result 1
fi
say "verify_aab_signer: MISMATCH — the AAB is NOT signed with the upload key"
say "  (a debug-signed release build looks identical until Play rejects it)"
result 0
