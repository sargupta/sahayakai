#!/bin/bash

# Define paths to search for Flutter
LOCATIONS=(
  "$HOME/flutter/bin/flutter"
  "$HOME/development/flutter/bin/flutter"
  "$HOME/Downloads/flutter/bin/flutter"
  "/opt/homebrew/bin/flutter"
  "/usr/local/bin/flutter"
)

FLUTTER_CMD=""

# Find Flutter
for LOC in "${LOCATIONS[@]}"; do
  if [ -f "$LOC" ]; then
    FLUTTER_CMD="$LOC"
    echo "✅ Found Flutter at: $FLUTTER_CMD"
    break
  fi
done

if [ -z "$FLUTTER_CMD" ]; then
  echo "❌ Could not find 'flutter'. Please install it or put it in one of these paths:"
  printf '%s\n' "${LOCATIONS[@]}"
  exit 1
fi

echo "🧹 Cleaning project..."
"$FLUTTER_CMD" clean
rm -rf pubspec.lock
rm -rf .dart_tool
rm -rf android/.gradle
rm -rf android/build

echo "📥 Getting dependencies..."
"$FLUTTER_CMD" pub get

echo "🧱 Generating Code (Isar)..."
"$FLUTTER_CMD" pub run build_runner build --delete-conflicting-outputs

echo "🏗️  Attempting Debug Build (Compilation Check)..."
"$FLUTTER_CMD" build apk --debug

if [ $? -eq 0 ]; then
  echo "🎉 BUILD SUCCESS! You can now press F5 in VS Code."
else
  echo "🔥 BUILD FAILED. Please copy the error message above."
fi
