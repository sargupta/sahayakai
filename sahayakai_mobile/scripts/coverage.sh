#!/usr/bin/env bash
# Run Flutter tests with coverage, filter out stubs/generated files, generate HTML report.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Running flutter test --coverage..."
flutter test --coverage || true  # don't abort on test failures

LCOV_RAW="coverage/lcov.info"
LCOV_FILTERED="coverage/lcov_filtered.info"

if [ ! -f "$LCOV_RAW" ]; then
  echo "ERROR: $LCOV_RAW not found. Tests may have failed to produce coverage."
  exit 1
fi

echo "==> Filtering screens, generated files, platform-native services, and pure-UI widgets..."
lcov --remove "$LCOV_RAW" \
  '*/presentation/screens/*_screen.dart' \
  '*/presentation/home_screen.dart' \
  '*/src/features/presentation/*' \
  '*/src/features/data/auth_repository.dart' \
  '*/lesson_plan_schema.g.dart' \
  '*/exam_paper_schema.g.dart' \
  '*/core/database/database_service.dart' \
  '*/core/services/pdf_generator_service.dart' \
  '*/core/theme/widgets/studio_scaffold.dart' \
  '*/core/theme/widgets/magical_loading_orb.dart' \
  '*/core/theme/widgets/glass_container.dart' \
  '*/core/error/connectivity_banner.dart' \
  '*/presentation/widgets/app_drawer.dart' \
  '*/presentation/widgets/voice_input_widget.dart' \
  '*/features/auth/router/app_router.dart' \
  --output-file "$LCOV_FILTERED" \
  --ignore-errors unused

echo "==> Generating HTML report with branch coverage..."
genhtml "$LCOV_FILTERED" \
  --output-directory coverage/html \
  --branch-coverage \
  --title "SahayakAI Mobile Coverage"

echo ""
echo "==> Coverage report ready: coverage/html/index.html"
echo ""
# Print summary
lcov --summary "$LCOV_FILTERED" --branch-coverage 2>&1 | tail -5
