#!/bin/bash
# SahayakAI Brain Cleanup Utility
# Optimized for Token Efficiency

BRAIN_DIR="/Users/sargupta/.gemini/antigravity/brain/$CONVERSATION_ID"

echo "🧹 Starting Brain Cleanup..."

# 1. Prune resolved history versions
find "$BRAIN_DIR" -name "*.resolved.*" -type f -delete
echo "✅ Pruned old resolved versions."

# 2. Archive completed implementation plans
find "$BRAIN_DIR" -name "implementation_plan.md" -not -path "*/current/*" -type f -exec mv {} {}.archived \;
echo "✅ Archived old plans."

echo "✨ Brain is now lean and mean!"
