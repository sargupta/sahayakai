#!/bin/bash

# Try to find flutter in common locations
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
    echo "✅ Found Flutter at: $FLUTTER"
    echo "🛠️  Creating Android files..."
    "$FLUTTER" create .
    FOUND=true
    break
  fi
done

if [ "$FOUND" = false ]; then
  echo "❌ Could not find 'flutter' automatically."
  echo "Please locate your 'flutter' folder, open 'bin', and find the 'flutter' file."
  echo "Then run: /path/to/flutter/bin/flutter create ."
else
  echo "✅ Success! Android files created."
  echo "👉 Now press Play (F5) in VS Code!"
fi
