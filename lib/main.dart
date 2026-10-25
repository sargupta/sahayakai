import 'dart:ui';

import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/firebase/firebase_init.dart';
import 'core/notifications/notification_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // No font warm-up. The Latin and Noto Sans Indic families are bundled in the
  // APK (pubspec.yaml `flutter.fonts`) and registered by the engine at startup.
  await FirebaseInit.ensureInitialized();
  // Crashlytics: release-only, no PII. Never set user identifiers, custom keys,
  // or breadcrumbs that contain names, phone numbers, student data, audio, or
  // API keys.
  if (FirebaseInit.isConfigured) {
    await FirebaseCrashlytics.instance
        .setCrashlyticsCollectionEnabled(kReleaseMode);
    if (kReleaseMode) {
      FlutterError.onError =
          FirebaseCrashlytics.instance.recordFlutterFatalError;
      PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
        FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
        return true;
      };
    }
  }
  // Migrate: clear legacy theme preference (dark/system) so users land on light.
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('app_theme_mode');
  } catch (_) {}
  // Initialize notification service (channels, permission deferred to first use).
  try {
    await NotificationService.instance.initialize();
  } catch (_) {}
  runApp(const ProviderScope(child: SahayakApp()));
}