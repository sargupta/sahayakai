import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:isar/isar.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/core/database/database_service.dart';

// ─── Image Cache Setup ──────────────────────────────────────────────────────
// Prevents Image.asset() from throwing in tests by providing a transparent image.

// ─── Test Widget Pumping Helper ─────────────────────────────────────────────

/// Wraps [child] in ProviderScope + MaterialApp.
/// Temporarily silences image loading errors from GlassScaffold's background image.
Future<void> pumpTestApp(
  WidgetTester tester,
  Widget child, {
  List<Override> overrides = const [],
}) async {
  final originalOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    final msg = details.exception.toString();
    if (msg.contains('Codec') || msg.contains('asset') || msg.contains('Unable to load')) {
      return; // Swallow image errors
    }
    if (originalOnError != null) originalOnError(details);
  };

  addTearDown(() {
    FlutterError.onError = originalOnError;
  });

  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: MaterialApp(
        home: child,
      ),
    ),
  );
}

// ─── Database Mocks ─────────────────────────────────────────────────────────

class MockIsar extends Mock implements Isar {}

class MockDatabaseService extends Mock implements DatabaseService {}
