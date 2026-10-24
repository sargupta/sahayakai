import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/firebase/firebase_init.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // No font warm-up. The Latin and Noto Sans Indic families are bundled in the
  // APK (pubspec.yaml `flutter.fonts`) and registered by the engine at startup.
  await FirebaseInit.ensureInitialized();
  // Migrate: clear legacy theme preference (dark/system) so users land on light.
  try {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('app_theme_mode');
  } catch (_) {}
  runApp(const ProviderScope(child: SahayakApp()));
}