#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Android build gate (PILLAR_BUILD_STATE.json guardrails).
#
# WHY THIS EXISTS
#   `flutter analyze` and `flutter test` are NECESSARY but NOT SUFFICIENT. They
#   run the Dart analysis server and the test VM — neither compiles the release
#   kernel snapshot or invokes Gradle. A federated plugin whose sibling platform
#   package is stale (e.g. record 5.2.1 pinning record_linux 0.7.2 against
#   record_platform_interface 1.6.0) passes analyze + test GREEN and still fails
#   `flutter build apk` at `kernel_snapshot_program`, because Flutter compiles
#   EVERY federated platform package's Dart into the kernel even for an
#   Android-only app. That mirage cost us a broken build. This gate closes it.
#
# WHEN TO RUN (acceptance gate, NOT the inner loop)
#   MANDATORY before landing any unit that touches native surface:
#     - pubspec.yaml / pubspec.lock (any plugin add / bump / override)
#     - android/** (manifest, Gradle, minSdk, desugaring, google-services.json)
#     - ios/** (Info.plist, Podfile) once an iOS target exists
#   The debug APK build is slow; do NOT wire it into every unit's fast loop.
#   Run it as the final gate for native-touching units and in CI.
#
# WHAT IT CHECKS (fail-fast, in cheapest-first order)
#   1. dart run build_runner build --delete-conflicting-outputs (clean)
#   2. flutter analyze                                          (0 issues)
#   3. bash scripts/token_guard.sh                              (tokens only)
#   4. flutter test                                             (all green)
#   5. flutter build apk --debug   <-- THE GATE analyze+test cannot replace
#
# Env (Android SDK + JDK 17) — override by exporting before calling.
#   export ANDROID_HOME="$HOME/Library/Android/sdk"
#   export JAVA_HOME="/opt/homebrew/opt/openjdk@17"
# ---------------------------------------------------------------------------
set -uo pipefail
cd "$(dirname "$0")/.."

: "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
: "${JAVA_HOME:=/opt/homebrew/opt/openjdk@17}"
export ANDROID_HOME JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

fail=0
step() { echo ""; echo "==> $1"; }

step "1/5 build_runner (codegen must be clean)"
dart run build_runner build --delete-conflicting-outputs || fail=1

step "2/5 flutter analyze (0 issues required)"
flutter analyze || fail=1

step "3/5 token_guard (design tokens only)"
bash scripts/token_guard.sh || fail=1

step "4/5 flutter test (full suite green)"
flutter test || fail=1

step "5/5 flutter build apk --debug (THE Android build gate)"
# This is the check analyze + test CANNOT substitute for: it compiles the
# kernel snapshot (catches stale federated-plugin Dart) and runs Gradle
# (catches minSdk / AGP / manifest-merge / desugaring breaks).
flutter build apk --debug || fail=1

echo ""
if [ "$fail" -ne 0 ]; then
  echo "verify_build: FAIL — Android build gate not satisfied."
  exit 1
fi
echo "verify_build: PASS — analyze + tokens + tests + debug APK all green."
