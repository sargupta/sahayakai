import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'firebase_options.dart';
import 'src/core/theme/providers/theme_provider.dart';
import 'src/core/theme/app_theme.dart';
import 'src/core/error/connectivity_banner.dart';
import 'src/features/auth/router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Global error handlers ──────────────────────────────────────────────────

  // Flutter framework errors (widget build, layout, rendering).
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    if (kReleaseMode) {
      FirebaseCrashlytics.instance.recordFlutterFatalError(details);
    }
  };

  // Dart async errors that escape the zone (e.g. unawaited futures).
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    if (kDebugMode) {
      debugPrint('[Unhandled Error] $error\n$stack');
    } else {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
    }
    return true; // Handled — prevents default crash dialog.
  };

  // ── Firebase ───────────────────────────────────────────────────────────────
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // ── Crashlytics ─────────────────────────────────────────────────────────
  // Disable collection in debug to keep console clean.
  await FirebaseCrashlytics.instance
      .setCrashlyticsCollectionEnabled(kReleaseMode);

  // ── FCM Push Notifications ──────────────────────────────────────────────
  try {
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    final token = await messaging.getToken();
    debugPrint('[FCM] Token: $token');

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM] Foreground message: ${message.notification?.title}');
    });

    // Handle background message tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[FCM] Message opened app: ${message.data}');
    });
  } catch (e) {
    debugPrint('[FCM] Init error: $e');
  }

  runApp(const ProviderScope(child: SahayakApp()));
}

class SahayakApp extends ConsumerWidget {
  const SahayakApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sahayakThemeAsync = ref.watch(sahayakThemeProvider);
    final router = ref.watch(routerProvider);

    return sahayakThemeAsync.when(
      loading: () => const MaterialApp(
        home: Scaffold(
          body: Center(child: CircularProgressIndicator(color: Colors.orange)),
        ),
      ),
      error: (err, stack) => MaterialApp(
        home: Scaffold(
          body: Center(child: Text("Error loading theme: $err")),
        ),
      ),
      data: (sahayakTheme) {
        return MaterialApp.router(
          title: 'SahayakAI',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme.copyWith(
            extensions: [sahayakTheme],
          ),
          routerConfig: router,
          builder: (context, child) => ConnectivityBanner(
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
