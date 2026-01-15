#!/bin/bash

# Same locator logic
LOCATIONS=(
  "$HOME/flutter/bin/flutter"
  "$HOME/development/flutter/bin/flutter"
  "$HOME/Downloads/flutter/bin/flutter"
  "/opt/homebrew/bin/flutter"
  "/usr/local/bin/flutter"
)

FOUND=false

for FLUTTER in "${LOCATIONS[@]}"; do
  if [ -f "$FLUTTER" ]; then
    echo "Using: $FLUTTER"
    "$FLUTTER" clean
    "$FLUTTER" pub get
    "$FLUTTER" run -v
    FOUND=true
    break
  fi
done

if [ "$FOUND" = false ]; then
  echo "❌ Could not find flutter."
fi
